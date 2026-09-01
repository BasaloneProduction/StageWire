import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const workerProfiles = pgTable("worker_profiles", {
  id: serial("id").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  displayName: text("display_name").notNull().default("StageWire Worker"),
  homeCityState: text("home_city_state").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  primaryRole: text("primary_role").notNull().default("Stagehand"),
  additionalRoles: text("additional_roles").array().notNull().default(sql`'{}'::text[]`),
  yearsExperience: integer("years_experience").notNull().default(0),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  certifications: text("certifications").array().notNull().default(sql`'{}'::text[]`),
  bio: text("bio"),
  emergencyContact: text("emergency_contact"),
  profilePhotoName: text("profile_photo_name"),
  privateByDefault: boolean("private_by_default").notNull().default(true),
}, (table) => [
  uniqueIndex("worker_profiles_owner_key_unique").on(table.ownerKey),
]);

export const workerIdentities = pgTable("worker_identities", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  subject: text("subject").notNull(),
  ownerKey: text("owner_key").notNull().references(() => workerProfiles.ownerKey, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("worker_identities_provider_subject_unique").on(table.provider, table.subject),
  index("worker_identities_owner_key_idx").on(table.ownerKey),
]);

export const workerSessions = pgTable("worker_sessions", {
  sessionHash: text("session_hash").primaryKey(),
  ownerKey: text("owner_key").notNull().references(() => workerProfiles.ownerKey, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  revokedAt: timestamp("revoked_at", { mode: "string" }),
}, (table) => [
  index("worker_sessions_owner_key_idx").on(table.ownerKey),
  index("worker_sessions_expires_at_idx").on(table.expiresAt),
]);

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  ownerKey: text("owner_key").notNull(),
  venue: text("venue").notNull(),
  venueAddress: text("venue_address"),
  showName: text("show_name").notNull(),
  workDate: date("work_date").notNull(),
  scheduledStart: text("scheduled_start"),
  estimatedEnd: text("estimated_end"),
  role: text("role").notNull(),
  department: text("department"),
  employer: text("employer"),
  crewContactName: text("crew_contact_name"),
  crewContactPhone: text("crew_contact_phone"),
  parkingInstructions: text("parking_instructions"),
  crewEntrance: text("crew_entrance"),
  loadingDockInfo: text("loading_dock_info"),
  dressRequirements: text("dress_requirements"),
  ppeRequirements: text("ppe_requirements"),
  toolRequirements: text("tool_requirements"),
  generalNotes: text("general_notes"),
  payType: text("pay_type").notNull().default("hourly"),
  minimumHours: real("minimum_hours").notNull().default(0),
  status: text("status").notNull().default("upcoming"),
  arrivalAt: timestamp("arrival_at", { mode: "string" }),
  actualStart: timestamp("actual_start", { mode: "string" }),
  actualEnd: timestamp("actual_end", { mode: "string" }),
  breakMinutes: integer("break_minutes").notNull().default(0),
  hourlyRate: real("hourly_rate").notNull().default(0),
  expenseAmount: real("expense_amount").notNull().default(0),
  mileage: real("mileage").notNull().default(0),
  parkingExpense: real("parking_expense").notNull().default(0),
  tollExpense: real("toll_expense").notNull().default(0),
  expenseDescription: text("expense_description"),
  note: text("note"),
  receiptAttachmentName: text("receipt_attachment_name"),
  workPhotoName: text("work_photo_name"),
  overtimeHours: real("overtime_hours").notNull().default(0),
  doubleTimeHours: real("double_time_hours").notNull().default(0),
  mealPenaltyAmount: real("meal_penalty_amount").notNull().default(0),
  completedAt: timestamp("completed_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("calls_owner_key_idx").on(table.ownerKey),
  index("calls_owner_work_date_idx").on(table.ownerKey, table.workDate),
]);

export const callChecklistItems = pgTable("call_checklist_items", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  checked: boolean("checked").notNull().default(false),
  isCustom: boolean("is_custom").notNull().default(false),
  isSuggested: boolean("is_suggested").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("call_checklist_items_call_id_idx").on(table.callId),
]);

export const callNotes = pgTable("call_notes", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("call_notes_call_id_idx").on(table.callId),
]);

export const callExpenses = pgTable("call_expenses", {
  id: serial("id").primaryKey(),
  callId: integer("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
  amount: real("amount").notNull(),
  category: text("category").notNull().default("Other"),
  description: text("description"),
  receiptAttachmentName: text("receipt_attachment_name"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("call_expenses_call_id_idx").on(table.callId),
]);