export class AuthenticationError extends Error {}

export class UnauthenticatedError extends AuthenticationError {
  constructor() {
    super("Authentication is required.");
    this.name = "UnauthenticatedError";
  }
}

export class InvalidSessionError extends AuthenticationError {
  constructor() {
    super("The authentication session is invalid.");
    this.name = "InvalidSessionError";
  }
}

export class ExpiredSessionError extends AuthenticationError {
  constructor() {
    super("The authentication session has expired.");
    this.name = "ExpiredSessionError";
  }
}

export class DomainUserNotFoundError extends AuthenticationError {
  constructor() {
    super("The authenticated identity is not provisioned in Reviva.");
    this.name = "DomainUserNotFoundError";
  }
}

export class InactiveUserError extends AuthenticationError {
  constructor() {
    super("The Reviva user is inactive.");
    this.name = "InactiveUserError";
  }
}

export class MembershipNotFoundError extends AuthenticationError {
  constructor() {
    super("No tenant membership exists for this user.");
    this.name = "MembershipNotFoundError";
  }
}

export class InactiveMembershipError extends AuthenticationError {
  constructor() {
    super("The tenant membership is inactive.");
    this.name = "InactiveMembershipError";
  }
}

export class TenantAccessDeniedError extends AuthenticationError {
  constructor() {
    super("The authenticated user cannot access the requested tenant.");
    this.name = "TenantAccessDeniedError";
  }
}

export class AmbiguousTenantSelectionError extends AuthenticationError {
  constructor() {
    super("An explicit validated tenant selection is required.");
    this.name = "AmbiguousTenantSelectionError";
  }
}

export class InvalidLocationAccessError extends AuthenticationError {
  constructor() {
    super("The authenticated user cannot access the requested location.");
    this.name = "InvalidLocationAccessError";
  }
}

export class UnsafeRedirectError extends AuthenticationError {
  constructor() {
    super("The redirect target is not allowed.");
    this.name = "UnsafeRedirectError";
  }
}

export class LogoutError extends AuthenticationError {
  constructor() {
    super("The session could not be cleared.");
    this.name = "LogoutError";
  }
}
