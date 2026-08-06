/**
 * Owner overview: business insights (not server metrics) in a warm card grid,
 * followed by the newest activity across the platform and quick actions.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  UserPlus,
  Activity,
  FileText,
  MessageSquare,
  Timer,
  TrendingUp,
  Sparkles,
  Megaphone,
  Inbox,
  Layers,
  ListChecks,
} from "lucide-react";

import { getOwnerOverview } from "@/lib/owner.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/owner/")({
  head: () => ({
    meta: [
      { title: "Owner overview — SparkSage" },
      { name: "description", content: "Students, uploads, AI activity and revenue signals at a glance." },
      { property: "og:title", content: "Owner overview — SparkSage" },
      { property: "og:description", content: "Business insights for the SparkSage study platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerOverviewPage,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function OwnerOverviewPage() {
  const overviewFn = useServerFn(getOwnerOverview);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["owner-overview"],
    queryFn: () => overviewFn(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-3xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load your overview</CardTitle>
          <CardDescription>Something went wrong fetching platform insights.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const stats = [
    { label: "Total students", value: data.totalStudents, icon: Users },
    { label: "Studied today", value: data.activeToday, icon: Activity },
    { label: "New signups today", value: data.newSignupsToday, icon: UserPlus },
    { label: "Documents today", value: data.documentsToday, icon: FileText },
    { label: "Documents this month", value: data.documentsThisMonth, icon: FileText },
    { label: "AI questions today", value: data.aiQuestionsToday, icon: MessageSquare },
    { label: "AI questions this month", value: data.aiQuestionsThisMonth, icon: MessageSquare },
    { label: "Study time this month", value: `${data.studyMinutesThisMonth}m`, icon: Timer },
    { label: "Avg study / student", value: `${data.avgStudyMinutesPerStudent}m`, icon: Timer },
    { label: "Quizzes created", value: data.quizzesCreated, icon: ListChecks },
    { label: "Flashcard decks", value: data.flashcardDecks, icon: Layers },
    { label: "Open feedback", value: data.openFeedback, icon: Inbox },
    { label: "Live announcements", value: data.liveAnnouncements, icon: Megaphone },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Owner overview</h1>
        <p className="text-muted-foreground">
          How SparkSage is doing today — students, study activity and AI usage.
        </p>
      </header>

      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-semibold leading-tight">{s.value}</p>
                <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section aria-label="Quick actions">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>The things you reach for most often.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/owner/announcements">Create announcement</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/admin">View members</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/owner/feedback">Review feedback</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/site-settings">Open settings</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/progress">View reports</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section aria-label="Recent activity" className="grid gap-6 lg:grid-cols-2">
        <ListCard
          title="Newest students"
          empty="No students have joined yet."
          items={data.newestStudents.map((s) => ({
            id: s.id,
            primary: s.name || s.email || "New student",
            secondary: s.email ?? "",
            meta: fmtDate(s.joined),
          }))}
        />
        <ListCard
          title="Recent documents"
          empty="No documents uploaded yet."
          items={data.recentDocuments.map((d) => ({
            id: d.id,
            primary: d.title,
            secondary: "",
            meta: fmtDate(d.created),
          }))}
        />
        <ListCard
          title="Recent feedback"
          empty="No feedback yet — students can send it from the header."
          items={data.recentFeedback.map((f) => ({
            id: f.id,
            primary: f.subject,
            secondary: f.category.replace("_", " "),
            meta: f.status,
          }))}
        />
        <ListCard
          title="Recent announcements"
          empty="Nothing announced yet."
          items={data.recentAnnouncements.map((a) => ({
            id: a.id,
            primary: a.title,
            secondary: a.published ? "Published" : "Draft",
            meta: fmtDate(a.created),
          }))}
        />
        <ListCard
          title="Recent AI activity"
          empty="No AI questions asked yet."
          items={data.recentAiActivity.map((a) => ({
            id: a.id,
            primary: a.snippet,
            secondary: "",
            meta: fmtDate(a.created),
          }))}
        />
      </section>
    </div>
  );
}

function ListCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; primary: string; secondary: string; meta: string }>;
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.primary}</p>
              {item.secondary && (
                <p className="truncate text-xs capitalize text-muted-foreground">{item.secondary}</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 capitalize">
              {item.meta}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
