/**
 * Announcements: compose banners, popups, notifications, dashboard cards or
 * email campaigns, target an audience, schedule them and preview before
 * publishing.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2, Pencil } from "lucide-react";

import {
  listAnnouncements,
  saveAnnouncement,
  deleteAnnouncement,
  type AnnouncementRow,
} from "@/lib/owner.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/owner/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — SparkSage" },
      { name: "description", content: "Write, schedule and publish announcements for your students." },
      { property: "og:title", content: "Announcements — SparkSage" },
      { property: "og:description", content: "Reach students with banners, popups and campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnnouncementsPage,
});

const TYPES = [
  { value: "banner", label: "Banner" },
  { value: "popup", label: "Popup" },
  { value: "notification", label: "Notification" },
  { value: "dashboard_card", label: "Dashboard card" },
  { value: "email", label: "Email campaign" },
];
const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "free", label: "Free students" },
  { value: "pro", label: "Pro students" },
];
const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

interface Draft {
  id?: string;
  title: string;
  subtitle: string;
  message: string;
  buttonText: string;
  buttonUrl: string;
  type: string;
  priority: string;
  audience: string;
  isPublished: boolean;
  publishAt: string;
  expiresAt: string;
}

const toLocalInput = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

const emptyDraft = (): Draft => ({
  title: "",
  subtitle: "",
  message: "",
  buttonText: "",
  buttonUrl: "",
  type: "banner",
  priority: "normal",
  audience: "everyone",
  isPublished: false,
  publishAt: new Date().toISOString().slice(0, 16),
  expiresAt: "",
});

function AnnouncementsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAnnouncements);
  const saveFn = useServerFn(saveAnnouncement);
  const deleteFn = useServerFn(deleteAnnouncement);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const list = useQuery({ queryKey: ["owner-announcements"], queryFn: () => listFn() });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveFn({
        data: {
          ...(d.id ? { id: d.id } : {}),
          title: d.title,
          subtitle: d.subtitle || null,
          message: d.message,
          buttonText: d.buttonText || null,
          buttonUrl: d.buttonUrl || null,
          type: d.type as "banner",
          priority: d.priority as "normal",
          audience: d.audience as "everyone",
          isPublished: d.isPublished,
          publishAt: new Date(d.publishAt).toISOString(),
          expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
        },
      }),
    onSuccess: () => {
      toast.success("Announcement saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["owner-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Announcement deleted");
      qc.invalidateQueries({ queryKey: ["owner-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function edit(row: AnnouncementRow) {
    setDraft({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? "",
      message: row.message,
      buttonText: row.button_text ?? "",
      buttonUrl: row.button_url ?? "",
      type: row.type,
      priority: row.priority,
      audience: row.audience,
      isPublished: row.is_published,
      publishAt: toLocalInput(row.publish_at),
      expiresAt: toLocalInput(row.expires_at),
    });
    setOpen(true);
  }

  const valid = draft.title.trim().length > 0 && draft.message.trim().length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">Share news, tips and offers with your students.</p>
        </div>
        <Button
          onClick={() => {
            setDraft(emptyDraft());
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          New announcement
        </Button>
      </header>

      {list.isLoading && <Skeleton className="h-64 w-full rounded-3xl" />}

      {list.isError && (
        <Card>
          <CardHeader>
            <CardTitle>Couldn't load announcements</CardTitle>
            <CardDescription>Please try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => list.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {list.data?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-accent/30 text-accent-foreground">
              <Megaphone className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="font-medium">No announcements yet</p>
              <p className="text-sm text-muted-foreground">
                Write your first one — students will see it right away.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {(list.data ?? []).map((row) => (
          <Card key={row.id}>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {row.title}
                  <Badge variant={row.is_published ? "default" : "secondary"}>
                    {row.is_published ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {row.type.replace("_", " ")}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {row.audience}
                  </Badge>
                </CardTitle>
                <CardDescription>{row.subtitle || row.message.slice(0, 120)}</CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="icon" aria-label={`Edit ${row.title}`} onClick={() => edit(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${row.title}`}
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>Preview it below before you publish.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" id="a-title" className="sm:col-span-2">
              <Input
                id="a-title"
                value={draft.title}
                maxLength={120}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Subtitle" id="a-subtitle" className="sm:col-span-2">
              <Input
                id="a-subtitle"
                value={draft.subtitle}
                maxLength={160}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
              />
            </Field>
            <Field label="Message" id="a-message" className="sm:col-span-2">
              <Textarea
                id="a-message"
                rows={4}
                maxLength={4000}
                value={draft.message}
                onChange={(e) => setDraft({ ...draft, message: e.target.value })}
              />
            </Field>
            <Field label="Button text" id="a-btn">
              <Input
                id="a-btn"
                value={draft.buttonText}
                maxLength={40}
                onChange={(e) => setDraft({ ...draft, buttonText: e.target.value })}
              />
            </Field>
            <Field label="Button URL" id="a-url">
              <Input
                id="a-url"
                value={draft.buttonUrl}
                maxLength={500}
                placeholder="/pricing"
                onChange={(e) => setDraft({ ...draft, buttonUrl: e.target.value })}
              />
            </Field>

            <PickField
              label="Type"
              value={draft.type}
              options={TYPES}
              onChange={(v) => setDraft({ ...draft, type: v })}
            />
            <PickField
              label="Audience"
              value={draft.audience}
              options={AUDIENCES}
              onChange={(v) => setDraft({ ...draft, audience: v })}
            />
            <PickField
              label="Priority"
              value={draft.priority}
              options={PRIORITIES}
              onChange={(v) => setDraft({ ...draft, priority: v })}
            />

            <Field label="Publish at" id="a-publish">
              <Input
                id="a-publish"
                type="datetime-local"
                value={draft.publishAt}
                onChange={(e) => setDraft({ ...draft, publishAt: e.target.value })}
              />
            </Field>
            <Field label="Expires at (optional)" id="a-expires">
              <Input
                id="a-expires"
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
              />
            </Field>

            <div className="flex items-center gap-3 rounded-2xl border border-border p-3 sm:col-span-2">
              <Switch
                id="a-published"
                checked={draft.isPublished}
                onCheckedChange={(checked) => setDraft({ ...draft, isPublished: checked })}
              />
              <Label htmlFor="a-published">Published (visible to the selected audience)</Label>
            </div>

            <div className="rounded-3xl border border-border bg-muted/40 p-4 sm:col-span-2">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
              <div className="rounded-2xl bg-accent/30 p-4">
                <p className="font-medium">{draft.title || "Your title"}</p>
                {draft.subtitle && <p className="text-sm text-muted-foreground">{draft.subtitle}</p>}
                <p className="mt-1 text-sm">{draft.message || "Your message shows up here."}</p>
                {draft.buttonText && (
                  <Button size="sm" className="mt-3">
                    {draft.buttonText}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!valid || save.isPending} onClick={() => save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  className,
  children,
}: {
  label: string;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
