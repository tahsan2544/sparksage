import { buildImagePrompt, IMAGE_SIZES, type ImageRequest } from "./image-safety";

const BASE_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-image-2.5-sunburst";

export async function generateSparkSageImage(input: ImageRequest, apiKey: string, stream: boolean) {
  return fetch(`${BASE_URL}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: buildImagePrompt(input),
      size: IMAGE_SIZES[input.aspectRatio],
      quality: "medium",
      ...(stream ? { stream: true, partial_images: 1 } : {}),
    }),
  });
}