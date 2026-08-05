/**
 * Browser-side text extraction for the document library.
 *
 * Everything here runs in the browser so large files never travel to the
 * server: we only ever upload the extracted plain text. Supported today:
 *   - plain text / markdown / csv / json / rtf
 *   - PDF   (pdfjs-dist)
 *   - DOCX  (mammoth)
 *   - PPTX  (jszip + slide XML)
 *   - images (sent to the AI tutor for OCR, see extractImageText)
 */

/** Human-friendly list used in accept attributes and copy. */
export const DOCUMENT_ACCEPT =
  ".txt,.md,.markdown,.csv,.json,.rtf,.pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.gif," +
  "text/*,application/pdf,image/*";

export type ExtractKind = "text" | "pdf" | "docx" | "pptx" | "image" | "unsupported";

/** Classify a file so the caller can pick the right reader (and messaging). */
export function classify(file: File): ExtractKind {
  const name = file.name.toLowerCase();
  if (/\.(txt|md|markdown|csv|json|rtf)$/.test(name) || file.type.startsWith("text/")) return "text";
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (file.type.startsWith("image/")) return "image";
  return "unsupported";
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsText(file);
  });
}

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // The worker ships with the package; Vite resolves it to a bundled URL.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(text);
  }
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import(
    /* @vite-ignore */ "mammoth/mammoth.browser"
  )) as unknown as {
    extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value.trim();
}


async function extractPptx(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const num = (s: string) => Number(s.match(/(\d+)\.xml$/)?.[1] ?? 0);
      return num(a) - num(b);
    });

  const slides: string[] = [];
  for (const [index, name] of slideNames.entries()) {
    const xml = await zip.files[name]!.async("string");
    // <a:t> holds every run of visible text on a slide.
    const text = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map((m) => m[1]!.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) slides.push(`Slide ${index + 1}: ${text}`);
  }
  return slides.join("\n\n");
}

export interface ExtractResult {
  /** Extracted text — empty when the caller must handle it another way. */
  text: string;
  kind: ExtractKind;
  /** For images: the data URL to send for OCR. */
  dataUrl?: string;
}

/**
 * Extract study text from any supported file. Images resolve with a data URL
 * instead of text so the caller can run OCR through the AI tutor.
 * Throws a friendly Error for unsupported formats.
 */
export async function extractText(file: File): Promise<ExtractResult> {
  const kind = classify(file);
  switch (kind) {
    case "text":
      return { text: (await readAsText(file)).trim(), kind };
    case "pdf":
      return { text: await extractPdf(file), kind };
    case "docx":
      return { text: await extractDocx(file), kind };
    case "pptx":
      return { text: await extractPptx(file), kind };
    case "image":
      return { text: "", kind, dataUrl: await readAsDataUrl(file) };
    default:
      throw new Error(
        `We can't read ${file.name} yet. Try a PDF, Word (.docx), PowerPoint (.pptx), text file, or an image.`,
      );
  }
}
