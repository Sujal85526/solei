import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * Display heading whose words rise out of a mask one after another when it scrolls into view.
 * `lines` render as separate lines; `italic` picks which lines are set in italic. Markup is plain
 * text inside spans (readable without JavaScript and by screen readers); the motion is CSS
 * (globals.css "Split heading"), driven by the shared Reveal observer.
 */
export function SplitHeading({
  as: Tag = "h2",
  id,
  lines,
  italic = [lines.length - 1],
  className,
}: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  lines: string[];
  italic?: number[];
  className?: string;
}) {
  let word = 0;
  return (
    <Reveal data-split="">
      <Tag id={id} className={cn("display", className)}>
        {lines.map((line, l) => (
          <span key={l} className={cn("block", italic.includes(l) && "italic")}>
            {line.split(" ").map((w, i) => (
              <Word key={i} index={word++}>
                {w}
              </Word>
            ))}
          </span>
        ))}
      </Tag>
    </Reveal>
  );
}

function Word({ index, children }: { index: number; children: ReactNode }) {
  return (
    <>
      <span className="split-word">
        <span style={{ "--i": index } as React.CSSProperties}>{children}</span>
      </span>{" "}
    </>
  );
}
