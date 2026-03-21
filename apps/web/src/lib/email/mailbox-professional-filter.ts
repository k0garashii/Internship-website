import {
  InboundEmailSignal,
  InboundEmailStatus,
  MailboxMessageDirection,
} from "@prisma/client";

import { db } from "@/lib/db";

type MailboxProfessionalContext = {
  companyTokens: Set<string>;
  titleTokens: Set<string>;
  domainTokens: Set<string>;
  senderDomains: Set<string>;
};

type MailboxClassificationInput = {
  direction: MailboxMessageDirection;
  labelIds: string[];
  subject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  canonicalUrl: string | null;
};

type MailboxClassification = {
  signal: InboundEmailSignal;
  processingStatus: InboundEmailStatus;
  professionalScore: number;
  isProfessional: boolean;
  reasons: string[];
};

const APPLICATION_HINTS = [
  "your application",
  "candidature",
  "candidate",
  "postule",
  "postuler",
  "thank you for applying",
  "merci pour votre candidature",
  "application update",
  "processus de recrutement",
  "recruitment process",
  "assessment",
  "coding challenge",
];

const INTERVIEW_HINTS = [
  "interview",
  "entretien",
  "screening",
  "technical screen",
  "call",
  "visio",
  "meeting",
  "availability for",
];

const OFFER_HINTS = [
  "job offer",
  "offer letter",
  "offre d emploi",
  "offre de poste",
  "proposal",
  "proposition",
  "contract",
  "contrat",
];

const RECRUITER_HINTS = [
  "recruiter",
  "talent",
  "hiring",
  "sourcing",
  "recrutement",
  "people ops",
  "human resources",
  "hr",
];

const JOB_ALERT_HINTS = [
  "job alert",
  "alerte",
  "new jobs",
  "offres pour vous",
  "recommendation",
  "recommended jobs",
  "opportunites",
];

const SCHOOL_HINTS = [
  "campus",
  "forum",
  "career center",
  "service carriere",
  "alumni",
  "ecole",
  "universit",
];

const NEGATIVE_HINTS = [
  "unsubscribe",
  "se desabonner",
  "manage preferences",
  "view in browser",
  "promotion",
  "promo",
  "discount",
  "newsletter",
  "webinar",
  "eventbrite",
  "invoice",
  "facture",
  "receipt",
  "order confirmation",
  "livraison",
];

const ATS_OR_CAREER_DOMAINS = [
  "greenhouse.io",
  "lever.co",
  "ashbyhq.com",
  "workday.com",
  "smartrecruiters.com",
  "teamtailor.com",
  "jobs",
  "careers",
];

const JOB_BOARD_DOMAINS = [
  "linkedin.com",
  "linkedinmail.com",
  "jobteaser.com",
  "welcometothejungle.com",
  "indeed.com",
  "hellowork.com",
  "apec.fr",
];

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
]);

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function tokenize(value: string | null | undefined, minLength = 3) {
  return Array.from(
    new Set(
      normalizeText(value)
        .replace(/[^a-z0-9\s]/gi, " ")
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= minLength),
    ),
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(haystack: string, phrase: string) {
  if (phrase.includes(" ")) {
    return haystack.includes(phrase);
  }

  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegex(phrase)}([^\\p{L}\\p{N}]|$)`,
    "iu",
  ).test(haystack);
}

function extractDomain(value: string | null | undefined) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("@")) {
    return normalized.split("@").at(-1) ?? null;
  }

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function stripCommonSubdomains(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/^www\./, "")
    .replace(/^jobs\./, "")
    .replace(/^careers\./, "")
    .replace(/^apply\./, "");
}

function countMatches(haystack: string, tokens: Iterable<string>, limit = 4) {
  let count = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      count += 1;
    }

    if (count >= limit) {
      return count;
    }
  }

  return count;
}

function hasAnyNeedle(haystack: string, needles: string[]) {
  return needles.some((needle) => hasPhrase(haystack, needle));
}

function inferSignal(haystack: string, senderDomain: string | null) {
  if (
    hasAnyNeedle(haystack, OFFER_HINTS) ||
    hasAnyNeedle(haystack, INTERVIEW_HINTS) ||
    hasAnyNeedle(haystack, APPLICATION_HINTS)
  ) {
    return InboundEmailSignal.APPLICATION_UPDATE;
  }

  if (hasAnyNeedle(haystack, RECRUITER_HINTS)) {
    return InboundEmailSignal.RECRUITER_OUTREACH;
  }

  if (
    hasAnyNeedle(haystack, JOB_ALERT_HINTS) ||
    JOB_BOARD_DOMAINS.some((domain) => senderDomain?.includes(domain))
  ) {
    return InboundEmailSignal.JOB_ALERT;
  }

  if (
    ATS_OR_CAREER_DOMAINS.some((domain) => senderDomain?.includes(domain)) ||
    haystack.includes("career") ||
    haystack.includes("careers")
  ) {
    return InboundEmailSignal.CAREER_SITE_DIGEST;
  }

  if (hasAnyNeedle(haystack, SCHOOL_HINTS)) {
    return InboundEmailSignal.SCHOOL_CAREER_DIGEST;
  }

  return InboundEmailSignal.UNKNOWN;
}

export async function buildMailboxProfessionalContext(userId: string): Promise<MailboxProfessionalContext> {
  const [targets, domains, watchlist, offers] = await Promise.all([
    db.searchTarget.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        title: true,
      },
      take: 20,
    }),
    db.searchDomain.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        label: true,
      },
      take: 20,
    }),
    db.companyWatchlistItem.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        companyName: true,
        websiteUrl: true,
        careerPageUrl: true,
      },
      take: 50,
    }),
    db.jobOffer.findMany({
      where: {
        userId,
        OR: [
          {
            feedbackEntries: {
              some: {},
            },
          },
          {
            drafts: {
              some: {},
            },
          },
          {
            mailboxSignals: {
              some: {},
            },
          },
        ],
      },
      select: {
        title: true,
        companyName: true,
        sourceUrl: true,
        companyWebsite: true,
      },
      orderBy: {
        lastSeenAt: "desc",
      },
      take: 50,
    }),
  ]);

  const companyTokens = new Set<string>();
  const titleTokens = new Set<string>();
  const domainTokens = new Set<string>();
  const senderDomains = new Set<string>();

  for (const target of targets) {
    for (const token of tokenize(target.title, 3)) {
      titleTokens.add(token);
    }
  }

  for (const domain of domains) {
    for (const token of tokenize(domain.label, 4)) {
      domainTokens.add(token);
    }
  }

  for (const item of watchlist) {
    for (const token of tokenize(item.companyName, 3)) {
      companyTokens.add(token);
    }
    for (const value of [item.websiteUrl, item.careerPageUrl]) {
      const domain = stripCommonSubdomains(extractDomain(value ?? null));
      if (domain) {
        senderDomains.add(domain);
        for (const token of tokenize(domain, 4)) {
          domainTokens.add(token);
        }
      }
    }
  }

  for (const item of offers) {
    for (const token of tokenize(item.companyName, 3)) {
      companyTokens.add(token);
    }
    for (const token of tokenize(item.title, 3)) {
      titleTokens.add(token);
    }
    for (const value of [item.sourceUrl, item.companyWebsite]) {
      const domain = stripCommonSubdomains(extractDomain(value ?? null));
      if (domain) {
        senderDomains.add(domain);
        for (const token of tokenize(domain, 4)) {
          domainTokens.add(token);
        }
      }
    }
  }

  return {
    companyTokens,
    titleTokens,
    domainTokens,
    senderDomains,
  };
}

export function classifyProfessionalMailboxMessage(
  input: MailboxClassificationInput,
  context: MailboxProfessionalContext,
): MailboxClassification {
  const senderDomain = stripCommonSubdomains(extractDomain(input.fromEmail));
  const haystack = normalizeText(
    [
      input.subject,
      input.snippet,
      input.fromEmail,
      input.fromName,
      input.canonicalUrl,
      ...input.toEmails,
      ...input.ccEmails,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const reasons: string[] = [];
  let score = 0;
  const hasApplicationHint = hasAnyNeedle(haystack, APPLICATION_HINTS);
  const hasInterviewHint = hasAnyNeedle(haystack, INTERVIEW_HINTS);
  const hasOfferHint = hasAnyNeedle(haystack, OFFER_HINTS);
  const hasRecruiterHint = hasAnyNeedle(haystack, RECRUITER_HINTS);
  const hasJobAlertHint = hasAnyNeedle(haystack, JOB_ALERT_HINTS);
  const isSpamLabel = input.labelIds.includes("SPAM");
  const isPersonalLabel = input.labelIds.includes("CATEGORY_PERSONAL");

  if (input.direction === MailboxMessageDirection.OUTBOUND) {
    score += 24;
    reasons.push("message sortant de candidature");
  }

  if (hasApplicationHint) {
    score += 28;
    reasons.push("vocabulaire de candidature");
  }

  if (hasInterviewHint) {
    score += 26;
    reasons.push("signal d entretien");
  }

  if (hasOfferHint) {
    score += 26;
    reasons.push("signal d offre");
  }

  if (hasRecruiterHint) {
    score += 18;
    reasons.push("vocabulaire RH / recrutement");
  }

  const titleMatches = countMatches(haystack, context.titleTokens, 4);
  if (titleMatches > 0) {
    score += titleMatches * 7;
    reasons.push("correspond a des roles / competences du profil");
  }

  const domainMatches = countMatches(haystack, context.domainTokens, 4);
  if (domainMatches > 0) {
    score += domainMatches * 5;
    reasons.push("correspond a des domaines cibles");
  }

  const companyMatches = countMatches(haystack, context.companyTokens, 4);
  if (companyMatches > 0) {
    score += companyMatches * 8;
    reasons.push("correspond a une entreprise cible ou deja vue");
  }

  if (senderDomain && context.senderDomains.has(senderDomain)) {
    score += 18;
    reasons.push("expediteur correspondant a un domaine d entreprise cible");
  }

  const hasKnownPlatformDomain =
    ATS_OR_CAREER_DOMAINS.some((domain) => senderDomain?.includes(domain)) ||
    JOB_BOARD_DOMAINS.some((domain) => senderDomain?.includes(domain));

  if (hasKnownPlatformDomain) {
    score += 16;
    reasons.push("expediteur issu d un ATS ou job board");
  }

  if (input.labelIds.includes("CATEGORY_PROMOTIONS") || input.labelIds.includes("CATEGORY_SOCIAL")) {
    score -= 24;
    reasons.push("categorie Gmail promotion / social");
  }

  const hasNegativeHint = hasAnyNeedle(haystack, NEGATIVE_HINTS);

  if (hasNegativeHint) {
    score -= 26;
    reasons.push("signal marketing / newsletter");
  }

  if (senderDomain && FREE_MAIL_DOMAINS.has(senderDomain) && !hasAnyNeedle(haystack, APPLICATION_HINTS)) {
    score -= 10;
  }

  const signal = inferSignal(haystack, senderDomain);
  const strongPositive =
    hasApplicationHint ||
    hasInterviewHint ||
    hasOfferHint ||
    hasRecruiterHint ||
    hasJobAlertHint ||
    hasKnownPlatformDomain ||
    signal === InboundEmailSignal.JOB_ALERT;

  if ((isSpamLabel || isPersonalLabel || hasNegativeHint) && !strongPositive) {
    return {
      signal,
      processingStatus: InboundEmailStatus.IGNORED,
      professionalScore: Math.max(0, Math.min(100, score)),
      isProfessional: false,
      reasons: Array.from(new Set(reasons)).slice(0, 6),
    };
  }

  const isProfessional =
    score >= 28 ||
    signal === InboundEmailSignal.APPLICATION_UPDATE ||
    signal === InboundEmailSignal.JOB_ALERT ||
    (input.direction === MailboxMessageDirection.OUTBOUND && score >= 18);

  return {
    signal,
    processingStatus: isProfessional
      ? InboundEmailStatus.PARSED
      : InboundEmailStatus.IGNORED,
    professionalScore: Math.max(0, Math.min(100, score)),
    isProfessional,
    reasons: Array.from(new Set(reasons)).slice(0, 6),
  };
}
