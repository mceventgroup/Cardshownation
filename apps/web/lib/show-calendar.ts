// Imported calendar dates use UTC. Keep an event discoverable through its last
// day, including multi-day shows that have already started.
export function upcomingShowWhere(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    status: "APPROVED" as const,
    endDate: { gte: today },
    OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
  };
}

export function isUpcomingCalendarShow(show: {
  status: string; endDate: Date; expiresAt: Date | null;
}, now = new Date()) {
  const { endDate: { gte: today } } = upcomingShowWhere(now);
  return show.status === "APPROVED" && show.endDate >= today && (!show.expiresAt || show.expiresAt >= today);
}
