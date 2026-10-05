// Reveals new AI answers one word at a time, matching the cadence of a
// streaming LLM. The full text is already in memory; older replies skip it.
import { useEffect, useRef, useState } from "react";

interface TypewriterProps {
  text: string;
  /** Set false for messages that were already on screen (history). */
  animate?: boolean;
  /** Words revealed per second. */
  speed?: number;
  /** Called on every reveal tick, e.g. to keep the transcript scrolled down. */
  onTick?: () => void;
  className?: string;
}

/** Strip the markdown markers the model sometimes emits so plain text reads cleanly. */
function tidy(raw: string) {
  return raw
    .replace(/^\s*(\*\s*){3,}$/gm, "———")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*]\s+/gm, "• ");
}

export function Typewriter({ text: raw, animate = true, speed = 18, onTick, className }: TypewriterProps) {
  const text = tidy(raw);
  const [shown, setShown] = useState(() => (animate ? "" : text));
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!animate) {
      setShown(text);
      return;
    }
    // Respect users who ask for reduced motion — show the answer at once.
    const reduced =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(text);
      return;
    }

    const words = text.match(/\S+\s*/g) ?? [];
    if (words.length === 0) {
      setShown(text);
      return;
    }

    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const revealNextWord = () => {
      index += 1;
      setShown(words.slice(0, index).join(""));
      tickRef.current?.();
      if (index >= words.length) return;

      const word = words[index - 1]?.trim() ?? "";
      const baseDelay = 1000 / Math.max(speed, 1);
      const punctuationPause = /[.!?]$/.test(word) ? 110 : /[,;:]$/.test(word) ? 45 : 0;
      timer = setTimeout(revealNextWord, baseDelay + punctuationPause);
    };

    setShown("");
    timer = setTimeout(revealNextWord, 80);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [text, animate, speed]);

  const done = shown.length >= text.length;
  return (
    <span className={className} aria-live="polite">
      <span aria-hidden={!done}>{shown}</span>
      {!done && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current" aria-hidden />}
      {/* Screen readers get the finished answer once, not every animation tick. */}
      {!done && <span className="sr-only">{text}</span>}
    </span>
  );
}
