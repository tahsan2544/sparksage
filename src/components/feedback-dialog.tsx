// Lightweight "Send feedback" dialog available to every signed-in student
// from the app header. Feedback lands in the Owner's inbox.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { submitFeedback } from "@/lib/owner.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES = [
  { value: "bug", label: "Bug report" },
  { value: "feature_request", label: "Feature request" },
  { value: "suggestion", label: "Suggestion" },
  { value: "review", label: "Review" },
  { value: "complaint", label: "Complaint" },
  { value: "question", label: "Question" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function FeedbackDialog() {
  const submitFn = useServerFn(submitFeedback);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          category,
          subject: subject.trim(),
          message: message.trim(),
          pageUrl: typeof window === "undefined" ? undefined : window.location.pathname,
        },
      }),
    onSuccess: () => {
      toast.success("Thanks! Your feedback is on its way.");
      setSubject("");
      setMessage("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = subject.trim().length >= 3 && message.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Send feedback">
          <MessageSquarePlus className="h-4 w-4" />
          <span className="ml-2 hidden md:inline">Feedback</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Found a bug or have an idea? We read every message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-category">Type</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger id="fb-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-subject">Subject</Label>
            <Input
              id="fb-subject"
              value={subject}
              maxLength={140}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quiz scores aren't saving"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-message">Message</Label>
            <Textarea
              id="fb-message"
              rows={4}
              maxLength={4000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what happened or what you'd love to see…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? "Sending…" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
