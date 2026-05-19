-- Especificaciones por proyecto (reglamento, acero, hormigón).
alter table public.projects
add column if not exists specs jsonb;

alter table public.projects
alter column specs set default '{"regulation":"CIRSOC_201","steel":"ADN_420","concrete":"H30"}'::jsonb;

update public.projects
set specs = coalesce(specs, '{"regulation":"CIRSOC_201","steel":"ADN_420","concrete":"H30"}'::jsonb)
where specs is null;
