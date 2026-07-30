/**
 * Feature Access Engine + role/subscription server functions.
 *
 * Single source of truth for "what is this account allowed to do".
 * All limits live in the database (`plans` / `plan_features`) so they can be
 * tuned by the Owner without a code change.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FeatureKey =
  | "documents"
  | "ai_chat_messages_per_day"
  | "quiz_generations_per_day"
  | "flashcard_generations_per_day"
  | "summaries_per_day";

export interface FeatureRule {
  featureKey: string;
  /** null = unlimited */
  maxUsage: number | null;
  cooldownSeconds: number;
  isVisible: boolean;
}

export interface AccountContext {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "user";
  plan: { key: string; name: string; description: string | null; priceCents: number } | null;
  features: FeatureRule[];
  /** True when no Owner account exists yet, so the platform can be claimed once. */
  ownerlessPlatform: boolean;
}

/** Everything the UI needs to render role-, plan- and limit-aware surfaces. */
export const getAccountContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountContext> => {
    const { supabase, userId, claims } = context;

    const [{ data: roles }, { data: sub }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_subscriptions")
        .select("plan_id, plans(key, name, description, price_cents)")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("display_name, email").eq("id", userId).maybeSingle(),
    ]);

    const role = roles?.some((r) => r.role === "owner") ? "owner" : "user";
    const planRow = (sub?.plans ?? null) as
      | { key: string; name: string; description: string | null; price_cents: number }
      | null;

    let features: FeatureRule[] = [];
    if (sub?.plan_id) {
      const { data } = await supabase
        .from("plan_features")
        .select("feature_key, max_usage, cooldown_seconds, is_visible")
        .eq("plan_id", sub.plan_id);
      features = (data ?? []).map((f) => ({
        featureKey: f.feature_key,
        maxUsage: f.max_usage,
        cooldownSeconds: f.cooldown_seconds,
        isVisible: f.is_visible,
      }));
    }

    // Owner bootstrap check: readable to everyone only as a boolean.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");

    return {
      userId,
      email: profile?.email ?? (claims.email as string | undefined) ?? null,
      displayName: profile?.display_name ?? null,
      role,
      plan: planRow
        ? {
            key: planRow.key,
            name: planRow.name,
            description: planRow.description,
            priceCents: planRow.price_cents,
          }
        : null,
      features,
      ownerlessPlatform: (count ?? 0) === 0,
    };
  });

/** Plans a student may see (Enterprise stays hidden until the Owner reveals it). */
export const listVisiblePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plans")
      .select("id, key, name, description, price_cents, sort_order, is_visible")
      .eq("is_visible", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Update the signed-in student's display name. */
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ displayName: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.displayName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Claim the single Owner seat. Only succeeds while no Owner exists — the
 * database also enforces this with a unique index, so races cannot create two.
 */
export const claimOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) > 0) throw new Error("An Owner account already exists.");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "owner" });
    if (error) throw new Error("An Owner account already exists.");
    return { ok: true };
  });

/** Owner-only: full plan catalogue including hidden plans and their limits. */
export const listPlansWithFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("plans")
      .select(
        "id, key, name, description, price_cents, sort_order, is_visible, plan_features(id, feature_key, max_usage, cooldown_seconds, is_visible)",
      )
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Owner-only: change a single feature limit. */
export const updatePlanFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        maxUsage: z.number().int().min(0).max(1_000_000).nullable(),
        cooldownSeconds: z.number().int().min(0).max(86_400),
        isVisible: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("plan_features")
      .update({
        max_usage: data.maxUsage,
        cooldown_seconds: data.cooldownSeconds,
        is_visible: data.isVisible,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner-only: show or hide a plan (Enterprise ships hidden). */
export const setPlanVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), isVisible: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("plans")
      .update({ is_visible: data.isVisible })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface MemberRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "user";
  planKey: string | null;
  createdAt: string;
}

/** Owner-only: every member with their role and current plan. */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden");

    const [{ data: profiles }, { data: roles }, { data: subs }] = await Promise.all([
      context.supabase.from("profiles").select("id, email, display_name, created_at"),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("user_subscriptions").select("user_id, plans(key)"),
    ]);

    const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
    const planByUser = new Map(
      (subs ?? []).map((s) => [s.user_id, (s.plans as { key: string } | null)?.key ?? null]),
    );

    return (profiles ?? []).map((p) => ({
      userId: p.id,
      email: p.email,
      displayName: p.display_name,
      role: (roleByUser.get(p.id) as "owner" | "user") ?? "user",
      planKey: planByUser.get(p.id) ?? null,
      createdAt: p.created_at,
    }));
  });

/** Owner-only: move a member onto a different plan. */
export const setMemberPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), planId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_subscriptions")
      .update({ plan_id: data.planId })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
