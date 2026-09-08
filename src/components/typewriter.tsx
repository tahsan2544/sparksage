// Reveals AI answers one letter at a time so a reply feels like it is being
// typed. Purely presentational: the full text is already in memory, we just
// unveil it smoothly (and skip the animation for older messages).
import { useEffect, useRef, useState } from "react";

interface TypewriterProps {
  text: string;
  /** Set false for messages that were already on screen (history). */
  animate?: boolean;
  /** Characters revealed per second. */
  speed?: number;
  /** Called on every reveal tick, e.g. to keep the transcript scrolled down. */
  onTick?: () => void;
  className?: string;
}

export function Typewriter({ text, animate = true, speed = 220, onTick, className }: TypewriterProps) {
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

    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const chars = Math.min(text.length, Math.floor(((now - start) / 1000) * speed));
      setShown(text.slice(0, chars));
      tickRef.current?.();
      if (chars < text.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, animate, speed]);

  const done = shown.length >= text.length;
  return (
    <span className={className}>
      {shown}
      {!done && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current" aria-hidden />}
      {/* Screen readers get the finished answer, not each keystroke. */}
      {!done && <span className="sr-only">{text}</span>}
    </span>
  );
}
