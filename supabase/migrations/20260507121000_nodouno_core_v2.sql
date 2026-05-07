-- Esquema escalable: catálogos, revisiones inmutables, exportaciones y auditoría.
-- Compatible con proyectos existentes (`user_id`, JSONB en projects hasta migración completa).

create table if not exists public.regulations (
  code text primary key,
  name text not null,
  version text,
  active boolean not null default true
);

create table if not exists public.concrete_classes (
  code text primary key,
  fck_mpa numeric not null,
  ec_mpa numeric,
  description text
);

create table if not exists public.steel_classes (
  code text primary key,
  fy_mpa numeric not null,
  fu_mpa numeric,
  es_mpa numeric,
  description text
);

insert into public.regulations (code, name, version, active)
values ('CIRSOC_201', 'CIRSOC 201 Hormigon armado', '2016', true)
on conflict (code) do nothing;

insert into public.concrete_classes (code, fck_mpa, description) values
  ('H25', 25, 'Hormigon H25'),
  ('H30', 30, 'Hormigon H30'),
  ('H35', 35, 'Hormigon H35')
on conflict (code) do nothing;

insert into public.steel_classes (code, fy_mpa, description) values
  ('ADN_420', 420, 'Acero ADN420')
on conflict (code) do nothing;

create table if not exists public.project_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version int not null,
  drawing_data jsonb,
  simplified_model jsonb,
  calculations jsonb,
  dimensioning jsonb,
  comment text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists project_revisions_project_version_idx
  on public.project_revisions(project_id, version desc);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  revision_id uuid references public.project_revisions(id) on delete set null,
  kind text not null check (kind in ('pdf', 'json', 'dxf')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  url text,
  params jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists exports_project_idx on public.exports(project_id);

create table if not exists public.audit_log (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  project_id uuid references public.projects(id) on delete set null,
  action text not null,
  payload jsonb,
  at timestamptz not null default now()
);

create index if not exists audit_log_project_idx on public.audit_log(project_id);

-- Vincular cabecera de proyecto a la revisión corriente (nullable hasta backfill)
alter table public.projects
  add column if not exists current_revision_id uuid references public.project_revisions(id) on delete set null;

alter table public.projects
  add column if not exists regulation_code text references public.regulations(code);

alter table public.projects
  add column if not exists concrete_code text references public.concrete_classes(code);

alter table public.projects
  add column if not exists steel_code text references public.steel_classes(code);

-- RLS: lectura de catálogos autenticados
alter table public.regulations enable row level security;
alter table public.concrete_classes enable row level security;
alter table public.steel_classes enable row level security;
alter table public.project_revisions enable row level security;
alter table public.exports enable row level security;
alter table public.audit_log enable row level security;

create policy "regulations_read_auth" on public.regulations
  for select to authenticated using (true);

create policy "concrete_read_auth" on public.concrete_classes
  for select to authenticated using (true);

create policy "steel_read_auth" on public.steel_classes
  for select to authenticated using (true);

create policy "revisions_by_owner" on public.project_revisions
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "exports_by_owner" on public.exports
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "audit_own" on public.audit_log
  for select to authenticated
  using (user_id = auth.uid());

create policy "audit_insert_own" on public.audit_log
  for insert to authenticated
  with check (user_id = auth.uid());
