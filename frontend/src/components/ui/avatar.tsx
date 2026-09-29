"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-muted font-medium",
  {
    variants: {
      size: {
        xs: "size-5 text-3xs",
        sm: "size-6 text-2xs",
        default: "size-8 text-xs",
        lg: "size-10 text-sm",
        xl: "size-14 text-lg",
      },
    },
    defaultVariants: { size: "default" },
  },
);

// Deterministic, token-based tints so the same person always gets the same colour.
const TINTS = [
  "bg-primary-soft text-primary-soft-foreground",
  "bg-info-soft text-info-soft-foreground",
  "bg-success-soft text-success-soft-foreground",
  "bg-warning-soft text-warning-soft-foreground",
  "bg-danger-soft text-danger-soft-foreground",
];

export function initialsOf(name?: string | null) {
  if (!name) return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function tintFor(seed?: string | null) {
  if (!seed) return TINTS[0];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return TINTS[Math.abs(hash) % TINTS.length];
}

type AvatarProps = React.ComponentProps<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants> & {
    name?: string | null;
    src?: string | null;
    /** Optional presence dot. */
    status?: "online" | "offline";
  };

function Avatar({ className, size, name, src, status, ...props }: AvatarProps) {
  return (
    <span className="relative inline-flex shrink-0">
      <AvatarPrimitive.Root
        className={cn(avatarVariants({ size }), tintFor(name), className)}
        {...props}
      >
        {src ? (
          <AvatarPrimitive.Image
            src={src}
            alt={name ?? ""}
            className="size-full object-cover"
          />
        ) : null}
        <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} aria-label={name ?? undefined}>
          {initialsOf(name)}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {status ? (
        <span
          aria-label={status}
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-card",
            status === "online" ? "bg-success" : "bg-subtle-foreground",
          )}
        />
      ) : null}
    </span>
  );
}

function AvatarStack({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: Array<{ id?: string; name?: string | null; avatarUrl?: string | null }>;
  max?: number;
  size?: VariantProps<typeof avatarVariants>["size"];
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((person, index) => (
        <Avatar
          key={person.id ?? index}
          name={person.name}
          src={person.avatarUrl}
          size={size}
          title={person.name ?? undefined}
          className="ring-2 ring-card"
        />
      ))}
      {rest > 0 ? (
        <span
          className={cn(
            avatarVariants({ size }),
            "bg-muted text-muted-foreground ring-2 ring-card",
          )}
          title={`${rest} more`}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  );
}

export { Avatar, AvatarStack, avatarVariants };
