import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { CreateCallBody } from "@workspace/api-zod";
import { db, callChecklistItems, callExpenses, callNotes, calls } from "@workspace/db";

const router: IRouter = Router();

const EditOpenCallBody = CreateCallBody.pick({
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
}).partial();

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

router.patch("/calls/:id/details", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "That call ID is not valid." });

  const current = (await db.select().from(calls).where(eq(calls.id, id)).limit(1))[0];
  if (!current) return res.status(404).json({ error: "Call not found." });
  if (current.status === "finished") {
    return res.status(409).json({ error: "This Call Receipt is locked. Use Correct record for audited changes." });
  }

  try {
    const input = EditOpenCallBody.parse(req.body);
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

    if (patch.role && patch.role !== current.role && current.actualStart) {
      return res.status(409).json({ error: "Paid work has already started. Keep the live role stable and use Final role check when you finish the call." });
    }

    const changed = Object.entries(patch)
      .filter(([key, value]) => comparable(current[key as keyof typeof current]) !== comparable(value))
      .map(([key]) => labels[key] || key);
    if (changed.length === 0) return res.json({ id, updated: false, changed: [] });

    const roleChanged = Boolean(patch.role && patch.role !== current.role);
    const updated = (await db.update(calls).set(patch).where(eq(calls.id, id)).returning())[0];

    if (roleChanged) {
      await db.delete(callChecklistItems).where(and(eq(callChecklistItems.callId, id), eq(callChecklistItems.isSuggested, true)));
      const remaining = await db.select().from(callChecklistItems).where(eq(callChecklistItems.callId, id));
      const startOrder = remaining.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
      const suggestions = roleChecklistSuggestions[updated.role] ?? [];
      if (suggestions.length > 0) {
        await db.insert(callChecklistItems).values(suggestions.map((label, index) => ({
          callId: id,
          label,
          checked: false,
          isCustom: false,
          isSuggested: true,
          sortOrder: startOrder + index,
        })));
      }
    }

    return res.json({ id, updated: true, changed });
  } catch {
    return res.status(400).json({ error: "Check the call details and try again." });
  }
});

router.delete("/calls/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "That call ID is not valid." });
  const current = (await db.select().from(calls).where(eq(calls.id, id)).limit(1))[0];
  if (!current) return res.status(404).json({ error: "Call not found." });
  if (current.status !== "upcoming" || current.arrivalAt || current.actualStart) {
    return res.status(409).json({ error: "Only a future call with no arrival or paid-work record can be removed. Active and finished work stays in StageWire." });
  }

  await db.delete(callChecklistItems).where(eq(callChecklistItems.callId, id));
  await db.delete(callNotes).where(eq(callNotes.callId, id));
  await db.delete(callExpenses).where(eq(callExpenses.callId, id));
  await db.delete(calls).where(eq(calls.id, id));
  return res.json({ id, removed: true });
});

export default router;
