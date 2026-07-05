// codex.ts — a ModelBackend over the ChatGPT-subscription Codex Responses API.
//
// This is NOT the platform OpenAI API. It calls chatgpt.com/backend-api/codex with
// a ChatGPT-account OAuth token (see codex-auth.ts) and bills against the user's
// ChatGPT plan, not a platform key. The wire contract is specific and was verified
// empirically against the live backend (it is documented NOWHERE — not in Hermes,
// not in OpenAI's API reference), one 400 at a time:
//
//   • MODEL — only `gpt-5.5` is accepted for a ChatGPT account. Every `gpt-5*-codex`,
//     `gpt-4o`, `o4-mini`, `codex-mini-latest` returns
//     "… model is not supported when using Codex with a ChatGPT account."
//   • STREAM-ONLY — a non-stream request 400s "Stream must be set to true". This is
//     WHY Hermes goes straight to the raw SSE iterator; it never had a one-shot path.
//   • TYPED INPUT — `input` must be a list of `{role, content:[{type:"input_text",
//     text}]}`. A bare string 400s "Input must be a list".
//   • STRUCTURED OUTPUT — no json_schema response_format on this path; ask for JSON
//     in the instructions and parse the streamed text (arrival's schema-blind tactic).
//
// The account gate accepts only a SMALL SET of model ids (verified live): `gpt-5.5`
// and `gpt-5.3-codex-spark` (a cheaper/faster tier) work; `gpt-5*-codex`, `gpt-4o`,
// `o4-mini`, `codex-mini-latest` are all 400 "not supported when using Codex with a
// ChatGPT account." So `spec.model` is HONORED when it names an accepted Codex id and
// otherwise falls back to `defaultModel` — a program naming a non-Codex token still
// routes to the default when this backend is bound. (An earlier version claimed a
// single-model hard gate; that was over-generalized from an incomplete probe set.)

import type { Completion, DeltaSink, ModelBackend, ModelSpec } from "../model.js";
import { parseChatPrompt, parseModelValue, renderSchema } from "./_shared.js";
import { resolveCodexCredential, CODEX_BASE_URL, type CodexCredential } from "./codex-auth.js";

/** Model ids the ChatGPT-account Codex backend accepts (verified live). The `-spark`
 *  tier is the cheaper/faster one — prefer it for tests and light work. */
export const CODEX_MODELS = ["gpt-5.5", "gpt-5.3-codex-spark"] as const;
/** Default when `spec.model` is not one of {@link CODEX_MODELS}. The cheap tier. */
export const CODEX_MODEL = "gpt-5.3-codex-spark";
/** Resolve the model to send: honor `spec.model` if the backend accepts it, else default. */
export const codexModelFor = (specModel: string): string =>
  (CODEX_MODELS as readonly string[]).includes(specModel) ? specModel : CODEX_MODEL;

export interface CodexOptions {
  /** Route the OAuth refresh ourselves (default). `false` requires a CLI-fresh
   *  token and never POSTs the credential — the caller runs `codex login`. */
  allowRefresh?: boolean;
  /** Override the fallback model (default {@link CODEX_MODEL}). Must be a
   *  {@link CODEX_MODELS} id or the backend will 400. */
  defaultModel?: string;
}

/** Strip a ```json … ``` fence if the model wrapped its JSON output. Exported for
 *  the unit test — the coercion is small but load-bearing on this schema-blind path. */
export function stripFence(text: string): string {
  const m = /^\s*```(?:json)?\s*\n([\s\S]*?)\n```\s*$/.exec(text.trim());
  return m ? m[1] : text.trim();
}

/** Lower a ModelSpec into the Codex Responses request body (the verified shape).
 *  Exported so the test can assert the hard constraints (accepted model / stream /
 *  typed input) without a live backend. `defaultModel` is the fallback when
 *  `spec.model` is not a {@link CODEX_MODELS} id. */
export function buildBody(
  spec: ModelSpec,
  defaultModel: string = CODEX_MODEL,
): { body: Record<string, unknown>; structured: boolean } {
  const messages = parseChatPrompt(spec.prompt) ?? [{ role: "user" as const, content: spec.prompt }];
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: [{ type: "input_text", text: m.content }] }));

  const schema = renderSchema(spec.schema);
  const schemaPreamble = schema
    ? `\n\nReturn ONLY a JSON object matching this schema, no prose:\n${JSON.stringify(schema)}`
    : "";
  const instructions = (system + schemaPreamble).trim();

  // Honor spec.model when the backend accepts it; else the default (see codexModelFor).
  const model = (CODEX_MODELS as readonly string[]).includes(spec.model) ? spec.model : defaultModel;

  return {
    body: {
      model,
      input,
      ...(instructions ? { instructions } : {}),
      store: false, // stateless: the whole context rides each call (replay-safe)
      stream: true, // MANDATORY on this backend
    },
    structured: Boolean(schema),
  };
}

/** The openai SDK's Responses `create({stream:true})` returns an async-iterable of
 *  raw SSE events. Assemble text from `output_text.delta`, usage off `completed`.
 *  We read the RAW events (not the SDK's typed `.stream()` helper, which
 *  reconstructs from `response.output` — a field this backend can leave null; the
 *  exact bug class Hermes documents sidestepping). */
async function streamText(
  client: ResponsesClient,
  body: Record<string, unknown>,
  onDelta?: DeltaSink,
): Promise<{ text: string; usage: CodexUsage | null; finish: string | null }> {
  const events = await client.responses.create({ ...body, stream: true });
  let text = "";
  let usage: CodexUsage | null = null;
  let finish: string | null = null;
  for await (const ev of events) {
    if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
      text += ev.delta;
      onDelta?.(ev.delta);
    } else if (ev.type === "response.completed" && ev.response?.usage) {
      usage = ev.response.usage;
    } else if (ev.type === "response.incomplete") {
      // A completed-but-truncated stream. NORMALIZE a length/token-cap cutoff to the
      // sentinel "length" — that's the ONLY value `coerceModelJson` treats as "do NOT
      // jsonrepair" (_shared.ts:62); the repair path would otherwise splice a truncated
      // JSON into garbage-that-parses instead of surfacing the truncation. (An adversarial
      // test caught this: without the normalization, a length-cut stream was silently
      // "recovered" into a wrong value rather than raising "raise max tokens".)
      const reason = ev.response?.incomplete_details?.reason ?? "incomplete";
      finish = /token|length|max/i.test(reason) ? "length" : reason;
    } else if (ev.type === "response.failed" || ev.type === "response.error") {
      // A server FAILURE event (policy/quota/backend) — the old loop dropped these,
      // so a blocked call became an empty-string "success". Surface the upstream cause.
      const err = ev.response?.error ?? ev.error;
      const msg = err?.message ?? err?.code ?? "unknown error";
      throw new Error(`Codex Responses stream failed: ${msg}`);
    }
  }
  return { text, usage, finish };
}

interface CodexUsage { input_tokens?: number; output_tokens?: number }
interface CodexError { message?: string; code?: string }
interface CodexEvent {
  type: string;
  delta?: string;
  error?: CodexError;
  response?: {
    usage?: CodexUsage;
    error?: CodexError;
    incomplete_details?: { reason?: string };
  };
}

/** The minimal Responses-stream client surface this backend needs (the openai SDK
 *  satisfies it at runtime). Named so the test can supply a fake. */
export interface ResponsesClient {
  responses: { create(body: unknown): Promise<AsyncIterable<CodexEvent>> };
}

/** Assemble a Completion from one streamed Codex response — the pure core, exported
 *  for the test. Given a resolved credential, a client built from it, and a spec:
 *  build the body, stream, parse. Refresh + client construction happen ABOVE this. */
export async function completeVia(
  client: ResponsesClient,
  spec: ModelSpec,
  onDelta?: DeltaSink,
  defaultModel: string = CODEX_MODEL,
): Promise<Completion> {
  const { body } = buildBody(spec, defaultModel);
  const { text, usage, finish } = await streamText(client, body, onDelta);
  // Route through the shared, tolerant coercion ladder (fenced / lightly-malformed /
  // reasoning-channel recovery) which raises a LEGIBLE cause on failure — instead of a
  // hand-rolled `JSON.parse(stripFence(...))` that threw "Unexpected end of JSON input"
  // with no model name or finish reason. `parseModelValue` returns text as-is when the
  // spec has no schema, so this one call handles both paths.
  const value = parseModelValue(spec, text, { finish });
  return { value, usage: { inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0 } };
}

/** Build the armed Responses client for a credential — the headers are the verified
 *  contract (chatgpt-account-id + originator). Exported so the test can assert them. */
export function clientHeaders(cred: CodexCredential): Record<string, string> {
  return {
    "chatgpt-account-id": cred.accountId,
    originator: "codex_cli_rs", // Codex CLI identity; the backend gates on it
  };
}

/** Seams the backend depends on, injectable for testing. Defaults are the real ones. */
export interface CodexDeps {
  /** Resolve (and refresh) the Codex credential. Default: {@link resolveCodexCredential}. */
  resolveCredential?: (opts: { allowRefresh?: boolean }) => Promise<CodexCredential>;
  /** Build a Responses client from a live credential. Default: the openai SDK. */
  makeClient?: (cred: CodexCredential) => ResponsesClient;
}

/**
 * A backend over the ChatGPT-subscription Codex Responses API. Requires a Codex
 * credential in ~/.codex/auth.json (run `codex login`). Bills against the ChatGPT
 * plan, not a platform key — see codex-auth.ts.
 *
 * The credential is resolved PER RUN, not once at construction: the token is a
 * short-lived JWT, so a long-lived backend must re-resolve (and let codex-auth
 * refresh) on each call rather than pin a stale client. `deps` is injectable for
 * tests; production uses the real resolver + openai SDK.
 */
export function codexBackend(opts: CodexOptions = {}, deps: CodexDeps = {}): ModelBackend {
  const resolveCredential = deps.resolveCredential ?? resolveCodexCredential;

  const makeClient =
    deps.makeClient ??
    (() => {
      // Lazily import the openai SDK once; reuse the loader across calls.
      let OpenAICtor: Promise<new (o: unknown) => unknown> | null = null;
      return (cred: CodexCredential): ResponsesClient => {
        // A tiny thunk that defers to the loaded SDK; the outer closure caches it.
        const client = (async () => {
          OpenAICtor ??= import("openai").then((m) => m.default as unknown as new (o: unknown) => unknown);
          const OpenAI = await OpenAICtor;
          return new OpenAI({
            apiKey: cred.accessToken,
            baseURL: cred.baseURL ?? CODEX_BASE_URL,
            defaultHeaders: clientHeaders(cred),
            maxRetries: 0, // the inference plane owns retry
          }) as ResponsesClient;
        })();
        // Adapt the async client to the sync ResponsesClient surface.
        return { responses: { create: async (body) => (await client).responses.create(body) } };
      };
    })();

  const defaultModel = opts.defaultModel ?? CODEX_MODEL;
  const run = async (spec: ModelSpec, onDelta?: DeltaSink): Promise<Completion> => {
    const cred = await resolveCredential({ allowRefresh: opts.allowRefresh });
    const client = makeClient(cred);
    return completeVia(client, spec, onDelta, defaultModel);
  };

  // Not wrapped in lazyBackend: resolution is already per-run and lazy (the SDK
  // import is deferred inside makeClient), and we want the fresh-credential-per-call
  // behavior lazyBackend's cache-once would defeat.
  return {
    complete: (spec) => run(spec),
    stream: (spec, onDelta) => run(spec, onDelta),
  };
}
