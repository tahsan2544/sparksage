/**
 * Per-user preferences: AI personalization + focus-timer configuration.
 * Stored in `user_preferences` so choices persist across sessions and devices.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TONES = ["friendly", "formal", "concise", "encouraging"] as const;
export const STYLES = ["simple", "balanced", "detailed"] as const;

export interface UserPreferences {
  aiTone: (typeof TONES)[number];
  aiStyle: (typeof STYLES)[number];
  aiLanguage: string;
  aiInstructions: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  soundEnabled: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  aiTone: "friendly",
  aiStyle: "balanced",
  aiLanguage: "English",
  aiInstructions: "",
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
};

const schema = z.object({
  aiTone: z.enum(TONES),
  aiStyle: z.enum(STYLES),
  aiLanguage: z.string().trim().min(1).max(40),
  aiInstructions: z.string().trim().max(1000),
  focusMinutes: z.number().int().min(1).max(180),
  shortBreakMinutes: z.number().int().min(1).max(60),
  longBreakMinutes: z.number().int().min(1).max(120),
  sessionsBeforeLongBreak: z.number().int().min(1).max(12),
  soundEnabled: z.boolean(),
});

/** Read the caller's preferences, falling back to sensible defaults. */
export const getPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserPreferences> => {
    const { data } = await context.supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) return DEFAULT_PREFERENCES;
    return {
      aiTone: (data.ai_tone as UserPreferences["aiTone"]) ?? "friendly",
      aiStyle: (data.ai_style as UserPreferences["aiStyle"]) ?? "balanced",
      aiLanguage: data.ai_language ?? "English",
      aiInstructions: data.ai_instructions ?? "",
      focusMinutes: data.focus_minutes ?? 25,
      shortBreakMinutes: data.short_break_minutes ?? 5,
      longBreakMinutes: data.long_break_minutes ?? 15,
      sessionsBeforeLongBreak: data.sessions_before_long_break ?? 4,
      soundEnabled: data.sound_enabled ?? true,
    };
  });

/** Create or update the caller's preferences. */
export const savePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_preferences").upsert(
      {
        user_id: context.userId,
        ai_tone: data.aiTone,
        ai_style: data.aiStyle,
        ai_language: data.aiLanguage,
        ai_instructions: data.aiInstructions,
        focus_minutes: data.focusMinutes,
        short_break_minutes: data.shortBreakMinutes,
        long_break_minutes: data.longBreakMinutes,
        sessions_before_long_break: data.sessionsBeforeLongBreak,
        sound_enabled: data.soundEnabled,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
