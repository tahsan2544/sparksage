import { describe, expect, test } from "bun:test";
import { buildImagePrompt, checkImagePrompt, imageRequestSchema, IMAGE_STYLES } from "./image-safety";

describe("Image Studio controls", () => {
  test("every offered style is validated and builds a defined prompt", () => {
    for (const style of IMAGE_STYLES) {
      const input = imageRequestSchema.parse({ prompt: "A leaf", style: style.value, aspectRatio: "square" });
      expect(buildImagePrompt(input)).not.toContain("undefined");
    }
  });
  test("legacy requests retain signature palette and automatic settings", () => {
    const input = imageRequestSchema.parse({ prompt: "A leaf", style: "sparksage", aspectRatio: "square" });
    expect(input.palette).toBe("signature");
    expect(input.lighting).toBe("auto");
    expect(input.composition).toBe("auto");
  });
  test("monochrome direction does not also impose brand colors", () => {
    const input = imageRequestSchema.parse({ prompt: "A leaf", style: "diagram", aspectRatio: "square", palette: "monochrome", lighting: "studio", composition: "closeup" });
    const prompt = buildImagePrompt(input);
    expect(prompt).toContain("strictly monochrome grayscale");
    expect(prompt).not.toContain("purple");
    expect(prompt).toContain("controlled studio lighting");
    expect(prompt).toContain("close-up composition");
  });
  test("unsupported settings are rejected", () => {
    expect(imageRequestSchema.safeParse({ prompt: "A leaf", style: "watercolor", aspectRatio: "square", palette: "arbitrary" }).success).toBe(false);
  });
  test("unsafe prompt filtering remains active", () => {
    expect(checkImagePrompt("explicit sex with an underage child").safe).toBe(false);
    expect(checkImagePrompt("Watercolor leaf in daylight").safe).toBe(true);
  });
});