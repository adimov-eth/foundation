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

  // ── EXCLUSION TRIPWIRES — the exclusions are PROBED FACT, not caution ───────────
  // Probed live 2026-07-07 against gpt-5.3-codex-spark: max_output_tokens and
  // temperature are each rejected with `400 {"detail":"Unsupported parameter: …"}`.
  // A sent field would 400 EVERY call that sets it — the inference plane sets
  // maxTokens routinely, so threading either bricks the backend. These pin the
  // probed truth; do not flip them without a fresh live probe (the gate's contract
  // is documented nowhere and can drift silently).

  it("TRIPWIRE: spec.maxTokens is NOT sent (probed 2026-07-07: 400 'Unsupported parameter')", () => {
    const body = buildBody(spec({ maxTokens: 512 }));
    expect(body).not.toHaveProperty("max_output_tokens");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("TRIPWIRE: spec.temperature is NOT sent (probed 2026-07-07: 400 'Unsupported parameter')", () => {
    const body = buildBody(spec({ temperature: 0 }));
    expect(body).not.toHaveProperty("temperature");
  });

  // ── TOOLS — the probed round-trip contract (2026-07-07, both directions live) ───
  // History: tools were first silently dropped (round-2 CONFIRMED major — a de-tooled
  // agentic spec FABRICATES: the loop reads a no-tool-call turn as the final answer),
  // then REFUSED with a throw, now SUPPORTED with the wire shapes pinned below. The
  // refusal's rationale still governs the shapes: every lowering here must round-trip
  // through the gate, or the fabrication returns one layer down.

  it("lowers spec.tools to the Responses FLAT function shape (not chat-completions' nested)", () => {
    // Probed: the gate accepts {type:"function", name, description, parameters} FLAT;
    // toolsToOpenAI's nested {function:{…}} is a DIFFERENT wire — reusing it here
    // would be the plausible-but-wrong move. `strict` is optional (probed omitted).
    const body = buildBody(
      spec({ tools: [{ name: "get_weather", description: "weather for a city", inputSchema: { type: "object", properties: { city: { type: "string" } } } }] }),
    );
    expect(body.tools).toEqual([
      {
        type: "function",
        name: "get_weather",
        description: "weather for a city",
        parameters: { type: "object", properties: { city: { type: "string" } } },
      },
    ]);
    expect(body).not.toHaveProperty("tool_choice"); // endpoint default; unprobed knobs stay home
  });

  it("a tool with no inputSchema gets the empty-object schema (same defaulting as toolsToOpenAI)", () => {
    const body = buildBody(spec({ tools: [{ name: "ping" }] }));
    expect((body.tools as Array<{ parameters: unknown }>)[0].parameters).toEqual({
      type: "object",
      properties: {},
      additionalProperties: false,
    });
  });

  it("an empty tools list sends NO tools field", () => {
    expect(buildBody(spec({ tools: [] }))).not.toHaveProperty("tools");
  });

  it("lowers the agentic tool round-trip to typed input items (function_call / function_call_output)", () => {
    // The exact wire shapes probed 2026-07-07: the model's own function_call item
    // echoed back (call_id/name/arguments-as-JSON-string), the tool result as a
    // function_call_output keyed by call_id. store:false ⇒ the whole trajectory
    // rides input every round.
    const prompt = JSON.stringify([
      { role: "user", content: "weather in Bangkok?" },
      { role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "get_weather", arguments: { city: "Bangkok" } }] },
      { role: "tool", content: '{"temperature_c":33}', toolCallId: "call_1" },
    ]);
    const body = buildBody(spec({ prompt, tools: [{ name: "get_weather" }] }));
    expect(body.input).toEqual([
      { role: "user", content: [{ type: "input_text", text: "weather in Bangkok?" }] },
      { type: "function_call", call_id: "call_1", name: "get_weather", arguments: '{"city":"Bangkok"}' },
      { type: "function_call_output", call_id: "call_1", output: '{"temperature_c":33}' },
    ]);
  });

  it("an assistant turn with BOTH text and tool calls emits the text item then the call items", () => {
    const prompt = JSON.stringify([
      { role: "user", content: "hi" },
      { role: "assistant", content: "checking…", toolCalls: [{ id: "c1", name: "lookup", arguments: {} }] },
      { role: "tool", content: "found", toolCallId: "c1" },
    ]);
    const { input } = buildBody(spec({ prompt })) as { input: Array<Record<string, unknown>> };
    expect(input.map((i) => i.type ?? i.role)).toEqual(["user", "assistant", "function_call", "function_call_output"]);
    expect(input[2]).toMatchObject({ call_id: "c1", arguments: "{}" });
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

  // (Fenced-JSON recovery is pinned ONCE, by the "recovers a fenced structured
  //  response … via the shared ladder" test in the failure-paths block below — a
  //  verbatim duplicate lived here and survived the 58cd9b6 dedup whose own message
  //  named the ladder-level test as the single keeper. Round-2 review, 2026-07-06.)

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

// ── tool-call parsing — the probed event stream (2026-07-07) ──────────────────────
// The COMPLETE call arrives on `response.output_item.done` with item.type ===
// "function_call": {call_id, name, arguments:<JSON string>}. response.completed's
// `output` is [] on this plane (the Hermes bug class — never reconstruct from it),
// and response.function_call_arguments.done duplicates the arguments (ignored: one
// source of truth per call). A tool-calling turn often has ZERO text.

describe("completeVia — tool calls", () => {
  /** The verbatim event sequence the live gate emitted for a forced tool call. */
  const toolCallEvents = [
    { type: "response.created" },
    { type: "response.in_progress" },
    { type: "response.output_item.added", item: { id: "rs_1", type: "reasoning" } },
    { type: "response.output_item.done", item: { id: "rs_1", type: "reasoning" } },
    {
      type: "response.output_item.added",
      item: { id: "fc_1", type: "function_call", status: "in_progress", arguments: "", call_id: "call_abc", name: "get_weather" },
    },
    { type: "response.function_call_arguments.done", arguments: '{"city":"Bangkok"}', item_id: "fc_1" },
    {
      type: "response.output_item.done",
      item: { id: "fc_1", type: "function_call", status: "completed", arguments: '{"city":"Bangkok"}', call_id: "call_abc", name: "get_weather" },
    },
    { type: "response.completed", response: { usage: { input_tokens: 40, output_tokens: 9 } } },
  ];

  it("collects the call from output_item.done — id, name, parsed arguments — exactly once", async () => {
    const client = fakeClient(toolCallEvents);
    const out = await completeVia(client, spec({ tools: [{ name: "get_weather" }] }));
    // exactly one call despite arguments appearing on TWO event types:
    expect(out.toolCalls).toEqual([{ id: "call_abc", name: "get_weather", arguments: { city: "Bangkok" } }]);
    expect(out.usage).toEqual({ inputTokens: 40, outputTokens: 9 });
  });

  it("a tool-calling turn SKIPS the schema parse (the chatBackend tool-vs-parse arc)", async () => {
    // Zero text + a schema'd spec: forcing parseModelValue here would throw "no
    // content" on every agentic round — the calls ARE the turn's content; the
    // agentic loop dispatches and re-infers.
    const client = fakeClient(toolCallEvents);
    const out = await completeVia(client, spec({ schema: JSON.stringify(["object", ["x", "string"]]) }));
    expect(out.toolCalls).toHaveLength(1);
    expect(out.value).toBe(""); // the raw (empty) text, not a parse error
  });

  it("a plain turn (no calls) has NO toolCalls key — the loop reads its text as final", async () => {
    const client = fakeClient(textEvents("done"));
    const out = await completeVia(client, spec());
    expect(out).not.toHaveProperty("toolCalls");
  });

  it("malformed call arguments degrade to {} (shared parseToolArguments tolerance)", async () => {
    const client = fakeClient([
      {
        type: "response.output_item.done",
        item: { type: "function_call", call_id: "c1", name: "f", arguments: "{not json" },
      },
      { type: "response.completed", response: { usage: { input_tokens: 1, output_tokens: 1 } } },
    ]);
    const out = await completeVia(client, spec());
    expect(out.toolCalls).toEqual([{ id: "c1", name: "f", arguments: {} }]);
  });

  it("a reasoning output item is NOT a tool call (item.type dispatch, not event.type)", async () => {
    const client = fakeClient([
      { type: "response.output_item.done", item: { id: "rs_9", type: "reasoning" } },
      { type: "response.output_text.delta", delta: "plain answer" },
      { type: "response.completed", response: { usage: { input_tokens: 2, output_tokens: 2 } } },
    ]);
    const out = await completeVia(client, spec());
    expect(out).not.toHaveProperty("toolCalls");
    expect(out.value).toBe("plain answer");
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

  it("persists the rotation even when the auth.json re-read fails mid-refresh", async () => {
    // The single-use rt is burned server-side the moment the POST succeeds — from
    // then on the rotated set is the ONLY working credential. The write-through
    // re-reads auth.json to preserve sibling fields; if that re-read throws
    // (file deleted/corrupted between POST and write), the rotation must still
    // land on disk in a minimal payload, or the session bricks until a manual
    // `codex login`. (Round-2 review, 2026-07-06.)
    await withCodexAuth(
      { accessToken: codexJwt(1), refreshJson: {} },
      async ({ authFile }) => {
        // Layered stub: delete auth.json BEFORE the refresh response returns, so the
        // post-POST re-read hits ENOENT. (The harness's finally still restores fetch.)
        // @ts-expect-error test stub
        globalThis.fetch = async () => {
          rmSync(authFile);
          return {
            ok: true,
            status: 200,
            json: async () => ({ access_token: FRESH_JWT, refresh_token: "rt-2" }),
          } as Response;
        };
        const out = await resolveCodexCredential({});
        expect(out.accessToken).toBe(FRESH_JWT);
        const onDisk = JSON.parse(readFileSync(authFile, "utf8")) as {
          tokens: { refresh_token: string };
        };
        expect(onDisk.tokens.refresh_token).toBe("rt-2"); // rotation survived the lost re-read
      },
    );
  });

  it("an unusable refreshed token REJECTS legibly — after persisting the rotation", async () => {
    // Presence-only validation shipped an opaque failure: a 200 carrying a truthy but
    // unparseable access_token was handed to the caller → backend 401 with no cause,
    // plus one refresh POST and one rt rotation per inference call. The fix throws a
    // NAMED error — but only after the write-through, because the burned rt makes the
    // rotated set the only copy worth protecting. (Round-2 review, 2026-07-06.)
    await withCodexAuth(
      { accessToken: codexJwt(1), refreshJson: { access_token: "garbage-not-a-jwt", refresh_token: "rt-2" } },
      async ({ authFile }) => {
        await expect(resolveCodexCredential({})).rejects.toThrow(/unusable access token.*codex login/is);
        const onDisk = JSON.parse(readFileSync(authFile, "utf8")) as {
          tokens: { access_token: string; refresh_token: string };
        };
        expect(onDisk.tokens.refresh_token).toBe("rt-2"); // rotation persisted despite the reject
        expect(onDisk.tokens.access_token).toBe("garbage-not-a-jwt");
      },
    );
  });
});
