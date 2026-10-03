// Materials library: categorize every document by type, subject and topic,
// then send a whole subject/topic to the chat tutor in one click.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { listDocuments, updateDocumentCategory } from "@/lib/documents.functions";
import { KIND_LABELS, KIND_OPTIONS, groupBySubject, type MaterialRow } from "@/lib/materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Library, MessagesSquare, Pencil, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Materials library — organise notes, textbooks & slides | SparkSage" },
      { name: "description", content: "Categorise your notes, textbooks and slides by subject and topic so the SparkSage tutor answers from the right materials." },
      { property: "og:title", content: "Materials library — SparkSage" },
      { property: "og:description", content: "Your study materials organised by subject and topic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => listDocuments() });
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    return ((docs.data ?? []) as MaterialRow[]).filter(
      (d) =>
        (kind === "all" || d.kind === kind) &&
        [d.title, d.subject, d.topic, d.author].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [docs.data, q, kind]);
  const groups = groupBySubject(rows);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Library className="h-7 w-7 text-primary" /> Materials library</h1>
          <p className="text-muted-foreground mt-1">Sort your notes, textbooks and slides by subject and topic. Ask the tutor about a whole subject or topic in one click.</p>
        </div>
        <Button asChild variant="outline"><Link to="/sources">Add a textbook or lecture notes</Link></Button>
      </header>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input aria-label="Search materials" className="pl-9" placeholder="Search title, subject, topic…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {[{ value: "all", label: "All" }, ...KIND_OPTIONS].map((o) => (
          <Button key={o.value} size="sm" variant={kind === o.value ? "default" : "outline"} aria-pressed={kind === o.value} onClick={() => setKind(o.value)}>{o.label}</Button>
        ))}
      </div>

      {docs.isLoading && <p className="text-muted-foreground">Loading your materials…</p>}
      {!docs.isLoading && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No materials here yet. <Link to="/documents" className="text-primary underline">Upload files</Link> or <Link to="/sources" className="text-primary underline">add a source</Link>.
        </CardContent></Card>
      )}

      {groups.map(([subject, items]) => {
        const topics = [...new Set(items.map((i) => i.topic).filter(Boolean))] as string[];
        return (
          <section key={subject} aria-labelledby={`sub-${subject}`} className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`sub-${subject}`} className="text-xl font-semibold">{subject}</h2>
              <Badge variant="secondary">{items.length}</Badge>
              <AskButton ids={items.map((i) => i.id)} label={`Ask about ${subject}`} />
              {topics.map((t) => (
                <AskButton key={t} ids={items.filter((i) => i.topic === t).map((i) => i.id)} label={t} subtle />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((d) =>
                editing === d.id ? (
                  <EditCard key={d.id} doc={d} onDone={() => setEditing(null)} />
                ) : (
                  <Card key={d.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <Link to="/documents/$documentId" params={{ documentId: d.id }} className="font-medium hover:underline line-clamp-2">{d.title}</Link>
                        <Button variant="ghost" size="icon" aria-label={`Edit category of ${d.title}`} onClick={() => setEditing(d.id)}><Pencil className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary">{KIND_LABELS[d.kind] ?? d.kind}</Badge>
                        {d.topic && <Badge variant="outline">{d.topic}</Badge>}
                      </div>
                      {d.author && <p className="text-xs text-muted-foreground">{d.author}</p>}
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function AskButton({ ids, label, subtle }: { ids: string[]; label: string; subtle?: boolean }) {
  return (
    <Button asChild size="sm" variant={subtle ? "ghost" : "outline"}>
      <Link to="/chat" search={{ docs: ids.slice(0, 10).join(",") } as never}>
        <MessagesSquare className="h-3.5 w-3.5" /> {label}
      </Link>
    </Button>
  );
}

function EditCard({ doc, onDone }: { doc: MaterialRow; onDone: () => void }) {
  const qc = useQueryClient();
  const update = useServerFn(updateDocumentCategory);
  const [f, setF] = useState({ kind: doc.kind, subject: doc.subject ?? "", topic: doc.topic ?? "", author: doc.author ?? "" });
  const save = useMutation({
    mutationFn: () => update({ data: { id: doc.id, ...f, kind: f.kind as never } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["documents"] }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-4">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <p className="font-medium line-clamp-1">{doc.title}</p>
          <select aria-label="Type" className="w-full rounded-[18px] border border-input bg-background px-3 py-2 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Input aria-label="Subject" placeholder="Subject" maxLength={120} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          <Input aria-label="Topic" placeholder="Topic" maxLength={160} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} />
          <Input aria-label="Author" placeholder="Author / lecturer" maxLength={200} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
          <div className="flex gap-2"><Button type="submit" size="sm" disabled={save.isPending}>Save</Button><Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
