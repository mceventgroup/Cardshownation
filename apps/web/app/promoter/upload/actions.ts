"use server";

import Papa from "papaparse";
import { requirePromoterSession } from "@/lib/promoter-auth";
import { bulkCreatePromoterShows, type PromoterBulkCsvRow } from "@/lib/promoters";
import { normalizeBulkHeader } from "@/lib/public-bulk-upload";

export type PromoterUploadState = {
  approved: number;
  pending: number;
  skipped: number;
  errors: { row: number; message: string }[];
  message: string | null;
};

const initialState: PromoterUploadState = {
  approved: 0,
  pending: 0,
  skipped: 0,
  errors: [],
  message: null,
};

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

type CsvRow = Omit<PromoterBulkCsvRow, "rowNumber">;

export async function uploadPromoterShowsCsvAction(
  _prevState: PromoterUploadState,
  formData: FormData,
): Promise<PromoterUploadState> {
  const session = await requirePromoterSession("/promoter/upload");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ...initialState,
      message: "Choose a CSV file before uploading.",
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ...initialState,
      message: "CSV file is too large. Keep uploads under 2 MB.",
    };
  }

  const csvText = await file.text();
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeBulkHeader,
  });

  if (parsed.errors.length > 0) {
    return {
      ...initialState,
      message: parsed.errors[0]?.message ?? "Could not parse the CSV file.",
    };
  }

  const rows = parsed.data
    .map((row, index) => ({
      rowNumber: index + 2,
      ...row,
    }))
    .filter((row) => !String(row.title ?? "").trim().toUpperCase().startsWith("EXAMPLE"));

  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ...initialState,
      message: "CSV file has too many rows. Split uploads into batches of 500 rows or fewer.",
    };
  }

  if (rows.length === 0) {
    return {
      ...initialState,
      message: "No importable rows were found in that CSV file.",
    };
  }

  try {
    const result = await bulkCreatePromoterShows(session.user.id, rows);
    return {
      ...result,
      message: `Upload finished. ${result.approved} approved, ${result.pending} sent for review, ${result.skipped} skipped.`,
    };
  } catch (error) {
    return {
      ...initialState,
      message:
        error instanceof Error
          ? error.message
          : "The upload failed before any shows were created.",
    };
  }
}
