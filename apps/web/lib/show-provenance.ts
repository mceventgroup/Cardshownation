type PublicSourceType = "MANUAL" | "SUBMITTED" | "IMPORTED";

export function getPublicSourceLabel(sourceType: PublicSourceType | string) {
  switch (sourceType) {
    case "MANUAL":
      return "Entered by Card Show Nation";
    case "SUBMITTED":
      return "Submitted by a promoter or community member";
    case "IMPORTED":
      return "Collected from a public event source";
    default:
      return "Card Show Nation listing";
  }
}

export function formatVerifiedDate(value: Date | null | undefined) {
  if (!value) return "Verification pending";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
