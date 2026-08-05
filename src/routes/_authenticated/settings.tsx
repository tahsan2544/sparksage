/**
 * Settings — profile, plan/subscription and (once) Owner claim.
 * Students never see administration tools here.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  getAccountContext,
  listVisiblePlans,
  updateProfile,
  claimOwnership,
} from "@/lib/access.functions";
import { getMyProRequest, requestPro } from "@/lib/pro.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SparkSage" },
      { name: "description", content: "Manage your SparkSage profile, plan and account preferences." },
      { property: "og:title", content: "Settings — SparkSage" },
      { property: "og:description", content: "Manage your SparkSage profile and subscription." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const FEATURE_LABELS: Record<string, string> = {
  documents: "Documents",
  ai_chat_messages_per_day: "AI tutor messages / day",
  quiz_generations_per_day: "Quiz generations / day",
  flashcard_generations_per_day: "Flashcard decks / day",
  summaries_per_day: "Summaries / day",
};

function SettingsPage() {
  const qc = useQueryClient();
  const accountFn = useServerFn(getAccountContext);
  const plansFn = useServerFn(listVisiblePlans);
  const saveFn = useServerFn(updateProfile);
  const claimFn = useServerFn(claimOwnership);

  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn({}) });
  const plans = useQuery({ queryKey: ["visible-plans"], queryFn: () => plansFn({}) });

  const [name, setName] = useState("");
  useEffect(() => {
    if (account.data?.displayName) setName(account.data.displayName);
  }, [account.data?.displayName]);

  const save = useMutation({
    mutationFn: (displayName: string) => saveFn({ data: { displayName } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claim = useMutation({
    mutationFn: () => claimFn({}),
    onSuccess: () => {
      toast.success("You are now the platform Owner");
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (account.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (account.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>We couldn't load your settings</CardTitle>
          <CardDescription>Please refresh the page and try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => account.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const acct = account.data!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8"
    >
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Your profile, plan and account details.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear across SparkSage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </div>
          <div className="grid gap-2 sm:max-w-sm">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={acct.email ?? ""} readOnly disabled />
          </div>
          <Button
            onClick={() => save.mutate(name.trim())}
            disabled={save.isPending || !name.trim() || name.trim() === acct.displayName}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>Your current plan and what it unlocks.</CardDescription>
          </div>
          <Badge className="rounded-full px-3 py-1 text-sm">
            <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
            {acct.plan?.name ?? "Free"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="grid gap-2 sm:grid-cols-2">
            {acct.features
              .filter((f) => f.isVisible)
              .map((f) => (
                <li key={f.featureKey} className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
                  <span className="text-sm">{FEATURE_LABELS[f.featureKey] ?? f.featureKey}</span>
                  <span className="text-sm font-medium">
                    {f.maxUsage === null ? "Unlimited" : f.maxUsage}
                  </span>
                </li>
              ))}
            {acct.features.length === 0 && (
              <li className="text-sm text-muted-foreground">No limits configured for this plan yet.</li>
            )}
          </ul>

          <div className="grid gap-4 sm:grid-cols-2">
            {plans.data?.map((p) => {
              const current = p.key === acct.plan?.key;
              return (
                <div
                  key={p.id}
                  className={`rounded-3xl border p-5 transition-shadow hover:shadow-md ${
                    current ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    {current && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary">
                        <Check className="h-3.5 w-3.5" aria-hidden /> Current
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  <p className="mt-4 text-2xl font-semibold">
                    {p.key === "free" ? "Free" : "By request"}
                  </p>

                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {acct.role !== "owner" && <UpgradeCard planKey={acct.plan?.key ?? "free"} />}



      {acct.role === "owner" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" aria-hidden /> Owner access
            </CardTitle>
            <CardDescription>You manage plans, limits and members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin">Open admin console</Link>
            </Button>
          </CardContent>
        </Card>
      ) : acct.ownerlessPlatform ? (
        <Card>
          <CardHeader>
            <CardTitle>Claim platform ownership</CardTitle>
            <CardDescription>
              No Owner account exists yet. Claiming it is a one-time action and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => claim.mutate()} disabled={claim.isPending}>
              {claim.isPending ? "Claiming…" : "Become the Owner"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </motion.div>
  );
}

/**
 * Ask the Owner for more capacity. SparkSage does not take payments — the
 * Owner reviews requests in their inbox and grants Pro (or Master) by hand.
 */
function UpgradeCard({ planKey }: { planKey: string }) {
  const qc = useQueryClient();
  const myRequestFn = useServerFn(getMyProRequest);
  const requestFn = useServerFn(requestPro);
  const [message, setMessage] = useState("");

  const request = useQuery({ queryKey: ["my-pro-request"], queryFn: () => myRequestFn() });

  const send = useMutation({
    mutationFn: () => requestFn({ data: { message: message.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Request sent — the Owner will review it shortly.");
      setMessage("");
      qc.invalidateQueries({ queryKey: ["my-pro-request"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (planKey === "master") return null;

  const current = request.data;
  const pending = current?.status === "pending";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" aria-hidden /> Need more room?
        </CardTitle>
        <CardDescription>
          Pro unlocks much higher daily limits. There's nothing to pay — just tell us how you study and the Owner
          will review your request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current && (
          <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
            <p className="font-medium">
              {pending
                ? "Your request is waiting for review."
                : current.status === "approved"
                  ? "Your last request was approved 🎉"
                  : "Your last request was declined."}
            </p>
            {current.ownerNote && <p className="mt-1 text-muted-foreground">Owner note: {current.ownerNote}</p>}
          </div>
        )}

        {!pending && planKey !== "pro" && (
          <div className="grid gap-2 sm:max-w-lg">
            <Label htmlFor="upgrade-message">Why do you need Pro? (optional)</Label>
            <Input
              id="upgrade-message"
              value={message}
              maxLength={1000}
              placeholder="I'm revising for finals and hit my daily limit."
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        )}

        {planKey === "pro" ? (
          <p className="text-sm text-muted-foreground">You're on Pro. Contact the Owner if you need unlimited access.</p>
        ) : (
          <Button onClick={() => send.mutate()} disabled={send.isPending || pending || request.isLoading}>
            {pending ? "Request pending" : send.isPending ? "Sending…" : "Request Pro access"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
