import type {
  MembershipStatus,
  TenantContext,
  TenantRole,
  TenantStatus,
  UserStatus,
} from "@reviva/domain";
import { requestId, tenantId, userId } from "@reviva/domain";
import {
  AmbiguousTenantSelectionError,
  DomainUserNotFoundError,
  InactiveMembershipError,
  InactiveUserError,
  MembershipNotFoundError,
  TenantAccessDeniedError,
} from "./errors.js";
import type { VerifiedAuthIdentity } from "./session.js";

export type AuthMembershipRecord = Readonly<{
  tenantId: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  role: TenantRole;
  status: MembershipStatus;
}>;

export type AuthUserRecord = Readonly<{
  id: string;
  displayName: string;
  status: UserStatus;
  memberships: readonly AuthMembershipRecord[];
}>;

export interface AuthIdentityRepository {
  resolveBySubject(subject: string): Promise<AuthUserRecord | null>;
}

export type TrustedAuthContext = Readonly<{
  context: TenantContext;
  displayName: string;
  tenantName: string;
}>;

export class TrustedTenantContextResolver {
  constructor(
    private readonly repository: AuthIdentityRepository,
    private readonly createRequestId: () => string,
  ) {}

  async resolve(
    identity: VerifiedAuthIdentity,
    options: Readonly<{ tenantHint?: string }> = {},
  ): Promise<TrustedAuthContext> {
    const user = await this.repository.resolveBySubject(identity.subject);
    if (!user) throw new DomainUserNotFoundError();
    if (user.status !== "active") throw new InactiveUserError();
    if (user.memberships.length === 0) throw new MembershipNotFoundError();

    const membership = options.tenantHint
      ? this.resolveHintedMembership(user.memberships, options.tenantHint)
      : this.resolveDefaultMembership(user.memberships);

    return {
      context: {
        tenantId: tenantId(membership.tenantId),
        actorId: userId(user.id),
        actorRole: membership.role,
        requestId: requestId(this.createRequestId()),
      },
      displayName: user.displayName,
      tenantName: membership.tenantName,
    };
  }

  private resolveHintedMembership(
    memberships: readonly AuthMembershipRecord[],
    tenantHint: string,
  ) {
    const membership = memberships.find((item) => item.tenantId === tenantHint);
    if (!membership) throw new TenantAccessDeniedError();
    this.assertActiveMembership(membership);
    return membership;
  }

  private resolveDefaultMembership(memberships: readonly AuthMembershipRecord[]) {
    const active = memberships.filter(
      (item) => item.status === "active" && item.tenantStatus === "active",
    );
    if (active.length > 1) throw new AmbiguousTenantSelectionError();
    if (active.length === 1) return active[0]!;
    if (memberships.some((item) => item.status !== "active")) {
      throw new InactiveMembershipError();
    }
    throw new TenantAccessDeniedError();
  }

  private assertActiveMembership(membership: AuthMembershipRecord) {
    if (membership.status !== "active") throw new InactiveMembershipError();
    if (membership.tenantStatus !== "active") throw new TenantAccessDeniedError();
  }
}
