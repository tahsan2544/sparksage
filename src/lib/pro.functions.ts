/**
 * Pro / Master access requests.
 *
 * SparkSage has no automatic payments: students ask for an upgrade and the
 * platform Owner grants it by hand. Requests are stored in `pro_requests` and
 * appear in the Owner's inbox.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ProRequest {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  requestedPlan: string;
  message: string | null;
  status: "pending" | "approved" | "declined";
  ownerNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

/** Throws unless the caller is the Owner; returns the privileged client. */
async function assertOwner(context: { supabase: any; userId: string }) {
  const { data: isOwner } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (!isOwner) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The caller's most recent upgrade request, if any. */
export const getMyProRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("pro_requests")
      .select("id, requested_plan, message, status, owner_note, created_at, decided_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      requestedPlan: data.requested_plan as string,
      message: data.message as string | null,
      status: data.status as ProRequest["status"],
      ownerNote: data.owner_note as string | null,
      createdAt: data.created_at as string,
      decidedAt: data.decided_at as string | null,
    };
  });

/** Send an upgrade request to the Owner. One pending request at a time. */
export const requestPro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ message: z.string().trim().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("pro_requests").insert({
      user_id: context.userId,
      requested_plan: "pro",
      message: data.message || null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already have a request waiting for review.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Owner: every upgrade request, newest first, with who sent it. */
export const listProRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProRequest[]> => {
    const admin = await assertOwner(context);
    const { data: rows } = await admin
      .from("pro_requests")
      .select("id, user_id, requested_plan, message, status, owner_note, created_at, decided_at")
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id, email, display_name").in("id", ids)
      : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: byId.get(r.user_id)?.email ?? null,
      displayName: byId.get(r.user_id)?.display_name ?? null,
      requestedPlan: r.requested_plan,
      message: r.message,
      status: r.status as ProRequest["status"],
      ownerNote: r.owner_note,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    }));
  });

/**
 * Owner: approve (moving the student onto a plan) or decline a request.
 * Approving with `plan: "master"` grants unlimited access.
 */
export const decideProRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
        plan: z.enum(["pro", "master"]).default("pro"),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context);

    const { data: req, error: reqError } = await admin
      .from("pro_requests")
      .select("id, user_id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (reqError || !req) throw new Error("That request no longer exists.");

    if (data.approve) {
      const { data: plan } = await admin.from("plans").select("id").eq("key", data.plan).maybeSingle();
      if (!plan) throw new Error(`The ${data.plan} plan is missing.`);
      const { error } = await admin
        .from("user_subscriptions")
        .upsert(
          { user_id: req.user_id, plan_id: plan.id, status: "active" },
          { onConflict: "user_id" },
        );
      if (error) throw new Error(error.message);
    }

    await admin
      .from("pro_requests")
      .update({
        status: data.approve ? "approved" : "declined",
        owner_note: data.note || null,
        decided_at: new Date().toISOString(),
        decided_by: context.userId,
      })
      .eq("id", data.id);

    return { ok: true };
  });

/** Owner: grant a plan directly to a student, without a request. */
export const grantPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), plan: z.enum(["free", "pro", "master"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertOwner(context);
    const { data: plan } = await admin.from("plans").select("id").eq("key", data.plan).maybeSingle();
    if (!plan) throw new Error(`The ${data.plan} plan is missing.`);
    const { error } = await admin
      .from("user_subscriptions")
      .upsert({ user_id: data.userId, plan_id: plan.id, status: "active" }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
