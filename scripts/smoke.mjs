// Local by default. Hosted runs require explicit approval and --hosted-reset.
import assert from "node:assert/strict";

const base = process.env.DRAFT_TEST_URL || "http://127.0.0.1:3000";
const adminKey = process.env.ADMIN_KEY || "change-me-dev-admin-key";
const hostedReset = process.argv.includes("--hosted-reset");
async function call(path, body, key) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { "x-admin-key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data };
}
const admin = (action, payload = {}) =>
  call("/api/admin", { action, ...payload }, adminKey);
const snapshot = async () => {
  const r = await call("/api/state");
  assert.equal(r.status, 200);
  return r.data;
};
const initial = await snapshot();
if (initial.mode !== "local") {
  assert.ok(
    hostedReset,
    "Hosted smoke test requires explicit approval and --hosted-reset.",
  );
  assert.equal(new URL(base).protocol, "https:");
  assert.equal(initial.mode, "supabase");
  assert.equal(
    initial.draft.phase,
    "lobby",
    "Hosted draft must be an unused lobby.",
  );
  assert.equal(initial.draft.pick_index, 0);
  assert.equal(initial.draft.picks_per_team, 4);
  assert.equal(initial.captains.length, 8);
  assert.ok(initial.players.length >= 32);
  assert.ok(initial.players.every(p=>!p.present), "Hosted draft already has player check-ins.");
  assert.ok(
    initial.captains.every((c) => !c.claimed && !c.ready),
    "Hosted draft has occupied seats.",
  );
  assert.ok(
    initial.players.every((p) => p.team_captain_id === null),
    "Hosted draft already has picks.",
  );
}
assert.equal(
  (await admin("verify")).status,
  200,
  "Use the dev server ADMIN_KEY",
);
assert.equal(
  (await call("/api/admin", { action: "verify" }, "wrong-key")).status,
  401,
);
if (initial.mode === "local") await admin("full-reset");
try {
  assert.equal((await admin("settings", {picksPerTeam:3})).status, 409);
  assert.equal((await call("/api/admin", {action:"finish"}, "wrong-key")).status, 401);
  assert.equal((await admin("finish")).status, 409, "Only a running draft can finish");
  const shortRoster = initial.players.slice(0, 2);
  for (const p of shortRoster) {
    assert.equal((await call("/api/attendance", {action:"check-in",playerId:p.id})).status, 200);
  }
  assert.equal((await admin("start")).status, 200, "Admin can start with two present players and no claimed seats");
  assert.equal((await admin("pick", {playerId:shortRoster[0].id,expectedPickIndex:0})).status, 200);
  assert.equal((await admin("finish")).status, 200);
  assert.equal((await snapshot()).draft.phase, "review");
  assert.equal((await snapshot()).draft.pick_index, 1);
  assert.equal((await admin("pick", {playerId:shortRoster[1].id,expectedPickIndex:1})).status, 409);
  assert.equal((await admin("publish")).status, 200);
  assert.equal((await snapshot()).draft.phase, "complete");
  assert.equal((await snapshot()).players.find(p=>p.id===shortRoster[0].id).team_captain_id, initial.captains.find(c=>c.slot===1).id);
  assert.equal((await admin("full-reset")).status, 200);
  const attendance = new Map();
  for(const p of initial.players) {
    const r = await call("/api/attendance", {action:"check-in", playerId:p.id});
    assert.equal(r.status,200);
    attendance.set(p.id,r.data.token);
  }
  const withdrawn = initial.players.at(-1);
  assert.equal((await call("/api/attendance", {action:"leave",token:attendance.get(withdrawn.id)})).status,200);
  assert.equal((await call("/api/attendance", {action:"me",token:attendance.get(withdrawn.id)})).data.playerId,null);
  const clients = new Map();
  const races = await Promise.all(
    Array.from({ length: 8 }, () => call("/api/claim", { captainId: 1 })),
  );
  assert.equal(races.filter((r) => r.status === 200).length, 1);
  assert.equal(
    races.filter((r) => r.status === 409 && r.data.error === "Already taken")
      .length,
    7,
  );
  clients.set(1, races.find((r) => r.status === 200).data.token);
  for (const c of initial.captains.filter(c=>c.slot!==1)) {
    const r = await call("/api/claim", { captainId:c.id });
    assert.equal(r.status, 200);
    clients.set(c.slot, r.data.token);
  }
  for (const c of initial.captains) {
    const token = clients.get(c.slot);
    assert.equal((await call("/api/me", { token })).data.captainId, c.id);
    assert.equal((await call("/api/ready", {token,ready:true})).status,200);
    assert.equal((await snapshot()).draft.phase,"lobby");
  }
  assert.equal((await admin("start")).status,200);
  assert.equal((await call("/api/attendance", {action:"check-in", playerId:withdrawn.id})).status,409);
  assert.equal((await admin("pick", {playerId:withdrawn.id,expectedPickIndex:0})).status,409);
  const order = [
    1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1, 2, 3, 4, 5, 6, 7, 8, 8,
    7, 6, 5, 4, 3, 2, 1,
  ];
  for (let k = 0; k < 32; k++) {
    let s = await snapshot();
    const player = s.players.find((p) => p.present && p.team_captain_id === null);
    const token = clients.get(order[k]);
    const wrong = clients.get(order[k] === 1 ? 2 : 1);
    assert.equal(
      (
        await call("/api/pick", {
          token: wrong,
          playerId: player.id,
          expectedPickIndex: k,
        })
      ).status,
      409,
    );
    const r = await call("/api/pick", {
      token,
      playerId: player.id,
      expectedPickIndex: k,
    });
    assert.equal(r.status, 200);
    // Exact replay never advances, including consecutive snake-end turns.
    assert.notEqual(
      (
        await call("/api/pick", {
          token,
          playerId: player.id,
          expectedPickIndex: k,
        })
      ).status,
      200,
    );
    s = await snapshot();
    assert.equal(s.draft.pick_index, k + 1);
    const picked = s.players.find((p) => p.id === player.id);
    assert.equal(picked.team_captain_id, initial.captains.find(c=>c.slot===order[k]).id);
    assert.equal(picked.pick_number, k + 1);
  }
  let s = await snapshot();
  assert.equal(s.draft.phase, "review");
  assert.equal((await admin("publish")).status,200);
  assert.equal((await snapshot()).draft.phase,"complete");
  assert.equal(s.players.filter((p) => p.team_captain_id === null).length, initial.players.length - 32);
  for (const {id} of initial.captains)
    assert.equal(s.players.filter((p) => p.team_captain_id === id).length, 4);
  await admin("undo");
  s = await snapshot();
  assert.equal(s.draft.phase, "drafting");
  assert.equal(s.draft.pick_index, 31);
  const oldToken = clients.get(1);
  await admin("release", { captainId: 1 });
  assert.equal(
    (await call("/api/me", { token: oldToken })).data.captainId,
    null,
  );
  assert.equal(
    (
      await call("/api/pick", {
        token: oldToken,
        playerId: s.players.find((p) => p.present && p.team_captain_id === null).id,
        expectedPickIndex: 31,
      })
    ).status,
    403,
  );
  const reclaim = await call("/api/claim", { captainId: 1 });
  assert.equal(reclaim.status, 200);
  assert.notEqual(reclaim.data.token, oldToken);
  assert.equal((await admin("announcement", {message:"Next phase follows organizer approval."})).status,200);
  assert.equal((await snapshot()).draft.announcement,"Next phase follows organizer approval.");
  await admin("reset");
  s = await snapshot();
  assert.equal(s.draft.phase, "lobby");
  assert.equal(s.captains.filter((c) => c.claimed).length, 8);
  assert.equal(s.players.filter(p=>p.present).length,initial.players.length-1);
  assert.equal(
    s.captains.some((c) => c.ready),
    false,
  );
  assert.equal(
    s.players.every((p) => p.team_captain_id === null),
    true,
  );
  console.log(
    "PASS: HTTP attendance ownership, incomplete-roster phase overrides, manual phases, absent-pick rejection, 8-way claim race, 32 snake picks, publish, undo, revocation and resets.",
  );
} finally {
  await admin("full-reset");
}
console.log("Board restored to a fresh lobby.");
