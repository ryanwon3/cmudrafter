import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { verifyReset } from "../scripts/verify-reset.mjs";
import type { DraftState } from "../src/lib/types";

const HOSTED = "https://draft.example.test";
const KEY = "test-admin-key";

function lobby(mode: DraftState["mode"] = "supabase"): DraftState {
  return {
    mode,
    draft: {
      id: 1, phase: "lobby", pick_index: 0, picks_per_team: 4, started_at: null,
      updated_at: "", announcement: "", bracket: null, bracket_revision: 3,
    },
    captains: [1, 2, 4, 5, 6, 7, 8, 9].map((id, i) => ({
      id, slot: i + 1, display_name: `C${id}`, riot_id: `C${id}#NA1`, opgg_url: "",
      peak_rank: "Diamond 1", rank_score: 20, claimed: i < 3, ready: false,
    })),
    players: [1, 2].map((id) => ({
      id, display_name: `P${id}`, riot_id: `P${id}#NA1`, opgg_url: "", peak_rank: "Gold 1",
      rank_score: 10, team_captain_id: null, pick_number: null, present: false,
    })),
  };
}

// What a correct regular reset returns: lobby, seats and attendance kept, bracket cleared.
function resetOf(s: DraftState): DraftState {
  const next = structuredClone(s);
  Object.assign(next.draft, {
    phase: "lobby", pick_index: 0, started_at: null, announcement: "",
    bracket: null, bracket_revision: s.draft.bracket_revision + 1,
  });
  next.captains.forEach((c) => (c.ready = false));
  next.players.forEach((p) => Object.assign(p, { team_captain_id: null, pick_number: null }));
  return next;
}

/** A fake API that records every request. */
function fakeApi(before: DraftState, after: (s: DraftState) => DraftState = resetOf) {
  const calls: { method: string; path: string; key?: string; body?: unknown }[] = [];
  let current = before;
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    calls.push({
      method, path: url.pathname, key: headers.get("x-admin-key") ?? undefined,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (method === "GET" && url.pathname === "/api/state") return Response.json(current);
    if (method === "POST" && url.pathname === "/api/admin") {
      current = after(current);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }) as typeof globalThis.fetch;
  return { fetch, calls, posts: () => calls.filter((c) => c.method === "POST") };
}

const unsafe: [string, (s: DraftState) => void, RegExp][] = [
  ["drafting phase with no picks", (s) => { s.draft.phase = "drafting"; }, /not in the lobby/],
  ["review phase", (s) => { s.draft.phase = "review"; }, /not in the lobby/],
  ["existing picks", (s) => { s.draft.pick_index = 1; s.players[0].team_captain_id = 1; s.players[0].pick_number = 1; }, /picks/],
  ["player attendance", (s) => { s.players[0].present = true; }, /attendance/],
  ["a Ready captain", (s) => { s.captains[0].ready = true; }, /Ready/],
  ["an announcement", (s) => { s.draft.announcement = "Doors open at 7"; }, /announcement/],
  ["an existing bracket", (s) => { s.draft.bracket = { seeds: [1, 2, 4, 5, 6, 7, 8, 9], winners: {} }; }, /bracket/],
  ["an unknown store mode", (s) => { (s as { mode: string }).mode = "hosted"; }, /Unknown store mode/],
];

for (const [name, mutate, message] of unsafe) {
  test(`hosted verification refuses ${name} before any mutation`, async () => {
    const before = lobby();
    mutate(before);
    const api = fakeApi(before);
    await assert.rejects(
      verifyReset({ base: HOSTED, key: KEY, hostedReset: true, fetch: api.fetch }),
      message,
    );
    assert.deepEqual(api.posts(), []);
  });
}

test("hosted verification refuses without --hosted-reset or over plain HTTP before any mutation", async () => {
  const noFlag = fakeApi(lobby());
  await assert.rejects(verifyReset({ base: HOSTED, key: KEY, fetch: noFlag.fetch }), /--hosted-reset/);
  assert.deepEqual(noFlag.posts(), []);
  const http = fakeApi(lobby());
  await assert.rejects(
    verifyReset({ base: "http://draft.example.test", key: KEY, hostedReset: true, fetch: http.fetch }),
    /https:/,
  );
  assert.deepEqual(http.posts(), []);
});

test("an authorized empty hosted lobby resets once, keeps claimed seats and passes postconditions", async () => {
  const api = fakeApi(lobby());
  await verifyReset({ base: HOSTED, key: KEY, hostedReset: true, fetch: api.fetch });
  assert.deepEqual(api.posts(), [{ method: "POST", path: "/api/admin", key: KEY, body: { action: "reset" } }]);
  assert.deepEqual(api.calls.map((c) => `${c.method} ${c.path}`), ["GET /api/state", "POST /api/admin", "GET /api/state"]);
});

const badResets: [string, (s: DraftState) => DraftState, RegExp | undefined][] = [
  ["leaves a bracket", (s) => { const n = resetOf(s); n.draft.bracket = { seeds: [1, 2, 4, 5, 6, 7, 8, 9], winners: {} }; return n; }, undefined],
  ["does not advance the bracket revision", (s) => { const n = resetOf(s); n.draft.bracket_revision = s.draft.bracket_revision; return n; }, /bracket revision/],
  ["rewinds the bracket revision", (s) => { const n = resetOf(s); n.draft.bracket_revision = 0; return n; }, /bracket revision/],
  ["switches store mode", (s) => ({ ...resetOf(s), mode: "local" }), /mode changed/],
  ["drops a claimed seat", (s) => { const n = resetOf(s); n.captains[0].claimed = false; return n; }, undefined],
];

for (const [name, after, message] of badResets) {
  test(`verification fails when the reset ${name}`, async () => {
    const api = fakeApi(lobby(), after);
    await assert.rejects(verifyReset({ base: HOSTED, key: KEY, hostedReset: true, fetch: api.fetch }), message ?? assert.AssertionError);
  });
}

test("local verification still resets an active practice draft and keeps seats and attendance", async () => {
  const before = lobby("local");
  Object.assign(before.draft, { phase: "complete", pick_index: 1, announcement: "Practice", bracket: { seeds: [1, 2, 4, 5, 6, 7, 8, 9], winners: { qf1: 1 } } });
  before.captains[0].ready = true;
  Object.assign(before.players[0], { present: true, team_captain_id: 1, pick_number: 1 });
  const api = fakeApi(before);
  await verifyReset({ base: "http://127.0.0.1:1", key: KEY, fetch: api.fetch });
  assert.equal(api.posts().length, 1);
});

/** Runs the script as the CLI does, against a local stub server. */
async function runCli(state: DraftState, args: string[] = []) {
  let current = state;
  const posts: string[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (req.method === "POST") {
        posts.push(`${req.headers["x-admin-key"]} ${body}`);
        current = resetOf(current);
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(req.method === "POST" ? { ok: true } : current));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const child = spawn(process.execPath, ["scripts/verify-reset.mjs", ...args], {
      env: { ...process.env, DRAFT_TEST_URL: `http://127.0.0.1:${port}`, ADMIN_KEY: KEY },
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
    return { code, output, posts };
  } finally {
    server.close();
  }
}

test("CLI verifies a local practice server with the configured admin key", async () => {
  const run = await runCli(lobby("local"));
  assert.equal(run.code, 0, run.output);
  assert.match(run.output, /PASS: regular reset/);
  assert.deepEqual(run.posts, [`${KEY} {"action":"reset"}`]);
});

test("CLI refuses a hosted store without mutating it, even with --hosted-reset", async () => {
  const withoutFlag = await runCli(lobby("supabase"));
  assert.notEqual(withoutFlag.code, 0);
  assert.match(withoutFlag.output, /--hosted-reset/);
  assert.deepEqual(withoutFlag.posts, []);
  const overHttp = await runCli(lobby("supabase"), ["--hosted-reset"]);
  assert.notEqual(overHttp.code, 0);
  assert.deepEqual(overHttp.posts, []);
});
