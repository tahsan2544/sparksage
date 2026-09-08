// Exam prep mode: turn an exam date + available time into a realistic,
// day-by-day revision schedule grounded in the student's own materials.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { createExamPlan, deleteExamPlan, listExamPlans, type ExamPlan } from "@/lib/exam.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, GraduationCap, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exam")({
  head: () => ({
    meta: [
      { title: "Exam prep — SparkSage revision planner" },
      {
        name: "description",
        content:
          "Enter your exam date, topics and daily study time and SparkSage builds a realistic revision schedule from your own materials and weak areas.",
      },
      { property: "og:title", content: "Exam prep — SparkSage" },
      {
        property: "og:description",
        content: "A realistic countdown plan built from your own study materials and quiz results.",
      },
    ],
  }),
  component: ExamPrep,
});

function daysUntil(date: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

function ExamPrep() {
  const qc = useQueryClient();
  const list = useServerFn(listExamPlans);
  const create = useServerFn(createExamPlan);
  const remove = useServerFn(deleteExamPlan);

  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topics, setTopics] = useState("");
  const [minutes, setMinutes] = useState("60");

  const plans = useQuery({ queryKey: ["exam-plans"], queryFn: () => list() });

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          subject: subject.trim(),
          examDate,
          topics: topics
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          minutesPerDay: Number(minutes) || 60,
        },
      }),
    onSuccess: () => {
      toast.success("Your plan is ready.");
      setSubject("");
      setExamDate("");
      setTopics("");
      qc.invalidateQueries({ queryKey: ["exam-plans"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not build the plan."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-plans"] }),
    onError: () => toast.error("Could not delete that plan."),
  });

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Exam prep</h1>
        <p className="text-sm text-muted-foreground">
          Tell SparkSage when your exam is and how long you can study each day. It builds a countdown plan from your own
          materials and the topics you keep getting wrong.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan a new exam</CardTitle>
          <CardDescription>Nothing is invented — the plan only uses your topics and uploaded materials.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!subject.trim() || !examDate) {
                toast.error("Add a subject and an exam date.");
                return;
              }
              createMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Biology midterm"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-date">Exam date</Label>
              <Input id="exam-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topics">Topics (comma separated)</Label>
              <Input
                id="topics"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder="Cell structure, photosynthesis, genetics"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minutes">Minutes you can study per day</Label>
              <Input
                id="minutes"
                type="number"
                min={15}
                max={480}
                step={15}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Building your plan…
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4" /> Build my plan
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {plans.isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading your plans…
        </p>
      )}
      {plans.isError && <p className="text-sm text-destructive">We couldn't load your plans. Refresh to try again.</p>}
      {plans.data?.length === 0 && !plans.isLoading && (
        <p className="text-sm text-muted-foreground">No exam plans yet — create your first one above.</p>
      )}

      <div className="space-y-5">
        {plans.data?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onDelete={() => deleteMutation.mutate(plan.id)} />
        ))}
      </div>
    </main>
  );
}

function PlanCard({ plan, onDelete }: { plan: ExamPlan; onDelete: () => void }) {
  const left = daysUntil(plan.examDate);
  const total = plan.days.reduce((sum, d) => sum + d.minutes, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{plan.subject}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {plan.examDate}
              </span>
              <Badge variant={left <= 3 ? "destructive" : "secondary"}>
                {left < 0 ? "Past" : left === 0 ? "Today" : `${left} day${left === 1 ? "" : "s"} left`}
              </Badge>
              <span>
                {plan.days.length} session{plan.days.length === 1 ? "" : "s"} · {Math.round(total / 60)} h total
              </span>
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete plan for ${plan.subject}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.notes && <p className="text-sm text-muted-foreground">{plan.notes}</p>}
          <ol className="space-y-2">
            {plan.days.map((day) => (
              <li key={day.date} className="rounded-2xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span>{day.date}</span>
                  <Badge variant="outline">{day.focus}</Badge>
                  <span className="text-muted-foreground font-normal">{day.minutes} min</span>
                </div>
                {day.topics.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{day.topics.join(" · ")}</p>
                )}
                {day.activities.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {day.activities.map((a, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden>•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </motion.div>
  );
}
