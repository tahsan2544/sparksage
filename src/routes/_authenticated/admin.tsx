/**
 * Owner-only admin console: plan catalogue, configurable feature limits and
 * the member directory. Non-owners are redirected back to their dashboard.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMembers,
  listPlansWithFeatures,
  setMemberPlan,
  setPlanVisibility,
  updatePlanFeature,
} from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    // Route-level gate: only the single Owner may reach /admin.
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "owner",
    });
    if (!isOwner) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Admin console — SparkSage" },
      { name: "description", content: "Owner console for plans, feature limits and members." },
      { property: "og:title", content: "Admin console — SparkSage" },
      { property: "og:description", content: "Manage plans, limits and members on SparkSage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8"
    >
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Admin console</h1>
        <p className="text-muted-foreground">
          Plans, feature limits and members. Limits are read from the database at runtime.
        </p>
      </header>

      <Tabs defaultValue="plans">
        <TabsList className="rounded-2xl">
          <TabsTrigger value="plans">Plans &amp; limits</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
        <TabsContent value="plans" className="mt-6">
          <PlansPanel />
        </TabsContent>
        <TabsContent value="members" className="mt-6">
          <MembersPanel />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function PlansPanel() {
  const qc = useQueryClient();
  const plansFn = useServerFn(listPlansWithFeatures);
  const visibilityFn = useServerFn(setPlanVisibility);
  const featureFn = useServerFn(updatePlanFeature);

  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn({}) });

  const toggleVisible = useMutation({
    mutationFn: (v: { id: string; isVisible: boolean }) => visibilityFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFeature = useMutation({
    mutationFn: (v: { id: string; maxUsage: number | null; cooldownSeconds: number; isVisible: boolean }) =>
      featureFn({ data: v }),
    onSuccess: () => {
      toast.success("Limit updated");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (plans.isLoading) return <Skeleton className="h-72 w-full rounded-3xl" />;
  if (plans.isError)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load plans</CardTitle>
          <CardDescription>Please try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => plans.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      {plans.data!.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                {plan.name}
                {!plan.is_visible && <Badge variant="secondary">Hidden</Badge>}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Visible</span>
              <Switch
                checked={plan.is_visible}
                aria-label={`Toggle visibility of the ${plan.name} plan`}
                onCheckedChange={(checked) => toggleVisible.mutate({ id: plan.id, isVisible: checked })}
              />
            </label>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.plan_features.map((f) => (
              <FeatureRow key={f.id} feature={f} onSave={(v) => saveFeature.mutate(v)} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface FeatureRecord {
  id: string;
  feature_key: string;
  max_usage: number | null;
  cooldown_seconds: number;
  is_visible: boolean;
}

function FeatureRow({
  feature,
  onSave,
}: {
  feature: FeatureRecord;
  onSave: (v: { id: string; maxUsage: number | null; cooldownSeconds: number; isVisible: boolean }) => void;
}) {
  const [max, setMax] = useState(feature.max_usage === null ? "" : String(feature.max_usage));
  const [cooldown, setCooldown] = useState(String(feature.cooldown_seconds));
  const [visible, setVisible] = useState(feature.is_visible);

  return (
    <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
      <div>
        <p className="text-sm font-medium">{feature.feature_key}</p>
        <p className="text-xs text-muted-foreground">Leave the limit empty for unlimited.</p>
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground" htmlFor={`max-${feature.id}`}>
          Max usage
        </label>
        <Input
          id={`max-${feature.id}`}
          inputMode="numeric"
          className="w-28"
          value={max}
          onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="∞"
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground" htmlFor={`cool-${feature.id}`}>
          Cooldown (s)
        </label>
        <Input
          id={`cool-${feature.id}`}
          inputMode="numeric"
          className="w-28"
          value={cooldown}
          onChange={(e) => setCooldown(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={visible}
          aria-label={`Toggle visibility of ${feature.feature_key}`}
          onCheckedChange={setVisible}
        />
        <span className="text-muted-foreground">Visible</span>
      </label>
      <Button
        variant="secondary"
        onClick={() =>
          onSave({
            id: feature.id,
            maxUsage: max === "" ? null : Number(max),
            cooldownSeconds: cooldown === "" ? 0 : Number(cooldown),
            isVisible: visible,
          })
        }
      >
        Save
      </Button>
    </div>
  );
}

function MembersPanel() {
  const qc = useQueryClient();
  const membersFn = useServerFn(listMembers);
  const plansFn = useServerFn(listPlansWithFeatures);
  const setPlanFn = useServerFn(setMemberPlan);

  const members = useQuery({ queryKey: ["admin-members"], queryFn: () => membersFn({}) });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn({}) });

  const changePlan = useMutation({
    mutationFn: (v: { userId: string; planId: string }) => setPlanFn({ data: v }),
    onSuccess: () => {
      toast.success("Plan updated");
      qc.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (members.isLoading) return <Skeleton className="h-64 w-full rounded-3xl" />;
  if (members.isError)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load members</CardTitle>
          <CardDescription>Please try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => members.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );

  if (members.data!.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No members yet</CardTitle>
          <CardDescription>Invite students and they'll appear here.</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>{members.data!.length} account(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.data!.map((m) => (
          <div
            key={m.userId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{m.displayName ?? m.email ?? "Unnamed"}</p>
              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
              <Select
                value={plans.data?.find((p) => p.key === m.planKey)?.id ?? undefined}
                onValueChange={(planId) => changePlan.mutate({ userId: m.userId, planId })}
              >
                <SelectTrigger className="w-40" aria-label={`Plan for ${m.email ?? m.userId}`}>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
