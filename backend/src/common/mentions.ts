export function mentionTokens(text: string) {
  return [...text.matchAll(/@([A-Za-z0-9._-]+)/g)].map((match) =>
    match[1].toLowerCase(),
  );
}

export function resolveMentionedUserIds(
  text: string,
  members: Array<{ id: string; name: string; email: string }>,
) {
  const tokens = mentionTokens(text);
  const ids = new Set<string>();
  for (const token of tokens) {
    for (const member of members) {
      const compact = member.name.toLowerCase().replace(/\s+/g, '');
      const first = member.name.split(/\s+/)[0]?.toLowerCase() ?? '';
      const email = member.email.split('@')[0]?.toLowerCase() ?? '';
      if (
        member.id === token ||
        compact === token ||
        first === token ||
        email === token
      ) {
        ids.add(member.id);
      }
    }
  }
  return [...ids];
}
