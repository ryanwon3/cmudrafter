// Exercises the real API, including PostgREST's safe-update checks on Supabase.
// Hosted use is limited to an event with no picks or attendance.
import assert from 'node:assert/strict';

const base = process.env.DRAFT_TEST_URL || 'http://127.0.0.1:3000';
const key = process.env.ADMIN_KEY || 'change-me-dev-admin-key';
const snapshot = async () => {
  const response = await fetch(base + '/api/state');
  assert.equal(response.status, 200);
  return response.json();
};
const before = await snapshot();
if (before.mode !== 'local') {
  assert.ok(process.argv.includes('--hosted-reset'), 'Hosted verification requires --hosted-reset.');
  assert.equal(new URL(base).protocol, 'https:');
  assert.equal(before.draft.pick_index, 0, 'Hosted event already has picks.');
  assert.ok(before.players.every(p => !p.present && p.team_captain_id === null && p.pick_number === null), 'Hosted event has attendance or picks.');
}
const response = await fetch(base + '/api/admin', {
  method: 'POST',
  headers: {'content-type': 'application/json', 'x-admin-key': key},
  body: JSON.stringify({action: 'reset'}),
});
assert.equal(response.status, 200, 'Regular reset must succeed through the real API.');
const after = await snapshot();
assert.equal(after.draft.phase, 'lobby');
assert.equal(after.draft.pick_index, 0);
assert.equal(after.draft.started_at, null);
assert.equal(after.draft.announcement, '');
assert.ok(after.captains.every(c => !c.ready));
assert.deepEqual(after.captains.map(c => [c.id, c.claimed]), before.captains.map(c => [c.id, c.claimed]));
assert.deepEqual(after.players.map(p => [p.id, p.present]), before.players.map(p => [p.id, p.present]));
assert.ok(after.players.every(p => p.team_captain_id === null && p.pick_number === null));
console.log('PASS: regular reset succeeds through the API, returns to lobby, and preserves seats and attendance.');
