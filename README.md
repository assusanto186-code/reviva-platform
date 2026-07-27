# Reviva Platform

> AI Employee Platform powered by REVOS.

## Overview

Reviva Platform is the home of REVOS, an AI Employee Operating System designed
to power intelligent AI employees for service-based businesses.

Our first product is **Reviva**, an AI Front Desk Employee built specifically
for med spas. Reviva is designed to communicate across text and voice with a
consistent professional character, use tenant-approved knowledge, perform
controlled front desk actions, and collaborate with human operators.

## Repository Structure

```text
apps/
packages/
services/
```

## Status

REV-001 through REV-011C are complete. The pure
`@reviva/conversation` aggregate, state machine, commands, events, policies,
failures, and replay engine are implemented without persistence or provider
integration. REV-011C adds deterministic capability authorization and a closed,
non-executing tool registry. REV-011D is Complete with provider-independent
persistence, idempotency, transaction, outbox, and audit contracts plus a
deterministic in-memory reference adapter; no production persistence exists. See
[`docs/PROJECT_STATUS.md`](./docs/PROJECT_STATUS.md) for authoritative milestone
status, [`docs/LAUNCH_ROADMAP.md`](./docs/LAUNCH_ROADMAP.md) for delivery order,
and
[`docs/LAUNCH_READINESS_CHECKLIST.md`](./docs/LAUNCH_READINESS_CHECKLIST.md) for
release evidence.
