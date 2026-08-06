/**
 * Settings — profile, AI personalization, focus-timer defaults and the
 * one-time Owner claim. SparkSage has no plans or billing: everyone gets the
 * same generous access.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getAccountContext, updateProfile, claimOwnership } from "@/lib/access.functions";
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  savePreferences,
  type UserPreferences,
} from "@/lib/preferences.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown, Sparkles, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SparkSage" },
      {
        name: "description",
        content: "Manage your SparkSage profile, personalize how the AI explains things, and set your focus timer.",
      },
      { property: "og:title", content: "Settings — SparkSage" },
      { property: "og:description", content: "Profile, AI personalization and focus timer preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly & conversational" },
  { value: "formal", label: "Formal & professional" },
  { value: "concise", label: "Short & to the point" },
  { value: "encouraging", label: "Encouraging & motivating" },
];

const STYLE_OPTIONS = [
  { value: "simple", label: "Explain it simply (beginner)" },
  { value: "balanced", label: "Balanced (default)" },
  { value: "detailed", label: "Detailed & technical" },
];

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Hindi", "Bengali", "Arabic", "Japanese"];

function SettingsPage() {
  const qc = useQueryClient();
  const accountFn = useServerFn(getAccountContext);
  const saveFn = useServerFn(updateProfile);
  const claimFn = useServerFn(claimOwnership);

  const account = useQuery({ queryKey: ["account"], queryFn: () => accountFn({}) });

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
        <p className="text-muted-foreground">Your profile, how SparkSage AI talks to you, and your focus timer.</p>
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

      <PreferencesCard />

      {acct.role === "owner" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" aria-hidden /> Owner access
            </CardTitle>
            <CardDescription>You manage members and platform settings.</CardDescription>
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
 * Personalize AI + focus-timer defaults. Both live in the same
 * `user_preferences` row, so they save together.
 */
function PreferencesCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPreferences);
  const saveFn = useServerFn(savePreferences);
  const prefs = useQuery({ queryKey: ["preferences"], queryFn: () => getFn({}) });

  const [draft, setDraft] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  useEffect(() => {
    if (prefs.data) setDraft(prefs.data);
  }, [prefs.data]);

  const save = useMutation({
    mutationFn: (value: UserPreferences) => saveFn({ data: value }),
    onSuccess: () => {
      toast.success("Preferences saved — every AI answer will follow them.");
      qc.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const numberField = (
    id: string,
    label: string,
    key: "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "sessionsBeforeLongBreak",
    max: number,
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={max}
        value={draft[key]}
        onChange={(e) => set(key, Math.min(max, Math.max(1, Number(e.target.value) || 1)))}
      />
    </div>
  );

  if (prefs.isLoading) return <Skeleton className="h-96 w-full rounded-3xl" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden /> Personalize AI
          </CardTitle>
          <CardDescription>
            These preferences are applied to every answer: the tutor, summaries, quizzes, flashcards and everything in
            Document Studio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ai-tone">Tone</Label>
              <Select value={draft.aiTone} onValueChange={(v) => set("aiTone", v as UserPreferences["aiTone"])}>
                <SelectTrigger id="ai-tone">
                  <SelectValue placeholder="Choose a tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-style">Explanation style</Label>
              <Select value={draft.aiStyle} onValueChange={(v) => set("aiStyle", v as UserPreferences["aiStyle"])}>
                <SelectTrigger id="ai-style">
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-language">Language</Label>
              <Select value={draft.aiLanguage} onValueChange={(v) => set("aiLanguage", v)}>
                <SelectTrigger id="ai-language">
                  <SelectValue placeholder="Choose a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ai-instructions">Custom instructions</Label>
            <Textarea
              id="ai-instructions"
              rows={4}
              maxLength={1000}
              value={draft.aiInstructions}
              placeholder="e.g. I'm studying for A-level biology. Always use real-world examples and finish with one practice question."
              onChange={(e) => set("aiInstructions", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{draft.aiInstructions.length}/1000 characters</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" aria-hidden /> Focus timer
          </CardTitle>
          <CardDescription>Your default Pomodoro lengths. Sessions are logged to Progress automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {numberField("focus-minutes", "Focus (minutes)", "focusMinutes", 180)}
            {numberField("short-break", "Short break (minutes)", "shortBreakMinutes", 60)}
            {numberField("long-break", "Long break (minutes)", "longBreakMinutes", 120)}
            {numberField("sessions-count", "Sessions before long break", "sessionsBeforeLongBreak", 12)}
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Chime when a session ends</p>
              <p className="text-xs text-muted-foreground">A short soft tone, nothing jarring.</p>
            </div>
            <Switch
              checked={draft.soundEnabled}
              onCheckedChange={(v) => set("soundEnabled", v)}
              aria-label="Play a sound when a session ends"
            />
          </div>
          <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
