// Adaptive review: a short mixed quiz built from the concepts the student
// keeps getting wrong, across all of their documents.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { buildReviewSession, type ReviewQuestion, type ReviewSession } from "@/lib/review.functions";
import { recordQuizAttempt } from "@/lib/performance.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Check, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({
    meta: [
      { title: "Daily review — SparkSage" },
      {
        name: "description",
        content:
          "A short adaptive review session built from the concepts you keep getting wrong, drawn from your own documents.",
      },
      { property: "og:title", content: "Daily review — SparkSage" },
      {
        property: "og:description",
        content: "Practise your weakest concepts with a quick mixed quiz generated from your study material.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

type Graded = { question: ReviewQuestion; chosen: number };

function ReviewPage() {
  const build = useServerFn(buildReviewSession);
  const record = useServerFn(recordQuizAttempt);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [graded, setGraded] = useState<Graded[]>([]);
  const [startedAt, setStartedAt] = useState(0);

  async function start() {
    setLoading(true);
    try {
      const s = await build({ data: { count: 6 } });
      setSession(s);
      setIndex(0);
      setChosen(null);
      setGraded([]);
      setStartedAt(Date.now());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build a review session.");
    } finally {
      setLoading(false);
    }
  }

  async function finish(all: Graded[]) {
    // Save results per document so weak areas stay attached to their material.
    const byDoc = new Map<string, Graded[]>();
    for (const g of all) {
      const list = byDoc.get(g.question.documentId) ?? [];
      list.push(g);
      byDoc.set(g.question.documentId, list);
    }
    const duration = Math.round((Date.now() - startedAt) / 1000);
    try {
      for (const [documentId, items] of byDoc) {
        await record({
          data: {
            documentId,
            total: items.length,
            correct: items.filter((i) => i.chosen === i.question.answerIndex).length,
            durationSeconds: duration,
            results: items.map((i) => ({
              topic: i.question.topic,
              correct: i.chosen === i.question.answerIndex,
            })),
          },
        });
      }
    } catch {
      /* the review still counts for the student even if saving fails */
    }
  }

  function next() {
    if (chosen === null || !session) return;
    const all = [...graded, { question: session.questions[index]!, chosen }];
    setGraded(all);
    setChosen(null);
    if (index + 1 >= session.questions.length) {
      void finish(all);
      setIndex(index + 1);
    } else {
      setIndex(index + 1);
    }
  }

  const done = session && index >= session.questions.length;
  const current = session && !done ? session.questions[index]! : null;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Daily review</h1>
        <p className="text-sm text-muted-foreground">
          A quick mixed session built from the ideas you have been getting wrong.
        </p>
      </header>

      {!session && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" aria-hidden /> Ready when you are
            </CardTitle>
            <CardDescription>
              Six questions, pulled from your own documents and weighted towards your weak spots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={start} disabled={loading}>
              {loading ? "Building your review…" : "Start review"}
            </Button>
          </CardContent>
        </Card>
      )}

      {session && !done && current && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardDescription>
                Question {index + 1} of {session.questions.length}
              </CardDescription>
              <Badge variant="secondary">{current.documentTitle}</Badge>
            </div>
            <Progress value={((index + 1) / session.questions.length) * 100} className="mt-2 h-1.5" />
            <CardTitle className="pt-3 text-base leading-relaxed">{current.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {current.choices.map((choice, i) => {
              const picked = chosen === i;
              const reveal = chosen !== null;
              const isAnswer = i === current.answerIndex;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => chosen === null && setChosen(i)}
                  aria-pressed={picked}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left text-sm transition-colors ${
                    reveal && isAnswer
                      ? "border-primary bg-primary/10"
                      : picked
                        ? "border-destructive bg-destructive/10"
                        : "border-border hover:bg-muted/60"
                  }`}
                >
                  {reveal && isAnswer && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                  {reveal && picked && !isAnswer && (
                    <X className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  <span>{choice}</span>
                </button>
              );
            })}

            {chosen !== null && (
              <div className="rounded-2xl bg-muted/60 p-3 text-sm">
                <p className="font-medium">
                  {chosen === current.answerIndex ? "Correct" : "Not quite"} — {current.topic}
                </p>
                <p className="mt-1 text-muted-foreground">{current.explanation}</p>
              </div>
            )}

            <div className="pt-2">
              <Button onClick={next} disabled={chosen === null}>
                {index + 1 >= session.questions.length ? "Finish review" : "Next question"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {session && done && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review complete</CardTitle>
            <CardDescription>
              You got {graded.filter((g) => g.chosen === g.question.answerIndex).length} of {graded.length} right.
              Your weak areas have been updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm">
              {graded.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  {g.chosen === g.question.answerIndex ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  <span>
                    <span className="font-medium">{g.question.topic}</span>{" "}
                    <span className="text-muted-foreground">— {g.question.documentTitle}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Button onClick={start} disabled={loading} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              {loading ? "Building…" : "Another round"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
