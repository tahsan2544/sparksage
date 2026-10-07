import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateSparkSageImage } from "@/lib/image-gateway.server";
import { checkImagePrompt, imageRequestSchema } from "@/lib/image-safety";

function safeGatewayMessage(raw: string, status: number): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: string }; message?: string };
    const message = parsed.error?.message ?? parsed.message;
    if (message) return message.slice(0, 300);
  } catch {
    // Non-JSON upstream errors use a short status-specific message below.
  }
  if (status === 402) return "Image credits are currently unavailable. Add credits in workspace billing settings.";
  if (status === 429) return "Image creation is busy right now. Please wait a moment and try again.";
  return "The image could not be generated. Try a different safe prompt.";
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token || token.split(".").length !== 3) return new Response("Sign in to create images.", { status: 401 });

        const backendUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!backendUrl || !publishableKey) return new Response("Authentication is not configured.", { status: 500 });
        const authClient = createClient(backendUrl, publishableKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: authError } = await authClient.auth.getClaims(token);
        if (authError || !claims?.claims?.sub) return new Response("Your session expired. Please sign in again.", { status: 401 });

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Send a valid image request.", { status: 400 });
        }
        const parsed = imageRequestSchema.safeParse(raw);
        if (!parsed.success) return new Response("Describe an image in 3–1,500 characters and choose valid settings.", { status: 400 });
        const safety = checkImagePrompt(parsed.data.prompt);
        if (!safety.safe) return new Response(safety.message, { status: 422 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Image AI is not configured.", { status: 500 });
        const stream = typeof raw === "object" && raw !== null && "stream" in raw && raw.stream === false ? false : true;
        const upstream = await generateSparkSageImage(parsed.data, apiKey, stream);
        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          return new Response(safeGatewayMessage(detail, upstream.status), { status: upstream.status });
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});