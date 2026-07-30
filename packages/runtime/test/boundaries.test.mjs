import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createRuntimeFixture } from "./fixtures.mjs";

const packageRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = join(packageRoot, "..", "..");

const readJson = async (path) =>
  JSON.parse(await readFile(path, "utf8"));

test("dependency direction keeps conversation and execution independent from runtime", async () => {
  const conversation = await readJson(
    join(repositoryRoot, "packages", "conversation", "package.json"),
  );
  const execution = await readJson(
    join(repositoryRoot, "packages", "execution", "package.json"),
  );
  const runtime = await readJson(join(packageRoot, "package.json"));
  assert.equal(conversation.dependencies?.["@reviva/runtime"], undefined);
  assert.equal(execution.dependencies?.["@reviva/runtime"], undefined);
  assert.deepEqual(Object.keys(runtime.dependencies).sort(), [
    "@reviva/conversation",
    "@reviva/execution",
  ]);
});

test("pure runtime source has no environment, network, provider SDK, filesystem, or code-execution primitive", async () => {
  const files = [
    "authorization.ts",
    "composition.ts",
    "contracts.ts",
    "execution-record.ts",
    "handoff-service.ts",
    "handoff.ts",
    "identifiers.ts",
    "index.ts",
    "registry.ts",
    "request.ts",
    "result.ts",
    "runtime.ts",
    "internal/canonical.ts",
    "internal/immutable.ts",
    "reference/composition.ts",
    "reference/handlers.ts",
    "reference/in-memory.ts",
  ];
  const source = (
    await Promise.all(
      files.map((file) =>
        readFile(join(packageRoot, "src", file), "utf8"),
      ),
    )
  ).join("\n");
  const forbidden = [
    /\bprocess\.env\b/u,
    /\beval\s*\(/u,
    /\bnew\s+Function\b/u,
    /\bfetch\s*\(/u,
    /node:(?:fs|http|https|net|tls|child_process)/u,
    /(?:openai|anthropic|gemini|twilio|sendgrid)/iu,
    /\bimport\s*\(\s*(?!["'])/u,
    /\bexec(?:File|Sync)?\s*\(/u,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(source, pattern);
  }
});

test("primary public API does not export reference adapters or mutable internals", async () => {
  const source = await readFile(
    join(packageRoot, "src", "index.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /reference\//u);
  assert.doesNotMatch(source, /resolveRuntimeHandler/u);
  assert.doesNotMatch(source, /runtimeConversationToolRegistry/u);
  assert.doesNotMatch(source, /export\s+\*/u);
});

test("reference composition is deterministic and accurately reports deferred delivery", async () => {
  const left = await createRuntimeFixture();
  const right = await createRuntimeFixture();
  const leftResult = await left.composition.toolRuntime.execute(
    left.request(),
  );
  const rightResult = await right.composition.toolRuntime.execute(
    right.request(),
  );
  assert.deepEqual(leftResult, rightResult);
  assert.equal(leftResult.status, "ExternalEffectDeferred");
  assert.equal(leftResult.safeResult.deliveryStatus, "pending");
});

test("runtime production sources contain no unfinished-work marker", async () => {
  const files = [
    "src",
    "README.md",
    "package.json",
    "tsconfig.json",
  ];
  const contents = [];
  for (const entry of files) {
    if (entry === "src") continue;
    contents.push(await readFile(join(packageRoot, entry), "utf8"));
  }
  const markerPattern = new RegExp(
    `\\b(?:${["TO", "DO"].join("")}|${["FIX", "ME"].join("")}|${[
      "HA",
      "CK",
    ].join("")})\\b`,
    "u",
  );
  assert.doesNotMatch(contents.join("\n"), markerPattern);
});
