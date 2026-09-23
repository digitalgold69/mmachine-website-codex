type Searchable = Record<string, unknown>;

function normaliseSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\u00a0/g, " ")
    .replace(/\u00d7/g, "x")
    .replace(/&/g, " and ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactSearchText(value: string) {
  return value.replace(/[^a-z0-9]+/g, "");
}

function searchTokens(query: string) {
  const normalised = normaliseSearchText(query);
  const loose = normalised
    .replace(/[^a-z0-9./"'-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return [...new Set(loose)];
}

function collectSearchValues(value: unknown, out: string[], seen: Set<unknown>, depth = 0) {
  if (value === null || value === undefined || depth > 3) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = normaliseSearchText(value);
    if (text) out.push(text);
    return;
  }
  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectSearchValues(item, out, seen, depth + 1));
    return;
  }

  Object.values(value as Searchable).forEach((item) => collectSearchValues(item, out, seen, depth + 1));
}

export function catalogueSearchText(item: Searchable) {
  const values: string[] = [];
  collectSearchValues(item, values, new Set());
  return values.join(" ");
}

export function catalogueSearchMatches(item: Searchable, query: string) {
  return catalogueSearchScore(item, query) > 0;
}

export function catalogueSearchScore(item: Searchable, query: string) {
  const tokens = searchTokens(query);
  if (!tokens.length) return 1;

  const text = catalogueSearchText(item);
  const compactText = compactSearchText(text);
  const phrase = normaliseSearchText(query);
  const compactPhrase = compactSearchText(phrase);
  let score = 0;
  let matchedTokens = 0;

  if (phrase && text.includes(phrase)) score += 120;
  if (compactPhrase && compactText.includes(compactPhrase)) score += 80;

  for (const token of tokens) {
    const compactToken = compactSearchText(token);
    const directMatch = text.includes(token);
    const compactMatch = compactToken.length > 1 && compactText.includes(compactToken);
    if (!directMatch && !compactMatch) continue;

    matchedTokens += 1;
    score += 20;
    if (new RegExp(`(^|\\s)${escapeRegExp(token)}`).test(text)) score += 8;
    if (compactToken.length > 1 && compactText.startsWith(compactToken)) score += 12;
  }

  if (!matchedTokens) return 0;
  if (matchedTokens === tokens.length) score += 60;
  return score + matchedTokens;
}

export function filterAndRankCatalogueProducts<T extends object>(items: T[], query: string) {
  const trimmed = query.trim();
  if (!trimmed) return items;

  return items
    .map((item, index) => ({ item, index, score: catalogueSearchScore(item as Searchable, trimmed) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
