import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LocalStore } from '../src/lib/server/local-store';
import { slotOnClock } from '../src/lib/server/rules';
import { CAPTAINS, PLAYERS } from '../src/lib/server/seed-data';
import { hashToken, newToken, requireAdmin } from '../src/lib/server/tokens';
import { isProductionRuntime } from '../src/lib/server/index';
import { DraftError } from '../src/lib/server/errors';

const SNAKE = [1,2,3,4,5,6,7,8,8,7,6,5,4,3,2,1,1,2,3,4,5,6,7,8,8,7,6,5,4,3,2,1];

async function claimAll(s: LocalStore) {
  for (const c of CAPTAINS) await s.claim(c.id, `hash-${c.id}`);
}
async function presentAll(s: LocalStore) {
  for (let id=1;id<=PLAYERS.length;id++) await s.checkIn(id, `p-${id}`);
}
async function startDraft(s: LocalStore) {
  await presentAll(s);
  await claimAll(s);
  for (const c of CAPTAINS) await s.setReady(`hash-${c.id}`, true);
  await s.adminStart();
}
async function bestAvailable(s: LocalStore) {
  return (await s.getState()).players.find((p) => p.team_captain_id === null)!;
}
const rejects = (p: Promise<unknown>, msg: RegExp | string) =>
  assert.rejects(p, (e: unknown) => e instanceof DraftError && (typeof msg === 'string' ? e.message === msg : msg.test(e.message)));

test('snake order matches the spec', () => {
  assert.deepEqual(SNAKE.map((_, k) => slotOnClock(k)), SNAKE);
});

test('seed data matches supabase/seed.sql exactly', () => {
  const sql = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
  assert.equal(CAPTAINS.length, 8);
  assert.ok(PLAYERS.length >= 32);
  for (const row of [...CAPTAINS, ...PLAYERS]) {
    const esc = (v: string) => v.replace(/'/g, "''");
    for (const v of [row.display_name, row.riot_id, row.opgg_url, row.peak_rank]) {
      assert.ok(sql.includes(`'${esc(v)}'`), `seed.sql is missing ${v}`);
    }
  }
  // Captains are never in the pool.
  const capIds = new Set(CAPTAINS.map((c) => c.riot_id));
  assert.ok(PLAYERS.every((p) => !capIds.has(p.riot_id)));
  // Pool is listed highest rank first.
  assert.deepEqual(PLAYERS.map((p) => p.rank_score), [...PLAYERS.map((p) => p.rank_score)].sort((a, b) => b - a));
});

test('second claim on the same name fails with "Already taken"', async () => {
  const s = new LocalStore();
  await s.claim(1, 'a');
  await rejects(s.claim(1, 'b'), 'Already taken');
  assert.equal(await s.captainForToken('a'), 1);
  assert.equal(await s.captainForToken('b'), null);
});

test('release frees the name in the lobby only', async () => {
  const s = new LocalStore();
  await s.claim(1, 'a');
  await s.release('a');
  assert.equal((await s.getState()).captains[0].claimed, false);
  assert.equal(await s.captainForToken('a'), null);
  await startDraft(s);
  await rejects(s.release('hash-1'), /lobby/);
});

test('ready never starts automatically; organizer approves after attendance', async () => {
  const s = new LocalStore();
  await claimAll(s);
  for (const c of CAPTAINS.slice(0, 7)) await s.setReady(`hash-${c.id}`, true);
  await s.setReady('hash-1', false);
  await s.setReady(`hash-${CAPTAINS.at(-1)!.id}`, true);
  assert.equal((await s.getState()).draft.phase, 'lobby');
  const r = await s.setReady('hash-1', true);
  assert.equal(r.started, false);
  await presentAll(s);
  await s.adminStart();
  assert.equal((await s.getState()).draft.phase, 'drafting');
  await rejects(s.setReady('hash-1', false), /already started/);
});

test('32 picks follow snake order; only the captain on the clock can pick', async () => {
  const s = new LocalStore();
  await startDraft(s);
  for (let k = 0; k < 32; k++) {
    const slot = SNAKE[k];
    const captainId = CAPTAINS.find(c => c.slot === slot)!.id;
    const wrong = CAPTAINS.find(c => c.slot === (slot % 8) + 1)!.id;
    const p = await bestAvailable(s);
    await rejects(s.pick(`hash-${wrong}`, p.id), /^It's .+'s pick$/);
    const res = await s.pick(`hash-${captainId}`, p.id, k);
    assert.equal(res.pick, k + 1);
  }
  const st = await s.getState();
  assert.equal(st.draft.phase, 'review');
  await s.adminPublish();
  assert.equal(st.players.filter((p) => p.team_captain_id === null).length, PLAYERS.length - 32);
  for (const c of st.captains) assert.equal(st.players.filter((p) => p.team_captain_id === c.id).length, 4);
  await rejects(s.pick('hash-1', st.players[34].id), /not running/);
});

test('already drafted, stale board, unknown token and lobby picks are rejected', async () => {
  const s = new LocalStore();
  const p = await bestAvailable(s);
  await claimAll(s);
  await rejects(s.pick('hash-1', p.id), /not running/);
  for (const c of CAPTAINS) await s.setReady(`hash-${c.id}`, true);
  await presentAll(s);
  await s.adminStart();
  await s.pick('hash-1', p.id);
  await rejects(s.pick('hash-2', p.id), `${p.display_name} was already drafted`);
  await rejects(s.pick('hash-2', (await bestAvailable(s)).id, 0), 'The board changed. Try again.');
  await rejects(s.pick('nobody', (await bestAvailable(s)).id), 'You are not a captain');
});

test('two simultaneous picks cannot both succeed', async () => {
  const s = new LocalStore();
  await startDraft(s);
  const p = await bestAvailable(s);
  const results = await Promise.allSettled([s.pick('hash-1', p.id, 0), s.pick('hash-1', p.id, 0)]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await s.getState()).draft.pick_index, 1);
});

test('admin undo returns the player and the turn, including from complete', async () => {
  const s = new LocalStore();
  await startDraft(s);
  for (let k = 0; k < 32; k++) await s.adminPick((await bestAvailable(s)).id);
  await s.adminUndo();
  let st = await s.getState();
  assert.equal(st.draft.phase, 'drafting');
  assert.equal(st.draft.pick_index, 31);
  assert.equal(st.players.filter((p) => p.team_captain_id === null).length, PLAYERS.length - 31);
  // Pick 32 belongs to Chomania (slot 1); pick 31 to Admirality.
  await s.adminUndo();
  st = await s.getState();
  assert.equal(st.draft.pick_index, 30);
  await rejects(s.pick('hash-1', (await bestAvailable(s)).id), /Admirality's pick/);
  await s.pick('hash-2', (await bestAvailable(s)).id);
});

test('admin release revokes the token and allows reclaim mid-draft', async () => {
  const s = new LocalStore();
  await startDraft(s);
  const id = CAPTAINS.find(c => c.slot === 3)!.id;
  await s.adminRelease(id);
  assert.equal(await s.captainForToken(`hash-${id}`), null);
  await s.claim(id, 'new-device');
  assert.equal(await s.captainForToken('new-device'), id);
});

test('force start, picks per team, reset and full reset', async () => {
  const s = new LocalStore();
  await rejects(s.adminSetPicksPerTeam(5), /four picks/);
  await rejects(s.adminSetPicksPerTeam(3), /four picks/);
  await s.adminSetPicksPerTeam(4);
  await presentAll(s);
  await s.claim(1, 'a');
  await s.adminStart();
  await rejects(s.adminSetPicksPerTeam(4), /lobby/);
  for (let k = 0; k < 32; k++) await s.adminPick((await bestAvailable(s)).id);
  assert.equal((await s.getState()).draft.phase, 'review');
  await s.adminPublish();
  await s.adminReset(false);
  let st = await s.getState();
  assert.equal(st.draft.phase, 'lobby');
  assert.equal(st.captains[0].claimed, true);
  assert.ok(st.players.every((p) => p.team_captain_id === null && p.pick_number === null));
  await s.adminReset(true);
  st = await s.getState();
  assert.ok(st.captains.every((c) => !c.claimed && !c.ready));
  assert.equal(await s.captainForToken('a'), null);
});

test('getState returns a copy, sorted', async () => {
  const s = new LocalStore();
  const a = await s.getState();
  a.captains[0].claimed = true;
  assert.equal((await s.getState()).captains[0].claimed, false);
  assert.deepEqual(a.captains.map((c) => c.slot), [1,2,3,4,5,6,7,8]);
});

test('tokens are random and hashed', () => {
  const t = newToken();
  assert.ok(t.length >= 40);
  assert.notEqual(t, newToken());
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
});

test('admin key check', () => {
  const req = (key?: string) => new Request('http://x', { headers: key ? { 'x-admin-key': key } : {} });
  const old = process.env.ADMIN_KEY;
  try {
    delete process.env.ADMIN_KEY;
    assert.throws(() => requireAdmin(req('x')), /ADMIN_KEY is not set/);
    process.env.ADMIN_KEY = 'secret-key-123';
    assert.throws(() => requireAdmin(req('wrong')), /Wrong admin key/);
    assert.throws(() => requireAdmin(req()), /Wrong admin key/);
    assert.doesNotThrow(() => requireAdmin(req('secret-key-123')));
  } finally {
    if (old === undefined) delete process.env.ADMIN_KEY; else process.env.ADMIN_KEY = old;
  }
});

test('local store is refused in production', () => {
  assert.equal(isProductionRuntime({ NODE_ENV: 'production' } as NodeJS.ProcessEnv), true);
  assert.equal(isProductionRuntime({ NODE_ENV: 'development', VERCEL: '1' } as NodeJS.ProcessEnv), true);
  assert.equal(isProductionRuntime({ NODE_ENV: 'development' } as NodeJS.ProcessEnv), false);
});
