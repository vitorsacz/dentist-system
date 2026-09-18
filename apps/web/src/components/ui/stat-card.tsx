import type { ReactNode } from "react";
import { Card } from "./card";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  secondary?: ReactNode;
  breakdown?: ReactNode;
}

export function StatCard({ label, value, icon, secondary, breakdown }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {icon && <span className="rounded-lg bg-gray-100 p-3 text-accent">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-ink">{value}</p>
          {secondary && <p className="mt-1 text-sm text-muted">{secondary}</p>}
        </div>
        {breakdown && <div className="flex flex-wrap justify-end gap-1.5">{breakdown}</div>}
      </div>
    </Card>
  );
}
