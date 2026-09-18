export const PUBLIC_SHOW_REPORT_REASONS = [
  { value: "date_time", label: "Date or hours are incorrect" },
  { value: "venue", label: "Venue or address is incorrect" },
  { value: "canceled", label: "Show is canceled or postponed" },
  { value: "duplicate", label: "This is a duplicate listing" },
  { value: "other", label: "Something else is incorrect" },
] as const;

export function parsePublicShowReport(formData: FormData) {
  const reasonValue = formData.get("reason");
  const detailsValue = formData.get("details");
  if (typeof reasonValue !== "string") return null;

  const reason = PUBLIC_SHOW_REPORT_REASONS.find(
    (candidate) => candidate.value === reasonValue
  )?.label;
  if (!reason) return null;

  const details = typeof detailsValue === "string" ? detailsValue.trim() : "";
  if (details.length > 1_000 || (reasonValue === "other" && !details)) return null;

  return {
    reason,
    details: details || null,
  };
}
