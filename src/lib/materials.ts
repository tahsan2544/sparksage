// Shared, browser-safe labels for material types in the library.
export const KIND_LABELS: Record<string, string> = {
  textbook: "Textbook",
  lecture_notes: "Lecture notes",
  slides: "Slides",
  notes: "Notes",
  other: "Other",
};
export const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }));

export type MaterialRow = {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  topic: string | null;
  author: string | null;
  details: string | null;
};

/** Group materials by subject (unfiled last). */
export function groupBySubject<T extends MaterialRow>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.subject?.trim() || "Unfiled";
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].sort(([a], [b]) => (a === "Unfiled" ? 1 : b === "Unfiled" ? -1 : a.localeCompare(b)));
}
