// Public, free study schedule generator. Runs fully in the browser (no sign-in);
// signed-in students can then build the plan from their own materials in Exam prep.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Printer, Sparkles } from "lucide-react";

const TITLE = "Free Study Schedule Generator — exam revision plan in seconds | SparkSage";
const DESC =
  "Free study schedule generator: enter your exam date, topics and daily study time to get a day-by-day revision plan with spaced review and practice tests.";

export const Route = createFileRoute("/study-schedule-generator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: "Free Study Schedule Generator — SparkSage" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://sparksage.lovable.app/study-schedule-generator" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://sparksage.lovable.app/study-schedule-generator" }],
  }),
  component: GeneratorPage,
});

type Block = { label: string; minutes: number; type: "learn" | "review" | "practice" | "rest" };
type Day = { date: Date; blocks: Block[] };

/** Learn each topic once, revisit it 1, 3 and 7 days later, finish with mock tests. */
export function buildSchedule(examDate: string, topics: string[], minutes: number): Day[] {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(`${examDate}T00:00:00`);
  const total = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (!topics.length || total < 1 || minutes < 10) return [];
  const days: Day[] = Array.from({ length: Math.min(total, 120) }, (_, i) => ({ date: new Date(start.getTime() + i * 86_400_000), blocks: [] }));
  const practiceDays = Math.max(1, Math.min(3, Math.floor(days.length / 5)));
  const learnSpan = Math.max(1, days.length - practiceDays);
  const reviews: Record<number, string[]> = {};
  topics.forEach((t, i) => {
    const d = Math.floor((i * learnSpan) / topics.length);
    days[d].blocks.push({ label: `Learn: ${t}`, minutes: 0, type: "learn" });
    for (const gap of [1, 3, 7]) if (d + gap < learnSpan) (reviews[d + gap] ??= []).push(t);
  });
  days.forEach((day, i) => {
    if (i >= learnSpan) day.blocks.push({ label: i === days.length - 1 ? "Light review + rest before the exam" : "Timed practice test on all topics", minutes: 0, type: i === days.length - 1 ? "rest" : "practice" });
    for (const t of reviews[i] ?? []) day.blocks.push({ label: `Review: ${t}`, minutes: 0, type: "review" });
    if (!day.blocks.length) day.blocks.push({ label: `Mixed recall quiz: ${topics[i % topics.length]}`, minutes: 0, type: "practice" });
    const weight = (b: Block) => (b.type === "learn" ? 3 : b.type === "review" ? 1 : 2);
    const sum = day.blocks.reduce((a, b) => a + weight(b), 0);
    day.blocks.forEach((b) => (b.minutes = Math.max(5, Math.round(((minutes * weight(b)) / sum) / 5) * 5)));
  });
  return days;
}

const tone: Record<Block["type"], string> = { learn: "default", review: "secondary", practice: "outline", rest: "outline" };

function GeneratorPage() {
  const reduce = useReducedMotion();
  const inTwoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const [exam, setExam] = useState(inTwoWeeks);
  const [topicsText, setTopicsText] = useState("Cell structure\nMembranes\nRespiration\nPhotosynthesis\nGenetics");
  const [minutes, setMinutes] = useState(60);
  const [submitted, setSubmitted] = useState({ exam, topicsText, minutes });
  const topics = submitted.topicsText.split(/[\n,]/).map((t) => t.trim()).filter(Boolean).slice(0, 40);
  const plan = useMemo(() => buildSchedule(submitted.exam, topics, submitted.minutes), [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
      <nav className="flex items-center justify-between">
        <Link to="/" className="font-bold text-lg">SparkSage</Link>
        <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
      </nav>
      <header className="text-center space-y-3">
        <Badge variant="secondary"><Sparkles className="h-3 w-3" /> 100% free · no sign-up</Badge>
        <h1 className="text-4xl sm:text-5xl font-bold text-gradient-animated">Free study schedule generator</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">Enter your exam date, the topics you need to cover and how long you can study each day. Get a day-by-day plan with spaced review and practice tests.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Your exam</CardTitle><CardDescription>One topic per line (or separated by commas).</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setSubmitted({ exam, topicsText, minutes }); }}>
            <div><Label htmlFor="g-date">Exam date</Label><Input id="g-date" type="date" required min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} value={exam} onChange={(e) => setExam(e.target.value)} /></div>
            <div><Label htmlFor="g-min">Minutes per day</Label><Input id="g-min" type="number" min={10} max={600} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></div>
            <div className="sm:col-span-2"><Label htmlFor="g-topics">Topics</Label><Textarea id="g-topics" rows={5} value={topicsText} onChange={(e) => setTopicsText(e.target.value)} /></div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="submit"><CalendarClock className="h-4 w-4" /> Generate my schedule</Button>
              {plan.length > 0 && <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      {plan.length === 0 ? (
        <p className="text-center text-muted-foreground">Pick a future exam date, at least one topic and 10+ minutes a day.</p>
      ) : (
        <section aria-labelledby="plan-h" className="space-y-3">
          <h2 id="plan-h" className="text-2xl font-semibold">{plan.length}-day plan · {topics.length} topics</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.map((d, i) => (
              <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 20) * 0.03 }}>
                <Card className="h-full"><CardContent className="p-4 space-y-2">
                  <p className="font-medium">Day {i + 1} · {d.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                  <ul className="space-y-1">
                    {d.blocks.map((b, j) => (
                      <li key={j} className="flex items-center justify-between gap-2 text-sm">
                        <span>{b.label}</span><Badge variant={tone[b.type] as never}>{b.minutes}m</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent></Card>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <Card className="glow-border">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Build it from your own materials</h2>
            <p className="text-muted-foreground">Sign in to plan from your textbooks, lecture notes and weak quiz topics — with the AI tutor ready for every session.</p>
          </div>
          <Button asChild size="lg"><Link to="/auth">Start free</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
