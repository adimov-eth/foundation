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
import { describe, expect, it, vi } from "vitest";

import {
  buildBody,
  clientHeaders,
  codexBackend,
  completeVia,
  stripFence,
  CODEX_MODEL,
  type CodexCredential,
  type ResponsesClient,
} from "../backends/codex.js";
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

// ── stripFence: schema-blind JSON recovery ────────────────────────────────────────

describe("stripFence", () => {
  it("unwraps a ```json fence", () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("unwraps a bare ``` fence", () => {
    expect(stripFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it("passes through unfenced text (trimmed)", () => {
    expect(stripFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});

// ── completeVia: SSE assembly + parse + usage ─────────────────────────────────────

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

  it("throws on a top-level response.error event too", async () => {
    const client = fakeClient([{ type: "response.error", error: { code: "server_error" } }]);
    await expect(completeVia(client, spec())).rejects.toThrow(/stream failed.*server_error/i);
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

// ── single-flight refresh (the CONFIRMED HIGH race) ──────────────────────────────

describe("resolveCodexCredential — concurrent refresh is single-flight", () => {
  it("collapses N concurrent expiring-token resolves onto ONE refresh POST", async () => {
    // This exercises the real codex-auth module against a stubbed fetch + a fake
    // ~/.codex/auth.json, proving two parallel resolves don't both POST the single-use
    // refresh_token. Uses a temp CODEX_HOME so it never touches the real credential.
    const os = await import("node:os");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { resolveCodexCredential } = await import("../backends/codex-auth.js");

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-test-"));
    const prevHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = dir;
    // An EXPIRED access token (exp in the past) so both resolves take the refresh path.
    const expiredJwt = `x.${Buffer.from(JSON.stringify({ exp: 1, "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } })).toString("base64url")}.y`;
    const freshJwt = `x.${Buffer.from(JSON.stringify({ exp: 9999999999, "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } })).toString("base64url")}.y`;
    fs.writeFileSync(
      path.join(dir, "auth.json"),
      JSON.stringify({ tokens: { access_token: expiredJwt, refresh_token: "rt-1", account_id: "acct-1" } }),
    );

    let posts = 0;
    const realFetch = globalThis.fetch;
    // @ts-expect-error test stub
    globalThis.fetch = async () => {
      posts += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: freshJwt, refresh_token: "rt-2" }),
      } as Response;
    };
    try {
      const [a, b, c] = await Promise.all([
        resolveCodexCredential({}),
        resolveCodexCredential({}),
        resolveCodexCredential({}),
      ]);
      // The single-use refresh_token was POSTed exactly once despite three callers.
      expect(posts).toBe(1);
      expect(a.accessToken).toBe(freshJwt);
      expect(b.accessToken).toBe(freshJwt);
      expect(c.accessToken).toBe(freshJwt);
    } finally {
      globalThis.fetch = realFetch;
      if (prevHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevHome;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats a token with NO readable exp as expiring — refresh recovers it", async () => {
    // A malformed/exp-less access token used to read as "fresh forever": never
    // refreshed, every call 401'd at the backend, no recovery short of a manual
    // `codex login`. It must take the refresh path instead.
    const os = await import("node:os");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { resolveCodexCredential } = await import("../backends/codex-auth.js");

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-test-"));
    const prevHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = dir;
    const freshJwt = `x.${Buffer.from(JSON.stringify({ exp: 9999999999, "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } })).toString("base64url")}.y`;
    fs.writeFileSync(
      path.join(dir, "auth.json"),
      // access_token is NOT a decodable JWT — no exp claim can be read from it.
      JSON.stringify({ tokens: { access_token: "not-a-jwt", refresh_token: "rt-1", account_id: "acct-1" } }),
    );

    let posts = 0;
    const realFetch = globalThis.fetch;
    // @ts-expect-error test stub
    globalThis.fetch = async () => {
      posts += 1;
      return { ok: true, status: 200, json: async () => ({ access_token: freshJwt, refresh_token: "rt-2" }) } as Response;
    };
    try {
      const out = await resolveCodexCredential({});
      expect(posts).toBe(1); // the broken token took the refresh path…
      expect(out.accessToken).toBe(freshJwt); // …and the caller got a LIVE credential
    } finally {
      globalThis.fetch = realFetch;
      if (prevHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevHome;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists the ROTATED token set to disk at mode 0600 (write-through contract)", async () => {
    // Two properties of the same write, asserted against the REAL file:
    //  • write-through — the refresh_token is SINGLE-USE, so if the rotated set only
    //    lives in memory, the next process reads the burned rt and bricks the session
    //    until manual `codex login`;
    //  • mode 0600 — `codex login` creates auth.json owner-only, and the atomic
    //    temp+rename REPLACES the inode, so an unmoded temp file would silently
    //    publish a live OAuth credential to local users on the first refresh.
    const os = await import("node:os");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { resolveCodexCredential } = await import("../backends/codex-auth.js");

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-auth-test-"));
    const prevHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = dir;
    const expiredJwt = `x.${Buffer.from(JSON.stringify({ exp: 1, "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } })).toString("base64url")}.y`;
    const freshJwt = `x.${Buffer.from(JSON.stringify({ exp: 9999999999, "https://api.openai.com/auth": { chatgpt_account_id: "acct-1" } })).toString("base64url")}.y`;
    const authFile = path.join(dir, "auth.json");
    // 0600 on disk, as `codex login` leaves it — the refresh must not loosen it.
    fs.writeFileSync(
      authFile,
      JSON.stringify({ tokens: { access_token: expiredJwt, refresh_token: "rt-1", account_id: "acct-1" } }),
      { mode: 0o600 },
    );

    const realFetch = globalThis.fetch;
    // @ts-expect-error test stub
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ access_token: freshJwt, refresh_token: "rt-2", id_token: "id-2" }),
    }) as Response;
    try {
      await resolveCodexCredential({});
      const onDisk = JSON.parse(fs.readFileSync(authFile, "utf8")) as {
        tokens: { access_token: string; refresh_token: string; id_token?: string };
        last_refresh?: string;
      };
      // Write-through: the FULL rotated set reached the file, not just memory.
      expect(onDisk.tokens.access_token).toBe(freshJwt);
      expect(onDisk.tokens.refresh_token).toBe("rt-2");
      expect(onDisk.tokens.id_token).toBe("id-2");
      expect(onDisk.last_refresh).toBeTruthy();
      // Perms: still owner-only after the temp+rename replaced the inode.
      expect(fs.statSync(authFile).mode & 0o777).toBe(0o600);
    } finally {
      globalThis.fetch = realFetch;
      if (prevHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevHome;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
