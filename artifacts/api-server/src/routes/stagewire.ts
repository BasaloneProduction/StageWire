import { Router, type IRouter } from "express";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  AddCallExpenseBody,
  AddCallNoteBody,
  AddChecklistItemBody,
  AddChecklistItemResponse,
  AddCallExpenseResponse,
  AddCallNoteResponse,
  ArriveAtCallBody,
  ArriveAtCallParams,
  ArriveAtCallResponse,
  CreateCallBody,
  FinishCallBody,
  FinishCallParams,
  GetCallChecklistParams,
  GetCallChecklistResponse,
  GetCallParams,
  GetCallWorkdayParams,
  GetCallWorkdayResponse,
  GetDashboardResponse,
  GetPassportResponse,
  GetProfileResponse,
  GetVaultResponse,
  ListCallsResponse,
  AddCallExpenseParams,
  AddCallNoteParams,
  AddChecklistItemParams,
  ResetCallChecklistResponse,
  ResetCallChecklistParams,
  StartCallWorkParams,
  StartCallWorkBody,
  StartCallWorkResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
  UpdateChecklistItemParams,
  UpdateChecklistItemBody,
  UpdateChecklistItemResponse,
} from "@workspace/api-zod";
import { db, callChecklistItems, callExpenses, callNotes, calls, workerProfiles } from "@workspace/db";
import { PREVIEW_OWNER_KEY, ownedCallWhere, ownedCallsWhere, ownedProfileWhere } from "../domain/worker-owner";
import { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";

const router: IRouter = Router();

const roles = [
  "Stagehand",
  "Up Rigger",
  "Down Rigger",
  "Pusher",
  "Audio",
  "Lighting",
  "Video",
  "Carpentry",
  "Forklift/Aerial Lift Operator",
  "Show Crew/Deck",
  "Other",
];

let seeded = false;

const fieldLabels: Record<string, string> = {
  venue: "Venue",
  showName: "Show name",
  workDate: "Work date",
  scheduledStart: "Scheduled start time",
  role: "Role",
  hourlyRate: "Hourly rate",
  displayName: "Display name",
  homeCityState: "Home city / state",
  phone: "Phone",
  email: "Email",
  primaryRole: "Primary role",
  additionalRoles: "Additional roles",
  yearsExperience: "Years of experience",
  skills: "Skills",
  certifications: "Certifications",
  bio: "Bio",
  emergencyContact: "Emergency contact",
  actualStart: "Actual start time",
  actualEnd: "Actual end time",
  breakMinutes: "Break minutes",
  expenseAmount: "Expenses",
  expenseDescription: "Expense description",
  note: "Notes",
  receiptAttachmentName: "Receipt attachment",
  workPhotoName: "Work photo",
  arrivalAt: "Arrival time",
  payType: "Pay type",
  minimumHours: "Minimum hours",
  mileage: "Mileage",
  parkingExpense: "Parking",
  tollExpense: "Tolls",
  category: "Category",
  text: "Note",
  label: "Checklist item",
};

const defaultChecklistItems = [
  "Work gloves",
  "Crescent wrench",
  "Multitool",
  "Flashlight / headlamp",
  "Hard hat",
  "Safety vest",
  "Work boots",
  "Harness if required",
  "Water",
  "Phone charger",
  "ID / credentials",
];

const roleChecklistSuggestions: Record<string, string[]> = {
  "Up Rigger": ["Harness fit checked", "Rigging gloves"],
  "Down Rigger": ["Rigging gloves", "Radio / comms"],
  Pusher: ["Crew contact saved", "Truck / dock details reviewed"],
  Lighting: ["Gels / tape", "Lighting tools"],
  Audio: ["Hearing protection", "Audio tools"],
  Video: ["Media / camera kit", "Video tools"],
  Carpentry: ["Eye protection", "Carpentry tools"],
  "Forklift/Aerial Lift Operator": ["Lift certification", "Spotter plan reviewed"],
  "Truck / Logistics": ["Driver documents", "Load plan reviewed"],
};

const expenseCategories = ["Parking", "Toll", "Mileage", "Transportation", "Meal", "Supplies", "Lodging", "Other"];

function friendlyFieldName(path: unknown[] | undefined) {
  const key = path?.join(".") || "";
  return fieldLabels[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()) || "Details";
}

function friendlyIssueMessage(issue: { path?: unknown[]; message?: string }) {
  const label = friendlyFieldName(issue.path);
  const message = issue.message || "";
  const normalized = message.toLowerCase();

  if (normalized.includes("expected number") && normalized.includes(">=0")) {
    return `${label} cannot be negative.`;
  }
  if (normalized.includes("expected number")) {
    return `${label} must be a number.`;
  }
  if (normalized.includes("expected date")) {
    return `${label} must be a valid date.`;
  }
  if (normalized.includes("received undefined") || normalized.includes("received null")) {
    return `${label} is required.`;
  }
  if (normalized.includes("expected string")) {
    return `${label} must be text.`;
  }
  return `${label}: ${message || "is invalid."}`;
}

function errorMessage(error: unknown, fallback = "Please check the details and try again.") {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ path?: unknown[]; message?: string }> }).issues ?? [];
    return issues.map(friendlyIssueMessage).join(" ");
  }
  return fallback;
}

function asNullable(value: string | null | undefined) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function callWithTotals(call: typeof calls.$inferSelect) {
  const start = call.actualStart ? new Date(call.actualStart) : null;
  const end = call.actualEnd ? new Date(call.actualEnd) : null;
  let hours = 0;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
    hours = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000 - call.breakMinutes / 60);
  }
  const payableHours = Math.max(hours, call.minimumHours ?? 0);
  const gross = call.payType === "hourly" ? payableHours * call.hourlyRate : call.hourlyRate;
  return {
    ...call,
    scheduledStart: call.scheduledStart ?? null,
    actualStart: call.actualStart ?? null,
    actualEnd: call.actualEnd ?? null,
    expenseDescription: call.expenseDescription ?? null,
    note: call.note ?? null,
    receiptAttachmentName: call.receiptAttachmentName ?? null,
    workPhotoName: call.workPhotoName ?? null,
    venueAddress: call.venueAddress ?? null,
    estimatedEnd: call.estimatedEnd ?? null,
    department: call.department ?? null,
    employer: call.employer ?? null,
    crewContactName: call.crewContactName ?? null,
    crewContactPhone: call.crewContactPhone ?? null,
    parkingInstructions: call.parkingInstructions ?? null,
    crewEntrance: call.crewEntrance ?? null,
    loadingDockInfo: call.loadingDockInfo ?? null,
    dressRequirements: call.dressRequirements ?? null,
    ppeRequirements: call.ppeRequirements ?? null,
    toolRequirements: call.toolRequirements ?? null,
    generalNotes: call.generalNotes ?? null,
    payType: call.payType ?? "hourly",
    minimumHours: call.minimumHours ?? 0,
    arrivalAt: call.arrivalAt ?? null,
    mileage: call.mileage ?? 0,
    parkingExpense: call.parkingExpense ?? 0,
    tollExpense: call.tollExpense ?? 0,
    overtimeHours: call.overtimeHours ?? 0,
    doubleTimeHours: call.doubleTimeHours ?? 0,
    mealPenaltyAmount: call.mealPenaltyAmount ?? 0,
    completedAt: call.completedAt ?? null,
    hours: Number(hours.toFixed(2)),
    gross: Number(gross.toFixed(2)),
  };
}

async function getCall(id: number) {
  return (await db.select().from(calls).where(ownedCallWhere(id)).limit(1))[0];
}

async function ensureChecklist(callId: number, role: string) {
  const existing = await db.select().from(callChecklistItems).where(eq(callChecklistItems.callId, callId));
  if (existing.length > 0) return existing;

  const suggestions = roleChecklistSuggestions[role] ?? [];
  const labels = [...defaultChecklistItems, ...suggestions];
  return db.insert(callChecklistItems).values(
    labels.map((label, index) => ({
      callId,
      label,
      sortOrder: index,
      isCustom: false,
      isSuggested: index >= defaultChecklistItems.length,
    })),
  ).returning();
}

async function workdayForCall(call: typeof calls.$inferSelect) {
  const [checklist, notes, expenses] = await Promise.all([
    ensureChecklist(call.id, call.role),
    db.select().from(callNotes).where(eq(callNotes.callId, call.id)).orderBy(desc(callNotes.createdAt)),
    db.select().from(callExpenses).where(eq(callExpenses.callId, call.id)).orderBy(desc(callExpenses.createdAt)),
  ]);
  return {
    call: callWithTotals(call),
    checklist: { items: checklist.sort((a, b) => a.sortOrder - b.sortOrder) },
    notes,
    expenses,
  };
}

async function ensureSeedData() {
  if (currentWorkerPrincipal().kind !== "preview") return;
  if (seeded) return;

  const existingProfile = await db.select({ id: workerProfiles.id }).from(workerProfiles).where(ownedProfileWhere()).limit(1);
  if (existingProfile.length === 0) {
    await db.insert(workerProfiles).values({
      ownerKey: PREVIEW_OWNER_KEY,
      displayName: "StageWire Worker",
      homeCityState: "New York, NY",
      primaryRole: "Stagehand",
      additionalRoles: ["Pusher"],
      yearsExperience: 8,
      skills: ["Load-in / load-out", "Deck work", "Forklift safety"],
      certifications: ["OSHA 10"],
      bio: "Live-production worker building a clear record of every call.",
      privateByDefault: true,
    });
  }

  const existingCall = await db.select({ id: calls.id }).from(calls).where(ownedCallsWhere()).limit(1);
  if (existingCall.length === 0) {
    await db.insert(calls).values([
      {
        ownerKey: PREVIEW_OWNER_KEY,
        venue: "Demo Arena",
        showName: "Concert Load-In",
        workDate: "2026-09-02",
        scheduledStart: "08:00",
        role: "Up Rigger",
        status: "upcoming",
        hourlyRate: 32,
      },
      {
        ownerKey: PREVIEW_OWNER_KEY,
        venue: "Downtown Theatre",
        showName: "Touring Broadway Load-Out",
        workDate: "2026-08-29",
        scheduledStart: "22:30",
        role: "Stagehand",
        status: "finished",
        actualStart: "2026-08-29T22:30:00",
        actualEnd: "2026-08-30T06:30:00",
        breakMinutes: 30,
        hourlyRate: 28,
        note: "Demo receipt from the starter record.",
      },
    ]);
  }

  seeded = true;
}

router.get("/dashboard", async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(calls).where(ownedCallsWhere());
  const completed = rows.filter((call) => call.status === "finished").map(callWithTotals);
  const upcoming = rows
    .filter((call) => call.status === "upcoming")
    .sort((a, b) => `${a.workDate} ${a.scheduledStart ?? ""}`.localeCompare(`${b.workDate} ${b.scheduledStart ?? ""}`));
  const active = rows
    .filter((call) => call.status === "arrived" || call.status === "active")
    .sort((a, b) => (b.arrivalAt ?? b.createdAt).localeCompare(a.arrivalAt ?? a.createdAt));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthWork = completed.filter((call) => call.workDate.startsWith(currentMonth));

  const data = {
    upcomingCount: upcoming.length,
    completedCount: completed.length,
    hoursThisMonth: Number(monthWork.reduce((sum, call) => sum + call.hours, 0).toFixed(2)),
    grossThisMonth: Number(monthWork.reduce((sum, call) => sum + call.gross, 0).toFixed(2)),
    upcomingCall: upcoming[0] ? callWithTotals(upcoming[0]) : null,
    activeCall: active[0] ? callWithTotals(active[0]) : null,
  };
  res.json(GetDashboardResponse.parse(data));
});

router.get("/profile", async (_req, res) => {
  await ensureSeedData();
  const profile = (await db.select().from(workerProfiles).where(ownedProfileWhere()).orderBy(asc(workerProfiles.id)).limit(1))[0];
  res.json(GetProfileResponse.parse(profile));
});

router.put("/profile", async (req, res) => {
  await ensureSeedData();
  try {
    const input = UpdateProfileBody.parse(req.body);
    if (!input.displayName.trim()) return res.status(400).json({ error: "Add a display name so your profile is easy to recognize." });
    if (!input.primaryRole.trim()) return res.status(400).json({ error: "Choose your primary role." });

    const current = (await db.select().from(workerProfiles).where(ownedProfileWhere()).orderBy(asc(workerProfiles.id)).limit(1))[0];
    const updated = (
      await db
        .update(workerProfiles)
        .set({
          displayName: input.displayName.trim(),
          homeCityState: input.homeCityState?.trim() ?? current.homeCityState,
          phone: input.phone?.trim() ?? current.phone,
          email: input.email?.trim() ?? current.email,
          primaryRole: input.primaryRole.trim(),
          additionalRoles: input.additionalRoles ?? current.additionalRoles,
          yearsExperience: input.yearsExperience ?? current.yearsExperience,
          skills: input.skills ?? current.skills,
          certifications: input.certifications ?? current.certifications,
          bio: input.bio === undefined ? current.bio : asNullable(input.bio),
          emergencyContact: input.emergencyContact === undefined ? current.emergencyContact : asNullable(input.emergencyContact),
          profilePhotoName: input.profilePhotoName === undefined ? current.profilePhotoName : asNullable(input.profilePhotoName),
          privateByDefault: true,
        })
        .where(and(eq(workerProfiles.id, current.id), ownedProfileWhere()))
        .returning()
    )[0];
    return res.json(UpdateProfileResponse.parse(updated));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Your profile could not be saved. Please check the fields and try again.") });
  }
});

router.get("/calls", async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(calls).where(ownedCallsWhere()).orderBy(desc(calls.workDate), desc(calls.id));
  res.json(ListCallsResponse.parse(rows.map(callWithTotals)));
});

router.post("/calls", async (req, res) => {
  await ensureSeedData();
  try {
    const input = CreateCallBody.parse(req.body);
    const created = (
      await db
        .insert(calls)
        .values({
          ownerKey: currentWorkerOwnerKey(),
          venue: input.venue.trim(),
          venueAddress: asNullable(input.venueAddress),
          showName: input.showName.trim(),
          workDate: input.workDate.toISOString().slice(0, 10),
          scheduledStart: input.scheduledStart?.trim() || null,
          estimatedEnd: asNullable(input.estimatedEnd),
          role: input.role.trim(),
          department: asNullable(input.department),
          employer: asNullable(input.employer),
          crewContactName: asNullable(input.crewContactName),
          crewContactPhone: asNullable(input.crewContactPhone),
          parkingInstructions: asNullable(input.parkingInstructions),
          crewEntrance: asNullable(input.crewEntrance),
          loadingDockInfo: asNullable(input.loadingDockInfo),
          dressRequirements: asNullable(input.dressRequirements),
          ppeRequirements: asNullable(input.ppeRequirements),
          toolRequirements: asNullable(input.toolRequirements),
          generalNotes: asNullable(input.generalNotes),
          payType: input.payType ?? "hourly",
          minimumHours: input.minimumHours ?? 0,
          status: "upcoming",
          hourlyRate: input.hourlyRate ?? 0,
        })
        .returning()
    )[0];
    await ensureChecklist(created.id, created.role);
    const customItems = (input.checklist ?? []).map((label) => label.trim()).filter(Boolean);
    if (customItems.length > 0) {
      await db.insert(callChecklistItems).values(customItems.map((label, index) => ({
        callId: created.id,
        label,
        sortOrder: defaultChecklistItems.length + index + 1,
        isCustom: true,
        isSuggested: false,
      })));
    }
    res.status(201).json(callWithTotals(created));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, "This call could not be saved. Please check the show, venue, date, and rate.") });
  }
});

router.get("/calls/:id", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = GetCallParams.parse(req.params);
    const call = (await db.select().from(calls).where(ownedCallWhere(id)).limit(1))[0];
    if (!call) return res.status(404).json({ error: "Call not found." });
    return res.json(callWithTotals(call));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "That call ID is not valid.") });
  }
});

router.post("/calls/:id/finish", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = FinishCallParams.parse(req.params);
    const input = FinishCallBody.parse(req.body);
    const existing = (await db.select().from(calls).where(ownedCallWhere(id)).limit(1))[0];
    if (!existing) return res.status(404).json({ error: "Call not found." });
    if (existing.status === "finished") return res.status(409).json({ error: "This call is already finished. Its receipt is safely kept in The Vault." });

    const start = new Date(input.actualStart);
    const end = new Date(input.actualEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "Enter a valid actual start and end time." });
    }
    if (end <= start) return res.status(400).json({ error: "Actual end time must be after actual start time." });
    const breakMinutes = input.breakMinutes ?? 0;
    const elapsedMinutes = (end.getTime() - start.getTime()) / 60_000;
    if (breakMinutes >= elapsedMinutes) return res.status(400).json({ error: "Break time must be shorter than the total call time." });

    const additionalAmount = input.additionalExpenseAmount ?? input.expenseAmount ?? 0;
    const parkingExpense = input.parkingExpense ?? 0;
    const tollExpense = input.tollExpense ?? 0;
    if (additionalAmount > 0) {
      await db.insert(callExpenses).values({
        callId: id,
        amount: additionalAmount,
        category: input.additionalExpenseCategory?.trim() || "Other",
        description: asNullable(input.additionalExpenseDescription) ?? asNullable(input.expenseDescription),
        receiptAttachmentName: asNullable(input.receiptAttachmentName),
      });
    }
    if (parkingExpense > 0) {
      await db.insert(callExpenses).values({ callId: id, amount: parkingExpense, category: "Parking", description: "Added while finishing the call" });
    }
    if (tollExpense > 0) {
      await db.insert(callExpenses).values({ callId: id, amount: tollExpense, category: "Toll", description: "Added while finishing the call" });
    }
    if (input.note?.trim()) {
      await db.insert(callNotes).values({ callId: id, text: input.note.trim(), category: "Work performed" });
    }

    const updated = (
      await db
        .update(calls)
        .set({
          actualStart: input.actualStart,
          actualEnd: input.actualEnd,
          breakMinutes,
          role: input.role.trim(),
          arrivalAt: input.arrivalAt ? input.arrivalAt : existing.arrivalAt,
          expenseAmount: Number(((existing.expenseAmount ?? 0) + additionalAmount + parkingExpense + tollExpense).toFixed(2)),
          parkingExpense: Number(((existing.parkingExpense ?? 0) + parkingExpense).toFixed(2)),
          tollExpense: Number(((existing.tollExpense ?? 0) + tollExpense).toFixed(2)),
          mileage: input.mileage ?? existing.mileage ?? 0,
          expenseDescription: asNullable(input.additionalExpenseDescription) ?? asNullable(input.expenseDescription) ?? existing.expenseDescription,
          note: asNullable(input.note),
          receiptAttachmentName: asNullable(input.receiptAttachmentName),
          workPhotoName: asNullable(input.workPhotoName),
          status: "finished",
          completedAt: new Date().toISOString(),
        })
        .where(ownedCallWhere(id))
        .returning()
    )[0];
    return res.json(callWithTotals(updated));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "This call could not be finished. Check the times, breaks, rate, and expenses.") });
  }
});

router.get("/calls/:id/workday", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = GetCallWorkdayParams.parse(req.params);
    const call = await getCall(id);
    if (!call) return res.status(404).json({ error: "Call not found." });
    return res.json(GetCallWorkdayResponse.parse(await workdayForCall(call)));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "That workday could not be loaded.") });
  }
});

router.post("/calls/:id/arrive", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = ArriveAtCallParams.parse(req.params);
    const input = ArriveAtCallBody.parse(req.body);
    const existing = await getCall(id);
    if (!existing) return res.status(404).json({ error: "Call not found." });
    if (existing.status === "finished") return res.status(409).json({ error: "This call is already finished." });
    const updated = (await db.update(calls).set({
      arrivalAt: input.arrivalAt,
      status: existing.status === "upcoming" ? "arrived" : existing.status,
    }).where(ownedCallWhere(id)).returning())[0];
    await ensureChecklist(id, updated.role);
    return res.json(ArriveAtCallResponse.parse(callWithTotals(updated)));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Enter a valid arrival time.") });
  }
});

router.post("/calls/:id/start", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = StartCallWorkParams.parse(req.params);
    const input = StartCallWorkBody.parse(req.body);
    const existing = await getCall(id);
    if (!existing) return res.status(404).json({ error: "Call not found." });
    if (existing.status === "finished") return res.status(409).json({ error: "This call is already finished." });
    if (!existing.arrivalAt) return res.status(400).json({ error: "Mark yourself arrived before starting paid work." });
    const updated = (await db.update(calls).set({
      actualStart: input.actualStart,
      status: "active",
    }).where(ownedCallWhere(id)).returning())[0];
    return res.json(StartCallWorkResponse.parse(callWithTotals(updated)));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Enter a valid paid work start time.") });
  }
});

router.get("/calls/:id/checklist", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = GetCallChecklistParams.parse(req.params);
    const call = await getCall(id);
    if (!call) return res.status(404).json({ error: "Call not found." });
    return res.json(GetCallChecklistResponse.parse({ items: (await ensureChecklist(id, call.role)).sort((a, b) => a.sortOrder - b.sortOrder) }));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "That checklist could not be loaded.") });
  }
});

router.post("/calls/:id/checklist/items", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = AddChecklistItemParams.parse(req.params);
    const input = AddChecklistItemBody.parse(req.body);
    if (!await getCall(id)) return res.status(404).json({ error: "Call not found." });
    const item = (await db.insert(callChecklistItems).values({
      callId: id,
      label: input.label.trim(),
      isCustom: true,
      isSuggested: false,
      sortOrder: (await db.select().from(callChecklistItems).where(eq(callChecklistItems.callId, id))).length + 1,
    }).returning())[0];
    return res.status(201).json(AddChecklistItemResponse.parse(item));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Add a checklist item before saving.") });
  }
});

router.patch("/calls/:id/checklist/items/:itemId", async (req, res) => {
  await ensureSeedData();
  try {
    const { id, itemId } = UpdateChecklistItemParams.parse(req.params);
    const input = UpdateChecklistItemBody.parse(req.body);
    const existing = (await db.select().from(callChecklistItems).where(eq(callChecklistItems.id, itemId)).limit(1))[0];
    if (!existing || existing.callId !== id) return res.status(404).json({ error: "Checklist item not found." });
    const updated = (await db.update(callChecklistItems).set({
      checked: input.checked ?? existing.checked,
      label: input.label?.trim() || existing.label,
    }).where(eq(callChecklistItems.id, itemId)).returning())[0];
    return res.json(UpdateChecklistItemResponse.parse(updated));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "That checklist item could not be updated.") });
  }
});

router.delete("/calls/:id/checklist/items/:itemId", async (req, res) => {
  await ensureSeedData();
  try {
    const { id, itemId } = UpdateChecklistItemParams.parse(req.params);
    const existing = (await db.select().from(callChecklistItems).where(eq(callChecklistItems.id, itemId)).limit(1))[0];
    if (!existing || existing.callId !== id) return res.status(404).json({ error: "Checklist item not found." });
    if (!existing.isCustom) return res.status(400).json({ error: "Suggested items stay on the checklist; uncheck them instead." });
    await db.delete(callChecklistItems).where(eq(callChecklistItems.id, itemId));
    return res.status(204).send();
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "That checklist item could not be removed.") });
  }
});

router.post("/calls/:id/checklist/reset", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = ResetCallChecklistParams.parse(req.params);
    const call = await getCall(id);
    if (!call) return res.status(404).json({ error: "Call not found." });
    await ensureChecklist(id, call.role);
    await db.update(callChecklistItems).set({ checked: false }).where(eq(callChecklistItems.callId, id));
    return res.json(ResetCallChecklistResponse.parse({ items: (await db.select().from(callChecklistItems).where(eq(callChecklistItems.callId, id))).sort((a, b) => a.sortOrder - b.sortOrder) }));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "The checklist could not be reset.") });
  }
});

router.post("/calls/:id/notes", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = AddCallNoteParams.parse(req.params);
    const input = AddCallNoteBody.parse(req.body);
    if (!await getCall(id)) return res.status(404).json({ error: "Call not found." });
    const note = (await db.insert(callNotes).values({
      callId: id,
      text: input.text.trim(),
      category: asNullable(input.category),
    }).returning())[0];
    return res.status(201).json(AddCallNoteResponse.parse(note));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Write a note before saving.") });
  }
});

router.post("/calls/:id/expenses", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = AddCallExpenseParams.parse(req.params);
    const input = AddCallExpenseBody.parse(req.body);
    const call = await getCall(id);
    if (!call) return res.status(404).json({ error: "Call not found." });
    const expense = (await db.insert(callExpenses).values({
      callId: id,
      amount: input.amount,
      category: input.category.trim(),
      description: asNullable(input.description),
      receiptAttachmentName: asNullable(input.receiptAttachmentName),
    }).returning())[0];
    const category = input.category.toLowerCase();
    await db.update(calls).set({
      expenseAmount: Number(((call.expenseAmount + input.amount)).toFixed(2)),
      parkingExpense: category === "parking" ? Number((call.parkingExpense + input.amount).toFixed(2)) : call.parkingExpense,
      tollExpense: category === "toll" ? Number((call.tollExpense + input.amount).toFixed(2)) : call.tollExpense,
    }).where(ownedCallWhere(id));
    return res.status(201).json(AddCallExpenseResponse.parse(expense));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Add an amount and category before saving the expense.") });
  }
});

router.get("/vault", async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(calls).where(and(ownedCallsWhere(), eq(calls.status, "finished"))).orderBy(desc(calls.workDate), desc(calls.id));
  const profile = (await db.select().from(workerProfiles).where(ownedProfileWhere()).orderBy(asc(workerProfiles.id)).limit(1))[0];
  const receipts = rows.map(callWithTotals);
  const documents = receipts
    .filter((call) => call.receiptAttachmentName)
    .map((call) => ({ name: call.receiptAttachmentName!, kind: "document" as const, callId: call.id }));
  const photos = receipts
    .filter((call) => call.workPhotoName)
    .map((call) => ({ name: call.workPhotoName!, kind: "photo" as const, callId: call.id }));
  res.json(
    GetVaultResponse.parse({
      calls: receipts,
      certifications: profile.certifications,
      skills: profile.skills,
      documents,
      photos,
    }),
  );
});

router.get("/passport", async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(calls).where(and(ownedCallsWhere(), eq(calls.status, "finished")));
  const profile = (await db.select().from(workerProfiles).where(ownedProfileWhere()).orderBy(asc(workerProfiles.id)).limit(1))[0];
  const grouped = new Map<string, { calls: number; hours: number }>();
  for (const call of rows) {
    const totals = callWithTotals(call);
    const current = grouped.get(call.role) ?? { calls: 0, hours: 0 };
    grouped.set(call.role, { calls: current.calls + 1, hours: current.hours + totals.hours });
  }
  const data = {
    workerName: profile.displayName,
    primaryRole: profile.primaryRole,
    additionalRoles: profile.additionalRoles,
    completedCallCount: rows.length,
    experience: [...grouped.entries()]
      .map(([role, totals]) => ({ role, calls: totals.calls, hours: Number(totals.hours.toFixed(2)) }))
      .sort((a, b) => b.calls - a.calls),
    skills: profile.skills,
    certifications: profile.certifications,
    privateByDefault: true,
  };
  res.json(GetPassportResponse.parse(data));
});

export default router;