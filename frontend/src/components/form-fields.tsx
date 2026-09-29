import { Paperclip } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  htmlFor?: string;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

export function Field({
  label,
  htmlFor,
  loading,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {loading ? <Skeleton className="h-9 w-full" /> : children}
    </div>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}

export function OptionalAttachments({
  files,
  onChange,
  disabled,
  inputId = "optional-files",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  inputId?: string;
}) {
  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!incoming.length) return;
    const next = [...files];
    for (const file of incoming) {
      const exists = next.some(
        (item) => item.name === file.name && item.size === file.size,
      );
      if (!exists) next.push(file);
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>Files</Label>
      <p className="text-xs text-muted-foreground">Optional. Up to 10MB each.</p>
      <label className="inline-flex">
        <input
          id={inputId}
          type="file"
          multiple
          className="peer sr-only"
          disabled={disabled}
          onChange={addFiles}
        />
        <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border-strong bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-soft-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
          <Paperclip className="size-3.5" />
          Choose files
        </span>
      </label>
      {files.length ? (
        <ul className="space-y-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {file.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {file.size < 1024
                    ? `${file.size} B`
                    : `${Math.round(file.size / 1024)} KB`}
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                disabled={disabled}
                onClick={() =>
                  onChange(files.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
