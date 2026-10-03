// Study sources: list real textbooks and lecture notes (with chapters / key
// notes) so the tutor and chat can search them like uploaded files.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createDocument, deleteDocument, listDocuments } from "@/lib/documents.functions";
import { KIND_LABELS } from "@/lib/materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookMarked, Loader2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sources")({
  head: () => ({
    meta: [
      { title: "Study sources — your textbooks & lecture notes | SparkSage" },
      { name: "description", content: "List the textbooks and lecture notes you actually study from so the SparkSage tutor answers from them." },
      { property: "og:title", content: "Study sources — SparkSage" },
      { property: "og:description", content: "Your real textbooks and lecture notes, searchable by your AI tutor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SourcesPage,
});

const empty = { kind: "textbook" as "textbook" | "lecture_notes", title: "", author: "", subject: "", topic: "", details: "", content: "" };

function SourcesPage() {
  const qc = useQueryClient();
  const create = useServerFn(createDocument);
  const remove = useServerFn(deleteDocument);
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => listDocuments() });
  const [f, setF] = useState(empty);
  const sources = (docs.data ?? []).filter((d) => d.kind === "textbook" || d.kind === "lecture_notes");

  const add = useMutation({
    mutationFn: () => {
      const header = [
        `${KIND_LABELS[f.kind]}: ${f.title}`,
        f.author && `Author / lecturer: ${f.author}`,
        f.subject && `Subject: ${f.subject}`,
        f.topic && `Topic: ${f.topic}`,
        f.details && `Edition / chapters / course: ${f.details}`,
      ].filter(Boolean).join("\n");
      return create({ data: { ...f, content: `${header}\n\n${f.content}`.trim() } });
    },
    onSuccess: () => {
      toast.success("Source added — the tutor can now use it");
      setF(empty);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2"><BookMarked className="h-7 w-7 text-primary" /> Study sources</h1>
        <p className="text-muted-foreground mt-1">
          Add the textbooks and lecture notes you really study from. Paste chapters, summaries or key passages — the tutor, chat and voice tutor search them alongside your uploads.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Add a source</CardTitle><CardDescription>The more text you paste, the better the tutor can answer from it.</CardDescription></CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <div className="sm:col-span-2 flex gap-2" role="radiogroup" aria-label="Source type">
              {(["textbook", "lecture_notes"] as const).map((k) => (
                <Button key={k} type="button" variant={f.kind === k ? "default" : "outline"} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}>{KIND_LABELS[k]}</Button>
              ))}
            </div>
            <div><Label htmlFor="s-title">Title</Label><Input id="s-title" required maxLength={200} value={f.title} onChange={set("title")} placeholder="Campbell Biology" /></div>
            <div><Label htmlFor="s-author">{f.kind === "textbook" ? "Author" : "Lecturer"}</Label><Input id="s-author" maxLength={200} value={f.author} onChange={set("author")} /></div>
            <div><Label htmlFor="s-subject">Subject</Label><Input id="s-subject" maxLength={120} value={f.subject} onChange={set("subject")} placeholder="Biology" /></div>
            <div><Label htmlFor="s-topic">Topic</Label><Input id="s-topic" maxLength={160} value={f.topic} onChange={set("topic")} placeholder="Cell structure" /></div>
            <div className="sm:col-span-2"><Label htmlFor="s-details">Edition, chapters or course</Label><Input id="s-details" maxLength={2000} value={f.details} onChange={set("details")} placeholder="12th ed., chapters 6–8" /></div>
            <div className="sm:col-span-2"><Label htmlFor="s-content">Content</Label><Textarea id="s-content" required rows={8} maxLength={200000} value={f.content} onChange={set("content")} placeholder="Paste chapter text, your lecture notes or key passages…" /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={add.isPending}>{add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add source</Button></div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="my-sources">
        <h2 id="my-sources" className="text-xl font-semibold mb-3">My sources</h2>
        {docs.isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!docs.isLoading && sources.length === 0 && <p className="text-muted-foreground">No textbooks or lecture notes yet. Add your first one above.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {sources.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/documents/$documentId" params={{ documentId: s.id }} className="font-medium hover:underline">{s.title}</Link>
                  <p className="text-sm text-muted-foreground truncate">{[s.author, s.details].filter(Boolean).join(" · ")}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary">{KIND_LABELS[s.kind]}</Badge>
                    {s.subject && <Badge variant="outline">{s.subject}</Badge>}
                    {s.topic && <Badge variant="outline">{s.topic}</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Delete ${s.title}`} onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
