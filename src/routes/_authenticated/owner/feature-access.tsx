/**
 * Feature Access Manager — every subscription restriction, editable per plan
 * without touching code. Limits live in `plan_features`.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { listPlansWithFeatures, updatePlanFeature, setPlanVisibility } from "@/lib/access.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/owner/feature-access")({
  head: () => ({
    meta: [
      { title: "Feature access — SparkSage" },
      { name: "description", content: "Turn features on or off and set usage limits for each plan." },
      { property: "og:title", content: "Feature access — SparkSage" },
      { property: "og:description", content: "Control every subscription restriction from one page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeatureAccessPage,
});

/** Human labels so the page reads like English, not like database keys. */
const LABELS: Record<string, string> = {
  pdf_upload: "PDF upload",
  max_documents: "Maximum documents",
  max_storage_mb: "Maximum storage (MB)",
  ai_questions_per_day: "Daily AI questions",
  ai_questions_per_month: "Monthly AI questions",
  flashcards_per_day: "Daily flashcard decks",
  flashcards_per_month: "Monthly flashcard decks",
  quizzes_per_day: "Daily quizzes",
  quizzes_per_month: "Monthly quizzes",
  notes_per_day: "Daily notes",
  notes_per_month: "Monthly notes",
  ocr: "OCR",
  voice_tutor: "Voice tutor",
  mind_maps: "Mind maps",
  research_assistant: "Research assistant",
  citation_generator: "Citation generator",
  grammar_correction: "Grammar correction",
  translation: "Translation",
  priority_ai: "Priority AI",
  fast_queue: "Fast queue",
  offline_mode: "Offline mode",
  cloud_backup: "Cloud backup",
  advanced_analytics: "Advanced analytics",
  export_pdf: "Export as PDF",
  export_docx: "Export as DOCX",
  export_markdown: "Export as Markdown",
  image_ocr: "Image OCR",
  image_understanding: "Image understanding",
  ai_whiteboard: "AI whiteboard",
  study_rooms: "Study rooms",
  documents: "Documents",
  ai_chat_messages_per_day: "Daily AI chat messages",
  quiz_generations_per_day: "Daily quiz generations",
  flashcard_generations_per_day: "Daily flashcard generations",
  summaries_per_day: "Daily summaries",
};

const label = (key: string) => LABELS[key] ?? key.replace(/_/g, " ");

interface FeatureRecord {
  id: string;
  feature_key: string;
  max_usage: number | null;
  cooldown_seconds: number;
  is_visible: boolean;
}

function FeatureAccessPage() {
  const qc = useQueryClient();
  const plansFn = useServerFn(listPlansWithFeatures);
  const featureFn = useServerFn(updatePlanFeature);
  const visibilityFn = useServerFn(setPlanVisibility);

  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn({}) });

  const saveFeature = useMutation({
    mutationFn: (v: { id: string; maxUsage: number | null; cooldownSeconds: number; isVisible: boolean }) =>
      featureFn({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePlan = useMutation({
    mutationFn: (v: { id: string; isVisible: boolean }) => visibilityFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (plans.isLoading) return <Skeleton className="h-96 w-full rounded-3xl" />;
  if (plans.isError || !plans.data)
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

  const first = plans.data[0];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Feature access</h1>
        <p className="text-muted-foreground">
          Switch a feature off, cap it, or leave the limit empty for unlimited. Changes apply instantly.
        </p>
      </header>

      <Tabs defaultValue={first?.key ?? "free"}>
        <TabsList className="rounded-2xl">
          {plans.data.map((plan) => (
            <TabsTrigger key={plan.id} value={plan.key}>
              {plan.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {plans.data.map((plan) => (
          <TabsContent key={plan.id} value={plan.key} className="mt-6 space-y-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    {!plan.is_visible && <Badge variant="secondary">Hidden</Badge>}
                  </CardTitle>
                  <CardDescription>
                    {plan.description ?? "No description"} · {plan.plan_features.length} features
                  </CardDescription>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Visible to students</span>
                  <Switch
                    checked={plan.is_visible}
                    aria-label={`Show the ${plan.name} plan to students`}
                    onCheckedChange={(checked) => togglePlan.mutate({ id: plan.id, isVisible: checked })}
                  />
                </label>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...plan.plan_features]
                  .sort((a, b) => label(a.feature_key).localeCompare(label(b.feature_key)))
                  .map((feature) => (
                    <FeatureRow
                      key={feature.id}
                      feature={feature as FeatureRecord}
                      onSave={(v) => saveFeature.mutate(v)}
                    />
                  ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FeatureRow({
  feature,
  onSave,
}: {
  feature: FeatureRecord;
  onSave: (v: { id: string; maxUsage: number | null; cooldownSeconds: number; isVisible: boolean }) => void;
}) {
  const [enabled, setEnabled] = useState(feature.is_visible);
  const [unlimited, setUnlimited] = useState(feature.max_usage === null);
  const [max, setMax] = useState(feature.max_usage === null ? "" : String(feature.max_usage));

  const dirty =
    enabled !== feature.is_visible ||
    unlimited !== (feature.max_usage === null) ||
    (!unlimited && max !== String(feature.max_usage ?? ""));

  return (
    <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label(feature.feature_key)}</p>
        <p className="truncate text-xs text-muted-foreground">{feature.feature_key}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={enabled}
          aria-label={`Enable ${label(feature.feature_key)}`}
          onCheckedChange={setEnabled}
        />
        <span className="text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
      </label>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={unlimited}
            aria-label={`Unlimited ${label(feature.feature_key)}`}
            onCheckedChange={setUnlimited}
          />
          <span className="text-muted-foreground">Unlimited</span>
        </label>
        <Input
          inputMode="numeric"
          className="w-24"
          disabled={unlimited}
          aria-label={`Limit for ${label(feature.feature_key)}`}
          value={unlimited ? "" : max}
          placeholder="0"
          onChange={(e) => setMax(e.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>

      <Button
        variant={dirty ? "default" : "secondary"}
        disabled={!dirty}
        onClick={() =>
          onSave({
            id: feature.id,
            maxUsage: unlimited ? null : Number(max || 0),
            cooldownSeconds: feature.cooldown_seconds,
            isVisible: enabled,
          })
        }
      >
        Save
      </Button>
    </div>
  );
}
