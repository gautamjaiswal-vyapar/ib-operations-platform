create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('ADMIN', 'EDITOR', 'VIEWER')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.executives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  employee_id text not null,
  executive_name text not null,
  email text not null,
  doj date not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  manager text not null,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, employee_id),
  unique (workspace_id, email)
);

create table if not exists public.monthly_mappings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  executive_id uuid not null references public.executives(id),
  employee_id text not null,
  executive_name text not null,
  email text not null,
  source text not null,
  tenurity text not null check (tenurity in ('M0', 'M1', 'M1+')),
  manager text not null,
  status text not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (workspace_id, month, executive_id)
);

create table if not exists public.target_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  tenurity text not null check (tenurity in ('M0', 'M1', 'M1+')),
  version integer not null check (version > 0),
  effective_from date not null,
  effective_to date,
  revenue numeric(16,2) not null check (revenue >= 0),
  login numeric(16,2) not null default 0 check (login >= 0),
  demo numeric(16,2) not null default 0 check (demo >= 0),
  license numeric(16,2) not null default 0 check (license >= 0),
  pro_platform numeric(16,2) not null default 0 check (pro_platform >= 0),
  arpl numeric(16,2) not null default 0 check (arpl >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (workspace_id, source, tenurity, version)
);

create unique index if not exists target_versions_one_active
  on public.target_versions (workspace_id, source, tenurity)
  where status = 'ACTIVE';
create index if not exists monthly_mappings_month_idx on public.monthly_mappings (workspace_id, month);
create index if not exists target_versions_effective_idx on public.target_versions (workspace_id, source, tenurity, effective_from, effective_to);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.workspace_members where workspace_id = target_workspace and user_id = auth.uid()) $$;

create or replace function public.bootstrap_workspace(workspace_name text default 'IB Operations')
returns uuid language plpgsql security definer set search_path = public
as $$
declare selected_workspace uuid;
begin
  select workspace_id into selected_workspace from public.workspace_members where user_id = auth.uid() order by created_at limit 1;
  if selected_workspace is null then
    insert into public.workspaces(name) values (workspace_name) returning id into selected_workspace;
    insert into public.workspace_members(workspace_id, user_id, role) values (selected_workspace, auth.uid(), 'ADMIN');
  end if;
  return selected_workspace;
end;
$$;

create or replace function public.create_target_version(
  target_workspace uuid, target_source text, target_tenurity text, starts_on date,
  target_revenue numeric, target_login numeric, target_demo numeric,
  target_license numeric, target_pro_platform numeric, target_arpl numeric
) returns public.target_versions
language plpgsql security invoker set search_path = public
as $$
declare next_version integer; created_target public.target_versions; active_from date;
begin
  if not public.is_workspace_member(target_workspace) then raise exception 'Workspace access denied'; end if;
  perform pg_advisory_xact_lock(hashtext(target_workspace::text || target_source || target_tenurity));
  select effective_from into active_from from public.target_versions
    where workspace_id = target_workspace and source = target_source and tenurity = target_tenurity and status = 'ACTIVE';
  if active_from is not null and starts_on <= active_from then
    raise exception 'New effective date must be later than the current active version (%).', active_from;
  end if;
  select coalesce(max(version), 0) + 1 into next_version from public.target_versions
    where workspace_id = target_workspace and source = target_source and tenurity = target_tenurity;
  update public.target_versions set status = 'INACTIVE', effective_to = starts_on - 1
    where workspace_id = target_workspace and source = target_source and tenurity = target_tenurity and status = 'ACTIVE';
  insert into public.target_versions(workspace_id, source, tenurity, version, effective_from, revenue, login, demo, license, pro_platform, arpl)
  values(target_workspace, target_source, target_tenurity, next_version, starts_on, target_revenue, target_login, target_demo, target_license, target_pro_platform, target_arpl)
  returning * into created_target;
  return created_target;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.executives enable row level security;
alter table public.monthly_mappings enable row level security;
alter table public.target_versions enable row level security;

create policy workspaces_member_access on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy members_read on public.workspace_members for select to authenticated using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
create policy executives_member_access on public.executives for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy mappings_member_access on public.monthly_mappings for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy targets_member_access on public.target_versions for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

grant select on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update on public.executives, public.monthly_mappings, public.target_versions to authenticated;
grant execute on function public.bootstrap_workspace(text) to authenticated;
grant execute on function public.create_target_version(uuid,text,text,date,numeric,numeric,numeric,numeric,numeric,numeric) to authenticated;
