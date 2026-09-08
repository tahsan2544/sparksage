// Chat thread page. One URL per thread so back/forward and refresh work.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  getDocument,
  listMessages,
  sendMessage,
  listThreads,
  createThread,
  deleteThread,
} from "@/lib/documents.functions";
import { Typewriter } from "@/components/typewriter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, MessageSquare, Plus, Send, Trash2, BookOpen, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documents/$documentId/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Chat — SparkSage" },
      { name: "description", content: "Chat about your document with AI." },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { documentId, threadId } = Route.useParams();
  const getDoc = useServerFn(getDocument);
  const listMsg = useServerFn(listMessages);
  const send = useServerFn(sendMessage);
  const qc = useQueryClient();

  const { data: doc } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDoc({ data: { id: documentId } }),
  });
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listMsg({ data: { threadId } }),
  });

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  /** Teach-Me mode: the tutor guides with questions instead of giving answers. */
  const [teachMe, setTeachMe] = useState(false);
  /** Excerpts backing the most recent answer, so claims can be verified. */
  const [sources, setSources] = useState<Array<{ index: number; excerpt: string }>>([]);
  // Only the answer that just arrived types itself out; history renders instantly.
  const [lastAnswerId, setLastAnswerId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    // Optimistic user message
    qc.setQueryData<typeof messages>(["messages", threadId], (prev) => [
      ...(prev ?? []),
      { id: `tmp-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() },
    ]);
    try {
      const res = await send({ data: { threadId, content: text, mode: teachMe ? "socratic" : "answer" } });
      setSources(res.sources ?? []);
      setLastAnswerId(res.assistantMessage?.id ?? null);
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
      qc.invalidateQueries({ queryKey: ["threads", documentId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
      // Roll back optimistic message
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] min-h-[calc(100vh-8rem)]">
      <ThreadList documentId={documentId} activeId={threadId} />

      <div className="flex flex-col min-w-0">
        <div className="mb-3">
          <Link
            to="/documents/$documentId"
            params={{ documentId }}
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Back to {doc?.title ?? "document"}
          </Link>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading && <div className="h-16 rounded bg-muted animate-pulse" aria-hidden />}
              {error && (
                <p className="text-sm text-destructive">
                  Failed to load messages: {error instanceof Error ? error.message : "unknown"}
                </p>
              )}
              {!isLoading && messages && messages.length === 0 && !busy && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  Ask anything about “{doc?.title ?? "this document"}”.
                </div>
              )}
              {messages?.map((m, i) => (
                <div key={m.id} className="space-y-2">
                  <MessageBubble
                    role={m.role}
                    content={m.content}
                    animate={m.role === "assistant" && i === messages.length - 1 && m.id === lastAnswerId}
                    onTick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })}
                  />
                  {m.role === "assistant" && i === messages.length - 1 && sources.length > 0 && (
                    <SourceList sources={sources} />
                  )}
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border px-3 pt-3">
              <button
                type="button"
                onClick={() => setTeachMe((v) => !v)}
                aria-pressed={teachMe}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  teachMe
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent/50"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                Teach-me mode {teachMe ? "on" : "off"}
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {teachMe
                  ? "The tutor will guide you with questions instead of handing over the answer."
                  : "Answers are drawn only from this document, with the exact excerpts shown."}
              </p>
            </div>

            <form onSubmit={onSend} className="p-3 flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder="Ask about the document…"
                rows={2}
                maxLength={4000}
                className="resize-none"
                aria-label="Message"
              />
              <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send message">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  animate = false,
  onTick,
}: {
  role: string;
  content: string;
  animate?: boolean;
  onTick?: () => void;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {isUser ? content : <Typewriter text={content} animate={animate} onTick={onTick} />}
      </div>
    </div>
  );
}

/** The document excerpts an answer was built from. */
function SourceList({ sources }: { sources: Array<{ index: number; excerpt: string }> }) {
  return (
    <div className="max-w-[85%] rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" aria-hidden /> Sources from this document
      </div>
      <ul className="mt-2 space-y-2">
        {sources.map((s) => (
          <li key={s.index} className="text-xs text-muted-foreground">
            <span className="mr-1 font-semibold text-primary">[{s.index}]</span>
            {s.excerpt}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThreadList({ documentId, activeId }: { documentId: string; activeId: string }) {
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const delFn = useServerFn(deleteThread);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data } = useQuery({
    queryKey: ["threads", documentId],
    queryFn: () => listFn({ data: { documentId } }),
  });

  async function add() {
    setCreating(true);
    try {
      const { id } = await createFn({ data: { documentId } });
      qc.invalidateQueries({ queryKey: ["threads", documentId] });
      navigate({ to: "/documents/$documentId/chat/$threadId", params: { documentId, threadId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    try {
      await delFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["threads", documentId] });
      if (id === activeId) navigate({ to: "/documents/$documentId", params: { documentId } });
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
          <Button size="sm" onClick={add} disabled={creating} aria-label="New chat">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {data?.map((t) => {
            const active = t.id === activeId;
            return (
              <div key={t.id} className="flex items-center gap-1 group">
                <Link
                  to="/documents/$documentId/chat/$threadId"
                  params={{ documentId, threadId: t.id }}
                  className={`flex-1 min-w-0 rounded-md px-2 py-1.5 text-sm truncate ${
                    active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
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
            );
          })}
          {data && data.length === 0 && (
            <p className="text-sm text-muted-foreground">No chats yet.</p>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
