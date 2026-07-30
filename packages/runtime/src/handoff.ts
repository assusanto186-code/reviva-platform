import { actorKinds } from "@reviva/conversation";

import type {
  HandoffFailure,
  HandoffRecord,
  HandoffStatus,
  HandoffTransitionRequest,
  HandoffTransitionResult,
} from "./contracts.js";
import { handoffTransitionId } from "./identifiers.js";
import { deepFreeze } from "./internal/immutable.js";

const failure = (
  code: HandoffFailure["code"],
  safeReason: string,
): HandoffTransitionResult =>
  deepFreeze({ ok: false, failure: { code, safeReason } });

const humanKinds = ["Staff", "HumanOperator"] as const;
const queueKinds = ["Staff", "HumanOperator", "System"] as const;
const operationalRoles = ["owner", "admin", "manager", "agent"] as const;

const nextStatus: Readonly<
  Record<HandoffTransitionRequest["action"], HandoffStatus>
> = Object.freeze({
  request: "Requested",
  queue: "Queued",
  assign: "Assigned",
  accept: "Accepted",
  resolve: "Resolved",
  return_to_automation: "ReturnedToAutomation",
  cancel: "Cancelled",
});

const allowedFrom: Readonly<
  Record<HandoffTransitionRequest["action"], readonly HandoffStatus[]>
> = Object.freeze({
  request: ["NotRequested"],
  queue: ["Requested"],
  assign: ["Queued"],
  accept: ["Assigned"],
  resolve: ["Accepted"],
  return_to_automation: ["Resolved"],
  cancel: ["Requested", "Queued", "Assigned"],
});

const validTimestamp = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value);
const safeReasonCode = /^[a-z][a-z0-9._:-]{0,127}$/u;

export const transitionHandoff = (
  current: HandoffRecord | null,
  request: HandoffTransitionRequest,
): HandoffTransitionResult => {
  if (
    !request ||
    !actorKinds.includes(request.actor.kind) ||
    !request.actor.actorReference.trim() ||
    request.actor.tenantId !== request.tenantId ||
    request.actor.correlationId !== request.correlationId ||
    !safeReasonCode.test(request.reasonCode) ||
    !validTimestamp(request.occurredAt)
  ) {
    return failure("InvalidHandoffRequest", "invalid_handoff_request");
  }
  try {
    handoffTransitionId(request.transitionId);
  } catch {
    return failure("InvalidHandoffRequest", "invalid_transition_identifier");
  }

  if (current !== null) {
    const duplicate = current.transitions.some(
      (transition) => transition.id === request.transitionId,
    );
    if (duplicate) {
      return deepFreeze({ ok: true, record: current, duplicate: true });
    }
    if (
      current.tenantId !== request.tenantId ||
      current.conversationId !== request.conversationId
    ) {
      return failure("HandoffTenantMismatch", "handoff_scope_mismatch");
    }
    if (current.version !== request.expectedVersion) {
      return failure("HandoffStaleVersion", "handoff_version_stale");
    }
  } else if (request.action !== "request") {
    return failure("HandoffNotFound", "handoff_not_found");
  } else if (request.expectedVersion !== 0) {
    return failure("HandoffStaleVersion", "handoff_version_stale");
  }

  const from = current?.status ?? "NotRequested";
  if (!allowedFrom[request.action].includes(from)) {
    return failure(
      "HandoffTransitionNotAllowed",
      "handoff_transition_not_allowed",
    );
  }
  if (
    (request.action === "queue" &&
      !queueKinds.includes(request.actor.kind as (typeof queueKinds)[number])) ||
    (["assign", "accept", "resolve", "return_to_automation", "cancel"].includes(
      request.action,
    ) &&
      !humanKinds.includes(request.actor.kind as (typeof humanKinds)[number]))
  ) {
    return failure("HandoffActorNotAllowed", "handoff_actor_not_allowed");
  }
  if (
    humanKinds.includes(request.actor.kind as (typeof humanKinds)[number]) &&
    (request.actor.role === null ||
      !operationalRoles.includes(
        request.actor.role as (typeof operationalRoles)[number],
      ) ||
      request.actor.authenticatedPrincipalReference === null)
  ) {
    return failure("HandoffActorNotAllowed", "handoff_role_not_allowed");
  }
  if (
    request.action === "request" &&
    (!request.targetQueueReference?.trim() || current !== null)
  ) {
    return failure("HandoffAlreadyExists", "handoff_already_exists");
  }
  if (
    request.action === "assign" &&
    !request.assigneeReference?.trim()
  ) {
    return failure("InvalidHandoffRequest", "assignee_required");
  }
  if (
    request.action === "accept" &&
    current?.assigneeReference !== request.actor.actorReference
  ) {
    return failure(
      "HandoffAssignmentMismatch",
      "handoff_assignment_mismatch",
    );
  }

  const to = nextStatus[request.action];
  const transition = deepFreeze({
    id: request.transitionId,
    from,
    to,
    actorReference: request.actor.actorReference,
    actorKind: request.actor.kind,
    reasonCode: request.reasonCode,
    occurredAt: request.occurredAt,
    correlationId: request.correlationId,
  });
  const record: HandoffRecord = deepFreeze({
    schemaVersion: 1,
    id: request.handoffId,
    tenantId: request.tenantId,
    conversationId: request.conversationId,
    status: to,
    reasonCode:
      request.action === "request"
        ? request.reasonCode
        : (current?.reasonCode ?? request.reasonCode),
    targetQueueReference:
      request.action === "request"
        ? (request.targetQueueReference ?? "")
        : (current?.targetQueueReference ?? ""),
    assigneeReference:
      request.action === "assign"
        ? request.assigneeReference
        : (current?.assigneeReference ?? null),
    requestedBy:
      request.action === "request"
        ? request.actor.actorReference
        : (current?.requestedBy ?? request.actor.actorReference),
    requestedAt:
      request.action === "request"
        ? request.occurredAt
        : (current?.requestedAt ?? request.occurredAt),
    acceptedAt:
      request.action === "accept"
        ? request.occurredAt
        : (current?.acceptedAt ?? null),
    resolvedAt:
      request.action === "resolve"
        ? request.occurredAt
        : (current?.resolvedAt ?? null),
    returnedToAutomationAt:
      request.action === "return_to_automation"
        ? request.occurredAt
        : (current?.returnedToAutomationAt ?? null),
    correlationId: request.correlationId,
    version: (current?.version ?? 0) + 1,
    transitions: [...(current?.transitions ?? []), transition],
  });
  return deepFreeze({ ok: true, record, duplicate: false });
};
