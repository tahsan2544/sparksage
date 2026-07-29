// Public landing page. Sends signed-in visitors to the dashboard.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  ListChecks,
  Layers,
  Target,
  LineChart,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyMind — Chat, summarize, and quiz your documents" },
      {
        name: "description",
        content:
          "Upload any document and turn it into an AI chat, summary, quiz, and flashcards. Learn faster with StudyMind.",
      },
      { property: "og:title", content: "StudyMind — AI study companion for your documents" },
      {
        property: "og:description",
        content: "Chat with your documents, generate summaries, quizzes, and flashcards in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: MessageSquare, title: "Chat with docs", body: "Ask questions grounded in your own material." },
  { icon: Sparkles, title: "Instant summaries", body: "Structured overviews of any document." },
  { icon: ListChecks, title: "Interactive quizzes", body: "Multiple choice with scoring and explanations." },
  { icon: Layers, title: "Flashcard decks", body: "Flip-card review for lasting recall." },
  { icon: Target, title: "Study planner", body: "Set goals and deadlines that keep you on track." },
  { icon: LineChart, title: "Progress tracking", body: "Streaks, focus time, and a Pomodoro timer." },
];

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <span>StudyMind</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ backgroundImage: "var(--gradient-hero)" }}
        />
        <div className="mx-auto max-w-4xl px-4 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden /> Your AI-powered study companion
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
            Turn any document into a{" "}
            <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">
              study session
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload notes, papers, or textbooks. StudyMind chats with them, summarizes them, and generates
            quizzes and flashcards — so you learn faster and retain more.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="shadow-[var(--shadow-elegant)]">
                Get started free <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline">See what's inside</Button>
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 pb-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-border bg-card p-6 transition-all hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground mb-4">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} StudyMind</span>
          <Link to="/auth" className="hover:text-foreground">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
}
