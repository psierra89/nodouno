-- Agrega especificaciones generales por proyecto.
-- Por ahora el sistema soporta: CIRSOC 201, ADN420 y hormigon H25/H30/H35.

alter table public.projects
add column if not exists specs jsonb;

-- Default para nuevos proyectos (la app igualmente normaliza ante null/ausente).
alter table public.projects
alter column specs set default '{"regulation":"CIRSOC_201","steel":"ADN_420","concrete":"H30"}'::jsonb;

-- Backfill (opcional pero recomendado).
update public.projects
set specs = coalesce(specs, '{"regulation":"CIRSOC_201","steel":"ADN_420","concrete":"H30"}'::jsonb)
where specs is null;

