/**
 * Account context + role server functions.
 *
 * SparkSage has no subscription tiers: every signed-in student gets the same
 * generous access. This module now only answers "who is this account and are
 * they the Owner?".
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface AccountContext {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "user";
  /** True when no Owner account exists yet, so the platform can be claimed once. */
  ownerlessPlatform: boolean;
}

/** Everything the UI needs to render role-aware surfaces. */
export const getAccountContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountContext> => {
    const { supabase, userId, claims } = context;

    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("display_name, email").eq("id", userId).maybeSingle(),
    ]);

    const role = roles?.some((r) => r.role === "owner") ? "owner" : "user";

    // Owner bootstrap check: exposed to everyone only as a boolean.
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
      ownerlessPlatform: (count ?? 0) === 0,
    };
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

export interface MemberRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "owner" | "user";
  createdAt: string;
}

/** Owner-only: every member with their role. */
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    const { data: isOwner } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "owner",
    });
    if (!isOwner) throw new Error("Forbidden");

    // Owner verified above; profiles are only readable by their owner under RLS,
    // so the member directory needs the privileged client.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, email, display_name, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

    return (profiles ?? []).map((p) => ({
      userId: p.id,
      email: p.email,
      displayName: p.display_name,
      role: (roleByUser.get(p.id) as "owner" | "user") ?? "user",
      createdAt: p.created_at,
    }));
  });
