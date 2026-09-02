/**
 * Document Studio — the generation surface for everything SparkSage can make
 * from a document beyond summary/quiz/flashcards: audio overview, video
 * overview, mind map, reports, slide deck, infographic and data table.
 *
 * Each kind loads its cached artifact first (`getArtifact`) and only calls the
 * AI when the student presses Generate / Regenerate.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getArtifact,
  generateArtifact,
  REPORT_VARIANTS,
  type ArtifactKind,
  type AudioOverview,
  type VideoOverview,
  type MindMapNode,
  type ReportDoc,
  type SlideDeck,
  type Infographic,
  type DataTable,
} from "@/lib/artifacts.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Headphones,
  Clapperboard,
  Network,
  FileText,
  Presentation,
  BarChart3,
  Table as TableIcon,
  Sparkles,
  RefreshCw,
} from "lucide-react";

const KINDS: Array<{ kind: ArtifactKind; label: string; icon: typeof Headphones; blurb: string }> = [
  { kind: "audio", label: "Audio", icon: Headphones, blurb: "A two-voice podcast discussion of this document." },
  { kind: "video", label: "Video", icon: Clapperboard, blurb: "A narrated slide-style video overview." },
  { kind: "mindmap", label: "Mind map", icon: Network, blurb: "A hierarchical map of the key themes." },
  { kind: "report", label: "Reports", icon: FileText, blurb: "Study guide, briefing doc, FAQ or timeline." },
  { kind: "slides", label: "Slides", icon: Presentation, blurb: "An auto-generated presentation deck." },
  { kind: "infographic", label: "Infographic", icon: BarChart3, blurb: "A one-page visual summary." },
  { kind: "table", label: "Data table", icon: TableIcon, blurb: "Structured facts and comparisons." },
];

const REPORT_LABELS: Record<string, string> = {
  study_guide: "Study guide",
  briefing: "Briefing doc",
  faq: "FAQ",
  timeline: "Timeline",
};

export function DocumentStudio({ documentId }: { documentId: string }) {
  return (
    <Tabs defaultValue="audio" className="min-w-0">
      <TabsList className="flex flex-wrap h-auto">
        {KINDS.map(({ kind, label, icon: Icon }) => (
          <TabsTrigger key={kind} value={kind} className="gap-1.5">
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {KINDS.map((k) => (
        <TabsContent key={k.kind} value={k.kind} className="mt-4">
          <StudioPanel documentId={documentId} kind={k.kind} label={k.label} blurb={k.blurb} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function StudioPanel({
  documentId,
  kind,
  label,
  blurb,
}: {
  documentId: string;
  kind: ArtifactKind;
  label: string;
  blurb: string;
}) {
  const [variant, setVariant] = useState(kind === "report" ? "study_guide" : "");
  const [guidance, setGuidance] = useState("");
  const [busy, setBusy] = useState(false);
  const get = useServerFn(getArtifact);
  const gen = useServerFn(generateArtifact);
  const qc = useQueryClient();

  const queryKey = ["artifact", documentId, kind, variant];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => get({ data: { documentId, kind, variant } }),
  });

  async function generate() {
    setBusy(true);
    try {
      await gen({ data: { documentId, kind, variant, guidance } });
      qc.invalidateQueries({ queryKey });
      toast.success(`${label} ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  const content = (data?.content ?? null) as unknown;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{label}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{blurb}</p>
          </div>
          <Button size="sm" onClick={generate} disabled={busy}>
            {content ? <RefreshCw className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {busy ? "Generating…" : content ? "Regenerate" : "Generate"}
          </Button>
        </div>
        {kind === "report" && (
          <div className="flex flex-wrap gap-2">
            {REPORT_VARIANTS.map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={variant === v ? "default" : "outline"}
                onClick={() => setVariant(v)}
              >
                {REPORT_LABELS[v]}
              </Button>
            ))}
          </div>
        )}
        <Input
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="Optional: what should it focus on? e.g. exam formulas"
          maxLength={600}
          aria-label={`Guidance for the ${label.toLowerCase()}`}
        />
      </CardHeader>
      <CardContent>
        {isLoading && <div className="h-24 rounded bg-muted animate-pulse" aria-hidden />}
        {!isLoading && !content && (
          <p className="text-sm text-muted-foreground">
            Nothing generated yet. Press Generate and SparkSage will build it from this document.
          </p>
        )}
        {busy && <p className="text-sm text-muted-foreground mt-2">This can take up to a minute for audio and video.</p>}
        {!!content && <Rendered kind={kind} content={content} />}
      </CardContent>
    </Card>
  );
}

function Rendered({ kind, content }: { kind: ArtifactKind; content: unknown }) {
  switch (kind) {
    case "audio":
      return <AudioView data={content as AudioOverview} />;
    case "video":
      return <VideoView data={content as VideoOverview} />;
    case "mindmap":
      return <MindMapView root={(content as { root: MindMapNode }).root} />;
    case "report":
      return <ReportView data={content as ReportDoc} />;
    case "slides":
      return <SlidesView data={content as SlideDeck} />;
    case "infographic":
      return <InfographicView data={content as Infographic} />;
    case "table":
      return <TableView data={content as DataTable} />;
  }
}

function AudioView({ data }: { data: AudioOverview }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{data.title}</h3>
      {data.turns.map((t, i) => (
        <div key={i} className="rounded-2xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.speaker}</p>
          <p className="mt-1 text-sm text-foreground/90">{t.text}</p>
          {t.audio && <audio controls src={t.audio} className="mt-3 w-full" />}
        </div>
      ))}
    </div>
  );
}

function VideoView({ data }: { data: VideoOverview }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{data.title}</h3>
      {data.slides.map((s, i) => (
        <div key={i} className="rounded-2xl border border-border p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {s.image && (
              <img
                src={s.image}
                alt=""
                aria-hidden
                className="w-full sm:w-48 rounded-xl object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {i + 1}. {s.title}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-foreground/90 space-y-1">
                {s.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">{s.narration}</p>
              {s.audio && <audio controls src={s.audio} className="mt-3 w-full" />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MindMapView({ root }: { root: MindMapNode }) {
  return (
    <div className="overflow-auto">
      <MindMapBranch node={root} level={0} />
    </div>
  );
}

function MindMapBranch({ node, level }: { node: MindMapNode; level: number }) {
  const tones = ["bg-primary/10 border-primary/30", "bg-secondary/10 border-secondary/30", "bg-accent/10 border-accent/30"];
  return (
    <div className={level === 0 ? "" : "ml-5 border-l border-border pl-4 mt-2"}>
      <div className={`inline-block rounded-2xl border px-3 py-2 ${tones[level % tones.length]}`}>
        <p className="text-sm font-medium">{node.label}</p>
        {node.detail && <p className="text-xs text-muted-foreground mt-0.5">{node.detail}</p>}
      </div>
      {node.children?.map((c, i) => <MindMapBranch key={i} node={c} level={level + 1} />)}
    </div>
  );
}

function ReportView({ data }: { data: ReportDoc }) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{data.title}</h3>
      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 max-h-[60vh] overflow-auto">
        {data.markdown}
      </pre>
    </div>
  );
}

function SlidesView({ data }: { data: SlideDeck }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{data.title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.slides.map((s, i) => (
          <div key={i} className="rounded-2xl border border-border p-4 aspect-[4/3] flex flex-col">
            <p className="text-xs text-muted-foreground">Slide {i + 1}</p>
            <p className="font-medium mt-1">{s.title}</p>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1 flex-1 overflow-auto">
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
            {s.note && <p className="text-xs text-muted-foreground mt-2 italic">{s.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfographicView({ data }: { data: Infographic }) {
  return (
    <div className="rounded-3xl border border-border p-6 space-y-6">
      <div>
        <h3 className="text-xl font-bold">{data.headline}</h3>
        <p className="text-sm text-muted-foreground">{data.subhead}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((s, i) => (
          <div key={i} className="rounded-2xl bg-muted/50 p-4 text-center">
            <p className="text-2xl font-bold text-primary">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.sections.map((s, i) => (
          <div key={i} className="rounded-2xl border border-border p-4">
            <p className="font-medium">{s.title}</p>
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
              {s.points.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="rounded-2xl bg-accent/10 p-4 text-sm font-medium">{data.takeaway}</p>
    </div>
  );
}

function TableView({ data }: { data: DataTable }) {
  return (
    <div>
      <h3 className="font-semibold mb-3">{data.title}</h3>
      <div className="overflow-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {data.columns.map((c, i) => (
                <th key={i} scope="col" className="px-3 py-2 text-left font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
