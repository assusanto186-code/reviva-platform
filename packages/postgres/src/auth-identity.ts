import type {
  AuthIdentityRepository,
  AuthMembershipRecord,
  AuthUserRecord,
} from "@reviva/auth";
import type {
  MembershipStatus,
  TenantRole,
  TenantStatus,
  UserStatus,
} from "@reviva/domain";
import type { Sql } from "postgres";
import { PersistenceConflictError } from "./errors.js";

type AuthIdentityRow = {
  user_id: string;
  display_name: string;
  user_status: UserStatus;
  membership_id: string | null;
  membership_status: MembershipStatus | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_status: TenantStatus | null;
  tenant_role: TenantRole | null;
};

export class PostgresAuthIdentityRepository implements AuthIdentityRepository {
  constructor(private readonly sql: Sql) {}

  async resolveBySubject(subject: string): Promise<AuthUserRecord | null> {
    const normalized = subject.trim();
    if (!normalized || normalized.length > 255) {
      throw new PersistenceConflictError("Authenticated subject is invalid.");
    }

    const rows = await this.sql<AuthIdentityRow[]>`
      select user_id, display_name, user_status, membership_id,
        membership_status, tenant_id, tenant_name, tenant_status, tenant_role
      from reviva_private.resolve_auth_identity(${normalized})
    `;
    const first = rows[0];
    if (!first) return null;

    const memberships: AuthMembershipRecord[] = [];
    for (const row of rows) {
      if (row.user_id !== first.user_id) {
        throw new PersistenceConflictError("Auth identity resolution returned mixed users.");
      }
      if (
        row.membership_id &&
        row.membership_status &&
        row.tenant_id &&
        row.tenant_name &&
        row.tenant_status &&
        row.tenant_role
      ) {
        memberships.push({
          tenantId: row.tenant_id,
          tenantName: row.tenant_name,
          tenantStatus: row.tenant_status,
          role: row.tenant_role,
          status: row.membership_status,
        });
      }
    }

    return {
      id: first.user_id,
      displayName: first.display_name,
      status: first.user_status,
      memberships,
    };
  }
}
