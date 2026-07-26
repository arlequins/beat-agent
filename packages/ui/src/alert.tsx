import { cn } from "@arlequins/ui";

export function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "destructive" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 text-sm",
        variant === "destructive" &&
          "border-destructive/40 bg-destructive/10 text-destructive",
        className,
      )}
      data-slot="alert"
      role="alert"
      {...props}
    />
  );
}
