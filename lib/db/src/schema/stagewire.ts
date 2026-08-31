import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const workerProfiles = pgTable("worker_profiles", {
  id: serial("id").primaryKey(),
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
});

export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  venue: text("venue").notNull(),
  showName: text("show_name").notNull(),
  workDate: date("work_date").notNull(),
  scheduledStart: text("scheduled_start"),
  role: text("role").notNull(),
  status: text("status").notNull().default("upcoming"),
  actualStart: timestamp("actual_start", { mode: "string" }),
  actualEnd: timestamp("actual_end", { mode: "string" }),
  breakMinutes: integer("break_minutes").notNull().default(0),
  hourlyRate: real("hourly_rate").notNull().default(0),
  expenseAmount: real("expense_amount").notNull().default(0),
  expenseDescription: text("expense_description"),
  note: text("note"),
  receiptAttachmentName: text("receipt_attachment_name"),
  workPhotoName: text("work_photo_name"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});