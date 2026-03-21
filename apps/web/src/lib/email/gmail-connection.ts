import {
  EmailIngestionConnectionStatus,
  EmailIngestionSourceType,
  MailboxReplyStatus,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  type GmailScopeSet,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_PROVIDER,
  GoogleIntegrationError,
  getGoogleOauthConfig,
  getScopesForScopeSet,
  hasGoogleScopes,
  parseGoogleScope,
  refreshGoogleTokens,
  type GoogleTokenPayload,
  type GoogleUserInfo,
} from "@/lib/email/google";
import {
  type GmailConnectionSnapshot,
  gmailConnectionSnapshotSchema,
  type MailboxMessageSnapshot,
  type OfferMailboxSignalSnapshot,
} from "@/lib/email/mailbox-sync";
import { logServiceEvent } from "@/lib/observability/error-logging";

const DEFAULT_GMAIL_SYNC_QUERY = "in:anywhere newer_than:120d -category:promotions -category:social";

export class GmailMailboxError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GmailMailboxError";
  }
}

function mergeScopes(...values: Array<string | null | undefined>) {
  const scopes = new Set<string>();

  for (const value of values) {
    for (const scope of parseGoogleScope(value)) {
      scopes.add(scope);
    }
  }

  return Array.from(scopes).sort().join(" ");
}

function serializeEmailArray(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[];
  }

  return input
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 20)
    .map((value) => value.trim().toLowerCase());
}

function toMessageSnapshot(message: {
  id: string;
  providerMessageId: string;
  providerThreadId: string | null;
  direction: Prisma.MailboxMessageGetPayload<{
    select: { direction: true };
  }>["direction"];
  subject: string | null;
  normalizedSubject: string | null;
  snippet: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: Prisma.JsonValue | null;
  ccEmails: Prisma.JsonValue | null;
  canonicalUrl: string | null;
  signal: Prisma.MailboxMessageGetPayload<{
    select: { signal: true };
  }>["signal"];
  processingStatus: Prisma.MailboxMessageGetPayload<{
    select: { processingStatus: true };
  }>["processingStatus"];
  sentAt: Date | null;
  receivedAt: Date | null;
}): MailboxMessageSnapshot {
  return {
    id: message.id,
    providerMessageId: message.providerMessageId,
    providerThreadId: message.providerThreadId,
    direction: message.direction,
    subject: message.subject,
    normalizedSubject: message.normalizedSubject,
    snippet: message.snippet,
    fromEmail: message.fromEmail,
    fromName: message.fromName,
    toEmails: serializeEmailArray(message.toEmails),
    ccEmails: serializeEmailArray(message.ccEmails),
    canonicalUrl: message.canonicalUrl,
    signal: message.signal,
    processingStatus: message.processingStatus,
    sentAt: message.sentAt?.toISOString() ?? null,
    receivedAt: message.receivedAt?.toISOString() ?? null,
  };
}

function toSignalSnapshot(signal: {
  id: string;
  jobOfferId: string;
  status: MailboxReplyStatus;
  confidence: number;
  summary: string | null;
  providerThreadId: string | null;
  detectedAt: Date;
  mailboxMessage: Parameters<typeof toMessageSnapshot>[0] | null;
  jobOffer: {
    title: string;
    companyName: string;
  };
}): OfferMailboxSignalSnapshot {
  return {
    id: signal.id,
    jobOfferId: signal.jobOfferId,
    jobOfferTitle: signal.jobOffer.title,
    companyName: signal.jobOffer.companyName,
    status: signal.status,
    confidence: signal.confidence,
    summary: signal.summary,
    providerThreadId: signal.providerThreadId,
    detectedAt: signal.detectedAt.toISOString(),
    latestMessage: signal.mailboxMessage ? toMessageSnapshot(signal.mailboxMessage) : null,
  };
}

function buildInstructions(options: {
  oauthConfigured: boolean;
  configured: boolean;
  hasSyncError: boolean;
  hasSendScope: boolean;
}) {
  if (!options.oauthConfigured) {
    return [
      "Configurer GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET pour activer la connexion Gmail.",
      "La lecture de boite devient alors la source principale pour reperer les reponses a des candidatures envoyees depuis Gmail ou hors app.",
      "Le forwarding reste le fallback MVP tant que l OAuth Google n est pas branche.",
    ];
  }

  if (!options.configured) {
    return [
      "Connecter Gmail active une lecture ciblee de la boite sans dependre des envois faits depuis l application.",
      "La synchro suit les messages recents, repere les threads de candidature et prepare les statuts de reponse par offre.",
      "Un second consentement Gmail permet ensuite de creer des brouillons et d envoyer les mails depuis le site.",
    ];
  }

  if (options.hasSyncError) {
    return [
      "Gmail est bien relie a l application, mais la derniere synchronisation a echoue.",
      "Tu peux corriger la configuration Google ou la requete Gmail, puis relancer la synchronisation sans reconnecter le compte.",
      "Les permissions Gmail deja accordees restent reutilisables pour les brouillons et la lecture.",
    ];
  }

  if (!options.hasSendScope) {
    return [
      "La boite Gmail est connectee en lecture et peut synchroniser les messages de candidature.",
      "Etendre les permissions Gmail ajoute la creation de brouillons et l envoi direct depuis le site.",
      "La detection des reponses continue de partir de la boite synchronisee, meme si le mail a ete envoye hors app.",
    ];
  }

  return [
    "La boite Gmail est connectee et le site peut lire les reponses puis creer ou envoyer des mails.",
    "La synchro se base sur les threads reels de la boite, pas uniquement sur les actions faites dans l application.",
    "Chaque nouveau sync recalculera les signaux de reponse et rapprochera les threads des offres pertinentes.",
  ];
}

function buildExpiryDate(payload: GoogleTokenPayload) {
  return new Date(Date.now() + payload.expires_in * 1000);
}

function getPrimaryGoogleScopes(scopeSet: GmailScopeSet) {
  return getScopesForScopeSet(scopeSet);
}

async function findExistingGoogleAccount(userId: string) {
  return db.authAccount.findFirst({
    where: {
      userId,
      provider: GOOGLE_PROVIDER,
    },
  });
}

export async function upsertGmailConnectionFromGoogleOauth(options: {
  userId: string;
  scopeSet: GmailScopeSet;
  userInfo: GoogleUserInfo;
  tokens: GoogleTokenPayload;
}) {
  const requestedScopes = getPrimaryGoogleScopes(options.scopeSet).join(" ");
  const incomingScopes = mergeScopes(options.tokens.scope, requestedScopes);
  const expiresAt = buildExpiryDate(options.tokens);

  await db.$transaction(async (tx) => {
    const conflictingAccount = await tx.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: GOOGLE_PROVIDER,
          providerAccountId: options.userInfo.sub,
        },
      },
    });

    if (conflictingAccount && conflictingAccount.userId !== options.userId) {
      throw new GmailMailboxError(
        "Ce compte Google est deja associe a un autre utilisateur",
        409,
      );
    }

    const existingAccount = await tx.authAccount.findFirst({
      where: {
        userId: options.userId,
        provider: GOOGLE_PROVIDER,
      },
    });

    const refreshToken = options.tokens.refresh_token ?? existingAccount?.refreshToken ?? null;
    const mergedScope = mergeScopes(existingAccount?.scope, incomingScopes);

    let authAccountId: string;

    if (conflictingAccount) {
      const updated = await tx.authAccount.update({
        where: {
          id: conflictingAccount.id,
        },
        data: {
          userId: options.userId,
          accessToken: options.tokens.access_token,
          refreshToken,
          expiresAt,
          tokenType: options.tokens.token_type ?? conflictingAccount.tokenType,
          scope: mergedScope,
          idToken: options.tokens.id_token ?? conflictingAccount.idToken,
        },
      });
      authAccountId = updated.id;
    } else if (existingAccount) {
      const updated = await tx.authAccount.update({
        where: {
          id: existingAccount.id,
        },
        data: {
          providerAccountId: options.userInfo.sub,
          accessToken: options.tokens.access_token,
          refreshToken,
          expiresAt,
          tokenType: options.tokens.token_type ?? existingAccount.tokenType,
          scope: mergedScope,
          idToken: options.tokens.id_token ?? existingAccount.idToken,
        },
      });
      authAccountId = updated.id;
    } else {
      const created = await tx.authAccount.create({
        data: {
          userId: options.userId,
          provider: GOOGLE_PROVIDER,
          providerAccountId: options.userInfo.sub,
          accountType: "oauth",
          accessToken: options.tokens.access_token,
          refreshToken,
          expiresAt,
          tokenType: options.tokens.token_type ?? "Bearer",
          scope: mergedScope,
          idToken: options.tokens.id_token,
        },
      });
      authAccountId = created.id;
    }

    await tx.emailIngestionConnection.upsert({
      where: {
        userId_sourceType: {
          userId: options.userId,
          sourceType: EmailIngestionSourceType.GMAIL,
        },
      },
      update: {
        authAccountId,
        label: "Boite Gmail",
        status: EmailIngestionConnectionStatus.ACTIVE,
        mailboxAddress: options.userInfo.email,
        syncQuery: DEFAULT_GMAIL_SYNC_QUERY,
        lastSyncError: null,
      },
      create: {
        userId: options.userId,
        authAccountId,
        sourceType: EmailIngestionSourceType.GMAIL,
        label: "Boite Gmail",
        status: EmailIngestionConnectionStatus.ACTIVE,
        mailboxAddress: options.userInfo.email,
        syncQuery: DEFAULT_GMAIL_SYNC_QUERY,
      },
    });

    if (options.userInfo.name) {
      await tx.user.updateMany({
        where: {
          id: options.userId,
          OR: [
            {
              fullName: null,
            },
            {
              fullName: "",
            },
          ],
        },
        data: {
          fullName: options.userInfo.name,
        },
      });
    }
  });

  logServiceEvent({
    scope: "email/gmail-connection",
    message: "Google OAuth account linked to Gmail connection",
    metadata: {
      userId: options.userId,
      scopeSet: options.scopeSet,
      mailboxAddress: options.userInfo.email,
    },
  });
}

export async function getGmailConnectionSnapshot(userId: string): Promise<GmailConnectionSnapshot> {
  const oauthConfig = getGoogleOauthConfig();

  const connection = await db.emailIngestionConnection.findUnique({
    where: {
      userId_sourceType: {
        userId,
        sourceType: EmailIngestionSourceType.GMAIL,
      },
    },
    select: {
      id: true,
      status: true,
      mailboxAddress: true,
      syncQuery: true,
      lastSyncedAt: true,
      lastSyncError: true,
      authAccount: {
        select: {
          scope: true,
        },
      },
      _count: {
        select: {
          mailboxMessages: true,
        },
      },
      mailboxMessages: {
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
        take: 10,
        select: {
          id: true,
          providerMessageId: true,
          providerThreadId: true,
          direction: true,
          subject: true,
          normalizedSubject: true,
          snippet: true,
          fromEmail: true,
          fromName: true,
          toEmails: true,
          ccEmails: true,
          canonicalUrl: true,
          signal: true,
          processingStatus: true,
          sentAt: true,
          receivedAt: true,
        },
      },
    },
  });

  const [signals, signalCount] = await Promise.all([
    db.offerMailboxSignal.findMany({
      where: {
        userId,
      },
      orderBy: {
        detectedAt: "desc",
      },
      take: 10,
      select: {
        id: true,
        jobOfferId: true,
        status: true,
        confidence: true,
        summary: true,
        providerThreadId: true,
        detectedAt: true,
        jobOffer: {
          select: {
            title: true,
            companyName: true,
          },
        },
        mailboxMessage: {
          select: {
            id: true,
            providerMessageId: true,
            providerThreadId: true,
            direction: true,
            subject: true,
            normalizedSubject: true,
            snippet: true,
            fromEmail: true,
            fromName: true,
            toEmails: true,
            ccEmails: true,
            canonicalUrl: true,
            signal: true,
            processingStatus: true,
            sentAt: true,
            receivedAt: true,
          },
        },
      },
    }),
    db.offerMailboxSignal.count({
      where: {
        userId,
      },
    }),
  ]);

  const grantedScopes = Array.from(parseGoogleScope(connection?.authAccount?.scope)).sort();
  const hasMailboxScope = hasGoogleScopes(
    connection?.authAccount?.scope,
    GOOGLE_OAUTH_SCOPES.mailbox,
  );
  const hasSendScope = hasGoogleScopes(
    connection?.authAccount?.scope,
    GOOGLE_OAUTH_SCOPES.compose,
  );
  const configured =
    Boolean(connection?.id) &&
    connection?.status !== EmailIngestionConnectionStatus.DISABLED &&
    hasMailboxScope;
  const hasSyncError = connection?.status === EmailIngestionConnectionStatus.ERROR;

  return gmailConnectionSnapshotSchema.parse({
    oauthConfigured: oauthConfig.isConfigured,
    configured,
    source: connection
      ? {
          id: connection.id,
          status: connection.status,
          mailboxAddress: connection.mailboxAddress,
          syncQuery: connection.syncQuery,
          lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
          lastSyncError: connection.lastSyncError,
          grantedScopes,
          hasMailboxScope,
          hasSendScope,
          messageCount: connection._count.mailboxMessages,
          responseSignalCount: signalCount,
        }
      : null,
    recentMessages: connection?.mailboxMessages.map((message) => toMessageSnapshot(message)) ?? [],
    detectedReplies: signals.map((signal) => toSignalSnapshot(signal)),
    instructions: buildInstructions({
      oauthConfigured: oauthConfig.isConfigured,
      configured,
      hasSyncError,
      hasSendScope,
    }),
  });
}

export async function ensureGmailConnectionAccess(options: {
  userId: string;
  requiredScopes: string[];
}) {
  const connection = await db.emailIngestionConnection.findUnique({
    where: {
      userId_sourceType: {
        userId: options.userId,
        sourceType: EmailIngestionSourceType.GMAIL,
      },
    },
    include: {
      authAccount: true,
    },
  });

  if (!connection || !connection.authAccount) {
    throw new GmailMailboxError("Gmail n est pas connecte pour cet utilisateur", 412);
  }

  if (connection.status === EmailIngestionConnectionStatus.DISABLED) {
    throw new GmailMailboxError("La connexion Gmail est desactivee", 412);
  }

  if (!hasGoogleScopes(connection.authAccount.scope, options.requiredScopes)) {
    throw new GmailMailboxError("Les permissions Gmail requises ne sont pas accordees", 412);
  }

  const now = Date.now();
  const expiresAt = connection.authAccount.expiresAt?.getTime() ?? 0;
  const shouldRefresh =
    !connection.authAccount.accessToken ||
    Boolean(connection.authAccount.refreshToken && expiresAt <= now + 60_000);

  if (!shouldRefresh) {
    return {
      connection,
      authAccount: connection.authAccount,
      accessToken: connection.authAccount.accessToken as string,
    };
  }

  if (!connection.authAccount.refreshToken) {
    throw new GmailMailboxError("La connexion Gmail doit etre reautorisée", 412);
  }

  const refreshed = await refreshGoogleTokens(connection.authAccount.refreshToken);
  const updatedAccount = await db.authAccount.update({
    where: {
      id: connection.authAccount.id,
    },
    data: {
      accessToken: refreshed.access_token,
      expiresAt: buildExpiryDate(refreshed),
      tokenType: refreshed.token_type ?? connection.authAccount.tokenType,
      scope: mergeScopes(connection.authAccount.scope, refreshed.scope),
      idToken: refreshed.id_token ?? connection.authAccount.idToken,
      refreshToken: refreshed.refresh_token ?? connection.authAccount.refreshToken,
    },
  });

  return {
    connection: {
      ...connection,
      authAccount: updatedAccount,
    },
    authAccount: updatedAccount,
    accessToken: updatedAccount.accessToken as string,
  };
}

export async function updateGmailSyncSettings(userId: string, input: { syncQuery?: string | null }) {
  const connection = await db.emailIngestionConnection.findUnique({
    where: {
      userId_sourceType: {
        userId,
        sourceType: EmailIngestionSourceType.GMAIL,
      },
    },
    select: {
      id: true,
    },
  });

  if (!connection) {
    throw new GmailMailboxError("Gmail n est pas encore connecte", 404);
  }

  await db.emailIngestionConnection.update({
    where: {
      id: connection.id,
    },
    data: {
      syncQuery: input.syncQuery?.trim() || DEFAULT_GMAIL_SYNC_QUERY,
      lastSyncError: null,
    },
  });

  return getGmailConnectionSnapshot(userId);
}

export async function disconnectGmailConnection(userId: string) {
  const connection = await db.emailIngestionConnection.findUnique({
    where: {
      userId_sourceType: {
        userId,
        sourceType: EmailIngestionSourceType.GMAIL,
      },
    },
    include: {
      authAccount: true,
    },
  });

  if (!connection) {
    return getGmailConnectionSnapshot(userId);
  }

  await db.$transaction(async (tx) => {
    await tx.emailIngestionConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        status: EmailIngestionConnectionStatus.DISABLED,
        authAccountId: null,
        lastSyncError: null,
      },
    });

    if (connection.authAccount) {
      await tx.authAccount.update({
        where: {
          id: connection.authAccount.id,
        },
        data: {
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          scope: null,
          idToken: null,
        },
      });
    }
  });

  return getGmailConnectionSnapshot(userId);
}

export function getDefaultGmailSyncQuery() {
  return DEFAULT_GMAIL_SYNC_QUERY;
}
