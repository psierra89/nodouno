-- Copia un snapshot inicial por proyecto hacia `project_revisions` si la tabla existe y aún no hay filas.
-- Idempotente: solo inserta cuando no existe revisión para ese proyecto.

insert into public.project_revisions (project_id, version, drawing_data, simplified_model, calculations, dimensioning)
select
  p.id,
  1,
  p.drawing_data,
  p.simplified_model,
  p.calculations,
  p.dimensioning
from public.projects p
where not exists (
  select 1 from public.project_revisions r where r.project_id = p.id
);

update public.projects proj
set current_revision_id = r.id
from public.project_revisions r
where r.project_id = proj.id
  and r.version = 1
  and proj.current_revision_id is null;
