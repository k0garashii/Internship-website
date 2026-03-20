import { InboundEmailSignal, InboundEmailStatus } from "@prisma/client";

import { normalizeInboundEmailOpportunityPreview } from "@/lib/search/normalization";
import type { NormalizedOpportunity } from "@/lib/search/types";

type OpportunitySourceKind = NormalizedOpportunity["sourceKind"];

export type InboundEmailOpportunityCandidate = {
  id: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  bodyPreview: string | null;
  snippet: string | null;
  canonicalUrl: string | null;
  signal: InboundEmailSignal;
  receivedAt: Date | string;
};

export type ParsedInboundEmailOpportunity = {
  processingStatus: InboundEmailStatus;
  normalizedOpportunity: NormalizedOpportunity | null;
  parsingSummary: string;
  parsingNotes: string[];
};

type ParsedSourceMetadata = {
  sourceKind: OpportunitySourceKind;
  sourceProvider: string;
  sourceLabel: string;
};

const IGNORE_SUBJECT_HINTS = [
  "application received",
  "candidature recue",
  "merci pour votre candidature",
  "thank you for applying",
  "we received your application",
  "application update",
  "mise a jour candidature",
];

const OPPORTUNITY_HINTS = [
  "stage",
  "internship",
  "alternance",
  "apprenticeship",
  "job",
  "role",
  "position",
  "opportunite",
  "opportunity",
  "software engineer",
  "engineer",
  "developpeur",
  "developer",
  "simulation",
  "graphics",
  "physics",
  "research",
  "scientific",
  "r&d",
];

const GENERIC_COMPANY_HINTS = [
  "linkedin",
  "indeed",
  "jobteaser",
  "welcome to the jungle",
  "welcometothejungle",
  "greenhouse",
  "workday",
  "lever",
  "smartrecruiters",
  "teamtailor",
  "ashby",
  "noreply",
  "no-reply",
  "recruiting",
  "careers",
  "jobs",
  "talent",
];

const SOURCE_HINTS: Array<{
  matchers: string[];
  sourceKind: OpportunitySourceKind;
  sourceProvider: string;
  sourceLabel: string;
}> = [
  {
    matchers: ["linkedin"],
    sourceKind: "JOB_BOARD",
    sourceProvider: "linkedin",
    sourceLabel: "LinkedIn Jobs",
  },
  {
    matchers: ["indeed"],
    sourceKind: "JOB_BOARD",
    sourceProvider: "indeed",
    sourceLabel: "Indeed",
  },
  {
    matchers: ["jobteaser"],
    sourceKind: "JOB_BOARD",
    sourceProvider: "jobteaser",
    sourceLabel: "JobTeaser",
  },
  {
    matchers: ["welcometothejungle", "welcome to the jungle", "wttj"],
    sourceKind: "JOB_BOARD",
    sourceProvider: "wttj",
    sourceLabel: "Welcome to the Jungle",
  },
  {
    matchers: ["greenhouse"],
    sourceKind: "COMPANY_CAREERS",
    sourceProvider: "greenhouse",
    sourceLabel: "Greenhouse",
  },
  {
    matchers: ["workday"],
    sourceKind: "COMPANY_CAREERS",
    sourceProvider: "workday",
    sourceLabel: "Workday",
  },
  {
    matchers: ["lever"],
    sourceKind: "COMPANY_CAREERS",
    sourceProvider: "lever",
    sourceLabel: "Lever",
  },
  {
    matchers: ["smartrecruiters"],
    sourceKind: "COMPANY_CAREERS",
    sourceProvider: "smartrecruiters",
    sourceLabel: "SmartRecruiters",
  },
  {
    matchers: ["teamtailor"],
    sourceKind: "COMPANY_CAREERS",
    sourceProvider: "teamtailor",
    sourceLabel: "Teamtailor",
  },
  {
    matchers: ["ashby"],
    sourceKind: "COMPANY_CAREERS",
    sourceProvider: "ashby",
    sourceLabel: "Ashby",
  },
];

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeWhitespace(value: string | null | undefined) {
  return normalizeText(value)?.replace(/\s+/g, " ") ?? null;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function titleCaseToken(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((token) => {
      if (token.length <= 3 && token === token.toUpperCase()) {
        return token;
      }

      return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function extractHostnameFromUrl(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function extractDomainFromEmail(email: string | null) {
  const normalized = normalizeText(email)?.toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return null;
  }

  return normalized.split("@").at(-1) ?? null;
}

function stripKnownSubdomains(hostname: string) {
  return hostname
    .replace(/^www\./, "")
    .replace(/^jobs\./, "")
    .replace(/^careers\./, "")
    .replace(/^talent\./, "")
    .replace(/^apply\./, "")
    .replace(/^boards\./, "");
}

function formatDomainAsCompany(hostname: string | null) {
  if (!hostname) {
    return null;
  }

  const stripped = stripKnownSubdomains(hostname);
  const firstLabel = stripped.split(".")[0];

  if (!firstLabel || GENERIC_COMPANY_HINTS.some((hint) => firstLabel.includes(hint))) {
    return null;
  }

  return titleCaseToken(firstLabel.replace(/[^a-z0-9&+.'-]+/gi, " "));
}

function isGenericCompanyName(value: string | null) {
  const normalized = normalizeText(value)?.toLowerCase();

  if (!normalized) {
    return true;
  }

  return GENERIC_COMPANY_HINTS.some((hint) => normalized.includes(hint));
}

function stripWrappingPunctuation(value: string | null) {
  return (
    normalizeText(value)
      ?.replace(/^[\s"'([{]+/g, "")
      .replace(/[\s"'.,:;!?-]+$/g, "") ?? null
  );
}

function detectSourceMetadata(input: InboundEmailOpportunityCandidate): ParsedSourceMetadata {
  const joinedHints = [
    extractDomainFromEmail(input.fromEmail),
    extractHostnameFromUrl(input.canonicalUrl),
    input.fromName,
    input.subject,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matched = SOURCE_HINTS.find((entry) =>
    entry.matchers.some((matcher) => joinedHints.includes(matcher)),
  );

  if (matched) {
    return matched;
  }

  switch (input.signal) {
    case InboundEmailSignal.JOB_ALERT:
      return {
        sourceKind: "JOB_BOARD",
        sourceProvider: "email-alert",
        sourceLabel: "Alerte email",
      };
    case InboundEmailSignal.CAREER_SITE_DIGEST:
      return {
        sourceKind: "COMPANY_CAREERS",
        sourceProvider: "career-site",
        sourceLabel: "Site carrieres",
      };
    case InboundEmailSignal.RECRUITER_OUTREACH:
      return {
        sourceKind: "INBOUND_EMAIL",
        sourceProvider: "recruiter-email",
        sourceLabel: "Email recruteur",
      };
    case InboundEmailSignal.SCHOOL_CAREER_DIGEST:
      return {
        sourceKind: "INBOUND_EMAIL",
        sourceProvider: "school-career",
        sourceLabel: "Diffusion ecole",
      };
    default:
      return {
        sourceKind: "INBOUND_EMAIL",
        sourceProvider: "forwarding",
        sourceLabel: "Forwarding dedie",
      };
  }
}

function extractCompanyFromText(input: string | null) {
  const value = normalizeWhitespace(input);

  if (!value) {
    return null;
  }

  const patterns = [
    /\b(?:chez|at|for|from)\s+([A-Z0-9][A-Za-z0-9&+.'()/-]*(?:\s+[A-Z0-9][A-Za-z0-9&+.'()/-]*){0,4})/,
    /\b(?:company|entreprise)\s*[:\-]\s*([A-Z0-9][A-Za-z0-9&+.'()/-]*(?:\s+[A-Z0-9][A-Za-z0-9&+.'()/-]*){0,4})/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    const candidate = stripWrappingPunctuation(match?.[1] ?? null);

    if (candidate && !isGenericCompanyName(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractCompanyName(
  input: InboundEmailOpportunityCandidate,
  sourceMetadata: ParsedSourceMetadata,
) {
  const textCandidates = [input.subject, input.snippet, input.bodyPreview];

  for (const candidate of textCandidates) {
    const extracted = extractCompanyFromText(candidate);

    if (extracted) {
      return extracted;
    }
  }

  if (!isGenericCompanyName(input.fromName)) {
    return stripWrappingPunctuation(input.fromName);
  }

  const companyFromUrl = formatDomainAsCompany(extractHostnameFromUrl(input.canonicalUrl));

  if (companyFromUrl) {
    return companyFromUrl;
  }

  if (sourceMetadata.sourceKind === "INBOUND_EMAIL") {
    return stripWrappingPunctuation(input.fromName ?? input.fromEmail);
  }

  return null;
}

function stripSubjectPrefix(subject: string) {
  return subject
    .replace(/^(new|nouveau|nouvelles?)\s+/i, "")
    .replace(/^(job alert|alerte emploi|your job alert)\s*[:\-]\s*/i, "")
    .replace(/^(opportunite|opportunity|poste|role)\s*[:\-]\s*/i, "")
    .trim();
}

function extractTitleFromSubject(subject: string, companyName: string | null) {
  const cleaned = stripWrappingPunctuation(stripSubjectPrefix(subject));

  if (!cleaned) {
    return null;
  }

  if (companyName) {
    const atPattern = new RegExp(
      `(.+?)\\s+(?:chez|at|for)\\s+${companyName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`,
      "i",
    );
    const atMatch = cleaned.match(atPattern);

    if (atMatch?.[1]) {
      return stripWrappingPunctuation(atMatch[1]);
    }

    const separatorPattern = new RegExp(
      `^(.+?)\\s*(?:-|\\||/)\\s*${companyName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}$`,
      "i",
    );
    const separatorMatch = cleaned.match(separatorPattern);

    if (separatorMatch?.[1]) {
      return stripWrappingPunctuation(separatorMatch[1]);
    }
  }

  return cleaned;
}

function looksLikeIgnoreCaseMatch(subject: string | null) {
  const normalized = normalizeWhitespace(subject)?.toLowerCase();

  if (!normalized) {
    return false;
  }

  return IGNORE_SUBJECT_HINTS.some((hint) => normalized.includes(hint));
}

function looksLikeOpportunityContent(input: InboundEmailOpportunityCandidate) {
  const joinedText = [input.subject, input.snippet, input.bodyPreview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return OPPORTUNITY_HINTS.some((hint) => joinedText.includes(hint));
}

export function parseInboundEmailOpportunity(
  input: InboundEmailOpportunityCandidate,
): ParsedInboundEmailOpportunity {
  if (input.signal === InboundEmailSignal.APPLICATION_UPDATE || looksLikeIgnoreCaseMatch(input.subject)) {
    return {
      processingStatus: InboundEmailStatus.IGNORED,
      normalizedOpportunity: null,
      parsingSummary: "Email conserve mais ecarte du pipeline d opportunites.",
      parsingNotes: [
        "Le signal detecte correspond a un suivi de candidature, pas a une nouvelle opportunite.",
      ],
    };
  }

  if (!input.subject && !input.snippet && !input.bodyPreview && !input.canonicalUrl) {
    return {
      processingStatus: InboundEmailStatus.IGNORED,
      normalizedOpportunity: null,
      parsingSummary: "Email trop pauvre pour produire une opportunite exploitable.",
      parsingNotes: ["Aucun sujet, extrait ou lien detecte n est disponible sur ce message."],
    };
  }

  const sourceMetadata = detectSourceMetadata(input);
  const companyName = extractCompanyName(input, sourceMetadata);
  const title = input.subject ? extractTitleFromSubject(input.subject, companyName) : null;
  const description = normalizeWhitespace(input.snippet ?? input.bodyPreview);
  const hasStrongSignal =
    Boolean(title) ||
    Boolean(companyName) ||
    Boolean(input.canonicalUrl) ||
    input.signal !== InboundEmailSignal.UNKNOWN;

  if (!hasStrongSignal && !looksLikeOpportunityContent(input)) {
    return {
      processingStatus: InboundEmailStatus.IGNORED,
      normalizedOpportunity: null,
      parsingSummary: "Email garde pour historique mais non projete en opportunite.",
      parsingNotes: [
        "Le contenu ne porte pas assez d indices sur une offre ou une prise de contact exploitable.",
      ],
    };
  }

  const normalizedOpportunity = normalizeInboundEmailOpportunityPreview({
    id: input.id,
    subject: input.subject,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    canonicalUrl: input.canonicalUrl,
    snippet: input.snippet,
    bodyPreview: input.bodyPreview,
    receivedAt: toIsoString(input.receivedAt),
    signal: input.signal,
    sourceKind: sourceMetadata.sourceKind,
    sourceProvider: sourceMetadata.sourceProvider,
    sourceLabel: sourceMetadata.sourceLabel,
    title,
    companyName,
    description,
  });

  return {
    processingStatus: InboundEmailStatus.PARSED,
    normalizedOpportunity,
    parsingSummary: "Email projete dans le format commun d opportunite.",
    parsingNotes: [
      `Canal detecte: ${sourceMetadata.sourceLabel}.`,
      companyName ? `Entreprise deduite: ${companyName}.` : "Entreprise non deduite de facon fiable.",
      title ? `Titre retenu: ${title}.` : "Titre retenu a partir du sujet brut.",
    ],
  };
}
