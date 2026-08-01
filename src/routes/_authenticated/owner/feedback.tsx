/**
 * Feedback inbox: everything students send, with reply, status, priority,
 * pinning, tags and archiving. Searchable and filterable.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Pin, Archive, Search } from "lucide-react";

import { listFeedback, updateFeedback, type FeedbackRow } from "@/lib/owner.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/owner/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback — SparkSage" },
      { name: "description", content: "Read student bug reports, ideas and reviews, and reply in one place." },
      { property: "og:title", content: "Feedback — SparkSage" },
      { property: "og:description", content: "The SparkSage student feedback inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeedbackPage,
});

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
];

const CATEGORY_FILTERS = [
  { value: "all", label: "All categories" },
  { value: "bug", label: "Bug report" },
  { value: "feature_request", label: "Feature request" },
  { value: "suggestion", label: "Suggestion" },
  { value: "review", label: "Review" },
  { value: "complaint", label: "Complaint" },
  { value: "question", label: "Question" },
];

function FeedbackPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFeedback);
  const updateFn = useServerFn(updateFeedback);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

  const list = useQuery({ queryKey: ["owner-feedback"], queryFn: () => listFn() });

  const update = useMutation({
    mutationFn: (v: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["owner-feedback"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((f) => {
      if (!showArchived && f.is_archived) return false;
      if (category !== "all" && f.category !== category) return false;
      if (status !== "all" && f.status !== status) return false;
      if (!q) return true;
      return (
        f.subject.toLowerCase().includes(q) ||
        f.message.toLowerCase().includes(q) ||
        (f.authorEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [list.data, search, category, status, showArchived]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground">What students are telling you, all in one inbox.</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Search subject, message or email"
            aria-label="Search feedback"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48" aria-label="Filter by category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTERS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived((v) => !v)}>
          <Archive className="mr-2 h-4 w-4" aria-hidden />
          {showArchived ? "Hiding nothing" : "Show archived"}
        </Button>
      </div>

      {list.isLoading && <Skeleton className="h-64 w-full rounded-3xl" />}

      {list.isError && (
        <Card>
          <CardHeader>
            <CardTitle>Couldn't load feedback</CardTitle>
            <CardDescription>Please try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => list.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!list.isLoading && rows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-secondary/30">
              <Inbox className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Nothing here yet</p>
              <p className="text-sm text-muted-foreground">
                Students can send feedback from the “Feedback” button in the header.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <FeedbackCard key={row.id} row={row} onUpdate={(v) => update.mutate(v)} />
        ))}
      </div>
    </div>
  );
}

function FeedbackCard({
  row,
  onUpdate,
}: {
  row: FeedbackRow;
  onUpdate: (v: {
    id: string;
    status?: "new" | "in_progress" | "completed" | "declined";
    isPinned?: boolean;
    isArchived?: boolean;
    reply?: string;
  }) => void;
}) {
  const [reply, setReply] = useState(row.owner_reply ?? "");

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {row.subject}
            <Badge variant="outline" className="capitalize">
              {row.category.replace("_", " ")}
            </Badge>
            <Badge variant={row.status === "completed" ? "default" : "secondary"} className="capitalize">
              {row.status.replace("_", " ")}
            </Badge>
            {row.rating != null && <Badge variant="outline">{row.rating}/5</Badge>}
          </CardTitle>
          <CardDescription>
            {row.authorName || row.authorEmail || "Student"} ·{" "}
            {new Date(row.created_at).toLocaleDateString()}
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant={row.is_pinned ? "default" : "ghost"}
            size="icon"
            aria-label={row.is_pinned ? "Unpin feedback" : "Pin feedback"}
            onClick={() => onUpdate({ id: row.id, isPinned: !row.is_pinned })}
          >
            <Pin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={row.is_archived ? "Unarchive feedback" : "Archive feedback"}
            onClick={() => onUpdate({ id: row.id, isArchived: !row.is_archived })}
          >
            <Archive className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="whitespace-pre-wrap text-sm">{row.message}</p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground" htmlFor={`reply-${row.id}`}>
              Your reply
            </label>
            <Textarea
              id={`reply-${row.id}`}
              rows={2}
              maxLength={4000}
              value={reply}
              placeholder="Write a friendly reply…"
              onChange={(e) => setReply(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={row.status}
              onValueChange={(v) =>
                onUpdate({ id: row.id, status: v as "new" | "in_progress" | "completed" | "declined" })
              }
            >
              <SelectTrigger className="w-36" aria-label={`Status for ${row.subject}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={reply.trim() === (row.owner_reply ?? "").trim()}
              onClick={() => {
                onUpdate({ id: row.id, reply: reply.trim() });
                toast.success("Reply saved");
              }}
            >
              Save reply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
