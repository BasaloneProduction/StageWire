import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetCrewKitStateResponse,
  UpdateCrewKitStateBody,
  UpdateCrewKitStateResponse,
} from "@workspace/api-zod";
import { db, workerCrewKitState, workerProfiles } from "@workspace/db";
import { currentWorkerOwnerKey, currentWorkerPrincipal } from "../domain/worker-context";
import { PREVIEW_OWNER_KEY } from "../domain/worker-owner";

const router: IRouter = Router();

type CrewKitStateValue = {
  customItems: Array<{ id: string; role: string; label: string }>;
  readyMarks: string[];
};

function isValidationError(error: unknown) {
  return Boolean(error && typeof error === "object" && "issues" in error);
}

async function ensureCrewKitOwner() {
  const ownerKey = currentWorkerOwnerKey();
  const existing = await db
    .select({ ownerKey: workerProfiles.ownerKey })
    .from(workerProfiles)
    .where(eq(workerProfiles.ownerKey, ownerKey))
    .limit(1);
  if (existing.length > 0) return ownerKey;

  if (currentWorkerPrincipal().kind !== "preview" || ownerKey !== PREVIEW_OWNER_KEY) {
    throw new Error("StageWire worker profile is missing for this authenticated identity.");
  }

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
  }).onConflictDoNothing({ target: workerProfiles.ownerKey });

  return ownerKey;
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function responseFromRow(row?: { customItemsJson: string; readyMarksJson: string } | null): CrewKitStateValue {
  const parsed = GetCrewKitStateResponse.safeParse({
    customItems: row ? parseArray(row.customItemsJson) : [],
    readyMarks: row ? parseArray(row.readyMarksJson) : [],
  });
  return parsed.success ? parsed.data : { customItems: [], readyMarks: [] };
}

function cleanInput(value: CrewKitStateValue) {
  const customItems = value.customItems.map((item) => ({
    id: item.id.trim(),
    role: item.role.trim(),
    label: item.label.trim(),
  }));
  if (customItems.some((item) => !item.id || !item.role || !item.label)) {
    throw new Error("crew-kit-blank-item");
  }
  const uniqueIds = new Set(customItems.map((item) => item.id));
  if (uniqueIds.size !== customItems.length) throw new Error("crew-kit-duplicate-item");
  const readyMarks = Array.from(new Set(value.readyMarks.map((mark) => mark.trim()).filter(Boolean)));
  return { customItems, readyMarks };
}

router.get("/crew-kit-state", async (_req, res, next) => {
  try {
    const ownerKey = await ensureCrewKitOwner();
    const row = (await db
      .select({
        customItemsJson: workerCrewKitState.customItemsJson,
        readyMarksJson: workerCrewKitState.readyMarksJson,
      })
      .from(workerCrewKitState)
      .where(eq(workerCrewKitState.ownerKey, ownerKey))
      .limit(1))[0];
    return res.json(GetCrewKitStateResponse.parse(responseFromRow(row)));
  } catch (error) {
    return next(error);
  }
});

router.put("/crew-kit-state", async (req, res, next) => {
  try {
    const ownerKey = await ensureCrewKitOwner();
    const input = UpdateCrewKitStateBody.parse(req.body);
    const clean = cleanInput(input);
    await db.insert(workerCrewKitState).values({
      ownerKey,
      customItemsJson: JSON.stringify(clean.customItems),
      readyMarksJson: JSON.stringify(clean.readyMarks),
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: workerCrewKitState.ownerKey,
      set: {
        customItemsJson: JSON.stringify(clean.customItems),
        readyMarksJson: JSON.stringify(clean.readyMarks),
        updatedAt: new Date().toISOString(),
      },
    });
    return res.json(UpdateCrewKitStateResponse.parse(clean));
  } catch (error) {
    if (isValidationError(error) || (error instanceof Error && error.message.startsWith("crew-kit-"))) {
      return res.status(400).json({ error: "Check the Crew Kit items and ready marks before saving." });
    }
    return next(error);
  }
});

export default router;
