import {
  bigint,
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex
} from 'drizzle-orm/pg-core';

/** Catálogo reglamentos (p.ej. CIRSOC 201). */
export const regulations = pgTable('regulations', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  version: text('version'),
  active: boolean('active').notNull().default(true)
});

export const concreteClasses = pgTable('concrete_classes', {
  code: text('code').primaryKey(),
  fckMpa: numeric('fck_mpa').notNull(),
  ecMpa: numeric('ec_mpa'),
  description: text('description')
});

export const steelClasses = pgTable('steel_classes', {
  code: text('code').primaryKey(),
  fyMpa: numeric('fy_mpa').notNull(),
  fuMpa: numeric('fu_mpa'),
  esMpa: numeric('es_mpa'),
  description: text('description')
});

/** Cabecera viva del proyecto (estado actual mutable). */
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  specs: jsonb('specs'),
  drawingData: jsonb('drawing_data'),
  simplifiedModel: jsonb('simplified_model'),
  calculations: jsonb('calculations'),
  dimensioning: jsonb('dimensioning'),
  currentRevisionId: uuid('current_revision_id'),
  regulationCode: text('regulation_code'),
  concreteCode: text('concrete_code'),
  steelCode: text('steel_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Snapshot inmutable por versión (histórico de proyecto). */
export const projectRevisions = pgTable(
  'project_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull(),
    version: integer('version').notNull(),
    drawingData: jsonb('drawing_data'),
    simplifiedModel: jsonb('simplified_model'),
    calculations: jsonb('calculations'),
    dimensioning: jsonb('dimensioning'),
    comment: text('comment'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('project_revisions_project_version_idx').on(t.projectId, t.version)]
);

export const exports = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull(),
  revisionId: uuid('revision_id'),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('queued'),
  url: text('url'),
  params: jsonb('params'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true })
});

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id'),
  projectId: uuid('project_id'),
  action: text('action').notNull(),
  payload: jsonb('payload'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow()
});
