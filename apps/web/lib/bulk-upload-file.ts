import "server-only";

import Papa from "papaparse";
import { readSheet } from "read-excel-file/node";
import {
  normalizeBulkHeader,
  rowsFromBulkSpreadsheet,
  type PublicBulkCsvRow,
} from "@/lib/public-bulk-upload";

export async function readBulkUploadFile(file: File) {
  if (/\.xlsx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    try {
      const grid = await readSheet(Buffer.from(await file.arrayBuffer()));
      return { ...rowsFromBulkSpreadsheet(grid), error: null as string | null };
    } catch {
      return { headers: [] as string[], rows: [] as PublicBulkCsvRow[], error: "We could not read that Excel file. Download a fresh template and try again." };
    }
  }

  const parsed = Papa.parse<Omit<PublicBulkCsvRow, "rowNumber">>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeBulkHeader,
  });
  if (parsed.errors.length > 0) {
    return { headers: parsed.meta.fields ?? [], rows: [] as PublicBulkCsvRow[], error: parsed.errors[0]?.message ?? "We could not read that CSV file." };
  }
  return {
    headers: parsed.meta.fields ?? [],
    rows: parsed.data.map((row, index) => ({ ...row, rowNumber: index + 2 })),
    error: null as string | null,
  };
}
