// codex.ts — a ModelBackend over the ChatGPT-subscription Codex Responses API.
//
// This is NOT the platform OpenAI API. It calls chatgpt.com/backend-api/codex with
// a ChatGPT-account OAuth token (see codex-auth.ts) and bills against the user's
// ChatGPT plan, not a platform key. The wire contract is specific and was verified
// empirically against the live backend (it is documented NOWHERE — not in Hermes,
// not in OpenAI's API reference), one 400 at a time:
//
//   • MODEL — the account gate accepts a SMALL SET (see CODEX_MODELS): `gpt-5.5`
//     and `gpt-5.3-codex-spark`. `gpt-5*-codex`, `gpt-4o`, `o4-mini`,
//     `codex-mini-latest` all return
//     "… model is not supported when using Codex with a ChatGPT account."
//     (This bullet once said "only gpt-5.5" — over-generalized from an incomplete
//     probe set, and it kept saying so AFTER the paragraph below corrected it: the
//     same comment-rot class twice in one header. Round-2 review, 2026-07-06.)
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
import { mergeSystem, parseModelValue, renderSchema, specMessages, streamGuard } from "./_shared.js";
import { resolveCodexCredential, type CodexCredential } from "./codex-auth.js";

/** Model ids the ChatGPT-account Codex backend accepts (verified live). The `-spark`
 *  tier is the cheaper/faster one — prefer it for tests and light work. */
export const CODEX_MODELS = ["gpt-5.5", "gpt-5.3-codex-spark"] as const;
/** Default when `spec.model` is not one of {@link CODEX_MODELS}. The cheap tier. */
export const CODEX_MODEL = "gpt-5.3-codex-spark";
/** Resolve the model to send: honor `spec.model` if the backend accepts it, else
 *  `defaultModel` (the backend's configured fallback; {@link CODEX_MODEL} when unset). */
export const codexModelFor = (specModel: string, defaultModel: (typeof CODEX_MODELS)[number] = CODEX_MODEL): string =>
  (CODEX_MODELS as readonly string[]).includes(specModel) ? specModel : defaultModel;

export interface CodexOptions {
  /** Route the OAuth refresh ourselves (default). `false` requires a CLI-fresh
   *  token and never POSTs the credential — the caller runs `codex login`. */
  allowRefresh?: boolean;
  /** Override the fallback model (default {@link CODEX_MODEL}). Typed to the
   *  accepted set — the doc used to say "must be a CODEX_MODELS id" while the
   *  `string` type let any typo through to a guaranteed 400 on every fallback. */
  defaultModel?: (typeof CODEX_MODELS)[number];
}

/** Lower a ModelSpec into the Codex Responses request body (the verified shape).
 *  Exported so the test can assert the hard constraints (accepted model / stream /
 *  typed input) without a live backend. `defaultModel` is the fallback when
 *  `spec.model` is not a {@link CODEX_MODELS} id.
 *
 *  KNOWN LIMITATION — `spec.maxTokens` and `spec.temperature` are deliberately NOT
 *  sent. The wire contract of chatgpt.com/backend-api/codex is documented nowhere
 *  and was established one 400 at a time; `max_output_tokens`/`temperature` are
 *  standard *platform* Responses fields but have never been probed against THIS
 *  gate, and a rejected field would 400 every call — bricking the backend is worse
 *  than an unenforced cap. So the spend ceiling is NOT honored on this path (the
 *  plan-billed plane has no per-token spend anyway) and sampling runs at the
 *  endpoint default. To lift: probe each field live with a `codex login`
 *  credential, then thread it here and flip the exclusion tripwires in
 *  codex-backend.test.ts. `spec.tools` is held to a STRICTER bar: REFUSED with a
 *  throw, not silently excluded — see the guard in the function body. */
export function buildBody(spec: ModelSpec, defaultModel: (typeof CODEX_MODELS)[number] = CODEX_MODEL): Record<string, unknown> {
  // spec.tools is REFUSED, not dropped. Tools are CONTENT-KEYED (model.ts: "different
  // tools can change the completion") and the agentic loop treats a no-tool-call turn
  // as the FINAL answer — so silently de-tooling a spec doesn't degrade, it
  // FABRICATES: the model answers from priors, the loop concludes with zero
  // dispatches, and the result is indistinguishable from a real finish. Tool-calling
  // is unprobed against this gate (same evidence bar as the maxTokens/temperature
  // exclusion above), but unlike an unenforced cap the failure mode is silent-wrong,
  // so it throws. To lift: probe the platform `tools` field live against
  // chatgpt.com/backend-api/codex, lower ToolDescriptors here, and flip the tripwire
  // in codex-backend.test.ts. (Round-2 review, 2026-07-06.)
  if (spec.tools?.length) {
    throw new Error(
      `codex backend cannot honor spec.tools (${spec.tools.length} declared): tool-calling is ` +
        `unprobed on the ChatGPT-account Codex plane, and a silently tool-less agentic answer ` +
        `would be indistinguishable from a real one — bind a tool-capable backend for agentic specs.`,
    );
  }
  const messages = specMessages(spec); // the shared spec→messages lowering — backends must not drift on it

  const schema = renderSchema(spec.schema);
  const schemaPreamble = schema
    ? `Return ONLY a JSON object matching this schema, no prose:\n${JSON.stringify(schema)}`
    : undefined;
  // ONE system instruction in the canonical persona · call · format order —
  // `spec.system` (the `(llm/with … :system …)` persona) rides `instructions`, a
  // field the verified contract already uses. The hand-rolled filter this replaces
  // silently DROPPED the persona.
  const { systemText, messagesWithoutSystem } = mergeSystem({
    messages,
    persona: spec.system,
    schemaPreamble,
  });
  const input = messagesWithoutSystem.map((m) => ({
    role: m.role,
    content: [{ type: "input_text", text: m.content }],
  }));

  return {
    model: codexModelFor(spec.model, defaultModel),
    input,
    ...(systemText ? { instructions: systemText } : {}),
    store: false, // stateless: the whole context rides each call (replay-safe)
    stream: true, // MANDATORY on this backend
  };
}

/** The openai SDK's Responses `create({stream:true})` returns an async-iterable of
 *  raw SSE events. Assemble text from `output_text.delta`, usage off `completed`.
 *  We read the RAW events (not the SDK's typed `.stream()` helper, which
 *  reconstructs from `response.output` — a field this backend can leave null; the
 *  exact bug class Hermes documents sidestepping).
 *
 *  `signal` is the CALLER's abort (infer-store releases the last subscriber →
 *  the billed Codex request must die, not run to completion). The shared
 *  {@link streamGuard} rides on top of it: idle window re-armed on every event
 *  (the openai SDK's timeout is cleared once response HEADERS arrive and never
 *  guards body reads) + total deadline, and every stream step is RACED against
 *  abort so an SDK (or fake) that ignores the signal still can't wedge us. */
async function streamText(
  client: ResponsesClient,
  body: Record<string, unknown>,
  onDelta?: DeltaSink,
  signal?: AbortSignal,
): Promise<{ text: string; usage: CodexUsage | null; finish: string | null }> {
  const guard = streamGuard("codex", signal);
  let text = "";
  let usage: CodexUsage | null = null;
  let finish: string | null = null;
  let it: AsyncIterator<CodexEvent> | undefined;
  try {
    const events = await guard.race(client.responses.create(body, { signal: guard.signal }));
    guard.armIdle(); // first-event deadline
    it = events[Symbol.asyncIterator]();
    for (;;) {
      const r = await guard.race(it.next());
      if (r.done) break;
      const ev = r.value;
      guard.armIdle(); // ANY event counts as liveness — deltas, reasoning, keep-alives
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
      } else if (ev.type === "response.failed" || ev.type === "error") {
        // A server FAILURE event (policy/quota/backend) — the old loop dropped these,
        // so a blocked call became an empty-string "success". Surface the upstream cause.
        // TWO wire shapes (openai@6 responses.d.ts): `response.failed` nests the error
        // as `response.error`; the top-level ResponseErrorEvent is `type: "error"` —
        // documented "Always `error`", NOT "response.error" (a name that exists in no
        // protocol version; the guard shipped matching that fiction and reading a
        // nested `ev.error`, so a real mid-stream `error` event fell through EVERY
        // arm: partial text resolved as success, and a schema'd truncation was
        // jsonrepair'd into a plausible WRONG value. Round-2 review kill-probe,
        // 2026-07-06). The `error` event carries code/message FLAT on the event.
        const err = ev.response?.error ?? (ev.type === "error" ? ev : undefined);
        const msg = err?.message ?? err?.code ?? "unknown error";
        throw new Error(`Codex Responses stream failed: ${msg}`);
      }
    }
  } finally {
    guard.done();
    // Close the iterator on EVERY exit. The openai SDK's stream generator tears its
    // transport down in its own `finally { … abort() }` — which only runs once the
    // iterator is CLOSED. The for-await this manual loop replaced did that on throw
    // automatically; the manual shape must do it by hand, or the throw paths above
    // (failure event, guard abort) leave the SSE socket open, trusting the server to
    // hang up. Fire-and-forget + swallow: closing a dead iterator must never mask the
    // real error. (Round-2 review, 2026-07-06.)
    void it?.return?.().catch(() => {});
  }
  return { text, usage, finish };
}

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
}
interface CodexError {
  message?: string;
  code?: string;
}
interface CodexEvent {
  type: string;
  delta?: string;
  /** FLAT payload of a top-level `error` event (ResponseErrorEvent). */
  message?: string;
  code?: string;
  response?: {
    usage?: CodexUsage;
    error?: CodexError;
    incomplete_details?: { reason?: string };
  };
}

/** The minimal Responses-stream client surface this backend needs (the openai SDK
 *  satisfies it at runtime — `create`'s second argument is its RequestOptions, of
 *  which we use only `signal`). Named so the test can supply a fake. */
export interface ResponsesClient {
  responses: {
    create(body: unknown, opts?: { signal?: AbortSignal }): Promise<AsyncIterable<CodexEvent>>;
  };
}

/** Assemble a Completion from one streamed Codex response — the pure core, exported
 *  for the test. Given a resolved credential, a client built from it, and a spec:
 *  build the body, stream, parse. Refresh + client construction happen ABOVE this.
 *  `signal` is the caller's abort; watchdogs ride on top of it (see streamText). */
export async function completeVia(
  client: ResponsesClient,
  spec: ModelSpec,
  onDelta?: DeltaSink,
  defaultModel: (typeof CODEX_MODELS)[number] = CODEX_MODEL,
  signal?: AbortSignal,
): Promise<Completion> {
  const body = buildBody(spec, defaultModel);
  const { text, usage, finish } = await streamText(client, body, onDelta, signal);
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

/** The production makeClient: lazily import the openai SDK (the ES module registry
 *  caches the load), arm it with the credential's token + identity headers, and adapt
 *  it to the {@link ResponsesClient} surface. `reqOpts` must pass through — it
 *  carries the abort signal (caller + watchdogs). */
const makeSdkClient = (cred: CodexCredential): ResponsesClient => ({
  responses: {
    create: async (body, reqOpts) => {
      const { default: OpenAI } = (await import("openai")) as unknown as {
        default: new (o: unknown) => ResponsesClient;
      };
      const armed = new OpenAI({
        apiKey: cred.accessToken,
        baseURL: cred.baseURL,
        defaultHeaders: clientHeaders(cred),
        maxRetries: 0, // the inference plane owns retry
      });
      return armed.responses.create(body, reqOpts);
    },
  },
});

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
  const makeClient = deps.makeClient ?? makeSdkClient;

  const defaultModel = opts.defaultModel ?? CODEX_MODEL;
  const run = async (spec: ModelSpec, onDelta?: DeltaSink, signal?: AbortSignal): Promise<Completion> => {
    const cred = await resolveCredential({ allowRefresh: opts.allowRefresh });
    const client = makeClient(cred);
    return completeVia(client, spec, onDelta, defaultModel, signal);
  };

  // Not wrapped in lazyBackend: resolution is already per-run and lazy (the SDK
  // import is deferred inside makeClient), and we want the fresh-credential-per-call
  // behavior lazyBackend's cache-once would defeat.
  return {
    complete: (spec) => run(spec),
    // The caller's signal (infer-store passes its subscriber-refcount controller's)
    // MUST reach the request — dropping it leaves a live BILLED stream running after
    // the last subscriber releases.
    stream: (spec, onDelta, signal) => run(spec, onDelta, signal),
  };
}
