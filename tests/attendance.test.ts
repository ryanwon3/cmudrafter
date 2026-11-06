import test from "node:test";
import assert from "node:assert/strict";
import { LocalStore } from "../src/lib/server/local-store";
import { CAPTAINS } from "../src/lib/server/seed-data";

async function present(s: LocalStore, count = 32) {
  for (let id = 1; id <= count; id++) await s.checkIn(id, `player-${id}`);
}

test("all ready waits for organizer approval; admin can start with fewer than 32 present", async () => {
  const s = new LocalStore();
  for (const { id } of CAPTAINS) {
    await s.claim(id, `captain-${id}`);
    assert.equal((await s.setReady(`captain-${id}`, true)).started, false);
  }
  assert.equal((await s.getState()).draft.phase, "lobby");
  await present(s, 31);
  await s.adminStart();
  assert.equal((await s.getState()).draft.phase, "drafting");
  assert.equal((await s.getState()).players.filter(p => p.present).length, 31);
});

test("admin can advance an empty draft through review and publish", async () => {
  const s = new LocalStore();
  await assert.rejects(s.adminFinish(), /running/);
  await s.adminStart();
  await assert.rejects(s.adminStart(), /already started/);
  await s.adminFinish();
  assert.equal((await s.getState()).draft.phase, "review");
  assert.equal((await s.getState()).draft.pick_index, 0);
  await assert.rejects(s.adminFinish(), /running/);
  await s.adminPublish();
  assert.equal((await s.getState()).draft.phase, "complete");
});

test("finishing an incomplete draft preserves picks, blocks new picks and supports undo", async () => {
  const s = new LocalStore();
  await present(s, 2);
  await s.adminStart();
  await assert.rejects(s.adminPick(3, 0), /not marked present/);
  await s.adminPick(1, 0);
  await s.adminFinish();
  const state = await s.getState();
  assert.equal(state.draft.phase, "review");
  assert.equal(state.draft.pick_index, 1);
  assert.equal(state.players.find(p => p.id === 1)?.team_captain_id, 1);
  await assert.rejects(s.adminPick(2, 1), /not running/);
  await s.adminPublish();
  await s.adminUndo();
  assert.equal((await s.getState()).draft.phase, "drafting");
  assert.equal((await s.getState()).players.find(p => p.id === 1)?.team_captain_id, null);
});

test("attendance is owned by a browser token and freezes when drafting begins", async () => {
  const s = new LocalStore();
  assert.ok((await s.getState()).players.every((p) => !p.present));
  await s.checkIn(1, "mine");
  assert.equal(await s.playerForToken("mine"), 1);
  await assert.rejects(s.checkIn(1, "someone-else"), /already checked in/i);
  await assert.rejects(s.leave("wrong"), /not checked in/i);
  await s.leave("mine");
  assert.equal(await s.playerForToken("mine"), null);
  await present(s);
  await s.adminStart();
  await assert.rejects(s.checkIn(33, "late"), /lobby/);
  await assert.rejects(s.leave("player-1"), /lobby/);
  await assert.rejects(s.adminSetAttendance(1, false), /lobby/);
});

test("absent players cannot be picked by captain or organizer", async () => {
  const s = new LocalStore();
  await present(s);
  await s.claim(1, "captain");
  await s.adminStart();
  await assert.rejects(s.pick("captain", 33, 0), /not marked present/);
  await assert.rejects(s.adminPick(33, 0), /not marked present/);
  assert.equal((await s.getState()).draft.pick_index, 0);
  await s.pick("captain", 1, 0);
});

test("organizer publishes after review; reset preserves attendance and full reset revokes it", async () => {
  const s = new LocalStore();
  await present(s);
  await s.adminAnnouncement("Draft starts after the attendance review.");
  assert.equal(
    (await s.getState()).draft.announcement,
    "Draft starts after the attendance review.",
  );
  await assert.rejects(s.adminPublish(), /review/);
  await s.adminStart();
  for (let id = 1; id <= 32; id++) await s.adminPick(id, id - 1);
  assert.equal((await s.getState()).draft.phase, "review");
  await assert.rejects(s.adminPick(33, 32), /not running/);
  await s.adminPublish();
  assert.equal((await s.getState()).draft.phase, "complete");
  await s.adminUndo();
  assert.equal((await s.getState()).draft.phase, "drafting");
  await s.adminReset(false);
  assert.equal(
    (await s.getState()).players.filter((p) => p.present).length,
    32,
  );
  assert.equal(await s.playerForToken("player-1"), 1);
  await s.adminReset(true);
  assert.ok((await s.getState()).players.every((p) => !p.present));
  assert.equal(await s.playerForToken("player-1"), null);
  assert.equal((await s.getState()).draft.announcement, "");
});

test("four picks per captain stays fixed and admin correction revokes attendance tokens", async () => {
  const s = new LocalStore();
  await assert.rejects(s.adminSetPicksPerTeam(3), /four picks/);
  await s.checkIn(1, "mine");
  await s.adminSetAttendance(1, false);
  assert.equal(await s.playerForToken("mine"), null);
  await s.checkIn(1, "new");
  await s.claim(1, "captain");
  await s.release("captain");
  assert.equal(await s.captainForToken("captain"), null);
  assert.equal((await s.getState()).captains[0].ready, false);
});

test("withdrawal before admin start stays absent; attendance remains frozen afterward", async () => {
  const s = new LocalStore();
  await present(s);
  const results = await Promise.allSettled([
    s.leave("player-1"),
    s.adminStart(),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "fulfilled");
  assert.equal((await s.getState()).draft.phase, "drafting");
  await assert.rejects(s.adminPick(1, 0), /not marked present/);
  await assert.rejects(s.checkIn(1, "late"), /lobby/);
});
