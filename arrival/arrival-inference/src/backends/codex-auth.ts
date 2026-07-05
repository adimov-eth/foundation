// codex-auth.ts — read + refresh a ChatGPT-subscription Codex OAuth credential.
//
// Ported from NousResearch/hermes-agent (MIT, hermes_cli/auth.py). The endpoint,
// client_id, and refresh flow are theirs verbatim; this is the minimal ~40 lines
// that matter, transcribed to TS. The wire CONTRACT that consumes the credential
// (stream-only, gpt-5.5, typed input) was verified empirically against the live
// backend — it is NOT documented in Hermes or OpenAI's public API; see codex.ts.
//
//   ~/.codex/auth.json  →  { tokens: { access_token, refresh_token, id_token,
//                                       account_id }, last_refresh }
//
// The access_token is a short-lived JWT (Bearer). When its `exp` is near, the
// single-use refresh_token is POSTed to auth.openai.com/oauth/token with Codex's
// public client_id. The chatgpt-account-id header comes from auth.json (or the
// token's auth claim as a fallback).

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** The ChatGPT-account Codex inference base URL (Hermes `DEFAULT_CODEX_BASE_URL`). */
export const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_OAUTH_TOKEN_URL = "https://auth.openai.com/oauth/token";
/** Codex CLI's public OAuth client id (Hermes `CODEX_OAUTH_CLIENT_ID`). */
const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const REFRESH_SKEW_SECONDS = 120;

interface CodexTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  account_id?: string;
}

/** A resolved, live Codex credential ready to arm a client. */
export interface CodexCredential {
  accessToken: string;
  accountId: string;
  baseURL: string;
}

const authPath = (): string =>
  join(process.env.CODEX_HOME?.trim() || join(homedir(), ".codex"), "auth.json");

/** Decode a JWT's base64url payload (no signature check — we read our OWN token,
 *  exactly as the Codex CLI does; this is not an auth boundary). */
function jwtClaims(token: string | undefined): Record<string, unknown> {
  if (typeof token !== "string" || token.split(".").length < 2) return {};
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((-b64.length % 4 + 4) % 4);
    return JSON.parse(Buffer.from(b64 + pad, "base64").toString()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isExpiring(token: string, skew = REFRESH_SKEW_SECONDS): boolean {
  const exp = jwtClaims(token).exp;
  return typeof exp === "number" ? exp <= Date.now() / 1000 + skew : false;
}

/** The chatgpt account id the backend requires as a header. auth.json carries it;
 *  fall back to the JWT `https://api.openai.com/auth` claim (Hermes reads both). */
function accountId(tokens: CodexTokens): string | undefined {
  if (tokens.account_id) return tokens.account_id;
  for (const t of [tokens.id_token, tokens.access_token]) {
    const claim = jwtClaims(t)["https://api.openai.com/auth"] as { chatgpt_account_id?: string } | undefined;
    if (claim?.chatgpt_account_id) return claim.chatgpt_account_id;
  }
  return undefined;
}

function readTokens(): CodexTokens {
  const p = authPath();
  if (!existsSync(p)) throw new Error(`Codex auth not found at ${p} — run \`codex login\`.`);
  const payload = JSON.parse(readFileSync(p, "utf8")) as { tokens?: CodexTokens };
  const tokens = payload.tokens;
  if (!tokens?.access_token || !tokens?.refresh_token) {
    throw new Error(`Codex auth at ${p} is missing access_token/refresh_token — run \`codex login\`.`);
  }
  return tokens;
}

/** Refresh against auth.openai.com. The refresh_token is single-use, so the
 *  response rotates it; persist the new set back to ~/.codex/auth.json (the CLI's
 *  own contract) so the CLI and this backend stay in sync. */
async function refresh(tokens: CodexTokens): Promise<CodexTokens> {
  const res = await fetch(CODEX_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: CODEX_OAUTH_CLIENT_ID,
    }),
  });
  // A 429 here is quota exhaustion, NOT an auth failure — the token is still valid
  // (Hermes classifies this distinctly so it doesn't prompt a pointless re-login).
  if (res.status === 429) throw new Error("Codex quota exhausted (429) — credentials valid, retry later.");
  if (!res.ok) throw new Error(`Codex token refresh failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; id_token?: string };
  if (!j.access_token) throw new Error("Codex refresh response missing access_token.");
  const next: CodexTokens = {
    ...tokens,
    access_token: j.access_token,
    refresh_token: j.refresh_token || tokens.refresh_token,
    id_token: j.id_token || tokens.id_token,
  };
  const p = authPath();
  const payload = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  const body = JSON.stringify({ ...payload, tokens: next, last_refresh: new Date().toISOString() }, null, 2);
  // ATOMIC write: a torn writeFileSync (crash / concurrent writer) would leave a
  // half-written auth.json that bricks BOTH this backend and the Codex CLI. Write a
  // sibling temp then rename — rename is atomic on POSIX, so a reader sees either the
  // old file or the new one, never a partial. (Single-flight below prevents the racing
  // writers in-process; this guards crashes and cross-process interleave.)
  //
  // mode 0o600: `codex login` creates auth.json owner-only, and rename REPLACES the
  // inode — a default-umask temp file would silently downgrade a live OAuth credential
  // to world-readable on the first refresh. The mode rides the temp file so the
  // credential is never on disk more open than 0600, even pre-rename.
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, body, { mode: 0o600 });
  renameSync(tmp, p);
  return next;
}

/** In-flight refresh promises, keyed by auth path. The refresh_token is SINGLE-USE:
 *  two concurrent expiring-token resolves both reading the same RT and both POSTing it
 *  = one wins, one gets `invalid_grant`, and the last write clobbers the winner's
 *  rotated token — bricking the session until manual `codex login`. Memoizing the
 *  in-flight refresh per path collapses concurrent callers onto ONE POST + ONE write. */
const inFlightRefresh = new Map<string, Promise<CodexTokens>>();

/**
 * Resolve a live Codex credential from ~/.codex/auth.json, refreshing in place if
 * the access token is expiring. With `allowRefresh: false` a stale token throws
 * instead of hitting the network — so a caller can require a CLI-fresh token and
 * never route the credential itself.
 */
export async function resolveCodexCredential(opts: { allowRefresh?: boolean } = {}): Promise<CodexCredential> {
  let tokens = readTokens();
  if (isExpiring(tokens.access_token)) {
    if (opts.allowRefresh === false) {
      throw new Error("Codex access token is expired and allowRefresh=false — run `codex login` to refresh it.");
    }
    // Single-flight: concurrent callers share ONE refresh (see inFlightRefresh above).
    const key = authPath();
    let pending = inFlightRefresh.get(key);
    if (!pending) {
      pending = refresh(tokens).finally(() => inFlightRefresh.delete(key));
      inFlightRefresh.set(key, pending);
    }
    tokens = await pending;
  }
  const acct = accountId(tokens);
  if (!acct) throw new Error("Could not determine chatgpt-account-id from the Codex token.");
  return { accessToken: tokens.access_token, accountId: acct, baseURL: CODEX_BASE_URL };
}
