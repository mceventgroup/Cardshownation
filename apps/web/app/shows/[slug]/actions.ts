"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { hashOpaqueToken } from "@/lib/token-hash";
import { rethrowIfRedirectError } from "@/lib/next-control-flow";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";
import { parsePublicShowReport } from "@/lib/show-report";

const REPORT_WINDOW_MS = 60 * 60 * 1_000;

function safeFallbackSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : "";
}

export async function reportShowIssue(
  showId: string,
  fallbackSlug: string,
  formData: FormData
) {
  const safeSlug = safeFallbackSlug(fallbackSlug);
  const fallbackPath = safeSlug ? `/shows/${safeSlug}` : "/card-shows";
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim()) {
    redirect(`${fallbackPath}?report=received#report-listing`);
  }

  const parsed = parsePublicShowReport(formData);
  if (!parsed || !showId) {
    redirect(`${fallbackPath}?report=invalid#report-listing`);
  }

  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders) ?? "unknown";
  const rateLimit = await consumeRateLimit(
    "public-show-report",
    hashOpaqueToken(ip),
    { maxAttempts: 5, windowMs: REPORT_WINDOW_MS, blockMs: REPORT_WINDOW_MS }
  );
  if (!rateLimit.allowed) {
    redirect(`${fallbackPath}?report=rate#report-listing`);
  }

  if (isFixtureMode()) {
    redirect(`${fallbackPath}?report=received#report-listing`);
  }

  try {
    const show = await db.show.findFirst({
      where: { id: showId, status: "APPROVED" },
      select: { id: true, slug: true },
    });
    if (!show) redirect(`${fallbackPath}?report=invalid#report-listing`);

    await db.showReport.create({
      data: {
        showId: show.id,
        reason: parsed.reason,
        details: parsed.details,
      },
    });
    redirect(`/shows/${show.slug}?report=received#report-listing`);
  } catch (error) {
    rethrowIfRedirectError(error);
    console.error("[public show report] failed", { showId, error });
    redirect(`${fallbackPath}?report=invalid#report-listing`);
  }
}
