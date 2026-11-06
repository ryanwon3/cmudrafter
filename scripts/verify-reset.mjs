// Exercises the real API, including PostgREST's safe-update checks on Supabase.
// Hosted use is limited to an unused lobby: no picks, attendance, Ready, announcement or bracket.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function verifyReset({
  base = 'http://127.0.0.1:3000',
  key = 'change-me-dev-admin-key',
  hostedReset = false,
  fetch = globalThis.fetch,
} = {}) {
  const snapshot = async () => {
    const response = await fetch(base + '/api/state');
    assert.equal(response.status, 200);
    return response.json();
  };
  const before = await snapshot();
  assert.ok(['local', 'supabase'].includes(before.mode), `Unknown store mode: ${before.mode}`);
  if (before.mode !== 'local') {
    assert.ok(hostedReset, 'Hosted verification requires --hosted-reset.');
    assert.equal(new URL(base).protocol, 'https:');
    assert.equal(before.draft.phase, 'lobby', 'Hosted event is not in the lobby.');
    assert.equal(before.draft.pick_index, 0, 'Hosted event already has picks.');
    assert.ok(before.players.every(p => !p.present && p.team_captain_id === null && p.pick_number === null), 'Hosted event has attendance or picks.');
    assert.ok(before.captains.every(c => !c.ready), 'Hosted event has Ready captains.');
    assert.equal(before.draft.announcement, '', 'Hosted event has an announcement.');
    assert.equal(before.draft.bracket, null, 'Hosted event has a bracket.');
  }
  assert.ok(Number.isSafeInteger(before.draft.bracket_revision), 'bracket_revision must be a whole number.');
  const response = await fetch(base + '/api/admin', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-admin-key': key},
    body: JSON.stringify({action: 'reset'}),
  });
  assert.equal(response.status, 200, 'Regular reset must succeed through the real API.');
  const after = await snapshot();
  assert.equal(after.mode, before.mode, 'Store mode changed during verification.');
  assert.equal(after.draft.phase, 'lobby');
  assert.equal(after.draft.pick_index, 0);
  assert.equal(after.draft.started_at, null);
  assert.equal(after.draft.announcement, '');
  assert.equal(after.draft.bracket, null);
  assert.ok(after.draft.bracket_revision > before.draft.bracket_revision, 'Reset must advance the bracket revision.');
  assert.ok(after.captains.every(c => !c.ready));
  assert.deepEqual(after.captains.map(c => [c.id, c.claimed]), before.captains.map(c => [c.id, c.claimed]));
  assert.deepEqual(after.players.map(p => [p.id, p.present]), before.players.map(p => [p.id, p.present]));
  assert.ok(after.players.every(p => p.team_captain_id === null && p.pick_number === null));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // No top-level await, so CommonJS test runners can import verifyReset.
  verifyReset({
    base: process.env.DRAFT_TEST_URL || 'http://127.0.0.1:3000',
    key: process.env.ADMIN_KEY || 'change-me-dev-admin-key',
    hostedReset: process.argv.includes('--hosted-reset'),
  }).then(
    () => console.log('PASS: regular reset succeeds through the API, returns to lobby, and preserves seats and attendance.'),
    (error) => { console.error(error); process.exitCode = 1; },
  );
}
