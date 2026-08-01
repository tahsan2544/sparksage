/**
 * Owner dashboard server functions.
 *
 * Everything here is gated on the single Owner role. Reads that must span all
 * accounts (profiles, documents, chats) use the privileged client only AFTER
 * the caller has been verified as the Owner through their own RLS-scoped
 * client.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Throws unless the caller holds the Owner role. Returns the admin client. */
async function assertOwner(context: { supabase: any; userId: string }) {
  const { data: isOwner } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "owner",
  });
  if (!isOwner) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};
const startOfMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export interface OwnerOverview {
  totalStudents: number;
  activeToday: number;
  newSignupsToday: number;
  planCounts: Record<string, number>;
  documentsToday: number;
  documentsThisMonth: number;
  aiQuestionsToday: number;
  aiQuestionsThisMonth: number;
  studyMinutesThisMonth: number;
  avgStudyMinutesPerStudent: number;
  conversionRate: number;
  openFeedback: number;
  liveAnnouncements: number;
  quizzesCreated: number;
  flashcardDecks: number;
  newestStudents: Array<{ id: string; name: string | null; email: string | null; joined: string }>;
  recentDocuments: Array<{ id: string; title: string; created: string }>;
  recentFeedback: Array<{ id: string; subject: string; category: string; status: string; created: string }>;
  recentAnnouncements: Array<{ id: string; title: string; published: boolean; created: string }>;
  recentAiActivity: Array<{ id: string; snippet: string; created: string }>;
}

/** Business-level insight numbers for the Owner overview page. */
export const getOwnerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerOverview> => {
    const admin = await assertOwner(context);
    const today = startOfToday();
    const monthStart = startOfMonth();
    const count = (q: any) => q.then((r: any) => r.count ?? 0);

    const [
      totalStudents,
      newSignupsToday,
      documentsToday,
      documentsThisMonth,
      aiQuestionsToday,
      aiQuestionsThisMonth,
      quizzesCreated,
      flashcardDecks,
      openFeedback,
      liveAnnouncements,
    ] = await Promise.all([
      count(admin.from("profiles").select("id", { count: "exact", head: true })),
      count(admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today)),
      count(admin.from("documents").select("id", { count: "exact", head: true }).gte("created_at", today)),
      count(admin.from("documents").select("id", { count: "exact", head: true }).gte("created_at", monthStart)),
      count(
        admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .gte("created_at", today),
      ),
      count(
        admin
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .gte("created_at", monthStart),
      ),
      count(admin.from("quizzes").select("id", { count: "exact", head: true })),
      count(admin.from("flashcard_decks").select("id", { count: "exact", head: true })),
      count(
        admin
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false)
          .neq("status", "completed"),
      ),
      count(admin.from("announcements").select("id", { count: "exact", head: true }).eq("is_published", true)),
    ]);

    const [
      { data: subs },
      { data: sessions },
      { data: newest },
      { data: docs },
      { data: fb },
      { data: anns },
      { data: ai },
    ] = await Promise.all([
      admin.from("user_subscriptions").select("user_id, plans(key)"),
      admin.from("study_sessions").select("user_id, duration_seconds, occurred_at").gte("occurred_at", monthStart),
      admin.from("profiles").select("id, display_name, email, created_at").order("created_at", { ascending: false }).limit(5),
      admin.from("documents").select("id, title, created_at").order("created_at", { ascending: false }).limit(5),
      admin
        .from("feedback")
        .select("id, subject, category, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("announcements")
        .select("id, title, is_published, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("chat_messages")
        .select("id, content, created_at")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const planCounts: Record<string, number> = {};
    for (const s of subs ?? []) {
      const key = (s.plans as { key: string } | null)?.key ?? "none";
      planCounts[key] = (planCounts[key] ?? 0) + 1;
    }

    const totalSeconds = (sessions ?? []).reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0);
    const activeToday = new Set(
      (sessions ?? []).filter((s) => s.occurred_at >= today).map((s) => s.user_id),
    ).size;
    const paid = Object.entries(planCounts)
      .filter(([k]) => k !== "free" && k !== "none")
      .reduce((a, [, v]) => a + v, 0);

    return {
      totalStudents,
      activeToday,
      newSignupsToday,
      planCounts,
      documentsToday,
      documentsThisMonth,
      aiQuestionsToday,
      aiQuestionsThisMonth,
      studyMinutesThisMonth: Math.round(totalSeconds / 60),
      avgStudyMinutesPerStudent:
        totalStudents > 0 ? Math.round(totalSeconds / 60 / totalStudents) : 0,
      conversionRate: totalStudents > 0 ? Math.round((paid / totalStudents) * 1000) / 10 : 0,
      openFeedback,
      liveAnnouncements,
      quizzesCreated,
      flashcardDecks,
      newestStudents: (newest ?? []).map((p) => ({
        id: p.id,
        name: p.display_name,
        email: p.email,
        joined: p.created_at,
      })),
      recentDocuments: (docs ?? []).map((d) => ({ id: d.id, title: d.title, created: d.created_at })),
      recentFeedback: (fb ?? []).map((f) => ({
        id: f.id,
        subject: f.subject,
        category: f.category,
        status: f.status,
        created: f.created_at,
      })),
      recentAnnouncements: (anns ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        published: a.is_published,
        created: a.created_at,
      })),
      recentAiActivity: (ai ?? []).map((m) => ({
        id: m.id,
        snippet: m.content.slice(0, 120),
        created: m.created_at,
      })),
    };
  });

/* ------------------------------ Announcements ----------------------------- */

export interface AnnouncementRow {
  id: string;
  title: string;
  subtitle: string | null;
  message: string;
  button_text: string | null;
  button_url: string | null;
  type: string;
  priority: string;
  audience: string;
  is_published: boolean;
  publish_at: string;
  expires_at: string | null;
  created_at: string;
}

export const ANNOUNCEMENT_TYPES = ["banner", "popup", "notification", "dashboard_card", "email"] as const;
export const ANNOUNCEMENT_AUDIENCES = ["everyone", "free", "pro"] as const;
export const ANNOUNCEMENT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const AnnouncementInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  subtitle: z.string().trim().max(160).nullable().optional(),
  message: z.string().trim().min(1).max(4000),
  buttonText: z.string().trim().max(40).nullable().optional(),
  buttonUrl: z.string().trim().max(500).nullable().optional(),
  type: z.enum(ANNOUNCEMENT_TYPES),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES),
  audience: z.enum(ANNOUNCEMENT_AUDIENCES),
  isPublished: z.boolean(),
  publishAt: z.string().min(1),
  expiresAt: z.string().nullable().optional(),
});

/** Owner-only: every announcement, newest first. */
export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AnnouncementRow[]> => {
    await assertOwner(context);
    const { data, error } = await context.supabase
      .from("announcements")
      .select(
        "id, title, subtitle, message, button_text, button_url, type, priority, audience, is_published, publish_at, expires_at, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AnnouncementRow[];
  });

/** Owner-only: create or update an announcement. */
export const saveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnnouncementInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const payload = {
      title: data.title,
      subtitle: data.subtitle || null,
      message: data.message,
      button_text: data.buttonText || null,
      button_url: data.buttonUrl || null,
      type: data.type,
      priority: data.priority,
      audience: data.audience,
      is_published: data.isPublished,
      publish_at: data.publishAt,
      expires_at: data.expiresAt || null,
      created_by: context.userId,
    };
    const query = data.id
      ? context.supabase.from("announcements").update(payload).eq("id", data.id)
      : context.supabase.from("announcements").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner-only: remove an announcement for good. */
export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- Feedback -------------------------------- */

export const FEEDBACK_CATEGORIES = [
  "bug",
  "feature_request",
  "suggestion",
  "review",
  "complaint",
  "question",
] as const;
export const FEEDBACK_STATUSES = ["new", "in_progress", "completed", "declined"] as const;

export interface FeedbackRow {
  id: string;
  category: string;
  subject: string;
  message: string;
  rating: number | null;
  status: string;
  priority: string;
  is_pinned: boolean;
  is_archived: boolean;
  owner_reply: string | null;
  created_at: string;
  authorEmail: string | null;
  authorName: string | null;
}

/** Any signed-in student can send feedback about the app. */
export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.enum(FEEDBACK_CATEGORIES),
        subject: z.string().trim().min(3).max(140),
        message: z.string().trim().min(5).max(4000),
        rating: z.number().int().min(1).max(5).nullable().optional(),
        pageUrl: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feedback").insert({
      user_id: context.userId,
      category: data.category,
      subject: data.subject,
      message: data.message,
      rating: data.rating ?? null,
      page_url: data.pageUrl ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner-only: the full feedback inbox with author details. */
export const listFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedbackRow[]> => {
    const admin = await assertOwner(context);
    const [{ data, error }, { data: profiles }] = await Promise.all([
      admin
        .from("feedback")
        .select(
          "id, user_id, category, subject, message, rating, status, priority, is_pinned, is_archived, owner_reply, created_at",
        )
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      admin.from("profiles").select("id, email, display_name"),
    ]);
    if (error) throw new Error(error.message);

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (data ?? []).map((f) => {
      const author = byId.get(f.user_id);
      return {
        id: f.id,
        category: f.category,
        subject: f.subject,
        message: f.message,
        rating: f.rating,
        status: f.status,
        priority: f.priority,
        is_pinned: f.is_pinned,
        is_archived: f.is_archived,
        owner_reply: f.owner_reply,
        created_at: f.created_at,
        authorEmail: author?.email ?? null,
        authorName: author?.display_name ?? null,
      };
    });
  });

/** Owner-only: reply to feedback or change its status/priority/pin/archive. */
export const updateFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(FEEDBACK_STATUSES).optional(),
        priority: z.enum(["low", "normal", "high"]).optional(),
        isPinned: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        reply: z.string().trim().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const patch: {
      status?: string;
      priority?: string;
      is_pinned?: boolean;
      is_archived?: boolean;
      owner_reply?: string;
      replied_at?: string;
    } = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.isPinned !== undefined) patch.is_pinned = data.isPinned;
    if (data.isArchived !== undefined) patch.is_archived = data.isArchived;
    if (data.reply !== undefined) {
      patch.owner_reply = data.reply;
      patch.replied_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase.from("feedback").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
