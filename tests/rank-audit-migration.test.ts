import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const directory = 'supabase/migrations';
const auditName = () => readdirSync(directory).find(name => name.endsWith('_audit_opgg_peak_ranks.sql'))!;
const migration = () => readFileSync(`${directory}/${auditName()}`, 'utf8');

async function database() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create publication supabase_realtime;');
  for (const file of readdirSync(directory).filter(name => name.endsWith('.sql') && name !== auditName()).sort()) {
    await db.exec(readFileSync(`${directory}/${file}`, 'utf8'));
  }
  return db;
}

async function preservedState(db: PGlite) {
  return (await db.query(`select json_build_object(
    'draft', (select row_to_json(d) from draft d),
    'captains', (select json_agg(to_jsonb(c)-'peak_rank'-'rank_score' order by id) from captains c),
    'players', (select json_agg(to_jsonb(p)-'peak_rank'-'rank_score' order by id) from players p),
    'captain_tokens', (select json_agg(t order by token_hash) from captain_tokens t),
    'player_tokens', (select json_agg(t order by token_hash) from player_tokens t)
  ) as state`)).rows[0];
}

test('rank audit upgrades an occupied draft without changing event state and can be reapplied', async () => {
  const db = await database();
  try {
    await db.exec("select claim_captain(1,'rank-audit-captain'); select set_ready('rank-audit-captain',true); select check_in_player(id,'rank-audit-player-'||id) from players; select admin_force_start(); select admin_pick(12,0);");
    const before = await preservedState(db);
    await db.exec(migration());
    assert.deepEqual((await db.query("select peak_rank,rank_score::float from players where riot_id='Yazurak#000'")).rows, [
      { peak_rank: 'Diamond 2 31 LP (S2026)', rank_score: 26.31 },
    ]);
    assert.deepEqual(await preservedState(db), before);
    const upgraded = (await db.query('select get_state() as state')).rows;
    await db.exec(migration());
    assert.deepEqual((await db.query('select get_state() as state')).rows, upgraded);
    await db.exec('select admin_finish_draft(); select admin_publish_results(); select admin_bracket_result(\'qf1\',1,0);');
    const bracket = await preservedState(db);
    await db.exec(migration());
    assert.deepEqual(await preservedState(db), bracket);
  } finally { await db.close(); }
});

test('rank audit rejects a missing identity atomically', async () => {
  const db = await database();
  try {
    await db.exec("update players set riot_id='changed-account#test' where riot_id='Yazurak#000';");
    const before = (await db.query('select get_state() as state')).rows;
    await assert.rejects(db.exec(migration()), /rank audit.*identit/i);
    assert.deepEqual((await db.query('select get_state() as state')).rows, before);
  } finally { await db.close(); }
});
