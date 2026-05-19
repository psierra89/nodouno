-- Añadir literal `loaded` al enum project_status (DBs creadas antes del alineamiento).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'loaded';
  END IF;
END $$;
