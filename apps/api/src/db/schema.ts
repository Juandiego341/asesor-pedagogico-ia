import {
  pgTable, uuid, text, integer, timestamp, jsonb, boolean, pgEnum, serial, real, customType, uniqueIndex, index,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() { return 'bytea'; },
});

export const roleEnum = pgEnum('role', ['ADMIN', 'TEACHER', 'STUDENT']);
export const rubricStatusEnum = pgEnum('rubric_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const fileKindEnum = pgEnum('file_kind', ['REPORT_PDF', 'CODE_ZIP', 'RUBRIC_SOURCE', 'IMAGE', 'SLIDES', 'VIDEO', 'OTHER']);
export const evalStatusEnum = pgEnum('eval_status', ['QUEUED', 'RUNNING', 'FAILED', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('STUDENT'),
  studentCode: text('student_code'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cohorts = pgTable('cohorts', {
  id: serial('id').primaryKey(),
  number: integer('number').notNull().unique(),
  name: text('name').notNull(),
  period: text('period'),
});

export const labs = pgTable('labs', {
  id: uuid('id').primaryKey().defaultRandom(),
  cohortId: integer('cohort_id').notNull().references(() => cohorts.id),
  order: integer('order').notNull().default(1),
  title: text('title').notNull(),
  description: text('description').notNull(),
  objectives: text('objectives').notNull().default(''),
  topics: jsonb('topics').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rubricVersions = pgTable('rubric_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  labId: uuid('lab_id').notNull().references(() => labs.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  status: rubricStatusEnum('status').notNull().default('DRAFT'),
  content: jsonb('content').notNull(),
  issues: jsonb('issues').notNull().default([]),
  sourceFileId: uuid('source_file_id'),
  extractedBy: text('extracted_by'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => [uniqueIndex('rubric_lab_version').on(t.labId, t.version)]);

export const submissions = pgTable('submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  labId: uuid('lab_id').notNull().references(() => labs.id, { onDelete: 'cascade' }),
  rubricVersionId: uuid('rubric_version_id').notNull().references(() => rubricVersions.id),
  repoUrl: text('repo_url'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sub_student').on(t.studentId)]);

export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => submissions.id, { onDelete: 'cascade' }),
  kind: fileKindEnum('kind').notNull(),
  filename: text('filename').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  data: bytea('data').notNull(),
  extractedText: text('extracted_text'),
  meta: jsonb('meta').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evaluations = pgTable('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  rubricVersionId: uuid('rubric_version_id').notNull().references(() => rubricVersions.id),
  rubricSnapshot: jsonb('rubric_snapshot').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  status: evalStatusEnum('status').notNull().default('QUEUED'),
  error: text('error'),
  evidenceManifest: jsonb('evidence_manifest').notNull().default([]),
  verification: jsonb('verification'),
  aiOutput: jsonb('ai_output'),
  citationCheck: jsonb('citation_check'),
  criteriaResults: jsonb('criteria_results'),
  preliminaryGrade: real('preliminary_grade'),
  finalGrade: real('final_grade'),
  teacherOverrides: jsonb('teacher_overrides').notNull().default({}),
  teacherComment: text('teacher_comment'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  usage: jsonb('usage'),
  attempts: integer('attempts').notNull().default(0),
  durationMs: integer('duration_ms'),
  requestedBy: uuid('requested_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('eval_sub').on(t.submissionId)]);

export const learningPlans = pgTable('learning_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: jsonb('content').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  basedOn: jsonb('based_on').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});

export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  bio: text('bio').notNull().default(''),
  photo: bytea('photo'),
  photoMime: text('photo_mime'),
  order: integer('order').notNull().default(0),
});
