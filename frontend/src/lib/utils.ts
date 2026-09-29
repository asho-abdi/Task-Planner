import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function readImageAsDataUrl(file: File, maxBytes = 350_000) {
  if (file.size > maxBytes) {
    return Promise.reject(
      new Error("Image is too large. Use a file under 350 KB."),
    );
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image"));
    reader.readAsDataURL(file);
  });
}

/** Shared field chrome for inputs, native selects and textareas. */
export const fieldBaseClass = [
  "w-full rounded-md border border-input bg-card text-base text-foreground shadow-xs",
  "transition-[border-color,box-shadow] duration-150",
  "placeholder:text-subtle-foreground",
  "hover:border-border-strong",
  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
].join(" ");

export const nativeSelectClass = `${fieldBaseClass} flex h-9 px-2.5`;

export const nativeTextareaClass = `${fieldBaseClass} flex min-h-24 px-3 py-2 leading-relaxed`;

export function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function fromDateInputValue(value: string) {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

export function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

export function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function localDateYmd(value: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
