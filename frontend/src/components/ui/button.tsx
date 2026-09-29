import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        outline:
          "border border-border bg-card text-foreground shadow-xs hover:border-border-strong hover:bg-muted",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground",
        soft:
          "bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft/70",
        destructive:
          "bg-danger text-danger-foreground shadow-xs hover:bg-danger-hover",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 gap-1.5 rounded-sm px-2 text-xs [&_svg]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-sm [&_svg]:size-3.5",
        default: "h-9 px-3.5 text-base",
        lg: "h-10 px-5 text-md",
        xl: "h-12 rounded-lg px-6 text-md",
        icon: "size-9",
        "icon-sm": "size-8 [&_svg]:size-4",
        "icon-xs": "size-7 rounded-sm [&_svg]:size-3.5",
      },
    },
    compoundVariants: [
      { variant: "link", size: ["xs", "sm", "default", "lg"], className: "h-auto px-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner, keeps the width stable and disables interaction. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
          <span className="invisible inline-flex items-center gap-[inherit]">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
