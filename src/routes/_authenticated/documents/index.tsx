// Documents dashboard: list existing docs + create a new one.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { listDocuments, createDocument, deleteDocument } from "@/lib/documents.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, GraduationCap, Plus, Trash2, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { consumePendingUpload, type PendingUpload } from "@/lib/pending-upload";
import { extractText, DOCUMENT_ACCEPT } from "@/lib/extract-text";
import { readImageText } from "@/lib/extract.functions";
import { SAMPLE_COURSE_TITLE, SAMPLE_COURSE_CONTENT } from "@/lib/sample-course";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({
    meta: [
      { title: "Your documents — SparkSage" },
      {
        name: "description",
        content:
          "Your SparkSage library: every note, PDF, slide deck and transcript you have uploaded, ready to study with AI.",
      },
      { property: "og:title", content: "Your document library — SparkSage" },
      {
        property: "og:description",
        content: "Upload notes, books and slides, then turn them into chats, summaries, quizzes and flashcards.",
      },
      { property: "og:url", content: "https://sparksage.lovable.app/documents" },
    ],
    links: [{ rel: "canonical", href: "https://sparksage.lovable.app/documents" }],
  }),

  component: Dashboard,
});

function Dashboard() {
  const listFn = useServerFn(listDocuments);
  const create = useServerFn(createDocument);
  const qc = useQueryClient();
  const navigate = useNavigate();
  // A file dropped on the landing page before signing up: finish it here.
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    const p = consumePendingUpload();
    if (!p) return;
    if (!p.content.trim()) {
      // Format we cannot read in the browser — prefill the dialog instead.
      setPending(p);
      return;
    }
    setProcessing(p.fileName);
    create({ data: { title: p.title.slice(0, 200), content: p.content.slice(0, 200_000) } })
      .then(({ id }) => {
        toast.success(`${p.fileName} is ready to study`);
        qc.invalidateQueries({ queryKey: ["documents"] });
        navigate({ to: "/documents/$documentId", params: { documentId: id } });
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "We couldn't process that file."),
      )
      .finally(() => setProcessing(null));
  }, [create, navigate, qc]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn: () => listFn(),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your documents</h1>
          <p className="text-sm text-muted-foreground">Upload a document to chat with it and generate study material.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SampleCourseButton />
          <NewDocumentDialog
            pending={pending}
            onPendingHandled={() => setPending(null)}
          />
        </div>

      </div>

      {processing && (
        <div className="mb-6 rounded-3xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">Processing {processing}…</p>
          <p className="text-muted-foreground mt-1">Extracting text and getting it ready to study.</p>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-[image:var(--gradient-primary)] animate-pulse" />
          </div>
        </div>
      )}

      {isLoading && <SkeletonGrid />}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load documents: {error instanceof Error ? error.message : "unknown error"}
        </div>
      )}
      {!isLoading && !error && data && data.length === 0 && <EmptyState />}
      {!isLoading && data && data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 rounded-xl border border-border bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

/**
 * One-click demo: creates a ready-made course document so Document Studio
 * (audio, video, mind map, reports, slides, infographic, table) can be tested
 * end to end without uploading anything.
 */
function SampleCourseButton() {
  const create = useServerFn(createDocument);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { id } = await create({
        data: { title: SAMPLE_COURSE_TITLE, content: SAMPLE_COURSE_CONTENT },
      });
      toast.success("Sample course added — open the Studio tab to test it");
      qc.invalidateQueries({ queryKey: ["documents"] });
      navigate({ to: "/documents/$documentId", params: { documentId: id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the sample course");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" onClick={load} disabled={loading}>
      <GraduationCap className="h-4 w-4 mr-2" aria-hidden />
      {loading ? "Adding…" : "Load sample course"}
    </Button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden />
      <h2 className="font-semibold text-lg">No documents yet</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Upload your first document, or load the sample course to try everything out.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <SampleCourseButton />
        <NewDocumentDialog />
      </div>
    </div>
  );
}


function DocumentCard({ doc }: { doc: { id: string; title: string; created_at: string; updated_at: string } }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteDocument);

  async function onDelete() {
    try {
      await del({ data: { id: doc.id } });
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <Card className="group">
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <Link
            to="/documents/$documentId"
            params={{ documentId: doc.id }}
            className="hover:underline min-w-0 truncate"
          >
            {doc.title}
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-60 hover:opacity-100 shrink-0"
                aria-label={`Delete ${doc.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the document and all of its chat threads, summaries, quizzes, and flashcards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardTitle>
        <CardDescription>Updated {formatDistanceToNow(new Date(doc.updated_at))} ago</CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          to="/documents/$documentId"
          params={{ documentId: doc.id }}
          className="text-sm text-primary hover:underline"
        >
          Open →
        </Link>
      </CardContent>
    </Card>
  );
}

function NewDocumentDialog({
  pending,
  onPendingHandled,
}: {
  pending?: PendingUpload | null;
  onPendingHandled?: () => void;
} = {}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useServerFn(createDocument);
  const ocr = useServerFn(readImageText);
  const qc = useQueryClient();
  const navigate = useNavigate();

  // A landing-page file we couldn't read: open prefilled so the student can
  // paste the text (PDF/DOCX/PPTX text extraction happens client-side today).
  useEffect(() => {
    if (!pending) return;
    setTitle(pending.title.slice(0, 200));
    setOpen(true);
    toast.info(`Paste the text from ${pending.fileName} to finish adding it.`);
    onPendingHandled?.();
  }, [pending, onPendingHandled]);

  /**
   * Read any supported file into the content box: text, PDF, Word, PowerPoint
   * (all parsed in the browser) or an image (transcribed by the AI tutor).
   */
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error("Files must be under 20 MB.");
      return;
    }
    setReading(f.name);
    try {
      const result = await extractText(f);
      let text = result.text;
      if (result.kind === "image" && result.dataUrl) {
        if (f.size > 5 * 1024 * 1024) throw new Error("Images must be under 5 MB to be transcribed.");
        text = (await ocr({ data: { fileName: f.name, dataUrl: result.dataUrl } })).text;
      }
      if (!text.trim()) {
        toast.error(`We couldn't find any text in ${f.name}. Try pasting it instead.`);
        return;
      }
      setContent(text.slice(0, 200_000));
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
      toast.success(`${f.name} is ready — review the text and save.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not read ${f.name}.`);
    } finally {
      setReading(null);
    }
  }


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setLoading(true);
    try {
      const { id } = await create({ data: { title: title.trim(), content: content.trim() } });
      toast.success("Document added");
      qc.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
      setTitle("");
      setContent("");
      navigate({ to: "/documents/$documentId", params: { documentId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a document</DialogTitle>
          <DialogDescription>
            Paste text or upload a PDF, Word (.docx), PowerPoint (.pptx), text file or a photo of your notes.
            SparkSage will use it for chat, summaries, quizzes and flashcards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter 3 — Photosynthesis"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="doc-content">Content</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={Boolean(reading)}>
                <Upload className="h-4 w-4 mr-2" /> {reading ? `Reading ${reading}…` : "Upload a file"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                onChange={onFile}
                className="hidden"
              />
            </div>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your document text here…"
              rows={12}
              maxLength={200_000}
              required
            />
            <p className="text-xs text-muted-foreground">{content.length.toLocaleString()} characters</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
