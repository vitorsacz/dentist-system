import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "error" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-success-light text-success-text",
  warning: "bg-warning-light text-warning-text",
  error: "bg-error-light text-error-text",
  neutral: "bg-line text-muted",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}
