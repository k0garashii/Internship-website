import {
  InboundEmailSignal,
  MailboxMessageDirection,
  MailboxReplyStatus,
} from "@prisma/client";

import { db } from "@/lib/db";

type ThreadMessage = {
  id: string;
  providerThreadId: string | null;
  subject: string | null;
  normalizedSubject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: unknown;
  ccEmails: unknown;
  canonicalUrl: string | null;
  signal: InboundEmailSignal;
  direction: MailboxMessageDirection;
  sentAt: Date | null;
  receivedAt: Date | null;
};

type OfferCandidate = {
  id: string;
  title: string;
  companyName: string;
  companyWebsite: string | null;
  sourceUrl: string;
};

type ThreadAggregate = {
  threadId: string;
  messages: ThreadMessage[];
  latestInbound: ThreadMessage | null;
  latestOutbound: ThreadMessage | null;
  status: MailboxReplyStatus;
  summary: string;
};

const REJECTION_HINTS = [
  "malheureusement",
  "we regret",
  "not moving forward",
  "rejected",
  "refus",
  "pas retenu",
  "non retenu",
];

const INTERVIEW_HINTS = [
  "interview",
  "entretien",
  "meeting",
  "call",
  "visio",
  "technical screen",
  "screening",
];

const OFFER_HINTS = [
  "offer",
  "proposition",
  "contract",
  "contrat",
  "welcome aboard",
];

const RESPONSE_HINTS = [
  "thank you for applying",
  "merci pour votre candidature",
  "application update",
  "candidature",
  "next steps",
  "suite du process",
];

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeConversationSubject(value: string | null | undefined) {
  let normalized = normalizeText(value);

  while (/^(re|fw|fwd)\s*:\s*/i.test(normalized)) {
    normalized = normalized.replace(/^(re|fw|fwd)\s*:\s*/i, "");
  }

  return normalized.replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string | null | undefined) {
  return Array.from(
    new Set(
      normalizeConversationSubject(value)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 3),
    ),
  );
}

function parseEmailArray(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return input.filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase());
}

function extractDomain(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

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

function stripCommonDomainParts(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/^www\./, "")
    .replace(/^jobs\./, "")
    .replace(/^careers\./, "")
    .replace(/^apply\./, "");
}

function inferReplyStatus(message: ThreadMessage | null, hasOutbound: boolean) {
  if (!message) {
    return hasOutbound ? MailboxReplyStatus.OUTBOUND_ONLY : MailboxReplyStatus.NONE;
  }

  const haystack = normalizeText(
    [message.subject, message.snippet, message.fromEmail, message.fromName].filter(Boolean).join(" "),
  );

  if (REJECTION_HINTS.some((hint) => haystack.includes(hint))) {
    return MailboxReplyStatus.REJECTION;
  }

  if (INTERVIEW_HINTS.some((hint) => haystack.includes(hint))) {
    return MailboxReplyStatus.INTERVIEW;
  }

  if (OFFER_HINTS.some((hint) => haystack.includes(hint))) {
    return MailboxReplyStatus.OFFER;
  }

  if (
    message.signal === InboundEmailSignal.APPLICATION_UPDATE ||
    RESPONSE_HINTS.some((hint) => haystack.includes(hint))
  ) {
    return MailboxReplyStatus.RESPONSE_RECEIVED;
  }

  return hasOutbound ? MailboxReplyStatus.RESPONSE_RECEIVED : MailboxReplyStatus.NONE;
}

function buildThreadSummary(message: ThreadMessage | null, status: MailboxReplyStatus) {
  if (!message) {
    return "Thread de candidature observe sans reponse entrante recente.";
  }

  const subject = message.subject ?? "Sans sujet";
  const snippet = message.snippet?.slice(0, 180) ?? "";

  switch (status) {
    case MailboxReplyStatus.REJECTION:
      return `Reponse de refus detectee sur "${subject}". ${snippet}`.trim();
    case MailboxReplyStatus.INTERVIEW:
      return `Reponse orientee entretien detectee sur "${subject}". ${snippet}`.trim();
    case MailboxReplyStatus.OFFER:
      return `Signal d offre ou de proposition detecte sur "${subject}". ${snippet}`.trim();
    case MailboxReplyStatus.RESPONSE_RECEIVED:
      return `Reponse a candidature detectee sur "${subject}". ${snippet}`.trim();
    case MailboxReplyStatus.OUTBOUND_ONLY:
      return `Candidature ou prise de contact sortante detectee sur "${subject}".`.trim();
    default:
      return `Thread mail observe sur "${subject}". ${snippet}`.trim();
  }
}

function aggregateThread(messages: ThreadMessage[]): ThreadAggregate {
  const sorted = [...messages].sort((left, right) => {
    const leftTime =
      left.receivedAt?.getTime() ?? left.sentAt?.getTime() ?? Number.MIN_SAFE_INTEGER;
    const rightTime =
      right.receivedAt?.getTime() ?? right.sentAt?.getTime() ?? Number.MIN_SAFE_INTEGER;

    return leftTime - rightTime;
  });

  const latestInbound = [...sorted]
    .reverse()
    .find((message) => message.direction === MailboxMessageDirection.INBOUND) ?? null;
  const latestOutbound = [...sorted]
    .reverse()
    .find((message) => message.direction === MailboxMessageDirection.OUTBOUND) ?? null;
  const hasOutbound = Boolean(latestOutbound);
  const status = inferReplyStatus(latestInbound, hasOutbound);
  const threadId = sorted[0]?.providerThreadId ?? sorted[0]?.id ?? `thread-${Date.now()}`;

  return {
    threadId,
    messages: sorted,
    latestInbound,
    latestOutbound,
    status,
    summary: buildThreadSummary(latestInbound ?? latestOutbound, status),
  };
}

function computeThreadOfferScore(thread: ThreadAggregate, offer: OfferCandidate) {
  const companyTokens = tokenize(offer.companyName);
  const titleTokens = tokenize(offer.title).slice(0, 8);
  const sourceDomain = stripCommonDomainParts(extractDomain(offer.sourceUrl));
  const websiteDomain = stripCommonDomainParts(extractDomain(offer.companyWebsite));
  const haystack = normalizeText(
    thread.messages
      .flatMap((message) => [
        message.subject,
        message.normalizedSubject,
        message.snippet,
        message.fromEmail,
        message.fromName,
        message.canonicalUrl,
        ...parseEmailArray(message.toEmails),
        ...parseEmailArray(message.ccEmails),
      ])
      .filter(Boolean)
      .join(" "),
  );

  let score = 0;

  const companyHits = companyTokens.filter((token) => haystack.includes(token)).length;
  if (companyHits > 0) {
    score += Math.min(60, companyHits * 25);
  }

  const titleHits = titleTokens.filter((token) => haystack.includes(token)).length;
  if (titleHits > 0) {
    score += Math.min(30, titleHits * 10);
  }

  const domains = new Set<string>();
  if (sourceDomain) {
    domains.add(sourceDomain);
  }
  if (websiteDomain) {
    domains.add(websiteDomain);
  }

  const domainMatch = Array.from(domains).some((domain) => haystack.includes(domain));
  if (domainMatch) {
    score += 20;
  }

  if (thread.status !== MailboxReplyStatus.NONE) {
    score += 10;
  }

  const normalizedTitle = normalizeConversationSubject(offer.title);
  const normalizedSubject = thread.latestInbound?.normalizedSubject ?? thread.latestOutbound?.normalizedSubject;
  if (normalizedTitle && normalizedSubject && normalizedSubject.includes(normalizedTitle.slice(0, 32))) {
    score += 20;
  }

  return Math.min(100, score);
}

export async function recomputeOfferMailboxSignals(userId: string) {
  const offers = await db.jobOffer.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      title: true,
      companyName: true,
      companyWebsite: true,
      sourceUrl: true,
    },
  });

  if (offers.length === 0) {
    await db.offerMailboxSignal.deleteMany({
      where: {
        userId,
      },
    });
    return {
      detectedReplyCount: 0,
    };
  }

  const messages = await db.mailboxMessage.findMany({
    where: {
      userId,
      connection: {
        sourceType: "GMAIL",
      },
    },
    orderBy: [
      {
        receivedAt: "desc",
      },
      {
        sentAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: 200,
    select: {
      id: true,
      providerThreadId: true,
      subject: true,
      normalizedSubject: true,
      snippet: true,
      fromEmail: true,
      fromName: true,
      toEmails: true,
      ccEmails: true,
      canonicalUrl: true,
      signal: true,
      direction: true,
      sentAt: true,
      receivedAt: true,
    },
  });

  const threadMap = new Map<string, ThreadMessage[]>();
  for (const message of messages) {
    const key = message.providerThreadId ?? message.id;
    const group = threadMap.get(key);
    if (group) {
      group.push(message);
    } else {
      threadMap.set(key, [message]);
    }
  }

  const matches = new Map<
    string,
    {
      offer: OfferCandidate;
      thread: ThreadAggregate;
      score: number;
      mailboxMessageId: string | null;
    }
  >();

  for (const threadMessages of threadMap.values()) {
    const thread = aggregateThread(threadMessages);

    if (thread.status === MailboxReplyStatus.NONE) {
      continue;
    }

    let bestOffer: OfferCandidate | null = null;
    let bestScore = 0;

    for (const offer of offers) {
      const score = computeThreadOfferScore(thread, offer);

      if (score > bestScore) {
        bestScore = score;
        bestOffer = offer;
      }
    }

    if (!bestOffer || bestScore < 55) {
      continue;
    }

    const existing = matches.get(bestOffer.id);
    const latestMessage = thread.latestInbound ?? thread.latestOutbound;

    if (!existing || bestScore > existing.score) {
      matches.set(bestOffer.id, {
        offer: bestOffer,
        thread,
        score: bestScore,
        mailboxMessageId: latestMessage?.id ?? null,
      });
    }
  }

  const matchedOfferIds = Array.from(matches.keys());

  await db.$transaction(async (tx) => {
    await tx.offerMailboxSignal.deleteMany({
      where: {
        userId,
        ...(matchedOfferIds.length > 0
          ? {
              jobOfferId: {
                notIn: matchedOfferIds,
              },
            }
          : {}),
      },
    });

    for (const match of matches.values()) {
      const latestMessage = match.thread.latestInbound ?? match.thread.latestOutbound;

      if (latestMessage?.id) {
        await tx.mailboxMessage.update({
          where: {
            id: latestMessage.id,
          },
          data: {
            jobOfferId: match.offer.id,
          },
        });
      }

      await tx.offerMailboxSignal.upsert({
        where: {
          userId_jobOfferId: {
            userId,
            jobOfferId: match.offer.id,
          },
        },
        update: {
          mailboxMessageId: match.mailboxMessageId,
          providerThreadId: match.thread.threadId,
          status: match.thread.status,
          confidence: Math.min(1, match.score / 100),
          summary: match.thread.summary.slice(0, 500),
          details: {
            score: match.score,
            matchedBy: "gmail-thread-heuristic",
            latestSubject: latestMessage?.subject ?? null,
            latestFromEmail: latestMessage?.fromEmail ?? null,
            latestSignal: latestMessage?.signal ?? null,
          },
          detectedAt:
            latestMessage?.receivedAt ??
            latestMessage?.sentAt ??
            new Date(),
        },
        create: {
          userId,
          jobOfferId: match.offer.id,
          mailboxMessageId: match.mailboxMessageId,
          providerThreadId: match.thread.threadId,
          status: match.thread.status,
          confidence: Math.min(1, match.score / 100),
          summary: match.thread.summary.slice(0, 500),
          details: {
            score: match.score,
            matchedBy: "gmail-thread-heuristic",
            latestSubject: latestMessage?.subject ?? null,
            latestFromEmail: latestMessage?.fromEmail ?? null,
            latestSignal: latestMessage?.signal ?? null,
          },
          detectedAt:
            latestMessage?.receivedAt ??
            latestMessage?.sentAt ??
            new Date(),
        },
      });
    }
  });

  return {
    detectedReplyCount: matches.size,
  };
}
