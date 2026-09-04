// Warm study home: welcome, streak, quick actions, recent docs, upcoming tasks.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow, format, parseISO, isPast, isToday } from "date-fns";
import {
  FileText,
  Flame,
  Timer,
  Plus,
  CalendarDays,
  LineChart,
  ArrowRight,
  Sparkles,
  Target,
  ListChecks,
} from "lucide-react";

import { listDocuments } from "@/lib/documents.functions";
import { listGoals, getProgress } from "@/lib/study.functions";
import { getWeakAreas, type WeakArea } from "@/lib/performance.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Study dashboard — SparkSage" },
      {
        name: "description",
        content:
          "Your SparkSage study home: current streak, recent documents, today's goals and a fresh study tip each visit.",
      },
      { property: "og:title", content: "Your study dashboard — SparkSage" },
      {
        property: "og:description",
        content: "Pick up where you left off: streaks, recent documents and today's study tasks.",
      },
      { property: "og:url", content: "https://sparksage.lovable.app/dashboard" },
    ],
    links: [{ rel: "canonical", href: "https://sparksage.lovable.app/dashboard" }],
  }),

  component: DashboardHome,
});

const TIPS = [
  "Short, daily sessions beat one long cram. Fifteen focused minutes counts.",
  "Explain a topic out loud as if teaching it — gaps show up fast.",
  "Review flashcards right before sleep; recall improves overnight.",
  "Start with the hardest topic while your attention is freshest.",
  "Close the tab you keep checking. Focus is a setting, not a mood.",
];

function DashboardHome() {
  const docsFn = useServerFn(listDocuments);
  const goalsFn = useServerFn(listGoals);
  const progressFn = useServerFn(getProgress);

  const { data: docs, isLoading: docsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => docsFn(),
  });
  const { data: goals } = useQuery({ queryKey: ["study-goals"], queryFn: () => goalsFn() });
  const { data: progress } = useQuery({ queryKey: ["progress"], queryFn: () => progressFn() });
  const weakFn = useServerFn(getWeakAreas);
  const { data: weakAreas, isLoading: weakLoading } = useQuery({
    queryKey: ["weak-areas"],
    queryFn: () => weakFn(),
  });

  const documents = (docs ?? []) as Array<{ id: string; title: string; updated_at: string }>;
  const tasks = ((goals ?? []) as Array<{ id: string; title: string; due_date: string; completed: boolean }>)
    .filter((g) => !g.completed)
    .slice(0, 5);
  const dueToday = tasks.filter(
    (t) => isToday(parseISO(t.due_date)) || isPast(parseISO(t.due_date)),
  ).length;

  const tip = TIPS[new Date().getDate() % TIPS.length];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your study dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{greeting} 👋</p>

        <p className="text-sm text-muted-foreground mt-1">
          {dueToday > 0
            ? `You have ${dueToday} task${dueToday === 1 ? "" : "s"} due today. Let's clear them.`
            : "Nothing overdue. A great day to get ahead."}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Flame className="h-4 w-4 text-primary" />}
          label="Study streak"
          value={progress ? `${progress.streak} day${progress.streak === 1 ? "" : "s"}` : "—"}
        />
        <Stat
          icon={<Timer className="h-4 w-4 text-primary" />}
          label="Focus (30d)"
          value={progress ? formatMinutes(progress.totalMinutes) : "—"}
        />
        <Stat
          icon={<FileText className="h-4 w-4 text-primary" />}
          label="Documents"
          value={progress ? String(progress.counts.documents) : String(documents.length)}
        />
        <Stat
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          label="Open tasks"
          value={String(tasks.length)}
        />
      </div>

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/documents">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" /> Upload document
            </Button>
          </Link>
          <Link to="/planner">
            <Button size="sm" variant="outline">
              <CalendarDays className="h-4 w-4 mr-2" /> Plan a task
            </Button>
          </Link>
          <Link to="/progress">
            <Button size="sm" variant="outline">
              <Timer className="h-4 w-4 mr-2" /> Start Pomodoro
            </Button>
          </Link>
          <Link to="/progress">
            <Button size="sm" variant="outline">
              <LineChart className="h-4 w-4 mr-2" /> View progress
            </Button>
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Continue studying</CardTitle>
            <CardDescription>Your most recently updated documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {docsLoading && <div className="h-24 rounded-xl bg-muted/40 animate-pulse" aria-hidden />}
            {!docsLoading && documents.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <FileText className="mx-auto h-7 w-7 text-muted-foreground mb-2" aria-hidden />
                <p className="text-sm text-muted-foreground">No documents yet.</p>
                <Link to="/documents" className="inline-block mt-3">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Add your first document
                  </Button>
                </Link>
              </div>
            )}
            {documents.slice(0, 5).map((d) => (
              <Link
                key={d.id}
                to="/documents/$documentId"
                params={{ documentId: d.id }}
                className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-accent/50 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                  <span className="truncate">{d.title}</span>
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(d.updated_at))} ago
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <TodaysPlan
            weakAreas={(weakAreas ?? []) as WeakArea[]}
            openTasks={tasks.length}
            hasDocuments={documents.length > 0}
            topDocumentId={documents[0]?.id}
          />
          <WeakAreas areas={(weakAreas ?? []) as WeakArea[]} loading={weakLoading} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upcoming tasks</CardTitle>
              <CardDescription>From your study planner.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 && (
                <p className="text-sm text-muted-foreground">No open tasks. Add one from the planner.</p>
              )}
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(t.due_date), "EEE, MMM d")}
                  </div>
                </div>
              ))}
              <Link to="/planner" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Open planner <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Tip of the day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{tip}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * "What should I do next" — built only from real signals: weak concepts,
 * open planner tasks and whether any material exists yet.
 */
function TodaysPlan({
  weakAreas,
  openTasks,
  hasDocuments,
  topDocumentId,
}: {
  weakAreas: WeakArea[];
  openTasks: number;
  hasDocuments: boolean;
  topDocumentId?: string;
}) {
  const needsReview = weakAreas.filter((w) => w.status !== "strong");

  const items: Array<{ label: string; minutes: number; to: string; params?: Record<string, string> }> = [];
  if (!hasDocuments) {
    items.push({ label: "Upload your first study material", minutes: 5, to: "/documents" });
  } else if (topDocumentId) {
    items.push({
      label: needsReview.length
        ? `Re-practise ${needsReview[0].topic}`
        : "Take a quiz on your latest material",
      minutes: 15,
      to: "/documents/$documentId",
      params: { documentId: needsReview[0]?.documentId ?? topDocumentId },
    });
  }
  if (openTasks > 0) items.push({ label: `Clear ${openTasks} planner task${openTasks === 1 ? "" : "s"}`, minutes: 20, to: "/planner" });
  items.push({ label: "Run one focused Pomodoro", minutes: 25, to: "/progress" });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden /> Today&apos;s study plan
        </CardTitle>
        <CardDescription>The next few things worth doing, in order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => (
          <Link
            key={item.label}
            to={item.to}
            params={item.params as never}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-accent/50 transition-colors"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="truncate text-sm">{item.label}</span>
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{item.minutes} min</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/** Honest weak areas: only shown once real quiz/flashcard data exists. */
function WeakAreas({ areas, loading }: { areas: WeakArea[]; loading: boolean }) {
  const shown = areas.filter((a) => a.status !== "strong").slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" aria-hidden /> Weak areas
        </CardTitle>
        <CardDescription>Based on your actual quiz and flashcard answers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <div className="h-16 rounded-xl bg-muted/40 animate-pulse" aria-hidden />}
        {!loading && shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing flagged yet. Take a quiz or run a flashcard deck and your weak concepts will show up here.
          </p>
        )}
        {shown.map((a) => (
          <div key={`${a.documentId}-${a.topic}`} className="rounded-xl border border-border px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{a.topic}</span>
              <span
                className={
                  a.status === "needs_review"
                    ? "shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                    : "shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                }
              >
                {a.status === "needs_review" ? "Needs review" : "Improving"}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {a.correct}/{a.attempts} correct
              {a.documentTitle ? ` · ${a.documentTitle}` : ""}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
