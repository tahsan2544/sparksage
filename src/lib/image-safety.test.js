import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildImagePrompt, checkImagePrompt, imageRequestSchema, IMAGE_STYLES } from "./image-safety";

describe("Image Studio controls", () => {
  test("every offered style is validated and builds a defined prompt", () => {
    for (const style of IMAGE_STYLES) {
      const input = imageRequestSchema.parse({ prompt: "A leaf", style: style.value, aspectRatio: "square" });
      assert.equal(buildImagePrompt(input).includes("undefined"), false);
    }
  });
  test("legacy requests retain signature palette and automatic settings", () => {
    const input = imageRequestSchema.parse({ prompt: "A leaf", style: "sparksage", aspectRatio: "square" });
    assert.equal(input.palette, "signature");
    assert.equal(input.lighting, "auto");
    assert.equal(input.composition, "auto");
  });
  test("monochrome direction does not also impose brand colors", () => {
    const input = imageRequestSchema.parse({ prompt: "A leaf", style: "diagram", aspectRatio: "square", palette: "monochrome", lighting: "studio", composition: "closeup" });
    const prompt = buildImagePrompt(input);
    assert.ok(prompt.includes("strictly monochrome grayscale"));
    assert.equal(prompt.includes("purple"), false);
    assert.ok(prompt.includes("controlled studio lighting"));
    assert.ok(prompt.includes("close-up composition"));
  });
  test("unsupported settings are rejected", () => {
    assert.equal(imageRequestSchema.safeParse({ prompt: "A leaf", style: "watercolor", aspectRatio: "square", palette: "arbitrary" }).success, false);
  });
  test("unsafe prompt filtering remains active", () => {
    assert.equal(checkImagePrompt("explicit sex with an underage child").safe, false);
    assert.equal(checkImagePrompt("Watercolor leaf in daylight").safe, true);
  });
});