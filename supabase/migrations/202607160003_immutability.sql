begin;
create or replace function reviva_private.reject_tenant_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tenant_id <> old.tenant_id then
    raise exception 'tenant ownership is immutable' using errcode = '23000';
  end if;
  return new;
end $$;
create or replace function reviva_private.protect_knowledge_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if current_user in ('postgres', 'supabase_admin') then return old; end if;
    raise exception 'knowledge versions cannot be deleted' using errcode = '23000';
  end if;
  if new.id <> old.id or new.tenant_id <> old.tenant_id or new.entry_id <> old.entry_id
    or new.source_id <> old.source_id or new.revision <> old.revision
    or new.content <> old.content or new.source_locator is distinct from old.source_locator
    or new.created_by <> old.created_by or new.created_at <> old.created_at
    or new.verified_at is distinct from old.verified_at then
    raise exception 'knowledge version content and provenance are immutable' using errcode = '23000';
  end if;
  if old.status = 'superseded' and new.status <> old.status then
    raise exception 'superseded knowledge versions are terminal' using errcode = '23000';
  end if;
  if old.status = 'published' and new.status not in ('published', 'superseded') then
    raise exception 'published knowledge versions cannot return to draft' using errcode = '23000';
  end if;
  return new;
end $$;
create or replace function reviva_private.protect_audit_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'audit events are append-only' using errcode = '23000';
end $$;

create trigger organizations_tenant_immutable before update on public.organizations
  for each row execute function reviva_private.reject_tenant_change();
create trigger locations_tenant_immutable before update on public.locations
  for each row execute function reviva_private.reject_tenant_change();
create trigger memberships_tenant_immutable before update on public.memberships
  for each row execute function reviva_private.reject_tenant_change();
create trigger knowledge_sources_tenant_immutable before update on public.knowledge_sources
  for each row execute function reviva_private.reject_tenant_change();
create trigger knowledge_entries_tenant_immutable before update on public.knowledge_entries
  for each row execute function reviva_private.reject_tenant_change();
create trigger knowledge_versions_protected before update or delete on public.knowledge_versions
  for each row execute function reviva_private.protect_knowledge_version();
create trigger audit_events_append_only before update or delete on public.audit_events
  for each row execute function reviva_private.protect_audit_event();
revoke all on function reviva_private.reject_tenant_change() from public;
revoke all on function reviva_private.protect_knowledge_version() from public;
revoke all on function reviva_private.protect_audit_event() from public;
commit;
