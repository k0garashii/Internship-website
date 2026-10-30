const AVAILABILITY_REQUEST_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 300_000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const EXPIRED_CONTENT_PATTERNS = [
  /offre (?:n[’']est plus disponible|a expir[ée]|expir[ée]e|n[’']existe plus|a [ée]t[ée] pourvue|est pourvue|est cl[oô]tur[ée]e)/i,
  /(?:poste|annonce) (?:a [ée]t[ée] pourvu|n[’']est plus (?:disponible|en ligne)|a expir[ée])/i,
  /candidatures? (?:sont |est )?(?:closes?|cl[oô]tur[ée]es?)/i,
  /(?:this )?(?:job|position|posting|offer) (?:is )?(?:no longer (?:available|open|active)|has (?:expired|been filled|closed))/i,
  /no longer accepting applications/i,
];

export type OfferAvailability = "available" | "expired" | "unknown";

export function detectOfferAvailability(status: number, html: string | null): OfferAvailability {
  if (status === 404 || status === 410) {
    return "expired";
  }

  if (status < 200 || status >= 300 || html === null) {
    return "unknown";
  }

  return EXPIRED_CONTENT_PATTERNS.some((pattern) => pattern.test(html)) ? "expired" : "available";
}

// Anti-bot pages (403, 429) and network errors stay "unknown": an offer is
// only marked expired on a clear signal.
export async function checkOfferAvailability(url: string): Promise<OfferAvailability> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(AVAILABILITY_REQUEST_TIMEOUT_MS),
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const html =
      response.ok && contentType.includes("text/html")
        ? (await response.text()).slice(0, MAX_HTML_BYTES)
        : response.ok
          ? ""
          : null;

    return detectOfferAvailability(response.status, html);
  } catch {
    return "unknown";
  }
}
