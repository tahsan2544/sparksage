import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Download, ImageIcon, Loader2, Palette, ShieldCheck, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { checkImagePrompt } from "@/lib/image-safety";
import { streamImage } from "@/lib/stream-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/image-studio")({
  head: () => ({
    meta: [
      { title: "AI image studio — SparkSage" },
      { name: "description", content: "Create safe, personalized educational images in SparkSage's warm visual style." },
      { property: "og:title", content: "AI image studio — SparkSage" },
      { property: "og:description", content: "Turn a study idea into a polished illustration, diagram, storybook scene, or photo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ImageStudio,
});

type Style = "sparksage" | "diagram" | "storybook" | "photoreal";
type AspectRatio = "square" | "landscape" | "portrait";

const STYLES: Array<{ value: Style; label: string; description: string }> = [
  { value: "sparksage", label: "SparkSage", description: "Soft, warm and polished" },
  { value: "diagram", label: "Study diagram", description: "Clear visual explanation" },
  { value: "storybook", label: "Storybook", description: "Friendly illustrated scene" },
  { value: "photoreal", label: "Photoreal", description: "Natural editorial photo" },
];

const RATIOS: Array<{ value: AspectRatio; label: string; className: string }> = [
  { value: "square", label: "Square", className: "aspect-square w-4" },
  { value: "landscape", label: "Wide", className: "aspect-[3/2] w-5" },
  { value: "portrait", label: "Tall", className: "aspect-[2/3] w-3" },
];

const IDEAS = [
  "A friendly visual of a plant cell as a tiny organized city",
  "A calm study desk with biology notes, morning light, and a cup of tea",
  "An educational diagram showing the water cycle without text labels",
];

function ImageStudio() {
  const [prompt, setPrompt] = useState(IDEAS[0]);
  const [style, setStyle] = useState<Style>("sparksage");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("square");
  const [image, setImage] = useState<string>();
  const [isFinal, setIsFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const outputRatio = useMemo(
    () => aspectRatio === "landscape" ? "aspect-[3/2]" : aspectRatio === "portrait" ? "aspect-[2/3] max-h-[680px]" : "aspect-square",
    [aspectRatio],
  );

  async function generate() {
    const cleanPrompt = prompt.trim();
    const safety = checkImagePrompt(cleanPrompt);
    if (!safety.safe) {
      setError(safety.message);
      toast.error("That prompt needs a safer direction.");
      return;
    }
    setBusy(true);
    setError("");
    setImage(undefined);
    setIsFinal(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired. Please sign in again.");
      await streamImage(
        "/api/generate-image",
        { prompt: cleanPrompt, style, aspectRatio },
        (nextImage, final) => {
          setImage(nextImage);
          setIsFinal(final);
        },
        { Authorization: `Bearer ${token}` },
      );
      toast.success("Your image is ready");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The image could not be generated.";
      setError(message);
      setImage(undefined);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-7 shadow-[var(--shadow-soft)] sm:px-8">
        <div aria-hidden className="blob -right-10 -top-16 h-44 w-44 bg-primary/30" />
        <div aria-hidden className="blob -bottom-20 right-1/3 h-36 w-36 bg-accent/60 [animation-delay:-8s]" />
        <div className="relative max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            <Palette className="h-3.5 w-3.5" aria-hidden /> SparkSage Image AI
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Turn ideas into visuals</h1>
          <p className="mt-2 text-muted-foreground">
            Create diagrams, study illustrations, storybook scenes, and photos in a style that fits your learning space.
          </p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="image-brief-title" className="space-y-6 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div>
            <h2 id="image-brief-title" className="font-semibold">Describe your image</h2>
            <p className="mt-1 text-sm text-muted-foreground">Be specific about the subject, setting, mood, and details.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="image-prompt">Prompt</Label>
            <Textarea
              id="image-prompt"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                if (error) setError("");
              }}
              rows={6}
              maxLength={1500}
              placeholder="Example: A labeled-free diagram of photosynthesis inside a bright green leaf…"
              aria-describedby="prompt-count"
              className="resize-none"
            />
            <p id="prompt-count" className="text-right text-xs text-muted-foreground">{prompt.length}/1500</p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Visual style</legend>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={style === option.value ? "default" : "outline"}
                  aria-pressed={style === option.value}
                  className="h-auto min-h-16 justify-start whitespace-normal px-3 py-2 text-left"
                  onClick={() => setStyle(option.value)}
                >
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="block text-xs font-normal opacity-75">{option.description}</span>
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Shape</legend>
            <div className="grid grid-cols-3 gap-2">
              {RATIOS.map((ratio) => (
                <Button
                  key={ratio.value}
                  type="button"
                  variant={aspectRatio === ratio.value ? "secondary" : "outline"}
                  aria-pressed={aspectRatio === ratio.value}
                  onClick={() => setAspectRatio(ratio.value)}
                >
                  <span aria-hidden className={cn("rounded-sm border-2 border-current", ratio.className)} />
                  {ratio.label}
                </Button>
              ))}
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

          <Button className="h-11 w-full" onClick={generate} disabled={busy || prompt.trim().length < 3}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <WandSparkles aria-hidden />}
            {busy ? "Creating your image…" : image ? "Create another" : "Create image"}
          </Button>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            Unsafe, exploitative, graphic, and illegal requests are blocked before generation and checked again by the image provider.
          </div>
        </section>

        <section aria-label="Generated image" className="space-y-3">
          <div className={cn("relative mx-auto w-full overflow-hidden rounded-3xl border border-border bg-muted/50 shadow-[var(--shadow-elegant)]", outputRatio)}>
            {image ? (
              <motion.img
                initial={{ opacity: 0.6, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                src={image}
                alt={prompt.trim() || "AI-generated study visual"}
                className={cn("h-full w-full object-cover transition-[filter] duration-700", isFinal ? "blur-0" : "blur-xl")}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <span className="float-slow inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
                  {busy ? <Loader2 className="h-7 w-7 animate-spin" aria-hidden /> : <ImageIcon className="h-7 w-7" aria-hidden />}
                </span>
                <h2 className="mt-5 font-semibold">{busy ? "Building your visual" : "Your creation appears here"}</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {busy ? "A preview will sharpen as the final image arrives." : "Choose a style and shape, then describe what you want to see."}
                </p>
              </div>
            )}
          </div>
          {image && isFinal && (
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <a href={image} download={`sparksage-${Date.now()}.png`}><Download aria-hidden /> Download PNG</a>
              </Button>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="idea-title" className="space-y-3">
        <h2 id="idea-title" className="text-sm font-semibold">Need a starting point?</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {IDEAS.map((idea) => (
            <Button key={idea} type="button" variant="outline" className="h-auto min-h-16 justify-start whitespace-normal p-4 text-left" onClick={() => setPrompt(idea)}>
              {idea}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}