// "Chat with SparkSage AI" — a general tutor chat with multi-file attachments.
// Conversation lives for the session only; use document chats for saved threads.
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { askTutor } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FileText, ImageIcon, Paperclip, Send, Sparkles, Video, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat with SparkSage AI — live AI tutor" },
      {
        name: "description",
        content:
          "Have a live conversation with the SparkSage AI tutor. Attach documents, images and videos and get instant explanations.",
      },
      { property: "og:title", content: "Chat with SparkSage AI" },
      {
        property: "og:description",
        content: "Ask anything and attach documents, images or videos for instant, tutor-style explanations.",
      },
    ],
  }),
  component: ChatWithAI,
});

/** Everything the composer accepts, grouped so we can label + icon each file. */
const ACCEPT =
  ".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.rtf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.mp4,.mov,.webm,.avi,.mkv," +
  "application/pdf,image/*,video/*,text/*";

const MAX_FILES = 6;
// Attachments travel to the tutor as base64 (~33% larger than the raw file),
// so keep them small — oversized bodies are rejected before they reach the
// model and surface in the browser as a generic "failed to fetch".
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB per file
const MAX_TOTAL_BYTES = 8 * 1024 * 1024; // 8 MB per message


type Kind = "image" | "document" | "video" | "other";

interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: Kind;
  progress: number;
  dataUrl?: string;
  previewUrl?: string;
}

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; kind: Kind; previewUrl?: string }[];
}

function kindOf(file: File): Kind {
  if (file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name)) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (/^(application|text)\//.test(file.type) || /\.(pdf|docx?|pptx?|txt|md|csv|rtf)$/i.test(file.name))
    return "document";
  return "other";
}

function prettySize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChatWithAI() {
  const ask = useServerFn(askTutor);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  /** Read each file as a data URL, reporting live upload progress. */
  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    setFiles((prev) => {
      const room = MAX_FILES - prev.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_FILES} files per message.`);
        return prev;
      }
      const accepted: Attachment[] = [];
      let running = prev.reduce((sum, f) => sum + f.size, 0);
      for (const file of list.slice(0, room)) {
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is larger than 4 MB. Try a smaller file or split it up.`);
          continue;
        }
        if (running + file.size > MAX_TOTAL_BYTES) {
          toast.error("That's too much for one message — send up to 8 MB of files at a time.");
          continue;
        }
        running += file.size;

        const kind = kindOf(file);
        const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
        const att: Attachment = {
          id,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          kind,
          progress: 0,
          previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined,
        };
        accepted.push(att);

        const reader = new FileReader();
        reader.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setFiles((cur) => cur.map((f) => (f.id === id ? { ...f, progress: pct } : f)));
        };
        reader.onload = () => {
          const dataUrl = typeof reader.result === "string" ? reader.result : undefined;
          setFiles((cur) => cur.map((f) => (f.id === id ? { ...f, progress: 100, dataUrl } : f)));
        };
        reader.onerror = () => {
          toast.error(`Could not read ${file.name}.`);
          setFiles((cur) => cur.filter((f) => f.id !== id));
        };
        reader.readAsDataURL(file);
      }
      return [...prev, ...accepted];
    });
  }, []);

  function removeFile(id: string) {
    setFiles((cur) => {
      const target = cur.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return cur.filter((f) => f.id !== id);
    });
  }

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (busy) return;
    if (!text && files.length === 0) return;
    if (files.some((f) => f.progress < 100)) {
      toast.error("Wait for the uploads to finish.");
      return;
    }

    const attached = files;
    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      files: attached.map((f) => ({ name: f.name, kind: f.kind, previewUrl: f.previewUrl })),
    };
    const history = turns.map((t) => ({ role: t.role, content: t.content }));

    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setFiles([]);
    setBusy(true);
    try {
      const { answer } = await ask({
        data: {
          message: text,
          history,
          attachments: attached.map((f) => ({
            name: f.name,
            mime: f.mime,
            kind: f.kind,
            // Videos are not sent inline; the tutor is told they exist instead.
            dataUrl: f.kind === "video" ? undefined : f.dataUrl,
          })),
        },
      });
      setTurns((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: answer }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The tutor could not reply. Try again.");
      setTurns((prev) => prev.filter((t) => t.id !== userTurn.id));
      setInput(text);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Chat with SparkSage AI</h1>
        <p className="text-sm text-muted-foreground">
          Ask anything and attach documents, images or videos. You need an internet connection — everything runs in the
          cloud.
        </p>
      </div>

      <Card
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <CardContent className="flex-1 min-h-0 p-0 flex flex-col relative">
          {dragging && (
            <div className="absolute inset-0 z-10 m-3 rounded-3xl border-2 border-dashed border-primary bg-primary/5 flex items-center justify-center text-sm font-medium text-primary">
              Drop your files here
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {turns.length === 0 && !busy && (
              <div className="text-center py-12">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground">
                  <Sparkles className="h-6 w-6" aria-hidden />
                </span>
                <h2 className="mt-4 font-semibold">Your AI tutor is ready</h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Explain a tricky topic, drop in lecture slides, snap a photo of your notes, or share a lecture
                  recording to talk it through.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {[
                    "Explain photosynthesis simply",
                    "Quiz me on this chapter",
                    "Make a 5-point revision summary",
                  ].map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => setInput(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    t.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {t.files && t.files.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {t.files.map((f) => (
                        <span
                          key={f.name}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-background/20 px-2 py-1 text-xs"
                        >
                          {f.kind === "image" && f.previewUrl ? (
                            <img src={f.previewUrl} alt={f.name} className="h-8 w-8 rounded-md object-cover" />
                          ) : (
                            <KindIcon kind={f.kind} />
                          )}
                          <span className="max-w-[10rem] truncate">{f.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {t.content}
                </div>
              </motion.div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="rounded-3xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1" aria-label="SparkSage is thinking">
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:240ms]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Attachment previews with upload progress */}
          {files.length > 0 && (
            <div className="border-t border-border p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((f) => (
                <div key={f.id} className="rounded-2xl border border-border bg-muted/30 p-2 flex items-center gap-3">
                  {f.kind === "image" && f.previewUrl ? (
                    <img src={f.previewUrl} alt={f.name} className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : f.kind === "video" && f.previewUrl ? (
                    <video src={f.previewUrl} className="h-12 w-12 rounded-xl object-cover shrink-0" muted />
                  ) : (
                    <span className="h-12 w-12 rounded-xl bg-accent text-accent-foreground grid place-items-center shrink-0">
                      <KindIcon kind={f.kind} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">{prettySize(f.size)}</p>
                    {f.progress < 100 && <Progress value={f.progress} className="mt-1 h-1" />}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => removeFile(f.id)}
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={onSend} className="border-t border-border p-3 flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach documents, images or videos"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
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
              placeholder="Ask your tutor anything, or drop files here…"
              rows={2}
              maxLength={8000}
              className="resize-none"
              aria-label="Message SparkSage AI"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || (!input.trim() && files.length === 0)}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === "image") return <ImageIcon className="h-4 w-4" aria-hidden />;
  if (kind === "video") return <Video className="h-4 w-4" aria-hidden />;
  return <FileText className="h-4 w-4" aria-hidden />;
}
