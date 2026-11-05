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

test("captain pick holds the draft lock before resolving its claim token", async () => {
  const db = await database();
  try {
    await db.exec(
      "select claim_captain(1,'token'); select admin_force_start();",
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
