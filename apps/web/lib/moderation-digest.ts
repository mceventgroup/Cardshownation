import { db } from "@/lib/db";
import { isFixtureMode } from "@/lib/data-mode";
import { sendModerationDigestEmail } from "@/lib/email";

function getDigestSlotKey(now: Date) {
  const date = now.toISOString().slice(0, 10);
  return `${date}-${now.getUTCHours() < 18 ? "morning" : "afternoon"}`;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
  );
}

export async function runModerationDigest(now = new Date()) {
  if (isFixtureMode()) {
    return { pendingCount: 0, recipients: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const [pending, reviewers] = await Promise.all([
    db.showSubmission.findMany({
      where: { status: "PENDING" },
      include: {
        organizer: {
          select: { moderationStatus: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      where: {
        OR: [
          { role: "ADMIN" },
          { role: "MODERATOR", emailVerifiedAt: { not: null } },
        ],
      },
      select: { email: true, role: true },
    }),
  ]);

  if (pending.length === 0) {
    return { pendingCount: 0, recipients: reviewers.length, sent: 0, skipped: 0, failed: 0 };
  }

  const recipients = Array.from(
    new Map(
      reviewers.map((reviewer) => [reviewer.email.trim().toLowerCase(), reviewer] as const)
    ).values()
  ).filter((reviewer) => reviewer.email.trim());
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://cardshownation.com"
  ).replace(/\/+$/, "");
  const slotKey = getDigestSlotKey(now);
  const newOrganizerCount = pending.filter(
    (submission) => !submission.organizer || submission.organizer.moderationStatus === "NEW"
  ).length;
  const submissions = pending.slice(0, 10).map((submission) => {
    const payload = submission.payloadJson as Record<string, unknown>;
    return {
      title: typeof payload.showName === "string" ? payload.showName : "Unnamed show",
      city: typeof payload.city === "string" ? payload.city : "",
      state: typeof payload.state === "string" ? payload.state : "",
      organizerName: submission.organizer?.moderationStatus
        ? `${submission.submitterName} · ${submission.organizer.moderationStatus.toLowerCase()}`
        : submission.submitterName,
    };
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const recipientEmail = recipient.email.trim().toLowerCase();
    const queueUrl = `${appUrl}/${recipient.role === "MODERATOR" ? "moderator" : "admin"}/submissions`;
    let delivery: { id: string };
    try {
      delivery = await db.moderationDigestDelivery.create({
        data: {
          recipientEmail,
          slotKey,
          pendingCount: pending.length,
        },
        select: { id: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        skipped += 1;
        continue;
      }
      throw error;
    }

    try {
      await sendModerationDigestEmail(recipientEmail, {
        pendingCount: pending.length,
        newOrganizerCount,
        queueUrl,
        submissions,
      });
      await db.moderationDigestDelivery.update({
        where: { id: delivery.id },
        data: { sentAt: new Date() },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await db.moderationDigestDelivery.delete({ where: { id: delivery.id } }).catch(() => null);
      console.error("[moderation digest] delivery failed", { recipientEmail, error });
    }
  }

  return {
    pendingCount: pending.length,
    recipients: recipients.length,
    sent,
    skipped,
    failed,
  };
}
