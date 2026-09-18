import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function AlertBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-warning-solid/20 bg-warning-light px-5 py-4 text-sm text-warning-text">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
