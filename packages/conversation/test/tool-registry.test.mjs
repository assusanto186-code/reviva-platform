import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeToolRequest,
  createToolRegistry,
  DuplicateToolIdentifier,
  DuplicateToolName,
  InvalidCapability,
  InvalidToolDescriptor,
  toolIdentifier,
} from "../dist/index.js";
import { createAuthorizationFixture } from "./authorization-fixtures.mjs";

test("registry creation, lookup, and enumeration are deterministic", () => {
  const fixture = createAuthorizationFixture();
  const second = fixture.descriptor({
    identifier: toolIdentifier("booking.create"),
    name: "booking.create",
    requiredCapability: "booking.create",
    confirmation: "required",
    effect: "mutating",
  });
  const registry = fixture.registry(second, fixture.descriptor());

  assert.deepEqual(
    registry.list().map((item) => item.identifier),
    ["availability.lookup", "booking.create"],
  );
  assert.equal(registry.findByName("availability.lookup", "1.0.0").ok, true);
  assert.equal(registry.findByIdentifier("unknown", "1.0.0").failure.code, "UnknownTool");
});

test("duplicate identifier and duplicate name fail deterministically", () => {
  const fixture = createAuthorizationFixture();
  assert.throws(
    () => createToolRegistry([
      fixture.descriptor(),
      fixture.descriptor({ name: "availability.second" }),
    ]),
    DuplicateToolIdentifier,
  );
  assert.throws(
    () => createToolRegistry([
      fixture.descriptor(),
      fixture.descriptor({ identifier: toolIdentifier("availability.second") }),
    ]),
    DuplicateToolName,
  );
});

test("descriptors are deeply immutable and contain no execution function", () => {
  const fixture = createAuthorizationFixture();
  const registry = fixture.registry();
  const registered = registry.list()[0];
  assert.equal(Object.isFrozen(registered), true);
  assert.equal(Object.isFrozen(registered.allowedActorKinds), true);
  assert.equal("handler" in registered, false);
  assert.equal("execute" in registered, false);
});

test("execution handlers and malformed descriptors are rejected", () => {
  const fixture = createAuthorizationFixture();
  assert.throws(
    () => createToolRegistry([{
      ...fixture.descriptor(),
      handler: () => undefined,
    }]),
    InvalidToolDescriptor,
  );
  assert.throws(
    () => createToolRegistry([fixture.descriptor({ version: "latest" })]),
    InvalidToolDescriptor,
  );
  assert.throws(
    () => createToolRegistry([{
      ...fixture.descriptor(),
      provider: "vendor-specific",
    }]),
    InvalidToolDescriptor,
  );
});

test("invalid capability references are rejected", () => {
  const fixture = createAuthorizationFixture();
  assert.throws(
    () => createToolRegistry([
      fixture.descriptor({ requiredCapability: "booking.*" }),
    ]),
    InvalidCapability,
  );
});

test("tool authorization denies unknown tools and capability mismatches", () => {
  const fixture = createAuthorizationFixture();
  const registry = fixture.registry();
  const context = fixture.aiContext("booking.availability.read");
  const unknown = authorizeToolRequest(context, registry, {
    toolIdentifier: "unknown",
    version: "1.0.0",
    declaredCapability: "booking.availability.read",
  });
  const mismatch = authorizeToolRequest(context, registry, {
    toolIdentifier: "availability.lookup",
    version: "1.0.0",
    declaredCapability: "booking.create",
  });
  assert.equal(unknown.reason, "tool_not_registered");
  assert.equal(mismatch.reason, "tool_capability_mismatch");
});

test("registered read-only tool is authorized without executing anything", () => {
  const fixture = createAuthorizationFixture();
  const result = authorizeToolRequest(
    fixture.aiContext("booking.availability.read"),
    fixture.registry(),
    {
      toolIdentifier: "availability.lookup",
      version: "1.0.0",
      declaredCapability: "booking.availability.read",
    },
  );
  assert.equal(result.type, "Allowed");
});

test("tool authorization enforces delegation tool scope", () => {
  const fixture = createAuthorizationFixture();
  const context = fixture.aiContext("booking.availability.read", {
    delegation: {
      status: "active",
      reference: "delegation-a",
      capabilities: fixture.all,
      toolIdentifiers: [],
      issuedForConversationVersion: fixture.conversation.version,
    },
  });
  const result = authorizeToolRequest(context, fixture.registry(), {
    toolIdentifier: "availability.lookup",
    version: "1.0.0",
    declaredCapability: "booking.availability.read",
  });
  assert.equal(result.reason, "delegation_tool_scope_missing");
});

test("tool authorization enforces descriptor actor categories", () => {
  const fixture = createAuthorizationFixture();
  const descriptor = fixture.descriptor({
    allowedActorKinds: ["Staff"],
  });
  const result = authorizeToolRequest(
    fixture.aiContext("booking.availability.read"),
    fixture.registry(descriptor),
    {
      toolIdentifier: "availability.lookup",
      version: "1.0.0",
      declaredCapability: "booking.availability.read",
    },
  );
  assert.equal(result.reason, "tool_actor_not_allowed");
});

test("mutating tool returns confirmation required until matching evidence exists", () => {
  const fixture = createAuthorizationFixture();
  const descriptor = fixture.descriptor({
    identifier: toolIdentifier("booking.create"),
    name: "booking.create",
    requiredCapability: "booking.create",
    confirmation: "required",
    effect: "mutating",
  });
  const registry = fixture.registry(descriptor);
  const result = authorizeToolRequest(
    fixture.aiContext("booking.create", {
      effectDigest: "booking-a",
      confirmation: { status: "missing", effectDigest: null },
    }),
    registry,
    {
      toolIdentifier: "booking.create",
      version: "1.0.0",
      declaredCapability: "booking.create",
    },
  );
  assert.equal(result.type, "ConfirmationRequired");
});

test("human-approval tool returns HumanApprovalRequired", () => {
  const fixture = createAuthorizationFixture();
  const descriptor = fixture.descriptor({
    identifier: toolIdentifier("booking.cancel"),
    name: "booking.cancel",
    requiredCapability: "booking.cancel.request",
    humanApproval: "required",
    effect: "mutating",
  });
  const result = authorizeToolRequest(
    fixture.aiContext("booking.cancel.request", {
      delegation: {
        status: "active",
        reference: "delegation-a",
        capabilities: fixture.all,
        toolIdentifiers: ["booking.cancel"],
        issuedForConversationVersion: fixture.conversation.version,
      },
      effectDigest: "cancel-a",
    }),
    fixture.registry(descriptor),
    {
      toolIdentifier: "booking.cancel",
      version: "1.0.0",
      declaredCapability: "booking.cancel.request",
    },
  );
  assert.equal(result.type, "HumanApprovalRequired");
});
