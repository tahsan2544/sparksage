// Study Planner: manage upcoming study goals grouped by due date.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { format, isPast, isToday, parseISO } from "date-fns";
import { CalendarDays, Plus, Trash2, Target } from "lucide-react";

import { listGoals, createGoal, toggleGoal, deleteGoal } from "@/lib/study.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({
    meta: [
      { title: "Study planner — StudyMind" },
      { name: "description", content: "Plan study goals, deadlines, and revision schedule." },
    ],
  }),
  component: PlannerPage,
});

type Goal = {
  id: string;
  title: string;
  subject: string | null;
  due_date: string;
  completed: boolean;
};

function PlannerPage() {
  const list = useServerFn(listGoals);
  const { data, isLoading, error } = useQuery({
    queryKey: ["study-goals"],
    queryFn: () => list(),
  });

  const goals = (data ?? []) as Goal[];
  const overdue = goals.filter((g) => !g.completed && isPast(parseISO(g.due_date)) && !isToday(parseISO(g.due_date)));
  const today = goals.filter((g) => !g.completed && isToday(parseISO(g.due_date)));
  const upcoming = goals.filter((g) => !g.completed && !isPast(parseISO(g.due_date)) && !isToday(parseISO(g.due_date)));
  const done = goals.filter((g) => g.completed);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Study planner</h1>
          <p className="text-sm text-muted-foreground">Set study goals and hit your deadlines.</p>
        </div>
        <NewGoalDialog />
      </div>

      {isLoading && <div className="h-32 rounded-xl border border-border bg-muted/40 animate-pulse" aria-hidden />}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load goals: {error instanceof Error ? error.message : "unknown error"}
        </div>
      )}

      {!isLoading && !error && goals.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Target className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden />
          <h2 className="font-semibold text-lg">No goals yet</h2>
          <p className="text-sm text-muted-foreground mt-1">Add your first study goal to get started.</p>
          <div className="mt-4 flex justify-center">
            <NewGoalDialog />
          </div>
        </div>
      )}

      {!isLoading && goals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <GoalGroup title="Overdue" tone="destructive" goals={overdue} />
          <GoalGroup title="Due today" tone="primary" goals={today} />
          <GoalGroup title="Upcoming" tone="muted" goals={upcoming} />
          <GoalGroup title="Completed" tone="muted" goals={done} />
        </div>
      )}
    </div>
  );
}

function GoalGroup({
  title,
  tone,
  goals,
}: {
  title: string;
  tone: "destructive" | "primary" | "muted";
  goals: Goal[];
}) {
  if (goals.length === 0) return null;
  const badge =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "primary"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <span className={`text-xs rounded-full px-2 py-0.5 ${badge}`}>{goals.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {goals.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </CardContent>
    </Card>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const qc = useQueryClient();
  const toggle = useServerFn(toggleGoal);
  const del = useServerFn(deleteGoal);
  const [busy, setBusy] = useState(false);

  async function onToggle(next: boolean) {
    setBusy(true);
    try {
      await toggle({ data: { id: goal.id, completed: next } });
      qc.invalidateQueries({ queryKey: ["study-goals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await del({ data: { id: goal.id } });
      toast.success("Goal deleted");
      qc.invalidateQueries({ queryKey: ["study-goals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <Checkbox
        checked={goal.completed}
        onCheckedChange={(v) => onToggle(Boolean(v))}
        disabled={busy}
        aria-label={`Mark ${goal.title} ${goal.completed ? "incomplete" : "complete"}`}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${goal.completed ? "line-through text-muted-foreground" : ""}`}>
          {goal.title}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
          <CalendarDays className="h-3 w-3" aria-hidden />
          <span>{format(parseISO(goal.due_date), "EEE, MMM d, yyyy")}</span>
          {goal.subject && <span>· {goal.subject}</span>}
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onDelete} disabled={busy} aria-label={`Delete ${goal.title}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NewGoalDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const create = useServerFn(createGoal);
  const qc = useQueryClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setLoading(true);
    try {
      await create({ data: { title: title.trim(), subject: subject.trim() || null, due_date: dueDate } });
      toast.success("Goal added");
      qc.invalidateQueries({ queryKey: ["study-goals"] });
      setOpen(false);
      setTitle("");
      setSubject("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add goal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a study goal</DialogTitle>
          <DialogDescription>Set what you want to study and when it's due.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Finish Chapter 3 problem set"
              maxLength={200}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-subject">Subject (optional)</Label>
              <Input
                id="goal-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Biology"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-due">Due date</Label>
              <Input
                id="goal-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Add goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
