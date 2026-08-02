// Global search (Ctrl/Cmd + K) across documents and planner goals.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, CalendarDays, MessagesSquare, Search } from "lucide-react";

import { listDocuments } from "@/lib/documents.functions";
import { listGoals } from "@/lib/study.functions";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const docsFn = useServerFn(listDocuments);
  const goalsFn = useServerFn(listGoals);

  // Only fetch once the palette is opened — keeps first paint fast.
  const { data: docs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => docsFn(),
    enabled: open,
  });
  const { data: goals = [] } = useQuery({
    queryKey: ["study-goals"],
    queryFn: () => goalsFn(),
    enabled: open,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const documents = useMemo(
    () => (docs as Array<{ id: string; title: string }>).slice(0, 20),
    [docs],
  );
  const tasks = useMemo(
    () => (goals as Array<{ id: string; title: string; due_date: string }>).slice(0, 20),
    [goals],
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-muted-foreground"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden md:inline rounded border border-border bg-muted px-1.5 text-[10px]">Ctrl K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search documents, planner tasks, pages…" />
        <CommandList>
          <CommandEmpty>No matches found.</CommandEmpty>
          <CommandGroup heading="Go to">
            <CommandItem
              value="chat with sparksage ai tutor"
              onSelect={() => {
                setOpen(false);
                navigate({ to: "/chat" });
              }}
            >
              <MessagesSquare className="h-4 w-4 mr-2" aria-hidden />
              Chat with SparkSage AI
            </CommandItem>
          </CommandGroup>
          {documents.length > 0 && (
            <CommandGroup heading="Documents">
              {documents.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`document ${d.title}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate({ to: "/documents/$documentId", params: { documentId: d.id } });
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" aria-hidden />
                  {d.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {tasks.length > 0 && (
            <CommandGroup heading="Planner">
              {tasks.map((t) => (
                <CommandItem
                  key={t.id}
                  value={`task ${t.title}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate({ to: "/planner" });
                  }}
                >
                  <CalendarDays className="h-4 w-4 mr-2" aria-hidden />
                  {t.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
