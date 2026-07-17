begin;

create table public.tenants (
  id uuid primary key, slug text not null unique, name text not null,
  status text not null check (status in ('active', 'suspended')),
  lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint tenants_slug_valid check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint tenants_name_valid check (char_length(btrim(name)) between 1 and 120)
);

create table public.users (
  id uuid primary key, auth_subject text not null unique, email text not null,
  display_name text not null, status text not null check (status in ('active', 'disabled')),
  lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint users_auth_subject_valid check (char_length(btrim(auth_subject)) between 1 and 255),
  constraint users_email_valid check (char_length(btrim(email)) between 3 and 254),
  constraint users_display_name_valid check (char_length(btrim(display_name)) between 1 and 120)
);
create unique index users_email_unique on public.users (lower(email));

create table public.organizations (
  id uuid primary key, tenant_id uuid not null references public.tenants (id),
  name text not null, legal_name text, timezone text not null,
  lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint organizations_name_valid check (char_length(btrim(name)) between 1 and 120),
  constraint organizations_legal_name_valid check (legal_name is null or char_length(btrim(legal_name)) between 1 and 200),
  constraint organizations_timezone_valid check (char_length(btrim(timezone)) between 1 and 100),
  constraint organizations_tenant_id_unique unique (tenant_id, id)
);

create table public.locations (
  id uuid primary key, tenant_id uuid not null, organization_id uuid not null,
  name text not null, timezone text not null,
  status text not null check (status in ('active', 'inactive')),
  lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint locations_organization_fk foreign key (tenant_id, organization_id)
    references public.organizations (tenant_id, id),
  constraint locations_name_valid check (char_length(btrim(name)) between 1 and 120),
  constraint locations_timezone_valid check (char_length(btrim(timezone)) between 1 and 100),
  constraint locations_tenant_id_unique unique (tenant_id, id)
);

create table public.memberships (
  id uuid primary key, tenant_id uuid not null references public.tenants (id),
  user_id uuid not null references public.users (id),
  role text not null check (role in ('owner', 'admin', 'manager', 'agent', 'viewer')),
  status text not null check (status in ('active', 'invited', 'disabled')),
  lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint memberships_tenant_id_unique unique (tenant_id, id),
  constraint memberships_tenant_user_unique unique (tenant_id, user_id)
);

create table public.knowledge_sources (
  id uuid primary key, tenant_id uuid not null references public.tenants (id),
  location_id uuid, kind text not null check (kind in ('website', 'document', 'operator', 'integration')),
  name text not null, uri text, owner_user_id uuid not null references public.users (id),
  status text not null check (status in ('active', 'archived')),
  last_verified_at timestamptz, lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint knowledge_sources_location_fk foreign key (tenant_id, location_id)
    references public.locations (tenant_id, id),
  constraint knowledge_sources_name_valid check (char_length(btrim(name)) between 1 and 160),
  constraint knowledge_sources_uri_valid check (uri is null or char_length(uri) <= 2000),
  constraint knowledge_sources_tenant_id_unique unique (tenant_id, id)
);

create table public.knowledge_entries (
  id uuid primary key, tenant_id uuid not null, source_id uuid not null, location_id uuid,
  key text not null, title text not null,
  status text not null check (status in ('draft', 'published', 'archived')),
  active_version_id uuid, lock_version bigint not null default 1 check (lock_version > 0),
  created_at timestamptz not null, updated_at timestamptz not null,
  constraint knowledge_entries_source_fk foreign key (tenant_id, source_id)
    references public.knowledge_sources (tenant_id, id),
  constraint knowledge_entries_location_fk foreign key (tenant_id, location_id)
    references public.locations (tenant_id, id),
  constraint knowledge_entries_key_valid check (char_length(btrim(key)) between 1 and 200),
  constraint knowledge_entries_title_valid check (char_length(btrim(title)) between 1 and 200),
  constraint knowledge_entries_tenant_id_unique unique (tenant_id, id),
  constraint knowledge_entries_tenant_source_unique unique (tenant_id, id, source_id),
  constraint knowledge_entries_tenant_key_unique unique (tenant_id, key)
);

create table public.knowledge_versions (
  id uuid primary key, tenant_id uuid not null, entry_id uuid not null, source_id uuid not null,
  revision integer not null check (revision > 0),
  content text not null check (char_length(btrim(content)) between 1 and 20000),
  source_locator text, status text not null check (status in ('draft', 'published', 'superseded')),
  created_by uuid not null references public.users (id), created_at timestamptz not null,
  published_at timestamptz, verified_at timestamptz,
  constraint knowledge_versions_entry_source_fk foreign key (tenant_id, entry_id, source_id)
    references public.knowledge_entries (tenant_id, id, source_id),
  constraint knowledge_versions_source_locator_valid check (source_locator is null or char_length(source_locator) <= 2000),
  constraint knowledge_versions_publication_valid check (
    (status = 'draft' and published_at is null) or
    (status in ('published', 'superseded') and published_at is not null)
  ),
  constraint knowledge_versions_tenant_id_unique unique (tenant_id, id),
  constraint knowledge_versions_tenant_entry_revision_unique unique (tenant_id, entry_id, revision),
  constraint knowledge_versions_tenant_id_entry_unique unique (tenant_id, id, entry_id)
);

alter table public.knowledge_entries add constraint knowledge_entries_active_version_fk
  foreign key (tenant_id, active_version_id, id)
  references public.knowledge_versions (tenant_id, id, entry_id)
  deferrable initially deferred;
create unique index knowledge_versions_one_published_per_entry
  on public.knowledge_versions (tenant_id, entry_id) where status = 'published';

create table public.audit_events (
  id uuid primary key, tenant_id uuid not null references public.tenants (id),
  actor_id uuid not null references public.users (id), request_id uuid not null,
  action text not null, resource_type text not null, resource_id text not null,
  occurred_at timestamptz not null, metadata jsonb not null default '{}'::jsonb,
  constraint audit_events_action_valid check (char_length(btrim(action)) between 1 and 160),
  constraint audit_events_resource_type_valid check (char_length(btrim(resource_type)) between 1 and 120),
  constraint audit_events_resource_id_valid check (char_length(btrim(resource_id)) between 1 and 200),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_events_tenant_id_unique unique (tenant_id, id)
);

create index organizations_tenant_idx on public.organizations (tenant_id);
create index locations_tenant_organization_idx on public.locations (tenant_id, organization_id);
create index memberships_tenant_user_idx on public.memberships (tenant_id, user_id);
create index knowledge_sources_tenant_location_idx on public.knowledge_sources (tenant_id, location_id);
create index knowledge_entries_tenant_source_idx on public.knowledge_entries (tenant_id, source_id);
create index knowledge_entries_tenant_status_idx on public.knowledge_entries (tenant_id, status);
create index knowledge_versions_tenant_entry_idx on public.knowledge_versions (tenant_id, entry_id, revision);
create index audit_events_tenant_occurred_idx on public.audit_events (tenant_id, occurred_at desc);
create index audit_events_tenant_resource_idx on public.audit_events (tenant_id, resource_type, resource_id);

commit;
