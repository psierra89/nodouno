-- Alinear literales de estado con la aplicación (ver packages/shared/src/project-status.ts).
-- Si `projects.status` es TEXT, basta con actualizar datos legacy.

update public.projects
set status = 'loaded'
where status = 'loads_defined';

comment on column public.projects.status is 'draft | drawn | loaded | calculated | dimensioned';
