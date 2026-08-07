// Progress analytics: study minutes over last 30 days, streaks, and totals.
// Includes a Pomodoro-style timer that logs a study session on stop.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Flame, Timer as TimerIcon, BookOpen, ListChecks, Layers, Play, Square } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { getProgress, logSession } from "@/lib/study.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Your progress — SparkSage" },
      {
        name: "description",
        content:
          "Track focused study time, daily streaks and everything you have created over the last 30 days in SparkSage.",
      },
      { property: "og:title", content: "Your study progress — SparkSage" },
      {
        property: "og:description",
        content: "See your focus hours, streaks and study activity trends at a glance.",
      },
      { property: "og:url", content: "https://sparksage.lovable.app/progress" },
    ],
    links: [{ rel: "canonical", href: "https://sparksage.lovable.app/progress" }],
  }),

  component: ProgressPage,
});

function ProgressPage() {
  const fetchProgress = useServerFn(getProgress);
  const { data, isLoading, error } = useQuery({
    queryKey: ["progress"],
    queryFn: () => fetchProgress(),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Your progress</h1>
        <p className="text-sm text-muted-foreground">
          Last 30 days of focused study, streaks, and what you've built.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard
          label="Study streak"
          value={data ? `${data.streak} day${data.streak === 1 ? "" : "s"}` : "—"}
          icon={<Flame className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Total time (30d)"
          value={data ? formatMinutes(data.totalMinutes) : "—"}
          icon={<TimerIcon className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Sessions (30d)"
          value={data ? String(data.sessionCount) : "—"}
          icon={<ListChecks className="h-4 w-4 text-primary" />}
        />
        <StatCard
          label="Documents"
          value={data ? String(data.counts.documents) : "—"}
          icon={<BookOpen className="h-4 w-4 text-primary" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Study minutes — last 30 days</CardTitle>
            <CardDescription>Rolling view of daily focus time.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="h-64 rounded bg-muted/40 animate-pulse" aria-hidden />}
            {error && (
              <p className="text-sm text-destructive">
                Failed to load: {error instanceof Error ? error.message : "unknown error"}
              </p>
            )}
            {data && <StudyChart daily={data.daily} />}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <PomodoroCard />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Study material</CardTitle>
              <CardDescription>Generated with AI from your documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <MaterialRow icon={<BookOpen className="h-4 w-4" />} label="Documents" value={data?.counts.documents ?? 0} />
              <MaterialRow icon={<ListChecks className="h-4 w-4" />} label="Quizzes" value={data?.counts.quizzes ?? 0} />
              <MaterialRow icon={<Layers className="h-4 w-4" />} label="Flashcard decks" value={data?.counts.decks ?? 0} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function MaterialRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StudyChart({ daily }: { daily: Array<{ date: string; minutes: number }> }) {
  const formatted = daily.map((d) => ({ ...d, label: format(parseISO(d.date), "MMM d") }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            interval={Math.max(0, Math.floor(formatted.length / 8) - 1)}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v} min`, "Study time"]}
          />
          <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Pomodoro card ----------

const POMODORO_SECONDS = 25 * 60;

function PomodoroCard() {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(POMODORO_SECONDS);
  const startedAtRef = useRef<number | null>(null);
  const log = useServerFn(logSession);
  const qc = useQueryClient();

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id);
          void finishSession(POMODORO_SECONDS);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  async function finishSession(seconds: number) {
    setRunning(false);
    startedAtRef.current = null;
    setRemaining(POMODORO_SECONDS);
    try {
      await log({ data: { duration_seconds: seconds } });
      toast.success(`Logged ${Math.round(seconds / 60)} min of study`);
      qc.invalidateQueries({ queryKey: ["progress"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log session");
    }
  }

  function start() {
    startedAtRef.current = Date.now();
    setRemaining(POMODORO_SECONDS);
    setRunning(true);
  }

  function stop() {
    const started = startedAtRef.current;
    const elapsed = started ? Math.max(1, Math.round((Date.now() - started) / 1000)) : POMODORO_SECONDS - remaining;
    if (elapsed >= 30) {
      void finishSession(Math.min(elapsed, POMODORO_SECONDS));
    } else {
      setRunning(false);
      startedAtRef.current = null;
      setRemaining(POMODORO_SECONDS);
      toast.info("Session too short to log (under 30s)");
    }
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TimerIcon className="h-4 w-4 text-primary" /> Focus timer
        </CardTitle>
        <CardDescription>25-minute Pomodoro. Logs on stop or completion.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-mono font-semibold tabular-nums text-center py-2" aria-live="polite">
          {mm}:{ss}
        </div>
        <div className="mt-3 flex justify-center">
          {running ? (
            <Button variant="secondary" onClick={stop}>
              <Square className="h-4 w-4 mr-2" /> Stop & log
            </Button>
          ) : (
            <Button onClick={start}>
              <Play className="h-4 w-4 mr-2" /> Start
            </Button>
          )}
        </div>
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
