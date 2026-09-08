// Public landing page. Content (name, hero copy, plans) comes from the
// Owner-managed settings + plans tables so it can be changed without a deploy.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getPublicSiteData, type SettingsMap } from "@/lib/settings.functions";
import { savePendingUpload } from "@/lib/pending-upload";
import { extractText, DOCUMENT_ACCEPT } from "@/lib/extract-text";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  Check,
  FileText,
  GraduationCap,
  Languages,
  Layers,
  LineChart,
  ListChecks,
  MessagesSquare,
  Mic,
  NotebookPen,
  PlayCircle,
  Quote,
  Search,
  Share2,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";

const SITE_URL = "https://sparksage.lovable.app";

export const Route = createFileRoute("/")({
  loader: () => getPublicSiteData(),
  head: () => ({
    meta: [
      { title: "SparkSage — AI study companion for your notes" },
      {
        name: "description",
        content:
          "Upload your notes, books or slides and let AI help you learn faster with summaries, quizzes, flashcards and personalized explanations.",
      },
      { property: "og:title", content: "SparkSage — AI study companion for your notes" },
      {
        property: "og:description",
        content: "AI summaries, quizzes, flashcards and a study planner built around your own material.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${SITE_URL}/#organization`,
              name: "SparkSage",
              url: `${SITE_URL}/`,
              description:
                "SparkSage turns your own documents into an AI tutor, summaries, quizzes, flashcards and a study plan.",
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: "SparkSage",
              url: `${SITE_URL}/`,
              publisher: { "@id": `${SITE_URL}/#organization` },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQS.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }),
      },
    ],
  }),

  component: Landing,
});

const FEATURES = [
  { icon: Brain, title: "AI Tutor", body: "Ask anything and get answers grounded in your own documents." },
  {
    icon: MessagesSquare,
    title: "Chat with SparkSage AI",
    body: "Live tutor chat where you can attach documents, images and videos.",
  },
  { icon: Layers, title: "Flashcards", body: "Auto-generated decks with flip review and mastery tracking." },
  { icon: ListChecks, title: "Quiz generator", body: "Practice quizzes with scoring, feedback and explanations." },
  { icon: NotebookPen, title: "Smart notes", body: "Turn long chapters into clean, structured revision notes." },
  { icon: Target, title: "Study planner", body: "Goals, deadlines and reminders that keep you moving." },
  { icon: Camera, title: "OCR ready", body: "Scanned pages become searchable, study-ready text." },
  { icon: Share2, title: "Mind maps", body: "See how concepts connect at a single glance." },
  { icon: Mic, title: "Voice tutor", body: "Learn hands-free while commuting or walking." },
  { icon: LineChart, title: "Progress tracking", body: "Streaks, focus time and a weekly learning trend." },
  { icon: GraduationCap, title: "Exam preparation", body: "Important questions, viva prompts and cheat sheets." },
  { icon: FileText, title: "Revision notes", body: "One-page summaries built for the night before." },
  { icon: Search, title: "Research assistant", body: "Find key concepts, definitions and citations fast." },
];

const STEPS = [
  { icon: Upload, title: "Upload", body: "Drop in documents, images or videos — PDF, DOCX, PPTX, TXT, JPG, PNG, MP4 and more." },
  { icon: Sparkles, title: "Let AI read it", body: "SparkSage extracts structure, key concepts and terms." },
  { icon: Brain, title: "Learn your way", body: "Chat live with the AI tutor, summarize, quiz yourself or drill flashcards." },
  { icon: LineChart, title: "Track and repeat", body: "Streaks and spaced review keep the knowledge in." },
];

const TESTIMONIALS = [
  {
    quote: "I turned a 200-page module into flashcards in minutes. My revision week finally felt calm.",
    name: "Anika R.",
    role: "Pharmacy student",
  },
  {
    quote: "The tutor actually quotes my lecture slides instead of making things up. That's the whole difference.",
    name: "Tanvir H.",
    role: "CSE, 3rd semester",
  },
  {
    quote: "The planner plus Pomodoro combo got me from cramming to a real daily habit.",
    name: "Maria L.",
    role: "Law undergraduate",
  },
];

const FAQS = [
  {
    q: "What file types can I upload?",
    a: "Documents (PDF, DOCX, PPTX, TXT, MD, CSV), images (JPG, PNG, WEBP, HEIC) and videos (MP4, MOV, WEBM) — attach several at once in a single chat message.",
  },
  {
    q: "Does the AI make things up?",
    a: "SparkSage answers from your uploaded material first and clearly tells you when it is using general knowledge instead.",
  },
  {
    q: "Is my material private?",
    a: "Your documents, chats and notes are tied to your account and protected by row-level security. Nobody else can read them.",
  },
  {
    q: "Can I use it in Bangla?",
    a: "Yes. You can ask for explanations in Bangla or English, and more languages are on the way.",
  },
  {
    q: "How much does SparkSage cost?",
    a: "Nothing. Every account gets the same generous access to the tutor, summaries, quizzes, flashcards, Document Studio and the planner.",
  },

  {
    q: "Do I need an internet connection?",
    a: "Yes. SparkSage is fully cloud-based, so your material and the AI tutor are always available on any device with a connection.",
  },
];

function Landing() {
  const { settings } = Route.useLoaderData() as { settings: SettingsMap };
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function googleSignIn() {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
    }
  }

  const appName = settings.app_name || "SparkSage";
  const googleEnabled = settings.google_login_enabled !== "false";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <span>{appName}</span>
        </Link>
        <nav aria-label="Landing" className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>

        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link to="/auth">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Get started</Button>
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 -z-10" style={{ backgroundImage: "var(--gradient-hero)" }} />
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
                <Sparkles className="h-3 w-3 text-primary" aria-hidden /> Your AI-powered study companion
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                {settings.app_tagline || "Study Smarter, Not Harder."}
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-xl">{settings.app_subheading}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth">
                  <Button size="lg" className="shadow-[var(--shadow-elegant)]">
                    Get started <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
                {googleEnabled && (
                  <Button size="lg" variant="outline" onClick={googleSignIn}>
                    Continue with Google
                  </Button>
                )}
                <a href="#how">
                  <Button size="lg" variant="ghost">
                    <PlayCircle className="h-4 w-4 mr-2" /> Watch demo
                  </Button>
                </a>
              </div>
            </div>

            <UploadAnimation />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Built for the way students actually study"
            body="A connected, cloud-based toolkit that turns passive reading into active learning."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.35 }}
                className="rounded-3xl border border-border bg-card p-6 transition-all hover:shadow-[var(--shadow-elegant)] hover:-translate-y-0.5"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground mb-4">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionHeading
              eyebrow="How it works"
              title="From file to fluency in four steps"
              body="No setup, no prompt engineering. Upload and start learning."
            />
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="rounded-3xl border border-border bg-card p-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary mb-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                      {i + 1}
                    </span>
                    Step {i + 1}
                  </div>
                  <Icon className="h-5 w-5 text-primary mb-3" aria-hidden />
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Study workflow */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading
            eyebrow="Study workflow"
            title="A rhythm that sticks"
            body="Pair short focus blocks with active recall and spaced review."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <WorkflowCard
              icon={<Target className="h-5 w-5" />}
              title="Plan the day"
              points={["Set one clear goal", "Break it into tasks", "Give each a deadline"]}
            />
            <WorkflowCard
              icon={<Brain className="h-5 w-5" />}
              title="Learn actively"
              points={["Chat live with the AI tutor", "Summarize in your own words", "Generate a quick quiz"]}
            />
            <WorkflowCard
              icon={<Languages className="h-5 w-5" />}
              title="Review and retain"
              points={["Drill flashcards", "Re-read the one-page summary", "Keep the streak alive"]}
            />
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionHeading eyebrow="Loved by students" title="Real study, real results" />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <figure key={t.name} className="rounded-3xl border border-border bg-card p-6">
                  <Quote className="h-5 w-5 text-primary mb-3" aria-hidden />
                  <blockquote className="text-sm leading-relaxed">{t.quote}</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground"> · {t.role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>




        {/* FAQ */}
        <section id="faq" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-20">
            <SectionHeading eyebrow="FAQ" title="Questions students ask" />
            <Accordion type="single" collapsible className="mt-8">
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Your next study session starts here</h2>
          <p className="mt-3 text-muted-foreground">
            Upload one document, image or video and see what {appName} can do in under a minute.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="shadow-[var(--shadow-elegant)]">
                Get started free <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            {googleEnabled && (
              <Button size="lg" variant="outline" onClick={googleSignIn}>
                Continue with Google
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row gap-4 items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {appName}</span>
          <div className="flex flex-wrap items-center gap-5">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>

            {settings.support_email && (
              <a href={`mailto:${settings.support_email}`} className="hover:text-foreground">
                Support
              </a>
            )}
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2>
      {body && <p className="mt-3 text-muted-foreground">{body}</p>}
    </div>
  );
}

function WorkflowCard({ icon, title, points }: { icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground mb-4">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Interactive hero dropzone. Visitors can drop or pick any document here; the
 * file is stashed locally and they're sent to sign-up, where the documents
 * page finishes processing it.
 */
function UploadAnimation() {
  const stages = ["Uploading lecture-notes.pdf", "Extracting text", "Finding key concepts", "Ready to study"];
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Files must be under 12 MB.");
      return;
    }
    setPicked(file.name);

    // Text is pulled out of PDFs, Word docs and slide decks right here in the
    // browser, so the student sees a finished document straight after signup.
    let content = "";
    try {
      content = (await extractText(file)).text;
    } catch {
      content = "";
    }

    savePendingUpload({
      title: file.name.replace(/\.[^.]+$/, ""),
      content,
      fileName: file.name,
    });
    toast.success("Create your free account to finish processing this file.");
    navigate({ to: "/auth" });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
      <input
        ref={inputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        aria-label="Upload a document to start studying"
        className={`w-full rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
        }`}
      >
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
        >
          <Upload className="h-6 w-6" aria-hidden />
        </motion.span>
        <span className="mt-3 block text-sm font-medium">{picked ?? "Drop your notes here"}</span>
        <span className="block text-xs text-muted-foreground">
          Any document, image or slide deck — click to browse
        </span>
      </button>

      <div className="mt-5 space-y-3" aria-hidden>
        {stages.map((label, i) => (
          <div key={label}>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[image:var(--gradient-primary)]"
                initial={{ width: "0%" }}
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 1.6, delay: i * 0.5, repeat: Infinity, repeatDelay: 2.4 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
