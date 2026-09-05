/**
 * Drag-and-drop upload area for the document library.
 *
 * Accepts several files at once, reads each one in the browser (PDF, Word,
 * PowerPoint, text) or through AI transcription (photos), and creates one
 * document per file while showing per-file progress, errors and retries.
 */
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, AlertCircle, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDocument } from "@/lib/documents.functions";
import { readImageText } from "@/lib/extract.functions";
import { extractText, DOCUMENT_ACCEPT } from "@/lib/extract-text";

type Status = "reading" | "saving" | "done" | "error";

interface QueueItem {
  id: string;
  name: string;
  status: Status;
  message?: string;
  documentId?: string;
}

const MAX_BYTES = 20 * 1024 * 1024;

export function UploadDropzone({ compact = false }: { compact?: boolean }) {
  const create = useServerFn(createDocument);
  const ocr = useServerFn(readImageText);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    setQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const ingest = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const items: QueueItem[] = files.map((f) => ({
        id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        status: "reading",
      }));
      setQueue((q) => [...items, ...q]);

      let lastId: string | undefined;
      for (const [i, file] of files.entries()) {
        const item = items[i]!;
        try {
          if (file.size > MAX_BYTES) throw new Error("Files must be under 20 MB.");
          const result = await extractText(file);
          let text = result.text;
          if (result.kind === "image" && result.dataUrl) {
            if (file.size > 5 * 1024 * 1024) throw new Error("Photos must be under 5 MB to be read.");
            text = (await ocr({ data: { fileName: file.name, dataUrl: result.dataUrl } })).text;
          }
          if (!text.trim()) throw new Error("We couldn't find any text in this file.");
          update(item.id, { status: "saving" });
          const { id } = await create({
            data: {
              title: file.name.replace(/\.[^.]+$/, "").slice(0, 200),
              content: text.slice(0, 200_000),
            },
          });
          lastId = id;
          update(item.id, { status: "done", documentId: id });
        } catch (err) {
          update(item.id, {
            status: "error",
            message: err instanceof Error ? err.message : "Could not read this file.",
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["documents"] });
      if (lastId) {
        toast.success(files.length > 1 ? "Your files are ready to study" : "Your file is ready to study");
        if (files.length === 1) navigate({ to: "/documents/$documentId", params: { documentId: lastId } });
      }
    },
    [create, ocr, qc, navigate, update],
  );

  const busy = queue.some((q) => q.status === "reading" || q.status === "saving");

  return (
    <div className={compact ? "" : "mb-6"}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents by dropping files here or pressing Enter to browse"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void ingest(Array.from(e.dataTransfer.files));
        }}
        className={[
          "cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
        ].join(" ")}
      >
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-primary" aria-hidden />
        <p className="font-medium">Drop your study material here</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDFs, Word, PowerPoint, text files or photos of your notes — several at once is fine.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void ingest(files);
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {queue.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.status === "reading" && "Reading the file…"}
                  {item.status === "saving" && "Saving to your library…"}
                  {item.status === "done" && "Ready to study"}
                  {item.status === "error" && item.message}
                </p>
              </div>
              {item.status === "done" && item.documentId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigate({ to: "/documents/$documentId", params: { documentId: item.documentId! } })
                  }
                >
                  Open
                </Button>
              )}
              {(item.status === "done" || item.status === "error") && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Dismiss ${item.name}`}
                  onClick={() => setQueue((q) => q.filter((x) => x.id !== item.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {busy && <p className="sr-only">Uploading your files…</p>}
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />;
  if (status === "error") return <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />;
  if (status === "saving") return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
  return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />;
}
