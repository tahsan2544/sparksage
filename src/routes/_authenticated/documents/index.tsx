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
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { consumePendingUpload, type PendingUpload } from "@/lib/pending-upload";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({
    meta: [
      { title: "Your documents — SparkSage" },
      { name: "description", content: "All your uploaded documents in one place." },
    ],
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
        <NewDocumentDialog
          pending={pending}
          onPendingHandled={() => setPending(null)}
        />
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

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center">
      <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" aria-hidden />
      <h2 className="font-semibold text-lg">No documents yet</h2>
      <p className="text-sm text-muted-foreground mt-1">Upload your first document to get started.</p>
      <div className="mt-4 flex justify-center">
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
  const fileRef = useRef<HTMLInputElement>(null);
  const create = useServerFn(createDocument);
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

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Text file must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setContent(text);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsText(f);
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
            Paste text or upload a .txt / .md file. SparkSage will use it for chat, summaries, and quizzes.
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
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Upload text file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
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
