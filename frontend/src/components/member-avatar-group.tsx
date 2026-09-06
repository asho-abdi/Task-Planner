import { cn } from "@/lib/utils";

type Person = { id: string; name: string };

export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[#EEF2F6] font-semibold text-[#172033]",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function MemberAvatarGroup({
  people,
  limit = 4,
}: {
  people: Person[];
  limit?: number;
}) {
  const shown = people.slice(0, limit);
  const extra = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <span
          key={person.id}
          title={person.name}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-accent text-[10px] font-semibold text-accent-foreground",
            index > 0 ? "-ml-2" : "",
          )}
        >
          {initials(person.name)}
        </span>
      ))}
      {extra > 0 ? (
        <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-secondary text-[10px] font-medium text-muted-foreground">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
