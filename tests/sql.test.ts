import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create publication supabase_realtime;
    create function unrelated_healthcheck() returns int language sql as 'select 1';`);
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  return db;
}

test('PostgreSQL attendance, manual phase approval and private tokens match the local rules', async () => {
  const db = await database();
  try {
    await db.exec("select check_in_player(1,'mine');");
    assert.equal((await db.query<{id:number}>("select player_for_token('mine') as id")).rows[0].id, 1);
    await assert.rejects(db.exec("select check_in_player(1,'other')"), /already checked in/i);
    await assert.rejects(db.exec("select release_player('other')"), /not checked in/i);
    await db.exec("select release_player('mine');");
    await db.exec("select claim_captain(id,'c'||id) from captains; select set_ready('c'||id,true) from captains;");
    assert.equal((await db.query<{phase:string}>('select phase from draft')).rows[0].phase,'lobby');
    for (let id=1;id<=32;id++) await db.exec(`select check_in_player(${id},'p${id}');`);
    await db.exec('select admin_force_start();');
    await assert.rejects(db.exec('select admin_set_attendance(1,false)'), /lobby/);
    await assert.rejects(db.exec("select release_player('p1')"), /lobby/);
    await assert.rejects(db.exec('select admin_pick(33,0)'), /not marked present/);
    for(let id=1;id<=32;id++) await db.exec(`select admin_pick(${id},${id-1})`);
    assert.equal((await db.query<{phase:string}>('select phase from draft')).rows[0].phase,'review');
    await db.exec('select admin_publish_results(); select admin_reset(false);');
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from players where present')).rows[0].n,32);
    await db.exec('select admin_reset(true);');
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from player_tokens')).rows[0].n,0);
    await db.exec('set role anon');
    await assert.rejects(db.exec('select * from player_tokens'), /permission denied/);
    await assert.rejects(db.exec("select check_in_player(1,'public')"), /permission denied/);
  } finally { await db.close(); }
});

test('PostgreSQL admin can advance incomplete rosters while phase and access rules remain enforced', async () => {
  const db = await database();
  try {
    await assert.rejects(db.exec('select admin_finish_draft()'), /not running/);
    await db.exec("select check_in_player(1,'present'); select admin_force_start();");
    await assert.rejects(db.exec('select admin_force_start()'), /already started/);
    await assert.rejects(db.exec('select admin_pick(2,0)'), /not marked present/);
    await db.exec('select admin_pick(1,0); select admin_finish_draft();');
    assert.deepEqual((await db.query('select phase,pick_index from draft')).rows, [{phase:'review',pick_index:1}]);
    assert.equal((await db.query<{id:number}>('select team_captain_id as id from players where id=1')).rows[0].id,1);
    await assert.rejects(db.exec('select admin_pick(2,1)'), /not running/);
    await assert.rejects(db.exec('select admin_finish_draft()'), /not running/);
    await db.exec('select admin_publish_results(); select admin_undo();');
    assert.deepEqual((await db.query('select phase,pick_index from draft')).rows, [{phase:'drafting',pick_index:0}]);
    await db.exec('select admin_reset(true); select admin_force_start(); select admin_finish_draft(); select admin_publish_results();');
    assert.deepEqual((await db.query('select phase,pick_index from draft')).rows, [{phase:'complete',pick_index:0}]);
    await db.exec('set role anon');
    await assert.rejects(db.exec('select admin_force_start()'), /permission denied/);
    await assert.rejects(db.exec('select admin_finish_draft()'), /permission denied/);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(db.exec('select admin_finish_draft()'), /permission denied/);
  } finally { await db.close(); }
});

test('tracked attendance upgrade preserves an existing captain claim and token', async () => {
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create publication supabase_realtime;');
    await db.exec(readFileSync('supabase/migrations/20261105203908_initialize_inhouse_draft.sql','utf8'));
    await db.exec("select claim_captain(1,'existing-captain');");
    await db.exec(readFileSync('supabase/migrations/20261106035130_attendance_and_admin_phases.sql','utf8'));
    assert.equal((await db.query<{id:number}>("select captain_for_token('existing-captain') as id")).rows[0].id,1);
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from players where present')).rows[0].n,0);
    assert.equal((await db.query<{n:number}>('select count(*)::int as n from captains where claimed')).rows[0].n,1);
  }finally{await db.close();}
});

test('tracked phase override upgrade preserves a running draft and supports early review', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create publication supabase_realtime;');
    await db.exec(readFileSync('supabase/migrations/20261105203908_initialize_inhouse_draft.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20261106035130_attendance_and_admin_phases.sql','utf8'));
    await db.exec("select check_in_player(id,'p'||id) from players; select claim_captain(1,'captain'); select admin_force_start(); select admin_pick(1,0);");
    const before = (await db.query('select get_state() as state')).rows[0];
    const migration = readFileSync('supabase/migrations/20261106060543_admin_incomplete_roster_phases.sql','utf8');
    await db.exec(migration);
    assert.deepEqual((await db.query('select get_state() as state')).rows[0], before);
    assert.equal((await db.query<{id:number}>("select captain_for_token('captain') as id")).rows[0].id, 1);
    await db.exec(migration);
    await db.exec('set role service_role; select admin_finish_draft(); select admin_publish_results(); select admin_reset(true); select admin_force_start(); select admin_finish_draft();');
    assert.deepEqual((await db.query('select phase,pick_index from draft')).rows, [{phase:'review',pick_index:0}]);
  } finally { await db.close(); }
});

test("actual PostgreSQL schema passes the 32-pick SQL acceptance suite and RLS checks", async () => {
  const db = await database();
  try {
    await db.exec(readFileSync("supabase/tests/draft_test.sql", "utf8"));
  } finally {
    await db.close();
  }
});

test("installing draft functions preserves unrelated public RPC access", async () => {
  const db = await database();
  try {
    await db.exec("set role anon");
    const result = await db.query<{ value: number }>(
      "select unrelated_healthcheck() as value",
    );
    assert.equal(result.rows[0].value, 1);
  } finally {
    await db.close();
  }
});

test("snapshot uses the app schema even when a caller changes search_path", async () => {
  const db = await database();
  try {
    await db.exec(`create schema shadow;
      create table shadow.draft (like public.draft including all);
      insert into shadow.draft (id,phase,pick_index,picks_per_team) values (1,'complete',999,4);
      set search_path = shadow, public;`);
    const result = await db.query<{
      state: { draft: { phase: string; pick_index: number } };
    }>("select public.get_state() as state");
    assert.equal(result.rows[0].state.draft.phase, "lobby");
    assert.equal(result.rows[0].state.draft.pick_index, 0);
  } finally {
    await db.close();
  }
});

test("captain pick holds the draft lock before resolving its claim token", async () => {
  const db = await database();
  try {
    await db.exec(
      "select check_in_player(id,'p' || id) from players; select claim_captain(1,'token'); select admin_force_start();",
    );
    // Inspect the database's real lock state at the token lookup boundary.
    await db.exec(`create or replace function captain_for_token(p_token_hash text) returns int
      language plpgsql volatile as $$ begin
        if not exists(select 1 from pg_locks where relation='draft'::regclass
          and mode='RowShareLock' and granted and pid=pg_backend_pid()) then
          raise exception 'Token lookup ran before acquiring the draft lock';
        end if;
        return (select captain_id from captain_tokens where token_hash=p_token_hash);
      end $$;`);
    const result = await db.query<{ result: { pick: number } }>(
      "select make_pick('token',1,0) as result",
    );
    assert.equal(result.rows[0].result.pick, 1);
  } finally {
    await db.close();
  }
});
