const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lt: "<",
  gt: ">",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  auml: "ä",
  ccedil: "ç",
  icirc: "î",
  iuml: "ï",
  ocirc: "ô",
  ouml: "ö",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeHtmlEntitiesOnce(value: string) {
  return value
    .replace(/&([a-z]+);/gi, (match, entity) => {
      const decoded = NAMED_HTML_ENTITIES[entity.toLowerCase()];
      return decoded ?? match;
    })
    .replace(/&#(\d+);/g, (_match, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : "";
    });
}

function decodeHtmlEntities(value: string) {
  let current = value;

  for (let index = 0; index < 3; index += 1) {
    const next = decodeHtmlEntitiesOnce(current);

    if (next === current) {
      break;
    }

    current = next;
  }

  return current;
}

function countMojibakeMarkers(value: string) {
  const matches = value.match(/[ÃÂâ€]/g);
  return matches?.length ?? 0;
}

function repairMojibake(value: string) {
  if (!/[ÃÂâ€]/.test(value)) {
    return value;
  }

  try {
    const repaired = Buffer.from(value, "latin1").toString("utf8");

    if (countMojibakeMarkers(repaired) < countMojibakeMarkers(value)) {
      return repaired;
    }
  } catch {
    return value;
  }

  return value;
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function removeHtmlAttributeNoise(value: string) {
  return value
    .replace(/\b(?:href|class|target|rel|src|style|id|title|data-[\w-]+)=["'][^"']*["']/gi, " ")
    .replace(/\b(?:href|class|target|rel|src|style|id|title|data-[\w-]+)=\S+/gi, " ");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanHumanText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const decoded = decodeHtmlEntities(value);
  const withoutTags = stripTags(decoded);
  const decodedAgain = decodeHtmlEntities(withoutTags);
  const repaired = repairMojibake(decodedAgain);
  const withoutNoise = removeHtmlAttributeNoise(repaired);
  const normalized = normalizeWhitespace(withoutNoise);

  return normalized || null;
}

export function isHumanReadableSnippet(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = cleanHumanText(value);

  if (!normalized) {
    return false;
  }

  if (/[<>]/.test(normalized) || /\bhref\s*=|class\s*=|target\s*=/i.test(normalized)) {
    return false;
  }

  const letterCount = (normalized.match(/\p{L}/gu) ?? []).length;
  return letterCount >= 12;
}
