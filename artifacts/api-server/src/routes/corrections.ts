import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { CreateCallBody, FinishCallBody } from "@workspace/api-zod";
import { db, callNotes, calls } from "@workspace/db";

const router: IRouter = Router();

const CorrectionBody = CreateCallBody.pick({
  venue: true,
  venueAddress: true,
  showName: true,
  workDate: true,
  scheduledStart: true,
  estimatedEnd: true,
  role: true,
  department: true,
  employer: true,
  crewContactName: true,
  crewContactPhone: true,
  parkingInstructions: true,
  crewEntrance: true,
  loadingDockInfo: true,
  dressRequirements: true,
  ppeRequirements: true,
  toolRequirements: true,
  generalNotes: true,
  payType: true,
  minimumHours: true,
  hourlyRate: true,
}).partial().merge(FinishCallBody.pick({
  actualStart: true,
  actualEnd: true,
  breakMinutes: true,
  arrivalAt: true,
  mileage: true,
  note: true,
}).partial());

const labels: Record<string, string> = {
  venue: "venue",
  venueAddress: "venue address",
  showName: "show or event",
  workDate: "work date",
  scheduledStart: "scheduled start",
  estimatedEnd: "estimated end",
  role: "role",
  department: "department",
  employer: "employer / labor provider",
  crewContactName: "crew contact",
  crewContactPhone: "crew contact phone",
  parkingInstructions: "parking instructions",
  crewEntrance: "crew entrance",
  loadingDockInfo: "dock / load-in info",
  dressRequirements: "dress requirements",
  ppeRequirements: "PPE requirements",
  toolRequirements: "tool requirements",
  generalNotes: "dispatch notes",
  payType: "pay type",
  minimumHours: "minimum hours",
  hourlyRate: "rate / flat amount",
  actualStart: "paid start",
  actualEnd: "actual end",
  breakMinutes: "break minutes",
  arrivalAt: "arrival",
  mileage: "mileage",
  note: "final closeout note",
};

function clean(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function comparable(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

router.patch("/calls/:id/correct", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "That call ID is not valid." });

  const current = (await db.select().from(calls).where(eq(calls.id, id)).limit(1))[0];
  if (!current) return res.status(404).json({ error: "Call not found." });
  if (current.status !== "finished") {
    return res.status(409).json({ error: "Only a finished Call Receipt can be corrected here. Open the active call instead." });
  }

  try {
    const input = CorrectionBody.parse(req.body);
    const patch: Partial<typeof calls.$inferInsert> = {};

    if (input.venue !== undefined) patch.venue = input.venue.trim();
    if (input.venueAddress !== undefined) patch.venueAddress = clean(input.venueAddress);
    if (input.showName !== undefined) patch.showName = input.showName.trim();
    if (input.workDate !== undefined) patch.workDate = input.workDate.toISOString().slice(0, 10);
    if (input.scheduledStart !== undefined) patch.scheduledStart = clean(input.scheduledStart);
    if (input.estimatedEnd !== undefined) patch.estimatedEnd = clean(input.estimatedEnd);
    if (input.role !== undefined) patch.role = input.role.trim();
    if (input.department !== undefined) patch.department = clean(input.department);
    if (input.employer !== undefined) patch.employer = clean(input.employer);
    if (input.crewContactName !== undefined) patch.crewContactName = clean(input.crewContactName);
    if (input.crewContactPhone !== undefined) patch.crewContactPhone = clean(input.crewContactPhone);
    if (input.parkingInstructions !== undefined) patch.parkingInstructions = clean(input.parkingInstructions);
    if (input.crewEntrance !== undefined) patch.crewEntrance = clean(input.crewEntrance);
    if (input.loadingDockInfo !== undefined) patch.loadingDockInfo = clean(input.loadingDockInfo);
    if (input.dressRequirements !== undefined) patch.dressRequirements = clean(input.dressRequirements);
    if (input.ppeRequirements !== undefined) patch.ppeRequirements = clean(input.ppeRequirements);
    if (input.toolRequirements !== undefined) patch.toolRequirements = clean(input.toolRequirements);
    if (input.generalNotes !== undefined) patch.generalNotes = clean(input.generalNotes);
    if (input.payType !== undefined) patch.payType = input.payType;
    if (input.minimumHours !== undefined) patch.minimumHours = input.minimumHours;
    if (input.hourlyRate !== undefined) patch.hourlyRate = input.hourlyRate;
    if (input.arrivalAt !== undefined) patch.arrivalAt = input.arrivalAt ? new Date(input.arrivalAt).toISOString() : null;
    if (input.actualStart !== undefined) patch.actualStart = new Date(input.actualStart).toISOString();
    if (input.actualEnd !== undefined) patch.actualEnd = new Date(input.actualEnd).toISOString();
    if (input.breakMinutes !== undefined) patch.breakMinutes = input.breakMinutes;
    if (input.mileage !== undefined) patch.mileage = input.mileage;
    if (input.note !== undefined) patch.note = clean(input.note);

    const nextStart = patch.actualStart ?? current.actualStart;
    const nextEnd = patch.actualEnd ?? current.actualEnd;
    const nextBreak = patch.breakMinutes ?? current.breakMinutes;
    if (nextStart && nextEnd) {
      const startMs = new Date(nextStart).getTime();
      const endMs = new Date(nextEnd).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return res.status(400).json({ error: "Actual end must be after paid start." });
      }
      const elapsedMinutes = (endMs - startMs) / 60_000;
      if (nextBreak < 0 || nextBreak >= elapsedMinutes) {
        return res.status(400).json({ error: "Break time must be shorter than the total call time." });
      }
      if (elapsedMinutes / 60 > 24) {
        return res.status(400).json({ error: "This corrected shift is over 24 hours. Check the dates and times." });
      }
    }

    const changed = Object.entries(patch).filter(([key, value]) => comparable(current[key as keyof typeof current]) !== comparable(value)).map(([key]) => labels[key] || key);
    if (changed.length === 0) return res.json({ id, corrected: false, changed: [] });

    await db.update(calls).set(patch).where(eq(calls.id, id));
    await db.insert(callNotes).values({
      callId: id,
      category: "correction",
      text: `Worker corrected: ${changed.join(", ")}.`,
    });

    return res.json({ id, corrected: true, changed });
  } catch (error) {
    const message = error && typeof error === "object" && "issues" in error ? "Check the corrected fields and try again." : "This correction could not be saved.";
    return res.status(400).json({ error: message });
  }
});

export default router;
