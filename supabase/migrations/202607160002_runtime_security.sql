begin;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'reviva_app') then
    create role reviva_app login noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $$;
alter role reviva_app set statement_timeout = '8s';
alter role reviva_app set lock_timeout = '3s';
alter role reviva_app set idle_in_transaction_session_timeout = '10s';

create schema if not exists reviva_private;
revoke all on schema reviva_private from public;
grant usage on schema reviva_private to reviva_app;

create or replace function reviva_private.current_tenant_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
create or replace function reviva_private.current_actor_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.actor_id', true), '')::uuid
$$;
create or replace function reviva_private.current_request_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(current_setting('app.request_id', true), '')::uuid
$$;

create or replace function reviva_private.set_tenant_context(
  requested_tenant_id uuid, requested_actor_id uuid,
  requested_role text, requested_request_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if requested_tenant_id is null or requested_actor_id is null
    or requested_request_id is null
    or requested_role not in ('owner', 'admin', 'manager', 'agent', 'viewer') then
    raise exception 'invalid tenant context' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tenants tenant
    join public.memberships membership on membership.tenant_id = tenant.id
    join public.users actor on actor.id = membership.user_id
    where tenant.id = requested_tenant_id and tenant.status = 'active'
      and actor.id = requested_actor_id and actor.status = 'active'
      and membership.status = 'active' and membership.role = requested_role
  ) then
    raise exception 'tenant context is not authorized' using errcode = '42501';
  end if;
  perform set_config('app.tenant_id', requested_tenant_id::text, true);
  perform set_config('app.actor_id', requested_actor_id::text, true);
  perform set_config('app.actor_role', requested_role, true);
  perform set_config('app.request_id', requested_request_id::text, true);
end $$;

revoke all on function reviva_private.current_tenant_id() from public;
revoke all on function reviva_private.current_actor_id() from public;
revoke all on function reviva_private.current_request_id() from public;
revoke all on function reviva_private.set_tenant_context(uuid, uuid, text, uuid) from public;
grant execute on all functions in schema reviva_private to reviva_app;

revoke all on all tables in schema public from anon, authenticated;
revoke all on public.tenants, public.users, public.organizations, public.locations,
  public.memberships, public.knowledge_sources, public.knowledge_entries,
  public.knowledge_versions, public.audit_events from public;
grant select, insert, update on public.tenants, public.organizations, public.locations,
  public.memberships, public.knowledge_sources, public.knowledge_entries,
  public.knowledge_versions to reviva_app;
grant select, insert on public.audit_events to reviva_app;

alter table public.tenants enable row level security; alter table public.tenants force row level security;
alter table public.organizations enable row level security; alter table public.organizations force row level security;
alter table public.locations enable row level security; alter table public.locations force row level security;
alter table public.memberships enable row level security; alter table public.memberships force row level security;
alter table public.knowledge_sources enable row level security; alter table public.knowledge_sources force row level security;
alter table public.knowledge_entries enable row level security; alter table public.knowledge_entries force row level security;
alter table public.knowledge_versions enable row level security; alter table public.knowledge_versions force row level security;
alter table public.audit_events enable row level security; alter table public.audit_events force row level security;

create policy tenants_isolation on public.tenants for all to reviva_app
  using (id = reviva_private.current_tenant_id()) with check (id = reviva_private.current_tenant_id());
create policy organizations_isolation on public.organizations for all to reviva_app
  using (tenant_id = reviva_private.current_tenant_id()) with check (tenant_id = reviva_private.current_tenant_id());
create policy locations_isolation on public.locations for all to reviva_app
  using (tenant_id = reviva_private.current_tenant_id()) with check (tenant_id = reviva_private.current_tenant_id());
create policy memberships_isolation on public.memberships for all to reviva_app
  using (tenant_id = reviva_private.current_tenant_id()) with check (tenant_id = reviva_private.current_tenant_id());
create policy knowledge_sources_isolation on public.knowledge_sources for all to reviva_app
  using (tenant_id = reviva_private.current_tenant_id()) with check (tenant_id = reviva_private.current_tenant_id());
create policy knowledge_entries_isolation on public.knowledge_entries for all to reviva_app
  using (tenant_id = reviva_private.current_tenant_id()) with check (tenant_id = reviva_private.current_tenant_id());
create policy knowledge_versions_isolation on public.knowledge_versions for all to reviva_app
  using (tenant_id = reviva_private.current_tenant_id()) with check (tenant_id = reviva_private.current_tenant_id());
create policy audit_events_read_isolation on public.audit_events for select to reviva_app
  using (tenant_id = reviva_private.current_tenant_id());
create policy audit_events_insert_isolation on public.audit_events for insert to reviva_app
  with check (tenant_id = reviva_private.current_tenant_id()
    and actor_id = reviva_private.current_actor_id()
    and request_id = reviva_private.current_request_id());

comment on role reviva_app is 'Restricted Reviva runtime role; set its password outside migrations.';
commit;
