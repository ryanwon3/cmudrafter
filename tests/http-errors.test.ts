import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { handle } from "../src/lib/server/http";

test("a rule error from another route bundle retains its 409 status and message", async () => {
  // Next dev compiles each route separately while sharing the global store.
  // Load a real second copy of the error class, as that bundler does.
  const source = readFileSync("src/lib/server/errors.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const foreign = { exports: {} } as {
    exports: { DraftError?: new (message: string, status: number) => Error };
  };
  runInNewContext(compiled, { exports: foreign.exports, Symbol });
  const response = await handle(async () => {
    throw new foreign.exports.DraftError!("Already taken", 409);
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "Already taken" });
});
