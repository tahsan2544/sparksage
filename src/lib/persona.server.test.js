import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatPersona } from "./persona.server";

describe("AI personalization boundaries", () => {
  test("custom preferences remain subordinate to task and source requirements", () => {
    const prompt = formatPersona({
      tone: "friendly",
      style: "simple",
      language: "English",
      instructions: "Use examples from my class.",
    });
    const preferenceStart = prompt.indexOf("<student_preferences>");
    const preferenceEnd = prompt.indexOf("</student_preferences>");
    const priorityRule = prompt.lastIndexOf("Personalization is style guidance only.");

    assert.ok(preferenceStart >= 0);
    assert.ok(preferenceEnd > preferenceStart);
    assert.ok(priorityRule > preferenceEnd);
  });

  test("custom instructions stay capped at the supported 1,000 characters", () => {
    const prompt = formatPersona({
      tone: "friendly",
      style: "balanced",
      language: "English",
      instructions: "x".repeat(1_200),
    });

    const captured = prompt.match(/<student_preferences>\n(x+)\n<\/student_preferences>/);
    assert.equal(captured?.[1]?.length, 1_000);
  });

  test("unknown saved settings safely fall back to defaults", () => {
    const prompt = formatPersona({ tone: "invalid", style: "invalid", language: "", instructions: "" });

    assert.ok(prompt.includes("Warm, friendly and conversational."));
    assert.ok(prompt.includes("Balance clarity with depth"));
    assert.ok(prompt.includes("English"));
  });
});