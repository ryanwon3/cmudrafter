import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const defaultSeeds = [1, 9, 5, 6, 2, 8, 4, 7];
const setup = `create role anon; create role authenticated; create role service_role bypassrls;
  create publication supabase_realtime;
  create function unrelated_healthcheck() returns int language sql as 'select 1';`;

type Bracket = { seeds: number[]; winners: Record<string, number> };
type Draft = { bracket: Bracket | null; bracket_revision: number; updated_at: string; phase: string; pick_index: number };

async function database() {
  const db = new PGlite();
  await db.exec(setup);
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  return db;
}

async function draft(db: PGlite) {
  return (await db.query<Draft>("select bracket,bracket_revision,updated_at::text,phase,pick_index from draft where id=1")).rows[0];
}

async function publish(db: PGlite) {
  await db.exec("select admin_force_start(); select admin_finish_draft(); select admin_publish_results();");
}

async function result(db: PGlite, match: string, winner: number | null) {
  const current = await draft(db);
  await db.query("select admin_bracket_result($1,$2,$3)", [match, winner, current.bracket_revision]);
}

async function finishBracket(db: PGlite) {
  await result(db, "qf1", 1);
  await result(db, "qf2", 5);
  await result(db, "qf3", 2);
  await result(db, "qf4", 4);
  await result(db, "sf1", 1);
  await result(db, "sf2", 2);
  await result(db, "final", 1);
}

test("PostgreSQL derives default seeds by captain slot and initializes an explicit seed edit", async () => {
  const db = await database();
  try {
    assert.equal((await draft(db)).bracket, null);
    assert.equal((await draft(db)).bracket_revision, 0);
    assert.deepEqual((await db.query<{ bracket: Bracket }>("select default_bracket() as bracket")).rows[0].bracket, {
      seeds: defaultSeeds, winners: {},
    });
    await publish(db);
    await db.exec("update draft set updated_at='2000-01-01' where id=1;");
    await db.query("select admin_bracket_seeds($1,0)", [defaultSeeds]);
    const initialized = await draft(db);
    assert.deepEqual(initialized.bracket, { seeds: defaultSeeds, winners: {} });
    assert.equal(initialized.bracket_revision, 1);
    assert.ok(Date.parse(initialized.updated_at) > Date.parse("2000-01-01"));
    await db.query("select admin_bracket_seeds($1,1)", [defaultSeeds]);
    assert.deepEqual(await draft(db), initialized);
  } finally { await db.close(); }
});

test("PostgreSQL records all seven bracket matches with revisions and a champion", async () => {
  const db = await database();
  try {
    await publish(db);
    await finishBracket(db);
    const completed = await draft(db);
    assert.deepEqual(completed.bracket, {
      seeds: defaultSeeds,
      winners: { qf1: 1, qf2: 5, qf3: 2, qf4: 4, sf1: 1, sf2: 2, final: 1 },
    });
    assert.equal(completed.bracket_revision, 7);
    assert.equal(completed.phase, "complete");
    await result(db, "final", 1);
    assert.deepEqual(await draft(db), completed);
    await db.exec("update draft set updated_at='2000-01-01' where id=1;");
    await result(db, "final", null);
    const cleared = await draft(db);
    assert.equal(cleared.bracket_revision, 8);
    assert.equal(cleared.bracket?.winners.final, undefined);
    assert.ok(Date.parse(cleared.updated_at) > Date.parse("2000-01-01"));
  } finally { await db.close(); }
});

test("PostgreSQL corrections and clearing invalidate only descendant matches", async () => {
  const db = await database();
  try {
    await publish(db);
    await finishBracket(db);
    await result(db, "qf1", 9);
    assert.deepEqual((await draft(db)).bracket?.winners, { qf1: 9, qf2: 5, qf3: 2, qf4: 4, sf2: 2 });
    await result(db, "sf1", 9);
    await result(db, "final", 9);
    await result(db, "sf2", 4);
    assert.deepEqual((await draft(db)).bracket?.winners, { qf1: 9, qf2: 5, qf3: 2, qf4: 4, sf1: 9, sf2: 4 });
    await result(db, "final", 4);
    await result(db, "qf3", null);
    assert.deepEqual((await draft(db)).bracket?.winners, { qf1: 9, qf2: 5, qf4: 4, sf1: 9 });
    const cleared = await draft(db);
    await result(db, "qf3", null);
    await result(db, "sf2", null);
    assert.deepEqual(await draft(db), cleared);
  } finally { await db.close(); }
});

test("PostgreSQL reseeding clears results and rejects invalid teams without changing state", async () => {
  const db = await database();
  try {
    await publish(db);
    await finishBracket(db);
    const original = await draft(db);
    for (const seeds of [null, [], defaultSeeds.slice(1), [...defaultSeeds, 1], [1, 1, 5, 6, 2, 8, 4, 7], [1, 3, 5, 6, 2, 8, 4, 7], [1, null, 5, 6, 2, 8, 4, 7]]) {
      await assert.rejects(db.query("select admin_bracket_seeds($1,7)", [seeds]), /eight|8|captain|seed/i);
      assert.deepEqual(await draft(db), original);
    }
    await assert.rejects(db.exec("select admin_bracket_seeds(array[[1,9,5,6],[2,8,4,7]],7)"), /eight|8|captain|seed/i);
    await db.query("select admin_bracket_seeds($1,7)", [[9, 1, 6, 5, 8, 2, 7, 4]]);
    assert.deepEqual((await draft(db)).bracket, { seeds: [9, 1, 6, 5, 8, 2, 7, 4], winners: {} });
    assert.equal((await draft(db)).bracket_revision, 8);
    await assert.rejects(db.exec("select admin_bracket_result('qf1',5,8)"), /participant|winner|match/i);
    await result(db, "qf1", 9);
    assert.equal((await draft(db)).bracket?.winners.qf1, 9);
  } finally { await db.close(); }
});

test("PostgreSQL bracket writes require published results, current revisions and determined participants", async () => {
  const db = await database();
  try {
    for (const phase of ["lobby", "drafting", "review"]) {
      await db.query("update draft set phase=$1 where id=1", [phase]);
      await assert.rejects(db.query("select admin_bracket_seeds($1,0)", [defaultSeeds]), /publish|complete/i);
      await assert.rejects(db.exec("select admin_bracket_result('qf1',1,0)"), /publish|complete/i);
    }
    await db.exec("select admin_publish_results();");
    const original = await draft(db);
    for (const revision of [null, -1, 1]) {
      await assert.rejects(db.query("select admin_bracket_seeds($1,$2)", [defaultSeeds, revision]), /changed|revision|stale/i);
      await assert.rejects(db.query("select admin_bracket_result('qf1',1,$1)", [revision]), /changed|revision|stale/i);
    }
    for (const match of [null, "", "quarterfinal", "QF1"]) {
      await assert.rejects(db.query("select admin_bracket_result($1,1,0)", [match]), /match/i);
    }
    await assert.rejects(db.exec("select admin_bracket_result('qf1',2,0)"), /participant|winner|match/i);
    await assert.rejects(db.exec("select admin_bracket_result('sf1',1,0)"), /participant|determin|ready/i);
    await assert.rejects(db.exec("select admin_bracket_result('final',1,0)"), /participant|determin|ready/i);
    await result(db, "sf1", null);
    assert.deepEqual(await draft(db), original);
    await result(db, "qf1", 1);
    await assert.rejects(db.exec("select admin_bracket_result('sf1',1,1)"), /participant|determin|ready/i);
    await assert.rejects(db.exec("select admin_bracket_result('qf1',1,0)"), /changed|revision|stale/i);
    assert.equal((await draft(db)).bracket_revision, 1);
  } finally { await db.close(); }
});

test("PostgreSQL undo and both reset modes clear the bracket and keep revisions monotonic", async () => {
  const db = await database();
  try {
    await db.exec("select check_in_player(1,'player'); select claim_captain(1,'captain'); select set_ready('captain',true); select admin_force_start(); select admin_pick(1,0); select admin_finish_draft(); select admin_publish_results();");
    await result(db, "qf1", 1);
    const undone = (await db.query<{ result: { pick: number; player: string } }>("select admin_undo() as result")).rows[0].result;
    assert.equal(undone.pick, 1);
    assert.equal(typeof undone.player, "string");
    assert.deepEqual(await db.query("select team_captain_id,pick_number from players where id=1").then(r => r.rows), [{ team_captain_id: null, pick_number: null }]);
    assert.equal((await draft(db)).bracket, null);
    assert.equal((await draft(db)).bracket_revision, 2);
    assert.equal((await draft(db)).phase, "drafting");
    await db.exec("select admin_finish_draft(); select admin_publish_results();");
    await assert.rejects(db.exec("select admin_bracket_result('qf1',1,1)"), /changed|revision|stale/i);
    await result(db, "qf1", 1);
    await db.exec("select admin_reset(false);");
    assert.equal((await draft(db)).bracket, null);
    assert.equal((await draft(db)).bracket_revision, 4);
    assert.deepEqual((await db.query("select claimed,ready from captains where id=1")).rows, [{ claimed: true, ready: false }]);
    assert.equal((await db.query<{ id: number }>("select player_for_token('player') as id")).rows[0].id, 1);
    assert.equal((await db.query<{ id: number }>("select captain_for_token('captain') as id")).rows[0].id, 1);
    await publish(db);
    await result(db, "qf1", 9);
    await db.exec("select admin_reset(true);");
    assert.equal((await draft(db)).bracket, null);
    assert.equal((await draft(db)).bracket_revision, 6);
    assert.deepEqual((await db.query("select claimed,ready from captains where id=1")).rows, [{ claimed: false, ready: false }]);
    assert.deepEqual((await db.query("select present from players where id=1")).rows, [{ present: false }]);
    assert.equal((await db.query<{ n: number }>("select count(*)::int as n from captain_tokens union all select count(*)::int from player_tokens")).rows.reduce((sum, row) => sum + row.n, 0), 0);
    await db.exec("select admin_reset(false);");
    assert.equal((await draft(db)).bracket_revision, 7);
  } finally { await db.close(); }
});

test("PostgreSQL bracket RPCs and helper are service-only with fixed search paths", async () => {
  const db = await database();
  try {
    await publish(db);
    const functions = ["default_bracket()", "admin_bracket_seeds(integer[],integer)", "admin_bracket_result(text,integer,integer)", "admin_reset(boolean)", "admin_undo()"];
    for (const name of functions) {
      const permissions = (await db.query<{ anon: boolean; authenticated: boolean; service_role: boolean; proconfig: string[]; prosecdef: boolean }>(`select has_function_privilege('anon',$1,'execute') as anon,
        has_function_privilege('authenticated',$1,'execute') as authenticated,
        has_function_privilege('service_role',$1,'execute') as service_role,proconfig,prosecdef
        from pg_proc where oid=$1::regprocedure`, [name])).rows[0];
      assert.deepEqual(permissions, { anon: false, authenticated: false, service_role: true, proconfig: ["search_path=public"], prosecdef: false });
    }
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select admin_bracket_seeds($1,0)", [defaultSeeds]), /permission denied/i);
      await assert.rejects(db.exec("select admin_bracket_result('qf1',1,0)"), /permission denied/i);
      await assert.rejects(db.exec("select default_bracket()"), /permission denied/i);
      assert.equal((await db.query<{ value: number }>("select unrelated_healthcheck() as value")).rows[0].value, 1);
      await db.exec("reset role");
    }
    await db.exec("create schema shadow; create table shadow.captains (like public.captains including all); set role service_role; set search_path=shadow,public;");
    await db.query("select public.admin_bracket_seeds($1,0)", [defaultSeeds]);
    await db.exec("select public.admin_bracket_result('qf1',1,1); select public.admin_reset(false);");
    assert.equal((await draft(db)).bracket_revision, 3);
  } finally { await db.close(); }
});

test("PostgreSQL bracket writes hold the draft lock before resolving captain IDs", async () => {
  const db = await database();
  try {
    await publish(db);
    // A view probes the real PostgreSQL lock at the first captain lookup.
    await db.exec(`create function captain_after_draft_lock(captain_id int) returns int
      language plpgsql volatile as $$ begin
        if not exists(select 1 from pg_locks where relation='draft'::regclass
          and mode='RowShareLock' and granted and pid=pg_backend_pid()) then
          raise exception 'Captain lookup ran before acquiring the draft lock';
        end if;
        return captain_id;
      end $$;
      alter table captains rename to bracket_test_captains;
      create view captains as select captain_after_draft_lock(id) as id,slot from bracket_test_captains;`);
    await db.query("select admin_bracket_seeds($1,0)", [defaultSeeds]);
    await db.exec("update draft set bracket=null where id=1;");
    await db.exec("select admin_bracket_result('qf1',1,1);");
    assert.equal((await draft(db)).bracket_revision, 2);
    assert.equal((await draft(db)).bracket?.winners.qf1, 1);
  } finally { await db.close(); }
});

test("tracked bracket upgrade preserves every existing event phase, row, claim and attendance token", async () => {
  const migrations = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort();
  const bracketMigration = migrations.find(name => name.endsWith("_tournament_bracket.sql"));
  assert.ok(bracketMigration, "CLI-generated tournament bracket migration exists");
  const migration = readFileSync(`supabase/migrations/${bracketMigration}`, "utf8");
  for (const phase of ["lobby", "drafting", "review", "complete"]) {
    const db = new PGlite();
    try {
      await db.exec(setup);
      for (const name of migrations.filter(name => name < bracketMigration)) {
        await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
      }
      await db.exec("select claim_captain(1,'captain'); select set_ready('captain',true); select check_in_player(id,'player') from players where riot_id='GamerNamer#NA1'; select admin_announcement('Preserve this event');");
      const playerId = (await db.query<{ id: number }>("select player_for_token('player') as id")).rows[0].id;
      assert.equal(typeof playerId, "number");
      if (phase !== "lobby") {
        await db.exec("select admin_force_start();");
        await db.query("select admin_pick($1,0)", [playerId]);
      }
      if (phase === "review" || phase === "complete") await db.exec("select admin_finish_draft();");
      if (phase === "complete") await db.exec("select admin_publish_results();");
      const before = (await db.query<{ state: { draft: Record<string, unknown> } }>("select get_state() as state")).rows[0].state;
      await db.exec(migration);
      const after = (await db.query<{ state: { draft: Record<string, unknown> } }>("select get_state() as state")).rows[0].state;
      assert.equal(after.draft.bracket, null);
      assert.equal(after.draft.bracket_revision, 0);
      delete after.draft.bracket;
      delete after.draft.bracket_revision;
      assert.deepEqual(after, before, `Existing ${phase} event is unchanged`);
      assert.equal((await db.query<{ id: number }>("select captain_for_token('captain') as id")).rows[0].id, 1);
      assert.equal((await db.query<{ id: number }>("select player_for_token('player') as id")).rows[0].id, playerId);
      await db.exec(migration);
      assert.equal((await draft(db)).bracket_revision, 0);
    } finally { await db.close(); }
  }
});
