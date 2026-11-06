import test from "node:test";
import assert from "node:assert/strict";
import { POST as attendance } from "../src/app/api/attendance/route";
import { POST as admin } from "../src/app/api/admin/route";
import { getStore } from "../src/lib/server";

test("attendance API validates input, hashes identities and protects organizer corrections", async () => {
  await getStore().adminReset(true);
  const req = (body: unknown, key?: string) =>
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { "x-admin-key": key } : {}),
      },
      body: JSON.stringify(body),
    });
  assert.equal((await attendance(req({ action: "unknown" }))).status, 400);
  assert.equal(
    (await attendance(req({ action: "check-in", playerId: "1" }))).status,
    400,
  );
  assert.equal(
    (await attendance(req({ action: "leave", token: "wrong" }))).status,
    403,
  );
  const r = await attendance(req({ action: "check-in", playerId: 1 }));
  assert.equal(r.status, 200);
  const { token } = await r.json();
  assert.ok(token.length >= 40);
  assert.equal(
    (await attendance(req({ action: "check-in", playerId: 1 }))).status,
    409,
  );
  assert.equal(
    (await (await attendance(req({ action: "me", token }))).json()).playerId,
    1,
  );
  assert.equal(
    (await getStore().getState()).players.find((p) => p.id === 1)?.present,
    true,
  );
  assert.ok(!JSON.stringify(await getStore().getState()).includes(token));
  const old = process.env.ADMIN_KEY;
  process.env.ADMIN_KEY = "test-admin-password";
  try {
    assert.equal(
      (await admin(req({ action: "attendance", playerId: 1, present: false })))
        .status,
      401,
    );
    assert.equal(
      (
        await admin(
          req(
            { action: "attendance", playerId: 1, present: "false" },
            "test-admin-password",
          ),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await admin(
          req(
            { action: "announcement", message: "x".repeat(501) },
            "test-admin-password",
          ),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await admin(
          req(
            { action: "attendance", playerId: 1, present: false },
            "test-admin-password",
          ),
        )
      ).status,
      200,
    );
    assert.equal(
      (await (await attendance(req({ action: "me", token }))).json()).playerId,
      null,
    );
  } finally {
    if (old === undefined) delete process.env.ADMIN_KEY;
    else process.env.ADMIN_KEY = old;
  }
});
