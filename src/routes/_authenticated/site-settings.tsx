// Owner-only global settings editor. Every value is stored in `app_settings`,
// so branding, limits and toggles are configurable without a deploy.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";

import { listSettings, updateSettings, type SettingRow } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/site-settings")({
  head: () => ({
    meta: [
      { title: "Site settings — SparkSage" },
      { name: "description", content: "Owner-only configuration for branding, uploads, auth and AI." },
    ],
  }),
  beforeLoad: async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw redirect({ to: "/auth" });
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: user.user.id,
      _role: "owner",
    });
    if (!isOwner) throw redirect({ to: "/dashboard" });
  },
  component: SiteSettingsPage,
});

const GROUP_LABELS: Record<string, string> = {
  branding: "Branding",
  general: "General",
  auth: "Authentication",
  uploads: "Uploads & OCR",
  ai: "AI",
  contact: "Contact & legal",
};

function SiteSettingsPage() {
  const listFn = useServerFn(listSettings);
  const saveFn = useServerFn(updateSettings);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ["app-settings"], queryFn: () => listFn() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Seed the editable draft once the rows arrive.
  useEffect(() => {
    if (!data) return;
    setDraft(Object.fromEntries(data.map((r) => [r.key, r.value ?? ""])));
  }, [data]);

  const rows = (data ?? []) as SettingRow[];
  const groups = Array.from(new Set(rows.map((r) => r.group_name)));
  const dirty = rows.filter((r) => (draft[r.key] ?? "") !== (r.value ?? ""));

  async function onSave() {
    if (dirty.length === 0) return;
    setSaving(true);
    try {
      await saveFn({ data: { updates: dirty.map((r) => ({ key: r.key, value: draft[r.key] ?? "" })) } });
      toast.success(`Saved ${dirty.length} setting${dirty.length === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["app-settings"] });
      qc.invalidateQueries({ queryKey: ["site-data"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site settings</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide configuration. Changes apply everywhere immediately.
          </p>
        </div>
        <Button onClick={onSave} disabled={saving || dirty.length === 0}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving…" : dirty.length > 0 ? `Save ${dirty.length} change${dirty.length === 1 ? "" : "s"}` : "Saved"}
        </Button>
      </div>

      {isLoading && <div className="h-40 rounded-2xl bg-muted/40 animate-pulse" aria-hidden />}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load settings: {error instanceof Error ? error.message : "unknown error"}
        </div>
      )}

      {!isLoading &&
        groups.map((group) => (
          <Card key={group}>
            <CardHeader>
              <CardTitle className="text-base">{GROUP_LABELS[group] ?? group}</CardTitle>
              <CardDescription>{rows.filter((r) => r.group_name === group).length} settings</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {rows
                .filter((r) => r.group_name === group)
                .map((row) => (
                  <SettingField
                    key={row.key}
                    row={row}
                    value={draft[row.key] ?? ""}
                    onChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))}
                  />
                ))}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

function SettingField({
  row,
  value,
  onChange,
}: {
  row: SettingRow;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `setting-${row.key}`;

  if (row.value_type === "boolean") {
    return (
      <div className="flex items-start justify-between gap-3 rounded-xl border border-border p-3 sm:col-span-2">
        <div className="min-w-0">
          <Label htmlFor={id} className="font-medium">
            {row.label}
          </Label>
          {row.description && <p className="text-xs text-muted-foreground mt-1">{row.description}</p>}
        </div>
        <Switch
          id={id}
          checked={value === "true"}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{row.label}</Label>
      {row.value_type === "textarea" ? (
        <Textarea id={id} value={value} rows={3} maxLength={5000} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          id={id}
          type={row.value_type === "number" ? "number" : "text"}
          value={value}
          maxLength={500}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
    </div>
  );
}
