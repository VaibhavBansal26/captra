# @captra-ai/state

## 0.4.1

### Patch Changes

- Reject cross-key lease substitution, malformed actors and owners, invalid versions and fencing tokens, non-finite expirations, and leases longer than five minutes across the in-memory and PostgreSQL shared-state adapters.

## 0.4.0

### Minor Changes

- Add shared multi-agent state with optimistic versioned commits, automatic conflict replanning, expiring leases, fencing tokens, validation, audit history, capability lock declarations, and a tenant-scoped PostgreSQL adapter.

## 0.3.0

### Minor Changes

- Add Captra State, a typed reactive state graph with subscriptions, request deduplication, prefix invalidation, optimistic updates, rollback, persistence, and hydration. Capabilities can now declare state reads, writes, and invalidations; local and remote React hooks apply those effects after successful execution.
