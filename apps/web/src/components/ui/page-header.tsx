import type { ReactNode } from "react";

interface PageHeaderProps {
  breadcrumb: string;
  title: string;
  action?: ReactNode;
}

export function PageHeader({ breadcrumb, title, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm text-muted">{breadcrumb}</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
      </div>
      {action}
    </div>
  );
}
