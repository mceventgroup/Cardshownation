"use server";

import { headers } from "next/headers";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { hashOpaqueToken } from "@/lib/token-hash";
import {
  MAX_PUBLIC_BULK_UPLOAD_BYTES,
  MAX_PUBLIC_BULK_UPLOAD_ROWS,
  validatePublicBulkRows,
  type BulkRowError,
} from "@/lib/public-bulk-upload";
import { readBulkUploadFile } from "@/lib/bulk-upload-file";
import { submitShowForModeration } from "@/lib/submissions";

export type PublicBulkUploadState = {
  approved: number;
  pending: number;
  updates: number;
  duplicates: number;
  errors: BulkRowError[];
  message: string | null;
  success: boolean;
};

const initialPublicBulkUploadState: PublicBulkUploadState = {
  approved: 0,
  pending: 0,
  updates: 0,
  duplicates: 0,
  errors: [],
  message: null,
  success: false,
};

function readText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function submitBulkShowsAction(
  _previousState: PublicBulkUploadState,
  formData: FormData,
): Promise<PublicBulkUploadState> {
  const honeypot = readText(formData, "companyWebsite", 200);
  if (honeypot) return { ...initialPublicBulkUploadState, success: true, message: "Your schedule was submitted." };

  const submitterEmail = readText(formData, "submitterEmail", 320)?.toLowerCase() ?? null;
  const submitterName = readText(formData, "submitterName", 120);
  if (!submitterEmail || !isValidEmail(submitterEmail)) {
    return { ...initialPublicBulkUploadState, message: "Enter a valid private contact email." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ...initialPublicBulkUploadState, message: "Choose an Excel or CSV file to upload." };
  }
  if (file.size > MAX_PUBLIC_BULK_UPLOAD_BYTES) {
    return { ...initialPublicBulkUploadState, message: "That file is too large. Keep the spreadsheet under 750 KB." };
  }

  const parsed = await readBulkUploadFile(file);
  if (parsed.error) {
    return { ...initialPublicBulkUploadState, message: parsed.error };
  }

  const rows = parsed.rows
    .filter((row) => !String(row.title ?? "").trim().toUpperCase().startsWith("EXAMPLE"));
  if (rows.length === 0) {
    return { ...initialPublicBulkUploadState, message: "No show rows were found. Keep the header row and replace the example row." };
  }
  if (rows.length > MAX_PUBLIC_BULK_UPLOAD_ROWS) {
    return { ...initialPublicBulkUploadState, message: "Upload up to 100 shows at a time. Split larger schedules into separate files." };
  }

  const { validRows, errors } = validatePublicBulkRows(rows);
  if (validRows.length === 0) {
    return { ...initialPublicBulkUploadState, errors, message: "Fix the listed rows and upload the file again." };
  }

  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const [ipLimit, emailLimit] = await Promise.all([
    consumeRateLimit("submit-shows-bulk", ip, { blockMs: 60 * 60 * 1000, maxAttempts: 3, windowMs: 60 * 60 * 1000 }),
    consumeRateLimit("submit-shows-bulk-email", hashOpaqueToken(submitterEmail), { blockMs: 24 * 60 * 60 * 1000, maxAttempts: 3, windowMs: 24 * 60 * 60 * 1000 }),
  ]);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { ...initialPublicBulkUploadState, message: "This upload limit has been reached. Please wait and try again later." };
  }

  const fallbackName = submitterEmail.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Card Show Promoter";
  const contactName = submitterName ?? fallbackName.replace(/\b\w/g, (letter) => letter.toUpperCase());
  let approved = 0;
  let pending = 0;
  let updates = 0;
  let duplicates = 0;
  const rowErrors = [...errors];
  const reviewDuplicateRows = new Set(
    formData.getAll("reviewDuplicateRows").flatMap((value) => {
      const rowNumber = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
      return Number.isInteger(rowNumber) ? [rowNumber] : [];
    })
  );

  for (const row of validRows) {
    try {
      const result = await submitShowForModeration({
        submitterName: contactName,
        submitterEmail,
        payloadJson: { ...row.payload, organizerName: contactName },
        duplicatePolicy: reviewDuplicateRows.has(row.rowNumber) ? "review-update" : "reject",
      });
      if (result.status === "APPROVED") approved += 1;
      else if (result.status === "PENDING") pending += 1;
      else if (result.status === "PENDING_UPDATE") updates += 1;
      else if (result.status === "DUPLICATE") duplicates += 1;
      else rowErrors.push({ row: row.rowNumber, message: "This organizer cannot submit shows." });
    } catch {
      rowErrors.push({ row: row.rowNumber, message: "This row could not be submitted. Please try it again." });
    }
  }

  const accepted = approved + pending + updates;
  return {
    approved,
    pending,
    updates,
    duplicates,
    errors: rowErrors,
    success: accepted > 0,
    message: accepted > 0
      ? `${accepted} show${accepted === 1 ? "" : "s"} submitted successfully. ${updates ? `${updates} likely match${updates === 1 ? " was" : "es were"} sent for moderator review. ` : ""}We skipped ${duplicates} existing match${duplicates === 1 ? "" : "es"}.`
      : "No new shows were submitted. Review the results below.",
  };
}
