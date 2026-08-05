/**
 * Owner inbox for Pro / Master access requests. SparkSage takes no payments —
 * the Owner grants access here by hand.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { listProRequests, decideProRequest } from "@/lib/pro.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/requests")({
  head: () => ({
    meta: [
      { title: "Upgrade requests — SparkSage Owner" },
      { name: "description", content: "Review and grant Pro or Master access to SparkSage students." },
      { property: "og:title", content: "Upgrade requests — SparkSage Owner" },
      { property: "og:description", content: "Approve or decline student requests for higher plan limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-accent/40 text-accent-foreground",
  approved: "bg-primary/15 text-primary",
  declined: "bg-muted text-muted-foreground",
};

function RequestsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProRequests);
  const decideFn = useServerFn(decideProRequest);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const requests = useQuery({ queryKey: ["pro-requests"], queryFn: () => listFn() });

  const decide = useMutation({
    mutationFn: (vars: { id: string; approve: boolean; plan: "pro" | "master"; note?: string }) =>
      decideFn({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? `Access granted (${vars.plan}).` : "Request declined.");
      qc.invalidateQueries({ queryKey: ["pro-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (requests.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }

  if (requests.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We couldn't load the requests</CardTitle>
          <CardDescription>Please refresh and try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => requests.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const rows = requests.data ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Upgrade requests</h1>
        <p className="text-sm text-muted-foreground">
          Students ask here instead of paying. Approve to move them onto Pro, or grant Master for unlimited access.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
          <h2 className="font-semibold">No requests yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When a student asks for more capacity, it will land right here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card>
                <CardHeader className="gap-2 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {r.displayName || r.email || "Student"}
                      {r.email && r.displayName && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">{r.email}</span>
                      )}
                    </CardTitle>
                    <Badge className={`rounded-full px-3 ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</Badge>
                  </div>
                  <CardDescription>
                    Asked for {r.requestedPlan} · {formatDistanceToNow(new Date(r.createdAt))} ago
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {r.message && <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">{r.message}</p>}
                  {r.ownerNote && (
                    <p className="text-sm text-muted-foreground">
                      Your reply: <span className="text-foreground">{r.ownerNote}</span>
                    </p>
                  )}

                  {r.status === "pending" && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        aria-label={`Note for ${r.displayName || r.email || "this student"}`}
                        placeholder="Optional note back to the student"
                        value={notes[r.id] ?? ""}
                        maxLength={1000}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, approve: true, plan: "pro", note: notes[r.id] })}
                        >
                          Grant Pro
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, approve: true, plan: "master", note: notes[r.id] })}
                        >
                          <Crown className="mr-1 h-3.5 w-3.5" aria-hidden /> Master
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, approve: false, plan: "pro", note: notes[r.id] })}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
