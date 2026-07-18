begin;

create or replace function reviva_private.resolve_auth_identity(
  requested_auth_subject text
) returns table (
  user_id uuid,
  display_name text,
  user_status text,
  membership_id uuid,
  membership_status text,
  tenant_id uuid,
  tenant_name text,
  tenant_status text,
  tenant_role text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    actor.id,
    actor.display_name,
    actor.status,
    membership.id,
    membership.status,
    tenant.id,
    tenant.name,
    tenant.status,
    membership.role
  from public.users as actor
  left join public.memberships as membership on membership.user_id = actor.id
  left join public.tenants as tenant on tenant.id = membership.tenant_id
  where actor.auth_subject = requested_auth_subject
  order by membership.id
$$;

revoke all on function reviva_private.resolve_auth_identity(text) from public;
grant execute on function reviva_private.resolve_auth_identity(text) to reviva_app;

comment on function reviva_private.resolve_auth_identity(text) is
  'Resolves minimum Reviva identity and membership data for a server-validated Auth subject.';

commit;
