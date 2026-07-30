import assert from "node:assert/strict";
import test from "node:test";

import { createCapabilitySet, toolIdentifier } from "@reviva/conversation";
import {
  DuplicateRuntimeToolRegistration,
  InvalidRuntimeRequestConstruction,
  InvalidRuntimeToolRegistration,
  createRuntimeExecutionRequest,
  createRuntimeToolRegistry,
  runtimeHandlerIdentifier,
} from "../dist/index.js";
import {
  createReleaseRuntimeRegistrations,
} from "../dist/reference/handlers.js";
import { createRuntimeFixture } from "./fixtures.mjs";

test("runtime request accepts trusted complete input and freezes nested data", async () => {
  const fixture = await createRuntimeFixture();
  const raw = fixture.input();
  const request = createRuntimeExecutionRequest(raw);
  assert.equal(request.tenantId, fixture.conversation.tenantId);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.validatedToolProposal.arguments), true);
  assert.throws(() => {
    request.validatedToolProposal.arguments.locationReference = "changed";
  }, TypeError);
});

test("runtime request fails closed for missing or inconsistent trusted facts", async (t) => {
  const fixture = await createRuntimeFixture();
  const cases = [
    ["missing tenant", { root: { tenantId: "" } }],
    ["missing actor", { root: { actor: { actorReference: "", kind: "AiAgent" } } }],
    ["invalid schema", { root: { schemaVersion: 2 } }],
    ["stale version", { root: { expectedConversationVersion: fixture.conversation.version - 1 } }],
    ["conversation mismatch", { root: { conversationId: "conversation-other" } }],
    ["malformed proposal", { proposal: { toolVersion: "latest" } }],
    ["missing idempotency", { root: { idempotencyKey: "" } }],
  ];
  for (const [name, overrides] of cases) {
    await t.test(name, () => {
      const raw = fixture.input(overrides);
      assert.throws(
        () => createRuntimeExecutionRequest(raw),
        InvalidRuntimeRequestConstruction,
      );
    });
  }
});

test("request fingerprint prevents payload mutation and mismatched reuse", async () => {
  const fixture = await createRuntimeFixture();
  const raw = fixture.input();
  raw.validatedToolProposal.arguments.startTime =
    "2026-08-02T10:00:00.000Z";
  assert.throws(
    () => createRuntimeExecutionRequest(raw),
    /idempotency_fingerprint/,
  );
});

test("canonical request rejects executable, prototype, and secret-bearing values", async (t) => {
  const fixture = await createRuntimeFixture();
  const cases = [
    ["function", { locationReference: "location-a", startTime: () => "now" }],
    [
      "prototype pollution",
      JSON.parse(
        '{"locationReference":"location-a","startTime":"now","__proto__":{"polluted":true}}',
      ),
    ],
    [
      "credential key",
      {
        locationReference: "location-a",
        startTime: "now",
        accessToken: "not-allowed",
      },
    ],
    [
      "connection string",
      {
        locationReference: "location-a",
        startTime: "postgresql://host/database",
      },
    ],
  ];
  for (const [name, args] of cases) {
    await t.test(name, () => {
      assert.throws(() => {
        const raw = fixture.input({ arguments: args });
        createRuntimeExecutionRequest(raw);
      });
    });
  }
  assert.equal({}.polluted, undefined);
});

test("closed registry resolves approved tools and denies unknown tools", () => {
  const registry = createRuntimeToolRegistry(
    createReleaseRuntimeRegistrations(),
  );
  assert.equal(registry.find("booking.create", "1").found, true);
  assert.deepEqual(registry.find("unknown.tool", "1"), {
    found: false,
    failure: { code: "RuntimeToolNotRegistered" },
  });
  assert.equal(Object.isFrozen(registry.list()), true);
  assert.equal(Object.isFrozen(registry.list()[0]), true);
  assert.equal(registry.resolveHandler, undefined);
  assert.equal(registry.conversationRegistry, undefined);
});

test("closed registry rejects duplicates and handler mismatch", () => {
  const registrations = createReleaseRuntimeRegistrations();
  assert.throws(
    () =>
      createRuntimeToolRegistry([
        registrations[0],
        registrations[0],
      ]),
    DuplicateRuntimeToolRegistration,
  );
  const descriptor = registrations[0].descriptor;
  assert.throws(
    () =>
      createRuntimeToolRegistry([
        {
          descriptor,
          handler: {
            identifier: runtimeHandlerIdentifier("other.handler.v1"),
            toolIdentifier: descriptor.tool.identifier,
            toolVersion: descriptor.tool.version,
            handle: () => ({
              status: "Succeeded",
              safeResult: null,
              conversationCommand: null,
            }),
          },
        },
      ]),
    InvalidRuntimeToolRegistration,
  );
});

test("registry rejects inconsistent effect and idempotency policy", () => {
  const registration = createReleaseRuntimeRegistrations()[0];
  assert.throws(
    () =>
      createRuntimeToolRegistry([
        {
          ...registration,
          descriptor: {
            ...registration.descriptor,
            effectClassification: "LocalTransactional",
          },
        },
      ]),
    InvalidRuntimeToolRegistration,
  );
});

test("provider proposal cannot manufacture capability authority", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request({
    actorAuthority: createCapabilitySet(["conversation.read"]),
  });
  const result = await fixture.composition.toolRuntime.execute(request);
  assert.equal(result.status, "Denied");
  assert.equal(result.failure.code, "CapabilityNotAuthorized");
});

test("arbitrary URL and command-shaped fields are rejected by approved handler schema", async () => {
  const fixture = await createRuntimeFixture();
  const request = fixture.request({
    arguments: {
      locationReference: "location-a",
      startTime: "2026-08-01T10:00:00.000Z",
      callbackUrl: "https://untrusted.invalid/execute",
      command: "remove-data",
    },
  });
  const result = await fixture.composition.toolRuntime.execute(request);
  assert.equal(result.status, "Failed");
  assert.equal(result.failure.code, "HandlerRejected");
  assert.equal(result.safeResult, null);
});

test("tool identity constructor remains closed", () => {
  assert.throws(() => toolIdentifier("https://untrusted.invalid/tool"));
});
