import { z } from "zod";

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1500),
  style: z.enum(["sparksage", "diagram", "storybook", "photoreal", "watercolor", "clay", "anime", "sketch"]),
  aspectRatio: z.enum(["square", "landscape", "portrait"]),
  palette: z.enum(["signature", "natural", "pastel", "monochrome"]).default("signature"),
  lighting: z.enum(["auto", "daylight", "golden", "studio"]).default("auto"),
  composition: z.enum(["auto", "closeup", "scene", "flatlay"]).default("auto"),
});

export type ImageRequest = z.infer<typeof imageRequestSchema>;

export const IMAGE_STYLES: Array<{ value: ImageRequest["style"]; label: string; description: string }> = [
  { value: "sparksage", label: "SparkSage", description: "Soft, warm and polished" },
  { value: "diagram", label: "Study diagram", description: "Clear visual explanation" },
  { value: "storybook", label: "Storybook", description: "Friendly illustrated scene" },
  { value: "photoreal", label: "Photoreal", description: "Natural editorial photo" },
  { value: "watercolor", label: "Watercolor", description: "Soft washes on textured paper" },
  { value: "clay", label: "3D clay", description: "Playful sculpted miniatures" },
  { value: "anime", label: "Anime", description: "Expressive original illustration" },
  { value: "sketch", label: "Pencil sketch", description: "Fine lines and gentle shading" },
];

export const IMAGE_PALETTES = [
  { value: "signature", label: "SparkSage" },
  { value: "natural", label: "Natural" },
  { value: "pastel", label: "Pastel" },
  { value: "monochrome", label: "Monochrome" },
] as const;
export const IMAGE_LIGHTING = [
  { value: "auto", label: "Automatic" },
  { value: "daylight", label: "Daylight" },
  { value: "golden", label: "Golden hour" },
  { value: "studio", label: "Studio light" },
] as const;
export const IMAGE_COMPOSITIONS = [
  { value: "auto", label: "Automatic" },
  { value: "closeup", label: "Close-up" },
  { value: "scene", label: "Full scene" },
  { value: "flatlay", label: "Flat lay" },
] as const;

const STYLE_PROMPTS: Record<ImageRequest["style"], string> = {
  sparksage: "SparkSage signature editorial illustration, friendly rounded forms, calm educational mood, polished soft light, spacious composition",
  diagram: "Clear educational infographic, simple visual hierarchy, accurate relationships, generous spacing, no text unless explicitly requested",
  storybook: "Warm modern storybook illustration, tactile paper-like detail, expressive but calm forms, gentle natural light",
  photoreal: "Natural editorial photography, believable materials and lighting, clean composition without artificial color casting",
  watercolor: "Hand-painted watercolor illustration, delicate translucent washes, textured paper, soft edges and carefully rendered subject detail",
  clay: "Handcrafted three-dimensional clay illustration, tactile matte materials, rounded sculpted forms, miniature diorama with clear subject detail",
  anime: "Original anime illustration, expressive characters, clean line work, cel shading, detailed scene, not in the style of any specific artist",
  sketch: "Detailed pencil drawing, fine graphite lines, subtle crosshatching, paper texture and clear educational subject detail",
};

const PALETTE_PROMPTS: Record<ImageRequest["palette"], string> = {
  signature: "warm white foundation, soft purple focal elements, gentle blue supporting colors, small warm orange accents",
  natural: "natural true-to-life colors appropriate to the subject, no imposed brand color palette",
  pastel: "gentle mint, blush pink, sky blue and lavender pastel colors",
  monochrome: "strictly monochrome grayscale, no colored accents, clear tonal contrast",
};
const LIGHTING_PROMPTS: Record<ImageRequest["lighting"], string> = {
  auto: "lighting appropriate to the selected style and subject",
  daylight: "soft bright daylight, balanced exposure and visible detail",
  golden: "warm golden-hour light with gentle long shadows",
  studio: "controlled studio lighting, soft key light and clean shadows",
};
const COMPOSITION_PROMPTS: Record<ImageRequest["composition"], string> = {
  auto: "composition appropriate to the subject",
  closeup: "close-up composition focusing on the subject's fine details",
  scene: "wide establishing composition showing the complete subject and its surroundings",
  flatlay: "top-down flat-lay composition with neatly arranged subjects",
};

const BLOCKED_RULES: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "sexual content involving minors",
    pattern: /(?:child|kid|minor|underage|teen|schoolgirl|schoolboy).{0,45}(?:nude|naked|sexual|erotic|lingerie|fetish)|(?:nude|naked|sexual|erotic|lingerie|fetish).{0,45}(?:child|kid|minor|underage|teen|schoolgirl|schoolboy)/i,
  },
  { label: "sexual or exploitative content", pattern: /porn|explicit sex|sexual assault|rape|non-consensual|bestiality|incest|sexualized nudity/i },
  { label: "graphic violence or self-harm", pattern: /graphic gore|dismemberment|decapitation|torture scene|suicide method|how to self-harm/i },
  { label: "extremist propaganda", pattern: /terrorist propaganda|extremist recruitment|nazi propaganda|isis propaganda/i },
  { label: "instructions for serious wrongdoing", pattern: /make a bomb|build a bomb|meth lab|manufacture meth|counterfeit money|fake government id/i },
];

export function checkImagePrompt(prompt: string): { safe: true } | { safe: false; message: string } {
  const normalized = prompt.normalize("NFKC").replace(/\s+/g, " ").trim();
  const blocked = BLOCKED_RULES.find((rule) => rule.pattern.test(normalized));
  if (!blocked) return { safe: true };
  return {
    safe: false,
    message: `This request was blocked because it appears to include ${blocked.label}. Try a safe, non-graphic study or creative prompt.`,
  };
}

export function buildImagePrompt(input: ImageRequest): string {
  return `${STYLE_PROMPTS[input.style]}. Color direction: ${PALETTE_PROMPTS[input.palette]}. Lighting: ${LIGHTING_PROMPTS[input.lighting]}. Framing: ${COMPOSITION_PROMPTS[input.composition]}. Create this image: ${input.prompt}. Keep the result clear, polished, inclusive, age-appropriate, and free of graphic or sexual content. Do not imitate living artists. Avoid logos, watermarks, or extra text unless requested.`;
}

export const IMAGE_SIZES: Record<ImageRequest["aspectRatio"], string> = {
  square: "1024x1024",
  landscape: "1536x1024",
  portrait: "1024x1536",
};