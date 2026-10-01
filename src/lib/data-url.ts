// Strict validation for browser-supplied attachments. Only genuine base64
// `data:` URIs with an allow-listed MIME type are accepted, so a caller can
// never smuggle an http(s)/internal URL through to the AI gateway (SSRF).
import { z } from "zod";

export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "image/heic", "image/heif"] as const;
export const DOCUMENT_MIMES = ["application/pdf"] as const;

function makeDataUrlSchema(mimes: readonly string[], max: number) {
  const pattern = new RegExp(
    `^data:(${mimes.map((m) => m.replace(/[/+.]/g, "\\$&")).join("|")});base64,[A-Za-z0-9+/]+={0,2}$`,
  );
  return z
    .string()
    .max(max)
    .refine((v) => pattern.test(v), { message: "Attachment must be a base64 data URL of a supported type." });
}

export const imageDataUrl = (max: number) => makeDataUrlSchema(IMAGE_MIMES, max);
export const imageOrPdfDataUrl = (max: number) => makeDataUrlSchema([...IMAGE_MIMES, ...DOCUMENT_MIMES], max);
