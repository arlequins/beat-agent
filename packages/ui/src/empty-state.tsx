import { cn } from "@arlequins/ui";
import type { LucideIcon } from "lucide-react";

export function EmptyState(props: {
  action?: React.ReactNode;
  className?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center",
        props.className,
      )}
      data-slot="empty-state"
    >
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-semibold">{props.title}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        {props.description}
      </p>
      {props.action && <div className="mt-4">{props.action}</div>}
    </div>
  );
}
