import { Avatar, AvatarStack } from "@/components/ui/avatar";

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
    <Avatar
      name={name}
      title={name}
      size={size === "sm" ? "sm" : "default"}
      className={className}
    />
  );
}

export function MemberAvatarGroup({
  people,
  limit = 4,
}: {
  people: Person[];
  limit?: number;
}) {
  return <AvatarStack people={people} max={limit} size="sm" />;
}
