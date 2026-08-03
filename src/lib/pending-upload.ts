/**
 * Hand-off for files dropped on the public landing page.
 *
 * Visitors can drop a file before they have an account. We stash it in
 * sessionStorage, send them to sign-up, and the documents page picks it up and
 * finishes processing once they are signed in.
 */
const KEY = "sparksage:pending-upload";

export interface PendingUpload {
  /** Suggested document title (file name without extension). */
  title: string;
  /** Extracted text — empty when the format needs manual pasting. */
  content: string;
  fileName: string;
}

/** True for formats we can read straight in the browser. */
export function isTextLike(file: File): boolean {
  return /^text\//.test(file.type) || /\.(txt|md|markdown|csv|rtf|json)$/i.test(file.name);
}

export function savePendingUpload(upload: PendingUpload) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(upload));
  } catch {
    /* storage unavailable — the user can upload again after signing in */
  }
}

/** Read and clear the pending upload (safe to call on every mount). */
export function consumePendingUpload(): PendingUpload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PendingUpload;
  } catch {
    return null;
  }
}
