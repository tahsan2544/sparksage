// Document detail: overview + AI summary/quiz/flashcards tabs, plus chat-thread list.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getDocument,
  getSummary,
  generateSummary,
  getLatestQuiz,
  generateQuiz,
  getLatestDeck,
  generateFlashcards,
  listThreads,
  createThread,
  deleteThread,
  type QuizQuestion,
  type Flashcard,
} from "@/lib/documents.functions";
import { logSession } from "@/lib/study.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, MessageSquare, Plus, Trash2, ChevronLeft, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/documents/$documentId/")({
  head: ({ params }) => ({
    meta: [
      { title: "Document — StudyMind" },
      { name: "description", content: `Study workspace for document ${params.documentId}.` },
    ],
  }),
  component: DocumentPage,
});

function DocumentPage() {
  const { documentId } = Route.useParams();
  const getDoc = useServerFn(getDocument);
  const { data: doc, isLoading, error } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDoc({ data: { id: documentId } }),
  });

  if (isLoading) {
    return <div className="h-40 rounded-xl bg-muted animate-pulse" aria-hidden />;
  }
  if (error || !doc) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load: {error instanceof Error ? error.message : "not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> All documents
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-2 break-words">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">
          {doc.content.length.toLocaleString()} characters · added {formatDistanceToNow(new Date(doc.created_at))} ago
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Tabs defaultValue="summary" className="min-w-0">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="quiz">Quiz</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="mt-4">
            <SummaryPanel documentId={documentId} />
          </TabsContent>
          <TabsContent value="quiz" className="mt-4">
            <QuizPanel documentId={documentId} />
          </TabsContent>
          <TabsContent value="flashcards" className="mt-4">
            <FlashcardsPanel documentId={documentId} />
          </TabsContent>
          <TabsContent value="content" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Original text</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 max-h-[60vh] overflow-auto">
                  {doc.content}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ThreadsSidebar documentId={documentId} />
      </div>
    </div>
  );
}

// ---------- Summary ----------

function SummaryPanel({ documentId }: { documentId: string }) {
  const getFn = useServerFn(getSummary);
  const genFn = useServerFn(generateSummary);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["summary", documentId],
    queryFn: () => getFn({ data: { documentId } }),
  });

  async function generate() {
    setBusy(true);
    try {
      await genFn({ data: { documentId } });
      qc.invalidateQueries({ queryKey: ["summary", documentId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Summary</CardTitle>
        <Button size="sm" onClick={generate} disabled={busy}>
          {data ? <RefreshCw className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {busy ? "Generating…" : data ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="h-24 rounded bg-muted animate-pulse" aria-hidden />}
        {!isLoading && !data && (
          <p className="text-sm text-muted-foreground">No summary yet. Click Generate to create one.</p>
        )}
        {data && (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">
            {data.content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Quiz ----------

function QuizPanel({ documentId }: { documentId: string }) {
  const getFn = useServerFn(getLatestQuiz);
  const genFn = useServerFn(generateQuiz);
  const logFn = useServerFn(logSession);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quiz", documentId],
    queryFn: () => getFn({ data: { documentId } }),
  });

  async function generate() {
    setBusy(true);
    setAnswers({});
    setRevealed(false);
    setStartedAt(Date.now());
    try {
      await genFn({ data: { documentId, count: 6 } });
      qc.invalidateQueries({ queryKey: ["quiz", documentId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  const questions = (data?.questions as QuizQuestion[] | undefined) ?? [];
  const answered = Object.keys(answers).length;
  const score = revealed
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0)
    : 0;
  const progressPct = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  async function submit() {
    setRevealed(true);
    const elapsed = startedAt ? Math.max(30, Math.round((Date.now() - startedAt) / 1000)) : questions.length * 30;
    const correct = questions.reduce((acc, q, i) => acc + (answers[i] === q.answerIndex ? 1 : 0), 0);
    try {
      await logFn({
        data: {
          duration_seconds: Math.min(elapsed, 30 * 60),
          document_id: documentId,
          note: `Quiz: ${correct}/${questions.length}`,
        },
      });
      qc.invalidateQueries({ queryKey: ["progress"] });
    } catch {
      // silent — quiz feedback still works even if logging fails
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Quiz</CardTitle>
        <Button size="sm" onClick={generate} disabled={busy}>
          {data ? <RefreshCw className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {busy ? "Generating…" : data ? "New quiz" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div className="h-24 rounded bg-muted animate-pulse" aria-hidden />}
        {!isLoading && !data && (
          <p className="text-sm text-muted-foreground">No quiz yet. Click Generate for questions.</p>
        )}
        {questions.length > 0 && !revealed && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-[image:var(--gradient-primary)] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {answered}/{questions.length}
            </span>
          </div>
        )}
        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-border p-4">
            <p className="font-medium text-sm">
              {i + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.choices.map((c, j) => {
                const chosen = answers[i] === j;
                const correct = revealed && j === q.answerIndex;
                const wrong = revealed && chosen && j !== q.answerIndex;
                return (
                  <label
                    key={j}
                    className={`flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer transition-colors ${
                      correct
                        ? "border-primary bg-primary/10"
                        : wrong
                          ? "border-destructive bg-destructive/10"
                          : chosen
                            ? "border-primary/60 bg-muted"
                            : "border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${i}`}
                      className="mt-1"
                      checked={chosen}
                      disabled={revealed}
                      onChange={() => setAnswers((a) => ({ ...a, [i]: j }))}
                    />
                    <span>{c}</span>
                  </label>
                );
              })}
            </div>
            {revealed && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold text-foreground">Why:</span> {q.explanation}
              </p>
            )}
          </div>
        ))}
        {questions.length > 0 && (
          <div className="flex items-center justify-between gap-3">
            {!revealed ? (
              <Button onClick={submit} disabled={answered !== questions.length}>
                Check answers
              </Button>
            ) : (
              <>
                <div className="text-sm">
                  Score:{" "}
                  <span className="font-semibold text-foreground">
                    {score} / {questions.length}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    ({Math.round((score / questions.length) * 100)}%) · logged to your progress
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnswers({});
                    setRevealed(false);
                    setStartedAt(Date.now());
                  }}
                >
                  Try again
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ---------- Flashcards ----------

function FlashcardsPanel({ documentId }: { documentId: string }) {
  const getFn = useServerFn(getLatestDeck);
  const genFn = useServerFn(generateFlashcards);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["deck", documentId],
    queryFn: () => getFn({ data: { documentId } }),
  });

  const cards = (data?.cards as Flashcard[] | undefined) ?? [];
  const card = cards[idx];

  async function generate() {
    setBusy(true);
    setIdx(0);
    setFlipped(false);
    try {
      await genFn({ data: { documentId, count: 10 } });
      qc.invalidateQueries({ queryKey: ["deck", documentId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Flashcards</CardTitle>
        <Button size="sm" onClick={generate} disabled={busy}>
          {data ? <RefreshCw className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {busy ? "Generating…" : data ? "New deck" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div className="h-40 rounded bg-muted animate-pulse" aria-hidden />}
        {!isLoading && !data && (
          <p className="text-sm text-muted-foreground">No flashcards yet. Click Generate to build a deck.</p>
        )}
        {card && (
          <>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="w-full min-h-56 rounded-xl border-2 border-border bg-card p-6 text-left transition-colors hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={flipped ? "Show front" : "Show back"}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                {flipped ? "Answer" : "Question"} · Card {idx + 1} of {cards.length}
              </p>
              <p className="text-lg font-medium whitespace-pre-wrap">{flipped ? card.back : card.front}</p>
              <p className="text-xs text-muted-foreground mt-4">Tap to flip</p>
            </button>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIdx((i) => (i - 1 + cards.length) % cards.length);
                  setFlipped(false);
                }}
              >
                Previous
              </Button>
              <Button
                onClick={() => {
                  setIdx((i) => (i + 1) % cards.length);
                  setFlipped(false);
                }}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Chat threads sidebar ----------

function ThreadsSidebar({ documentId }: { documentId: string }) {
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const delFn = useServerFn(deleteThread);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["threads", documentId],
    queryFn: () => listFn({ data: { documentId } }),
  });

  async function newThread() {
    setCreating(true);
    try {
      const { id } = await createFn({ data: { documentId } });
      qc.invalidateQueries({ queryKey: ["threads", documentId] });
      navigate({ to: "/documents/$documentId/chat/$threadId", params: { documentId, threadId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create thread");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["threads", documentId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <aside className="min-w-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Chats
          </CardTitle>
          <Button size="sm" onClick={newThread} disabled={creating} aria-label="New chat">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {isLoading && <div className="h-8 rounded bg-muted animate-pulse" aria-hidden />}
          {!isLoading && data && data.length === 0 && (
            <p className="text-sm text-muted-foreground">Start a chat to ask questions about this document.</p>
          )}
          {data?.map((t) => (
            <div key={t.id} className="flex items-center gap-1 group">
              <Link
                to="/documents/$documentId/chat/$threadId"
                params={{ documentId, threadId: t.id }}
                className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-sm hover:bg-muted truncate"
              >
                {t.title}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={() => remove(t.id)}
                aria-label={`Delete ${t.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </aside>
  );
}
