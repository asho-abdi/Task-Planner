import * as React from "react";
import { cn, fieldBaseClass } from "@/lib/utils";

export { fieldBaseClass };

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBaseClass,
        "flex h-9 px-3 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBaseClass, "flex min-h-24 px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export { Input, Textarea };
