"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import {
  isMissingAutoImportSourceTableError,
  validateAutoImportSourceInput,
  type AutoImportSourceInput,
} from "@/lib/auto-import-sources";
import { runScheduledImportsForSource } from "@/lib/scheduled-imports";
import { runImportHealthNotifications } from "@/lib/import-health-alerts";

export async function triggerAutoImports(selectedSource: string = "all") {
  await requireAdminSession("/admin/imports");
  const result = await runScheduledImportsForSource(selectedSource);
  try {
    await runImportHealthNotifications();
  } catch (error) {
    console.error("[import health] notification check failed after manual import", error);
  }
  return result;
}

export async function createAutoImportSource(input: AutoImportSourceInput) {
  await requireAdminSession("/admin/imports");

  const validated = validateAutoImportSourceInput(input);
  if ("error" in validated) {
    return { ok: false, error: validated.error };
  }

  try {
    await db.autoImportSource.create({
      data: validated.value,
    });
  } catch (error) {
    if (isMissingAutoImportSourceTableError(error)) {
      return { ok: false, error: "Auto-import storage is not ready yet. Run the latest database migration first." };
    }
    if (error instanceof Error && /unique/i.test(error.message)) {
      return { ok: false, error: "That URL is already managed in the portal." };
    }
    throw error;
  }

  revalidatePath("/admin/imports");
  return { ok: true };
}

export async function updateAutoImportSource(id: string, input: AutoImportSourceInput) {
  await requireAdminSession("/admin/imports");

  const validated = validateAutoImportSourceInput(input);
  if ("error" in validated) {
    return { ok: false, error: validated.error };
  }

  try {
    await db.autoImportSource.update({
      where: { id },
      data: validated.value,
    });
  } catch (error) {
    if (isMissingAutoImportSourceTableError(error)) {
      return { ok: false, error: "Auto-import storage is not ready yet. Run the latest database migration first." };
    }
    if (error instanceof Error && /unique/i.test(error.message)) {
      return { ok: false, error: "That URL is already managed in the portal." };
    }
    throw error;
  }

  revalidatePath("/admin/imports");
  return { ok: true };
}

export async function deleteAutoImportSource(id: string) {
  await requireAdminSession("/admin/imports");
  try {
    await db.autoImportSource.delete({ where: { id } });
  } catch (error) {
    if (isMissingAutoImportSourceTableError(error)) {
      return { ok: false, error: "Auto-import storage is not ready yet. Run the latest database migration first." };
    }
    throw error;
  }
  revalidatePath("/admin/imports");
  return { ok: true };
}
