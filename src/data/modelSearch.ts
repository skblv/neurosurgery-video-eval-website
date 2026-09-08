export function matchesModelSearch(name: string, query: string): boolean {
  const text = name.toLocaleLowerCase();
  return query.toLocaleLowerCase().trim().split(/\s+/)
    .map((term) => term.replace(/\.+$/, ""))
    .every((term) => text.includes(term));
}
