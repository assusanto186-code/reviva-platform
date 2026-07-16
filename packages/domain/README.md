# @reviva/domain

Dependency-free domain contracts for Reviva tenant and knowledge workflows.

This package defines:

- opaque business identifiers;
- tenant, organization, location, user, membership, and role models;
- mandatory tenant context and role checks;
- knowledge source, entry, and immutable version models;
- draft, publish, and rollback lifecycle rules;
- tenant-aware repository interfaces;
- in-memory repositories for tests and local domain verification;
- tenant-scoped audit event contracts.

The in-memory repositories are not production persistence. A production adapter
must enforce the same tenant context at database query and transaction
boundaries, use durable audit storage, and pass the shared isolation tests.
