/**
 * codex backend — the ChatGPT-subscription Codex Responses plane.
 *
 * These tests pin the WIRE CONTRACT we reverse-engineered against the live backend
 * (it is documented nowhere), one 400 at a time, so a future edit can't silently
 * regress it:
 *   • model is one of the accepted Codex ids (gpt-5.5 / gpt-5.3-codex-spark); a
 *     non-Codex token falls back to the cheap default
 *   • `stream: true` is mandatory
 *   • `input` is a typed list of `{role, content:[{type:"input_text", text}]}`
 * plus the SSE assembly, schema-blind JSON coercion, per-run credential refresh,
 * and usage mapping. No network: the client + credential seams are injected.
 */
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  buildBody,
  clientHeaders,
  codexBackend,
  completeVia,
  CODEX_MODEL,
  type CodexCredential,
  type ResponsesClient,
} from "../backends/codex.js";
import { resolveCodexCredential } from "../backends/codex-auth.js";
import type { ModelSpec } from "../model.js";

const spec = (over: Partial<ModelSpec> = {}): ModelSpec => ({
  model: "whatever-the-program-said",
  prompt: "hello",
  schema: null,
  ...over,
});

const cred: CodexCredential = {
  accessToken: "at.jwt.sig",
  accountId: "acct-123",
  baseURL: "https://chatgpt.com/backend-api/codex",
};

/** A fake Responses client that yields a scripted SSE event sequence and records
 *  the body it was called with. */
function fakeClient(events: unknown[]): ResponsesClient & { lastBody: unknown } {
  const self = {
    lastBody: undefined as unknown,
    responses: {
      create: async (body: unknown) => {
        self.lastBody = body;
        return (async function* () {
          for (const e of events) yield e as never;
        })();
      },
    },
  };
  return self;
}

const textEvents = (text: string, usage?: { input_tokens: number; output_tokens: number }) => [
  { type: "response.created" },
  { type: "response.output_text.delta", delta: text.slice(0, Math.ceil(text.length / 2)) },
  { type: "response.output_text.delta", delta: text.slice(Math.ceil(text.length / 2)) },
  { type: "response.completed", response: { usage: usage ?? { input_tokens: 5, output_tokens: 7 } } },
];

// ── buildBody: the three verified constraints ────────────────────────────────────

describe("buildBody — the verified Codex wire contract", () => {
  it("falls back to the default model when the program named a NON-Codex token", () => {
    const body = buildBody(spec({ model: "gpt-4o" }));
    expect(body.model).toBe(CODEX_MODEL); // gpt-4o isn't accepted → default (cheap spark tier)
  });

  it("HONORS spec.model when it names an accepted Codex model (gpt-5.5 / spark)", () => {
    expect(buildBody(spec({ model: "gpt-5.5" })).model).toBe("gpt-5.5");
    expect(buildBody(spec({ model: "gpt-5.3-codex-spark" })).model).toBe("gpt-5.3-codex-spark");
  });

  it("respects an explicit defaultModel override", () => {
    expect(buildBody(spec({ model: "unknown" }), "gpt-5.5").model).toBe("gpt-5.5");
  });

  it("sets stream:true (the backend 400s 'Stream must be set to true' otherwise)", () => {
    expect(buildBody(spec()).stream).toBe(true);
  });

  it("wraps input as a typed input_text list (a bare string 400s 'Input must be a list')", () => {
    const body = buildBody(spec({ prompt: "hi there" }));
    expect(body.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "hi there" }] }]);
  });

  it("routes system turns into `instructions`, non-system into `input`", () => {
    const prompt = JSON.stringify([
      { role: "system", content: "be terse" },
      { role: "user", content: "ping" },
    ]);
    const body = buildBody(spec({ prompt }));
    expect(body.instructions).toBe("be terse");
    expect(body.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "ping" }] }]);
  });

  it("appends a schema preamble to instructions when a schema is present", () => {
    const schema = JSON.stringify(["object", ["name", "string"]]);
    const body = buildBody(spec({ schema }));
    expect(String(body.instructions)).toContain("Return ONLY a JSON object");
    expect(String(body.instructions)).toContain('"name"');
  });

  it("carries no instructions for a plain, schema-less prompt", () => {
    expect(buildBody(spec()).instructions).toBeUndefined();
  });

  it("sets store:false (stateless — the whole context rides each call, replay-safe)", () => {
    expect(buildBody(spec()).store).toBe(false);
  });

  it("merges spec.system (the persona) into instructions, in persona · call · format order", () => {
    // The hand-rolled system filter this pins against silently DROPPED the
    // `(llm/with … :system …)` persona — model-bound AND content-keyed, so losing
    // it changes what the inference MEANS, not just how it runs.
    const prompt = JSON.stringify([
      { role: "system", content: "call-level instruction" },
      { role: "user", content: "ping" },
    ]);
    const schema = JSON.stringify(["object", ["ok", "boolean"]]);
    const body = buildBody(spec({ prompt, system: "persona text", schema }));
    const instructions = String(body.instructions);
    const iPersona = instructions.indexOf("persona text");
    const iCall = instructions.indexOf("call-level instruction");
    const iFormat = instructions.indexOf("Return ONLY a JSON object");
    expect(iPersona).toBeGreaterThanOrEqual(0);
    expect(iCall).toBeGreaterThan(iPersona);
    expect(iFormat).toBeGreaterThan(iCall);
  });

  it("carries a persona-only spec (no system turns in the prompt) as instructions", () => {
    const body = buildBody(spec({ system: "be a pirate" }));
    expect(body.instructions).toBe("be a pirate");
  });

  // ── EXCLUSION TRIPWIRES — flip these only after a LIVE probe ────────────────────
  // max_output_tokens/temperature are standard *platform* Responses fields that have
  // never been probed against the chatgpt.com/backend-api/codex gate (the contract
  // that 400s on unaccepted models, non-stream, bare-string input). A rejected field
  // would 400 EVERY call that sets it — the inference plane sets maxTokens routinely,
  // so shipping unprobed bricks the backend. These pin the deliberate exclusion; see
  // the KNOWN LIMITATION note on buildBody for the lift procedure.

  it("TRIPWIRE: spec.maxTokens is deliberately NOT sent (unprobed against the live gate)", () => {
    const body = buildBody(spec({ maxTokens: 512 }));
    expect(body).not.toHaveProperty("max_output_tokens");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("TRIPWIRE: spec.temperature is deliberately NOT sent (unprobed against the live gate)", () => {
    const body = buildBody(spec({ temperature: 0 }));
    expect(body).not.toHaveProperty("temperature");
  });

  it("TRIPWIRE: spec.tools is REFUSED (thrown), never silently dropped", () => {
    // Stricter than the exclusions above, because the failure mode is worse: tools are
    // CONTENT-KEYED and the agentic loop treats a no-tool-call turn as the FINAL
    // answer — a silently de-tooled spec returns a plausible answer-from-priors with
    // zero dispatches, indistinguishable from a real finish (round-2 review,
    // 2026-07-06). An unenforced cap degrades; a tool-less agentic answer LIES.
    const tooled = spec({
      tools: [{ name: "search", description: "look things up", inputSchema: { type: "object" } }],
    });
    expect(() => buildBody(tooled)).toThrow(/cannot honor spec\.tools.*tool-capable backend/is);
    // and an empty tools list is NOT an agentic spec — it must build normally:
    expect(buildBody(spec({ tools: [] }))).toHaveProperty("model");
  });
});

// ── clientHeaders: the identity headers the backend gates on ──────────────────────

describe("clientHeaders", () => {
  it("carries chatgpt-account-id and the codex_cli_rs originator", () => {
    expect(clientHeaders(cred)).toEqual({
      "chatgpt-account-id": "acct-123",
      originator: "codex_cli_rs",
    });
  });
});

// ── completeVia: SSE assembly + parse + usage ─────────────────────────────────────
// (Fence-stripping is owned by the shared coercion ladder — pinned by the
//  "recovers a fenced structured response" test below, not a local helper.)

describe("completeVia — stream assembly", () => {
  it("assembles text from output_text deltas and maps usage", async () => {
    const client = fakeClient(textEvents("Merge sort", { input_tokens: 13, output_tokens: 4 }));
    const out = await completeVia(client, spec());
    expect(out.value).toBe("Merge sort");
    expect(out.usage).toEqual({ inputTokens: 13, outputTokens: 4 });
  });

  it("parses a structured response into an object", async () => {
    const client = fakeClient(textEvents('{"algorithm":"merge","complexity":"O(n log n)"}'));
    const out = await completeVia(client, spec({ schema: JSON.stringify(["object", ["algorithm", "string"]]) }));
    expect(out.value).toEqual({ algorithm: "merge", complexity: "O(n log n)" });
  });

  it("strips a fenced structured response before parsing", async () => {
    const client = fakeClient(textEvents('```json\n{"ok":true}\n```'));
    const out = await completeVia(client, spec({ schema: JSON.stringify(["object", ["ok", "boolean"]]) }));
    expect(out.value).toEqual({ ok: true });
  });

  it("forwards each delta to onDelta in order", async () => {
    const client = fakeClient(textEvents("abcd"));
    const seen: string[] = [];
    await completeVia(client, spec(), (d) => seen.push(d));
    expect(seen.join("")).toBe("abcd");
  });

  it("tolerates a completed event with no usage (zeros)", async () => {
    const client = fakeClient([
      { type: "response.output_text.delta", delta: "x" },
      { type: "response.completed", response: {} },
    ]);
    const out = await completeVia(client, spec());
    expect(out.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

// ── abort + stall watchdogs (the vercel.ts war-story class, on the codex path) ────
//
// The openai SDK's request timeout is CLEARED once response headers arrive — it
// never guards body reads — so a stalled Codex SSE stream was an infinite await.
// And the caller's AbortSignal (infer-store's subscriber-refcount controller) was
// dropped entirely: last-subscriber release left a live BILLED stream. These pin
// both: the signal reaches the request, and idle/total watchdogs cover the read
// loop even against a stream that IGNORES the signal.

describe("completeVia — caller abort + idle/total watchdogs", () => {
  it("rejects on CALLER abort mid-stream, even when the stream ignores the signal", async () => {
    // One delta arrives, then next() never settles AND the signal is ignored — the
    // worst case. The read loop must still unwind via its abort race.
    let first = true;
    const client: ResponsesClient = {
      responses: {
        create: async () => ({
          [Symbol.asyncIterator]: () => ({
            next: () =>
              first
                ? ((first = false),
                  Promise.resolve({ done: false as const, value: { type: "response.output_text.delta", delta: "a" } }))
                : new Promise<never>(() => {}),
          }),
        }),
      },
    };
    const ac = new AbortController();
    const p = completeVia(client, spec(), () => ac.abort(new Error("last subscriber released")), undefined, ac.signal);
    await expect(p).rejects.toThrow(/last subscriber released/);
  });

  it("threads the caller's signal into the SDK request options (codexBackend.stream)", async () => {
    let seen: AbortSignal | undefined;
    const client: ResponsesClient = {
      responses: {
        create: async (_body, opts) => {
          seen = opts?.signal;
          return (async function* () {
            yield { type: "response.output_text.delta", delta: "ok" } as never;
            yield { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } } as never;
          })();
        },
      },
    };
    const backend = codexBackend({}, { resolveCredential: async () => cred, makeClient: () => client });
    const ac = new AbortController();
    await backend.stream!(spec(), () => {}, ac.signal);
    expect(seen).toBeInstanceOf(AbortSignal);
    // The request signal is the COMBINED one — it must follow the caller's abort.
    ac.abort();
    expect(seen!.aborted).toBe(true);
  });

  it("aborts a STALLED stream at the idle window (silent 0%-CPU wedge)", async () => {
    process.env.ARRIVAL_INFER_IDLE_MS = "40";
    try {
      const client: ResponsesClient = {
        responses: {
          create: async () => ({
            [Symbol.asyncIterator]: () => ({ next: () => new Promise<never>(() => {}) }),
          }),
        },
      };
      await expect(completeVia(client, spec())).rejects.toThrow(/idle 40ms/);
    } finally {
      delete process.env.ARRIVAL_INFER_IDLE_MS;
    }
  });

  it("aborts a never-idle but unbounded stream at the TOTAL deadline", async () => {
    process.env.ARRIVAL_INFER_TOTAL_MS = "60";
    try {
      const client: ResponsesClient = {
        responses: {
          create: async () =>
            (async function* () {
              // Emits forever, fast enough to never trip the idle window.
              while (true) {
                await new Promise((r) => setTimeout(r, 5));
                yield { type: "response.output_text.delta", delta: "x" } as never;
              }
            })(),
        },
      };
      await expect(completeVia(client, spec())).rejects.toThrow(/total 60ms/);
    } finally {
      delete process.env.ARRIVAL_INFER_TOTAL_MS;
    }
  });

  it("a slow but ACTIVE stream survives — the idle window re-arms on every event", async () => {
    process.env.ARRIVAL_INFER_IDLE_MS = "120";
    try {
      const client: ResponsesClient = {
        responses: {
          create: async () =>
            (async function* () {
              for (const d of ["a", "b", "c", "d"]) {
                // Each gap (40ms) is under the window; the TOTAL run (160ms) is over
                // it — only a re-armed watchdog passes this while a fixed one fails.
                await new Promise((r) => setTimeout(r, 40));
                yield { type: "response.output_text.delta", delta: d } as never;
              }
              yield { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 4 } } } as never;
            })(),
        },
      };
      const out = await completeVia(client, spec());
      expect(out.value).toBe("abcd");
    } finally {
      delete process.env.ARRIVAL_INFER_IDLE_MS;
    }
  });
});

// ── codexBackend: per-run credential resolution (the freshness invariant) ─────────

describe("codexBackend — resolves the credential PER RUN", () => {
  it("re-resolves the credential on every complete() (token is a short-lived JWT)", async () => {
    const resolveCredential = vi.fn(async () => cred);
    const client = fakeClient(textEvents("ok"));
    const makeClient = vi.fn(() => client);
    const backend = codexBackend({ allowRefresh: true }, { resolveCredential, makeClient });

    await backend.complete(spec());
    await backend.complete(spec());

    // A backend that pinned the client once at construction would resolve ONCE;
    // ours must re-resolve so codex-auth can refresh an expiring token mid-session.
    expect(resolveCredential).toHaveBeenCalledTimes(2);
    expect(resolveCredential).toHaveBeenCalledWith({ allowRefresh: true });
  });

  it("passes allowRefresh:false through to the resolver (CLI-fresh-token mode)", async () => {
    const resolveCredential = vi.fn(async () => cred);
    const backend = codexBackend({ allowRefresh: false }, { resolveCredential, makeClient: () => fakeClient(textEvents("hi")) });
    await backend.complete(spec());
    expect(resolveCredential).toHaveBeenCalledWith({ allowRefresh: false });
  });

  it("drives the full path: build → stream → parse, end to end through the public API", async () => {
    const client = fakeClient(textEvents('{"algorithm":"quicksort"}'));
    const backend = codexBackend(
      {},
      { resolveCredential: async () => cred, makeClient: () => client },
    );
    const out = await backend.complete(spec({ schema: JSON.stringify(["object", ["algorithm", "string"]]) }));
    expect(out.value).toEqual({ algorithm: "quicksort" });
    // and the body that reached the client honored the wire contract (default model,
    // since the spec didn't name an accepted Codex id):
    expect((client.lastBody as { model: string }).model).toBe(CODEX_MODEL);
    expect((client.lastBody as { stream: boolean }).stream).toBe(true);
  });
});

// ── failure paths (the review's CONFIRMED findings, pinned as tripwires) ──────────
// These are the bugs the adversarial reviews found: the old loop DROPPED server
// failure events (a blocked call looked like an empty success), and a schema'd
// non-JSON turn crashed with an opaque `JSON.parse` error naming no model/reason.

describe("completeVia — server failure + malformed output are surfaced, not swallowed", () => {
  it("throws on a response.failed event instead of returning an empty success", async () => {
    const client = fakeClient([
      { type: "response.created" },
      { type: "response.failed", response: { error: { message: "content policy violation" } } },
    ]);
    await expect(completeVia(client, spec())).rejects.toThrow(/stream failed.*content policy/i);
  });

  it("throws on a top-level `error` event — the REAL wire shape, code/message FLAT", async () => {
    // ResponseErrorEvent (openai@6 responses.d.ts): `type` is "Always `error`" and
    // code/message sit flat on the event. An earlier guard matched the FICTIONAL name
    // "response.error" with a nested payload — its test pinned that fiction back at
    // the implementation, so a real mid-stream server error resolved as SUCCESS
    // (round-2 review kill-probe, 2026-07-06). This pins the real contract.
    const client = fakeClient([
      { type: "response.output_text.delta", delta: "partial answer" },
      { type: "error", code: "server_error", message: "boom mid-stream" },
    ]);
    await expect(completeVia(client, spec())).rejects.toThrow(/stream failed.*boom mid-stream/i);
  });

  it("a flat `error` event with only a code still surfaces the code, not 'unknown error'", async () => {
    const client = fakeClient([{ type: "error", code: "server_error" }]);
    await expect(completeVia(client, spec())).rejects.toThrow(/stream failed.*server_error/i);
  });

  it("a schema'd stream cut by a mid-stream `error` REJECTS — never a jsonrepair'd wrong value", async () => {
    // The round-2 kill-probe's exact scenario: truncated JSON + a real `error` event.
    // Under the fictional-name guard this RESOLVED to {algorithm:"merge"} — a plausible
    // wrong value fabricated by jsonrepair from a failed stream.
    const client = fakeClient([
      { type: "response.output_text.delta", delta: '{"algorithm":"merge' },
      { type: "error", code: "server_error", message: "upstream reset" },
    ]);
    await expect(
      completeVia(client, spec({ schema: JSON.stringify(["object", ["algorithm", "string"]]) })),
    ).rejects.toThrow(/stream failed.*upstream reset/i);
  });

  it("closes the stream iterator when a failure event throws (SSE transport teardown)", async () => {
    // The openai SDK's stream generator aborts its transport in its own finally —
    // which only runs when the iterator is CLOSED. The manual read loop must call
    // it.return() on the throw path or the socket stays open (round-2 review).
    let returned = false;
    const events = [
      { type: "response.created" },
      { type: "response.failed", response: { error: { message: "quota" } } },
    ];
    const client: ResponsesClient = {
      responses: {
        create: async () => {
          let i = 0;
          return {
            [Symbol.asyncIterator]() {
              return {
                next: async () =>
                  i < events.length ? { done: false as const, value: events[i++] as never } : { done: true as const, value: undefined as never },
                return: async () => {
                  returned = true;
                  return { done: true as const, value: undefined as never };
                },
              };
            },
          };
        },
      },
    };
    await expect(completeVia(client, spec())).rejects.toThrow(/stream failed.*quota/i);
    expect(returned).toBe(true);
  });

  it("a schema'd REFUSAL yields a LEGIBLE error naming the model, not `Unexpected token`", async () => {
    // Old code: JSON.parse("I can't help with that") → "Unexpected token 'I'".
    const client = fakeClient(textEvents("I can't help with that."));
    await expect(
      completeVia(client, spec({ schema: JSON.stringify(["object", ["x", "string"]]) })),
    ).rejects.toThrow(/whatever-the-program-said|unparseable|no content/i);
    // and crucially NOT the bare parser internal:
    await expect(
      completeVia(client, spec({ schema: JSON.stringify(["object", ["x", "string"]]) })),
    ).rejects.not.toThrow(/Unexpected token/);
  });

  it("a schema'd EMPTY turn (reasoning-only) yields a legible 'no content' error, not a parse crash", async () => {
    const client = fakeClient([
      { type: "response.created" },
      { type: "response.completed", response: { usage: { input_tokens: 3, output_tokens: 0 } } },
    ]);
    await expect(
      completeVia(client, spec({ schema: JSON.stringify(["object", ["x", "string"]]) })),
    ).rejects.toThrow(/no content|declined structured/i);
  });

  it("recovers a fenced structured response (```json …```) via the shared ladder", async () => {
    const client = fakeClient(textEvents('```json\n{"ok":true}\n```'));
    const out = await completeVia(client, spec({ schema: JSON.stringify(["object", ["ok", "boolean"]]) }));
    expect(out.value).toEqual({ ok: true });
  });

  it("a token-capped truncation is SURFACED, not silently jsonrepair'd into a wrong value", async () => {
    // The subtle bug an adversarial test caught: `{"algorithm":"merge` is truncated JSON
    // that jsonrepair WOULD "fix" into {algorithm:"merge"} — a plausible WRONG value. The
    // token-cap reason must normalize to the "length" sentinel so coerceModelJson SKIPS
    // repair and the truncation is raised (blaming the cap) instead of recovered.
    const client = fakeClient([
      { type: "response.output_text.delta", delta: '{"algorithm":"merge' }, // cut mid-JSON
      { type: "response.incomplete", response: { incomplete_details: { reason: "max_output_tokens" } } },
    ]);
    await expect(
      completeVia(client, spec({ schema: JSON.stringify(["object", ["algorithm", "string"]]) })),
    ).rejects.toThrow(/whatever-the-program-said|truncat|cut off|raise max/i);
    // and NOT a bare parser internal, and NOT a silently-repaired wrong value:
    await expect(
      completeVia(client, spec({ schema: JSON.stringify(["object", ["algorithm", "string"]]) })),
    ).rejects.not.toThrow(/Unexpected token|Unexpected end/);
  });
});

// ── refresh path against the REAL codex-auth module (temp CODEX_HOME, stubbed fetch;
//    never touches a real credential) ───────────────────────────────────────────────

/** A decodable fake JWT carrying `exp` and the chatgpt account claim. */
const codexJwt = (exp: number): string =>
  `x.${Buffer.from(JSON.stringify({ exp, "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } })).toString("base64url")}.y`;

const FRESH_JWT = codexJwt(9_999_999_999);

/** Run `fn` with a temp CODEX_HOME holding `accessToken` + rt-1, and a stubbed
 *  refresh endpoint answering `refreshJson`. Owns the save/restore of CODEX_HOME
 *  and global fetch (a divergent restore leaks into every later test) and hands
 *  back the auth-file path plus a live count of refresh POSTs. */
async function withCodexAuth(
  opts: { accessToken: string; mode?: number; refreshJson: Record<string, unknown> },
  fn: (ctx: { authFile: string; posts: () => number }) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), "codex-auth-test-"));
  const prevHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = dir;
  const authFile = path.join(dir, "auth.json");
  writeFileSync(
    authFile,
    JSON.stringify({ tokens: { access_token: opts.accessToken, refresh_token: "rt-1", account_id: "acct-1" } }),
    opts.mode === undefined ? {} : { mode: opts.mode },
  );
  let posts = 0;
  const realFetch = globalThis.fetch;
  // @ts-expect-error test stub
  globalThis.fetch = async () => {
    posts += 1;
    return { ok: true, status: 200, json: async () => opts.refreshJson } as Response;
  };
  try {
    await fn({ authFile, posts: () => posts });
  } finally {
    globalThis.fetch = realFetch;
    if (prevHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = prevHome;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("resolveCodexCredential — the refresh path", () => {
  it("collapses N concurrent expiring-token resolves onto ONE refresh POST (single-flight)", async () => {
    // The refresh_token is SINGLE-USE: two parallel resolves must not both POST it.
    await withCodexAuth(
      { accessToken: codexJwt(1), refreshJson: { access_token: FRESH_JWT, refresh_token: "rt-2" } },
      async ({ posts }) => {
        const [a, b, c] = await Promise.all([
          resolveCodexCredential({}),
          resolveCodexCredential({}),
          resolveCodexCredential({}),
        ]);
        expect(posts()).toBe(1);
        for (const cred of [a, b, c]) expect(cred.accessToken).toBe(FRESH_JWT);
      },
    );
  });

  it("treats a token with NO readable exp as expiring — refresh recovers it", async () => {
    // A malformed/exp-less access token used to read as "fresh forever": never
    // refreshed, every call 401'd at the backend, no recovery short of a manual
    // `codex login`. It must take the refresh path instead.
    await withCodexAuth(
      { accessToken: "not-a-jwt", refreshJson: { access_token: FRESH_JWT, refresh_token: "rt-2" } },
      async ({ posts }) => {
        const out = await resolveCodexCredential({});
        expect(posts()).toBe(1); // the broken token took the refresh path…
        expect(out.accessToken).toBe(FRESH_JWT); // …and the caller got a LIVE credential
      },
    );
  });

  it("persists the ROTATED token set to disk at mode 0600 (write-through contract)", async () => {
    // Two properties of the same write, asserted against the REAL file:
    //  • write-through — if the rotated set only lives in memory, the next process
    //    reads the burned single-use rt and bricks the session until `codex login`;
    //  • mode 0600 — `codex login` creates auth.json owner-only, and the atomic
    //    temp+rename REPLACES the inode, so an unmoded temp file would silently
    //    publish a live OAuth credential to local users on the first refresh.
    await withCodexAuth(
      {
        accessToken: codexJwt(1),
        mode: 0o600, // as `codex login` leaves it — the refresh must not loosen it
        refreshJson: { access_token: FRESH_JWT, refresh_token: "rt-2", id_token: "id-2" },
      },
      async ({ authFile }) => {
        await resolveCodexCredential({});
        const onDisk = JSON.parse(readFileSync(authFile, "utf8")) as {
          tokens: { access_token: string; refresh_token: string; id_token?: string };
          last_refresh?: string;
        };
        expect(onDisk.tokens.access_token).toBe(FRESH_JWT);
        expect(onDisk.tokens.refresh_token).toBe("rt-2");
        expect(onDisk.tokens.id_token).toBe("id-2");
        expect(onDisk.last_refresh).toBeTruthy();
        expect(statSync(authFile).mode & 0o777).toBe(0o600);
      },
    );
  });
});
