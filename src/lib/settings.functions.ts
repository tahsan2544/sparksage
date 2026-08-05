/**
 * Global platform settings.
 *
 * Every configurable value lives in the `app_settings` table so the Owner can
 * change branding, limits and toggles from the admin console without a deploy.
 * Public (non-private) settings are readable by anyone, including signed-out
 * visitors, so the landing page can be rendered on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

export interface SettingRow {
  id: string;
  key: string;
  value: string | null;
  group_name: string;
  label: string;
  description: string | null;
  value_type: string;
  is_private: boolean;
  sort_order: number;
}

export type SettingsMap = Record<string, string>;

/** Fallbacks so the UI never renders blank if a row is missing. */
export const SETTINGS_DEFAULTS: SettingsMap = {
  app_name: "SparkSage",
  app_tagline: "Study Smarter, Not Harder.",
  app_subheading:
    "Upload your notes, books, or slides and let AI help you learn faster with summaries, quizzes, flashcards, and personalized explanations.",
  logo_url: "",
  default_theme: "system",
  maintenance_mode: "false",
  default_language: "en",
  registration_enabled: "true",
  email_login_enabled: "true",
  google_login_enabled: "true",
  max_upload_mb: "20",
  allowed_file_types: "pdf,docx,pptx,txt",
  max_ocr_pages: "50",
  default_ai_model: "google/gemini-3.5-flash",
  support_email: "support@sparksage.app",
  privacy_url: "/privacy",
  terms_url: "/terms",
  announcement: "",
};

export interface PublicPlan {
  key: string;
  name: string;
  description: string | null;
  priceCents: number;
  features: Array<{ featureKey: string; maxUsage: number | null }>;
}

/** Server-side publishable client (no user session) for public reads. */
function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Public settings + visible plans — safe to call from a public route loader. */
export const getPublicSiteData = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ settings: SettingsMap; plans: PublicPlan[] }> => {
    const supabase = publicClient();
    // Plan limits are not readable by anonymous visitors (they describe how
    // quotas are enforced), so the pricing table is assembled server-side with
    // the privileged client and projected down to safe, public fields only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: settingRows }, { data: planRows }] = await Promise.all([
      supabase.from("app_settings").select("key, value").eq("is_private", false),
      supabaseAdmin
        .from("plans")
        .select("key, name, description, price_cents, sort_order, plan_features(feature_key, max_usage, is_visible)")
        .eq("is_visible", true)
        .order("sort_order"),
    ]);


    const settings: SettingsMap = { ...SETTINGS_DEFAULTS };
    for (const row of settingRows ?? []) {
      if (row.value !== null && row.value !== undefined) settings[row.key] = row.value;
    }

    const plans: PublicPlan[] = (planRows ?? []).map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      priceCents: p.price_cents,
      features: ((p.plan_features ?? []) as Array<{ feature_key: string; max_usage: number | null; is_visible: boolean }>)
        .filter((f) => f.is_visible)
        .map((f) => ({ featureKey: f.feature_key, maxUsage: f.max_usage })),
    }));

    return { settings, plans };
  },
);

/** Owner-only: full settings list (RLS blocks private rows for everyone else). */
export const listSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SettingRow[]> => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("id, key, value, group_name, label, description, value_type, is_private, sort_order")
      .order("group_name")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as SettingRow[];
  });

const UpdateInput = z.object({
  updates: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        value: z.string().max(5000),
      }),
    )
    .min(1)
    .max(60),
});

/** Owner-only: persist edited settings. RLS enforces the owner check. */
export const updateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    for (const u of data.updates) {
      const { error } = await context.supabase
        .from("app_settings")
        .update({ value: u.value })
        .eq("key", u.key);
      if (error) throw new Error(`Could not save "${u.key}": ${error.message}`);
    }
    return { ok: true, count: data.updates.length };
  });
