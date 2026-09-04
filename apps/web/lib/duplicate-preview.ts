export type PublicDuplicatePreview = {
  kind: "show" | "submission";
  score: number;
  title: string;
  date: string;
  city: string;
  state: string;
  venueName: string;
  href: string | null;
  recommendation: "existing" | "incoming";
  enrichableFields: string[];
};
