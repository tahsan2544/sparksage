// Plan usage meters: shows how much of each metered feature the student has
// used this month/day. Limits come from the database and are enforced
// server-side, so these numbers match what the API actually allows.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsage } from "@/lib/access.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Gauge } from "lucide-react";

const LABELS: Record<string, string> = {
  documents: "Documents",
  ai_chat_messages_per_day: "AI chat messages today",
  quiz_generations_per_day: "Quizzes today",
  flashcard_generations_per_day: "Flashcard decks today",
  summaries_per_day: "Summaries today",
};

export function UsageMeters() {
  const usageFn = useServerFn(getUsage);
  const { data } = useQuery({ queryKey: ["usage"], queryFn: () => usageFn() });

  const rows = (data ?? []).filter((r) => r.limit !== null);
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" aria-hidden /> Your plan usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row) => {
          const limit = row.limit as number;
          const pct = limit === 0 ? 100 : Math.min(100, Math.round((row.used / limit) * 100));
          return (
            <div key={row.feature}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{LABELS[row.feature] ?? row.feature}</span>
                <span className="font-medium">
                  {row.used} of {limit} used
                </span>
              </div>
              <Progress value={pct} className="h-1.5" aria-label={`${LABELS[row.feature]} usage`} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
