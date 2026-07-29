import assert from "node:assert/strict";
import test from "node:test";

import {
  createCapabilitySet,
  toolIdentifier,
} from "@reviva/conversation";

import {
  createExecutionRequest,
  InvalidExecutionRequestConstruction,
  plannerOutputSchema,
} from "../dist/index.js";
import {
  bookingPlannerResult,
  bookingRequest,
  bookingTool,
  budget,
  providerPolicy,
  request,
  requestInput,
  validPlannerResult,
} from "./fixtures.mjs";

test("a complete execution request is canonical and deeply immutable", () => {
  const value = request();
  assert.equal(value.schemaVersion, 1);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.budget), true);
  assert.equal(Object.isFrozen(value.contextEntries), true);
  assert.equal(Object.isFrozen(value.providerPolicy.candidates), true);
});

for (const [name, override, reason] of [
  ["missing tenant", { tenantId: "" }, "missing_trusted_identity"],
  ["missing actor", { actor: undefined }, "missing_trusted_identity"],
  [
    "stale conversation version",
    {
      delegation: {
        status: "current",
        reference: "delegation-fixture",
        issuedForVersion: 2,
      },
    },
    "stale_or_missing_delegation",
  ],
  [
    "malformed budget",
    { budget: budget({ maximumProviderAttempts: 0 }) },
    "invalid_budget",
  ],
  ["missing budget", { budget: undefined }, "missing_budget"],
  ["missing provider policy", { providerPolicy: undefined }, "invalid_provider_policy"],
  [
    "unsupported execution purpose",
    { purpose: "free_form_prompt" },
    "unsupported_execution_purpose",
  ],
]) {
  test(`request construction rejects ${name}`, () => {
    assert.throws(
      () => createExecutionRequest(requestInput(override)),
      (error) =>
        error instanceof InvalidExecutionRequestConstruction &&
        error.reason === reason,
    );
  });
}

test("request construction rejects an input-token ceiling breach", () => {
  assert.throws(
    () =>
      createExecutionRequest(
        requestInput({
          inputTokenEstimate: 101,
          budget: budget({ maximumInputTokens: 100 }),
        }),
      ),
    (error) =>
      error instanceof InvalidExecutionRequestConstruction &&
      error.reason === "request_budget_exceeded",
  );
});

test("request construction rejects a provider retry policy above two", () => {
  assert.throws(
    () =>
      createExecutionRequest(
        requestInput({
          providerPolicy: providerPolicy({ maximumProviderRetries: 3 }),
        }),
      ),
    (error) =>
      error instanceof InvalidExecutionRequestConstruction &&
      error.reason === "invalid_provider_policy",
  );
});

test("request construction rejects function-valued structured input", () => {
  assert.throws(() =>
    createExecutionRequest(
      requestInput({ input: { execute: () => "not allowed" } }),
    ),
  );
});

test("request construction rejects unknown runtime fields", () => {
  assert.throws(
    () =>
      createExecutionRequest(
        requestInput({ credentialHint: "must-not-cross-boundary" }),
      ),
    (error) =>
      error instanceof InvalidExecutionRequestConstruction &&
      error.reason === "invalid_request_shape",
  );
});

test("request construction does not freeze caller-owned canonical input", () => {
  const source = requestInput({
    input: { nested: { message: "caller-owned" } },
  });
  const constructed = createExecutionRequest(source);
  assert.notEqual(constructed.input, source.input);
  assert.equal(Object.isFrozen(constructed.input), true);
  assert.equal(Object.isFrozen(source.input), false);
});

test("the planner schema accepts exact versioned output", () => {
  const result = plannerOutputSchema.validate(validPlannerResult(), request());
  assert.equal(result.valid, true);
});

for (const [name, payload, expectedFailure] of [
  [
    "missing fields",
    { schemaVersion: 1, purpose: "produce_patient_response" },
    "invalid_planner_shape",
  ],
  [
    "unknown fields",
    { ...validPlannerResult(), hiddenReasoning: "not allowed" },
    "invalid_planner_shape",
  ],
  [
    "unsupported schema",
    validPlannerResult({ schemaVersion: 2 }),
    "unsupported_schema_version",
  ],
  [
    "unknown enum",
    validPlannerResult({ confidenceBand: "certain" }),
    "invalid_confidence_band",
  ],
  [
    "invalid reason code",
    validPlannerResult({ reasonCodes: ["Unsafe reason"] }),
    "invalid_reason_codes",
  ],
]) {
  test(`the planner schema rejects ${name}`, () => {
    const result = plannerOutputSchema.validate(payload, request());
    assert.equal(result.valid, false);
    assert.equal(result.failures.includes(expectedFailure), true);
  });
}

test("the planner schema rejects capabilities outside the trusted set", () => {
  const result = plannerOutputSchema.validate(
    bookingPlannerResult(),
    bookingRequest({
      authorizedCapabilities: createCapabilitySet(["conversation.read"]),
    }),
  );
  assert.equal(result.valid, false);
  assert.equal(result.failures.includes("capability_not_authorized"), true);
});

test("the planner schema rejects an unknown closed-registry tool", () => {
  const result = plannerOutputSchema.validate(
    bookingPlannerResult({
      proposedTool: {
        ...bookingPlannerResult().proposedTool,
        identifier: toolIdentifier("booking.unknown"),
      },
    }),
    bookingRequest(),
  );
  assert.equal(result.valid, false);
  assert.equal(result.failures.includes("tool_not_registered"), true);
});

test("the planner schema rejects a tool capability mismatch", () => {
  const result = plannerOutputSchema.validate(
    bookingPlannerResult(),
    bookingRequest({
      availableTools: [
        bookingTool({ requiredCapability: "booking.modify" }),
      ],
      authorizedCapabilities: createCapabilitySet([
        "booking.create",
        "booking.modify",
      ]),
    }),
  );
  assert.equal(result.valid, false);
  assert.equal(result.failures.includes("tool_capability_mismatch"), true);
});

test("required confirmation must remain required, never provider-confirmed", () => {
  const result = plannerOutputSchema.validate(
    bookingPlannerResult({
      proposedTool: {
        ...bookingPlannerResult().proposedTool,
        confirmationStatus: "confirmed",
      },
    }),
    bookingRequest(),
  );
  assert.equal(result.valid, false);
  assert.equal(result.failures.includes("confirmation_status_mismatch"), true);
});

test("function-valued tool arguments are rejected", () => {
  const result = plannerOutputSchema.validate(
    bookingPlannerResult({
      proposedTool: {
        ...bookingPlannerResult().proposedTool,
        arguments: { execute: () => "not allowed" },
      },
    }),
    bookingRequest(),
  );
  assert.equal(result.valid, false);
  assert.equal(result.failures.includes("invalid_tool_arguments"), true);
});
