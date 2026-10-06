import { z } from "zod";

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(1500),
  style: z.enum(["sparksage", "diagram", "storybook", "photoreal"]),
  aspectRatio: z.enum(["square", "landscape", "portrait"]),
});

export type ImageRequest = z.infer<typeof imageRequestSchema>;

const STYLE_PROMPTS: Record<ImageRequest["style"], string> = {
  sparksage: "SparkSage signature editorial illustration, warm white foundation, soft purple focal elements, gentle blue supporting shapes, small warm orange accents, friendly rounded forms, calm educational mood, polished soft light, spacious composition",
  diagram: "Clear educational infographic, simple visual hierarchy, accurate relationships, warm white background, soft purple and blue forms with restrained orange highlights, generous spacing, no text unless explicitly requested",
  storybook: "Warm modern storybook illustration, tactile paper-like detail, expressive but calm forms, soft purple, sky blue and warm orange palette, gentle natural light",
  photoreal: "Natural editorial photography, believable materials and lighting, clean composition, subtle soft purple and warm orange art direction without artificial color casting",
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