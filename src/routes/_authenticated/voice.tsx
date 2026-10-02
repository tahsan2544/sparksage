// Voice tutor: speak a question, hear an answer grounded in your own materials.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mic, Square, Volume2, VolumeX, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDocuments } from "@/lib/documents.functions";
import { askTutor, speakAnswer } from "@/lib/chat.functions";
import { Typewriter } from "@/components/typewriter";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({
    meta: [
      { title: "Voice tutor — SparkSage" },
      { name: "description", content: "Ask questions out loud and hear answers drawn from your own study materials." },
      { property: "og:title", content: "Voice tutor — SparkSage" },
      { property: "og:description", content: "Speak your questions, hear grounded answers from your notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VoicePage,
});

type Phase = "idle" | "listening" | "thinking" | "speaking";
type Turn = {
  question: string;
  answer: string;
  sources: Array<{ index: number; documentTitle: string; excerpt: string }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRecognition(): any {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function VoicePage() {
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => listDocuments() });
  const ask = useServerFn(askTutor);
  const speak = useServerFn(speakAnswer);

  const [selected, setSelected] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSupported(Boolean(getRecognition()));
    return () => {
      recRef.current?.abort?.();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Default: all documents selected.
  const docIds = selected ?? (docs.data ?? []).map((d) => d.id);

  function stopAudio() {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    if (phase === "speaking") setPhase("idle");
  }

  async function readAloud(text: string) {
    if (muted) return setPhase("idle");
    setPhase("speaking");
    try {
      const { audio } = await speak({ data: { text: text.slice(0, 3000) } });
      const el = new Audio(`data:audio/mp3;base64,${audio}`);
      audioRef.current = el;
      el.onended = () => setPhase("idle");
      await el.play();
    } catch {
      // Fall back to the browser's built-in voice.
      const u = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, ""));
      u.onend = () => setPhase("idle");
      window.speechSynthesis.speak(u);
    }
  }

  async function handleQuestion(question: string) {
    if (!question.trim()) return setPhase("idle");
    if (docIds.length === 0) {
      toast.error("Add a document first so the tutor has materials to answer from.");
      return setPhase("idle");
    }
    setPhase("thinking");
    try {
      const history = turns.slice(-4).flatMap((t) => [
        { role: "user" as const, content: t.question },
        { role: "assistant" as const, content: t.answer },
      ]);
      const res = await ask({ data: { message: question, history, attachments: [], documentIds: docIds.slice(0, 10) } });
      setTurns((cur) => [...cur, { question, answer: res.answer, sources: res.sources }]);
      await readAloud(res.answer);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    }
  }

  function startListening() {
    stopAudio();
    const Rec = getRecognition();
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setInterim(text);
      if (e.results[e.results.length - 1].isFinal) finalText = text;
    };
    rec.onerror = () => setPhase("idle");
    rec.onend = () => {
      setInterim("");
      void handleQuestion(finalText);
    };
    recRef.current = rec;
    setPhase("listening");
    rec.start();
  }

  function stopListening() {
    recRef.current?.stop();
  }

  const label =
    phase === "listening" ? "Listening… tap to finish" :
    phase === "thinking" ? "Searching your materials…" :
    phase === "speaking" ? "Speaking — tap to ask again" :
    "Tap and ask a question";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Voice tutor</h1>
        <p className="mt-1 text-muted-foreground">
          Ask out loud. Answers come only from the materials you select, and are read back to you.
        </p>
      </header>

      {/* Materials picker */}
      <section aria-label="Study materials" className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <BookOpen className="h-4 w-4 text-primary" /> Answer from
          <span className="text-muted-foreground font-normal">({docIds.length} selected)</span>
        </div>
        {docs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your documents…</p>
        ) : (docs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents yet — upload one in Documents to start.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(docs.data ?? []).map((d) => {
              const on = docIds.includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(on ? docIds.filter((x) => x !== d.id) : [...docIds, d.id])}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                    on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d.title}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Mic */}
      <section className="flex flex-col items-center gap-4 py-6">
        {!supported ? (
          <p className="text-center text-sm text-muted-foreground max-w-sm">
            Your browser can't listen to speech. Try Chrome or Edge, or use Chat with AI to type questions.
          </p>
        ) : (
          <>
            <div className="relative">
              <AnimatePresence>
                {(phase === "listening" || phase === "speaking") &&
                  [0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-primary/25"
                      initial={{ scale: 1, opacity: 0.6 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
                    />
                  ))}
              </AnimatePresence>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={phase === "listening" ? stopListening : startListening}
                disabled={phase === "thinking"}
                aria-label={phase === "listening" ? "Stop listening" : "Ask a question by voice"}
                className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] disabled:opacity-70"
              >
                {phase === "thinking" ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : phase === "listening" ? (
                  <Square className="h-9 w-9" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </motion.button>
            </div>
            <p className="text-sm font-medium" aria-live="polite">{label}</p>
            {interim && <p className="text-center text-muted-foreground italic max-w-lg">“{interim}”</p>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMuted((m) => !m)}>
                {muted ? <VolumeX className="h-4 w-4 mr-1" /> : <Volume2 className="h-4 w-4 mr-1" />}
                {muted ? "Voice off" : "Voice on"}
              </Button>
              {phase === "speaking" && (
                <Button variant="ghost" size="sm" onClick={stopAudio}>Stop reading</Button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Conversation */}
      <section aria-label="Conversation" className="space-y-4">
        {[...turns].reverse().map((t, i) => (
          <motion.article
            key={turns.length - i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card p-5 space-y-3"
          >
            <p className="text-sm text-muted-foreground">You asked: <span className="text-foreground">{t.question}</span></p>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {i === 0 ? <Typewriter text={t.answer} /> : t.answer}
            </div>
            {t.sources.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Sources ({t.sources.length})</summary>
                <ul className="mt-2 space-y-1">
                  {t.sources.map((s) => (
                    <li key={s.index}><span className="font-medium text-foreground">[{s.index}] {s.documentTitle}</span> — {s.excerpt}</li>
                  ))}
                </ul>
              </details>
            )}
          </motion.article>
        ))}
      </section>
    </div>
  );
}
