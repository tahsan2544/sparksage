// Public landing page. Sends signed-in visitors to the dashboard.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, MessageSquare, Sparkles, ListChecks, Layers } from "lucide-react";

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
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden />
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

      <section className="mx-auto max-w-4xl px-4 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground mb-6">
          <Sparkles className="h-3 w-3" aria-hidden /> AI-powered study companion
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground">
          Turn any document into a study session
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload notes, papers, or textbooks. StudyMind chats with them, summarizes them, and generates
          quizzes and flashcards so you learn faster.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg">Get started free</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: MessageSquare, title: "Chat", body: "Ask questions grounded in your document." },
          { icon: Sparkles, title: "Summaries", body: "Instant, structured overviews." },
          { icon: ListChecks, title: "Quizzes", body: "Multiple-choice questions with explanations." },
          { icon: Layers, title: "Flashcards", body: "Front/back cards for spaced review." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5">
            <Icon className="h-5 w-5 text-primary mb-3" aria-hidden />
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
