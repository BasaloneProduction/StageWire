import { Router, type IRouter } from "express";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  CreateCallBody,
  FinishCallBody,
  FinishCallParams,
  GetCallParams,
  GetDashboardResponse,
  GetPassportResponse,
  GetProfileResponse,
  GetVaultResponse,
  ListCallsResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import { db, calls, workerProfiles } from "@workspace/db";

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

function errorMessage(error: unknown, fallback = "Please check the details and try again.") {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ path?: unknown[]; message?: string }> }).issues ?? [];
    return issues
      .map((issue) => `${issue.path?.join(".") || "Details"}: ${issue.message || "is invalid"}`)
      .join(" ");
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
  const gross = hours * call.hourlyRate;
  return {
    ...call,
    scheduledStart: call.scheduledStart ?? null,
    actualStart: call.actualStart ?? null,
    actualEnd: call.actualEnd ?? null,
    expenseDescription: call.expenseDescription ?? null,
    note: call.note ?? null,
    receiptAttachmentName: call.receiptAttachmentName ?? null,
    workPhotoName: call.workPhotoName ?? null,
    hours: Number(hours.toFixed(2)),
    gross: Number(gross.toFixed(2)),
  };
}

async function ensureSeedData() {
  if (seeded) return;

  const existingProfile = await db.select({ id: workerProfiles.id }).from(workerProfiles).limit(1);
  if (existingProfile.length === 0) {
    await db.insert(workerProfiles).values({
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

  const existingCall = await db.select({ id: calls.id }).from(calls).limit(1);
  if (existingCall.length === 0) {
    await db.insert(calls).values([
      {
        venue: "Demo Arena",
        showName: "Concert Load-In",
        workDate: "2026-09-02",
        scheduledStart: "08:00",
        role: "Up Rigger",
        status: "upcoming",
        hourlyRate: 32,
      },
      {
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
  const rows = await db.select().from(calls);
  const completed = rows.filter((call) => call.status === "finished").map(callWithTotals);
  const upcoming = rows
    .filter((call) => call.status === "upcoming")
    .sort((a, b) => `${a.workDate} ${a.scheduledStart ?? ""}`.localeCompare(`${b.workDate} ${b.scheduledStart ?? ""}`));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthWork = completed.filter((call) => call.workDate.startsWith(currentMonth));

  const data = {
    upcomingCount: upcoming.length,
    completedCount: completed.length,
    hoursThisMonth: Number(monthWork.reduce((sum, call) => sum + call.hours, 0).toFixed(2)),
    grossThisMonth: Number(monthWork.reduce((sum, call) => sum + call.gross, 0).toFixed(2)),
    upcomingCall: upcoming[0] ? callWithTotals(upcoming[0]) : null,
  };
  res.json(GetDashboardResponse.parse(data));
});

router.get("/profile", async (_req, res) => {
  await ensureSeedData();
  const profile = (await db.select().from(workerProfiles).orderBy(asc(workerProfiles.id)).limit(1))[0];
  res.json(GetProfileResponse.parse(profile));
});

router.put("/profile", async (req, res) => {
  await ensureSeedData();
  try {
    const input = UpdateProfileBody.parse(req.body);
    if (!input.displayName.trim()) return res.status(400).json({ error: "Add a display name so your profile is easy to recognize." });
    if (!input.primaryRole.trim()) return res.status(400).json({ error: "Choose your primary role." });

    const current = (await db.select().from(workerProfiles).orderBy(asc(workerProfiles.id)).limit(1))[0];
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
        .where(eq(workerProfiles.id, current.id))
        .returning()
    )[0];
    return res.json(UpdateProfileResponse.parse(updated));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "Your profile could not be saved. Please check the fields and try again.") });
  }
});

router.get("/calls", async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(calls).orderBy(desc(calls.workDate), desc(calls.id));
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
          venue: input.venue.trim(),
          showName: input.showName.trim(),
          workDate: input.workDate.toISOString().slice(0, 10),
          scheduledStart: input.scheduledStart?.trim() || null,
          role: input.role.trim(),
          status: "upcoming",
          hourlyRate: input.hourlyRate ?? 0,
        })
        .returning()
    )[0];
    res.status(201).json(callWithTotals(created));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error, "This call could not be saved. Please check the show, venue, date, and rate.") });
  }
});

router.get("/calls/:id", async (req, res) => {
  await ensureSeedData();
  try {
    const { id } = GetCallParams.parse(req.params);
    const call = (await db.select().from(calls).where(eq(calls.id, id)).limit(1))[0];
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
    const existing = (await db.select().from(calls).where(eq(calls.id, id)).limit(1))[0];
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

    const updated = (
      await db
        .update(calls)
        .set({
          actualStart: input.actualStart,
          actualEnd: input.actualEnd,
          breakMinutes,
          role: input.role.trim(),
          expenseAmount: input.expenseAmount ?? 0,
          expenseDescription: asNullable(input.expenseDescription),
          note: asNullable(input.note),
          receiptAttachmentName: asNullable(input.receiptAttachmentName),
          workPhotoName: asNullable(input.workPhotoName),
          status: "finished",
        })
        .where(eq(calls.id, id))
        .returning()
    )[0];
    return res.json(callWithTotals(updated));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error, "This call could not be finished. Check the times, breaks, rate, and expenses.") });
  }
});

router.get("/vault", async (_req, res) => {
  await ensureSeedData();
  const rows = await db.select().from(calls).where(eq(calls.status, "finished")).orderBy(desc(calls.workDate), desc(calls.id));
  const profile = (await db.select().from(workerProfiles).orderBy(asc(workerProfiles.id)).limit(1))[0];
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
  const rows = await db.select().from(calls).where(eq(calls.status, "finished"));
  const profile = (await db.select().from(workerProfiles).orderBy(asc(workerProfiles.id)).limit(1))[0];
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