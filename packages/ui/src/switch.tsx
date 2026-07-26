"use client";

import { cn } from "@arlequins/ui";
import { Switch as SwitchPrimitive } from "radix-ui";

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "bg-input data-[state=checked]:bg-primary inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-background pointer-events-none block size-4 translate-x-0.5 rounded-full shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
