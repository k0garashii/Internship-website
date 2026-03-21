import { z } from "zod";

const emailSignalSchema = z.enum([
  "job_alert",
  "career_site_digest",
  "recruiter_outreach",
  "school_career_digest",
  "application_update",
]);

const emailSourceIdSchema = z.enum(["gmail", "outlook", "forwarding"]);
const emailConnectionModeSchema = z.enum(["oauth", "forwarding"]);
const emailTrustBoundarySchema = z.enum(["user_mailbox", "dedicated_inbox"]);
const emailImplementationStatusSchema = z.enum(["planned", "partial", "ready"]);

const emailPermissionSchema = z.object({
  id: z.string().trim().min(2).max(80),
  label: z.string().trim().min(2).max(120),
  scope: z.string().trim().min(2).max(200).nullish().transform((value) => value || null),
  required: z.boolean(),
  reason: z.string().trim().min(8).max(240),
});

const emailIngestionSourceSchema = z.object({
  id: emailSourceIdSchema,
  label: z.string().trim().min(2).max(80),
  priority: z.number().int().min(1).max(10),
  connectionMode: emailConnectionModeSchema,
  trustBoundary: emailTrustBoundarySchema,
  implementationStatus: emailImplementationStatusSchema,
  recommendedUseCases: z.array(z.string().trim().min(4).max(160)).min(1).max(6),
  supportedSignals: z.array(emailSignalSchema).min(1).max(5),
  permissions: z.array(emailPermissionSchema).min(1).max(6),
  constraints: z.array(z.string().trim().min(8).max(220)).min(1).max(8),
});

export const emailIngestionStrategySchema = z.object({
  generatedAt: z.string().datetime(),
  summary: z.string().trim().min(1).max(400),
  ingestionOrder: z.array(emailSourceIdSchema).min(1).max(3),
  designPrinciples: z.array(z.string().trim().min(8).max(220)).min(4).max(8),
  securityRules: z.array(z.string().trim().min(8).max(220)).min(4).max(10),
  parsingSignals: z.array(emailSignalSchema).min(3).max(5),
  currentScope: z.object({
    readsFullMailbox: z.boolean(),
    sendsEmails: z.boolean(),
    downloadsAttachmentsByDefault: z.boolean(),
    storesRawEmailByDefault: z.boolean(),
  }),
  supportedSources: z.array(emailIngestionSourceSchema).min(3).max(3),
  nextTasks: z.array(z.number().int().positive()).min(2).max(12),
});

export type EmailIngestionStrategy = z.output<typeof emailIngestionStrategySchema>;

export function getEmailIngestionStrategy(): EmailIngestionStrategy {
  return emailIngestionStrategySchema.parse({
    generatedAt: new Date().toISOString(),
    summary:
      "La cible produit devient Gmail en lecture ciblee pour suivre les reponses de candidatures et centraliser les alertes. Le forwarding reste un fallback pour les utilisateurs qui refusent OAuth, puis la creation de brouillons et l envoi Gmail viennent ensuite.",
    ingestionOrder: ["gmail", "outlook", "forwarding"],
    designPrinciples: [
      "Traiter les emails comme une source secondaire de fraicheur et de couverture, jamais comme la seule source d offres.",
      "Demander le minimum de permissions necessaires et rester en lecture seule tant que l utilisateur ne demande pas la creation de brouillons ou l envoi.",
      "Preferer une lecture ciblee par label ou requete Gmail afin d eviter un scan large de la boite personnelle.",
      "Reconstruire les conversations et reponses depuis la boite synchronisee, meme si le mail initial n a pas ete emis depuis l application.",
      "Extraire d abord des messages synchronises, des statuts de candidature et des opportunites structurees plutot que de conserver le contenu brut complet.",
      "Conserver un chemin sans OAuth via forwarding pour les utilisateurs qui ne veulent pas connecter leur messagerie principale.",
    ],
    securityRules: [
      "La lecture Gmail reste separee de la creation de brouillons et de l envoi d email via des scopes demandes au bon moment.",
      "Aucune suppression, archivage ou modification de message ne doit etre faite par defaut.",
      "Le produit doit permettre un revocation simple du connecteur et l arret immediat des synchronisations.",
      "Les emails bruts ne doivent pas etre conserves par defaut; seuls les metadonnees, extraits et signaux utiles sont stockes.",
      "Les pieces jointes ne sont pas telechargees automatiquement au MVP, sauf evolution explicite du backlog.",
      "Les messages synchronises sont dedupliques par identifiant provider, thread, sujet normalise et URL canonique quand elle existe.",
    ],
    parsingSignals: [
      "job_alert",
      "career_site_digest",
      "recruiter_outreach",
      "school_career_digest",
      "application_update",
    ],
    currentScope: {
      readsFullMailbox: false,
      sendsEmails: false,
      downloadsAttachmentsByDefault: false,
      storesRawEmailByDefault: false,
    },
    supportedSources: [
      {
        id: "gmail",
        label: "Gmail",
        priority: 1,
        connectionMode: "oauth",
        trustBoundary: "user_mailbox",
        implementationStatus: "partial",
        recommendedUseCases: [
          "Utilisateur qui veut suivre les reponses a ses candidatures meme si le mail initial est parti hors application",
          "Reception d alertes LinkedIn, Welcome to the Jungle, JobTeaser ou ATS entreprise dans Gmail",
          "Centralisation des messages recruteurs, RH et campus dans une boite ou un label deja organise",
        ],
        supportedSignals: [
          "job_alert",
          "career_site_digest",
          "recruiter_outreach",
          "school_career_digest",
          "application_update",
        ],
        permissions: [
          {
            id: "gmail.readonly",
            label: "Lecture seule de Gmail",
            scope: "https://www.googleapis.com/auth/gmail.readonly",
            required: true,
            reason: "Lire les sujets, expediteurs, dates, extraits, threads et liens utiles des emails de candidature et d opportunite.",
          },
          {
            id: "gmail.compose",
            label: "Creation de brouillons Gmail",
            scope: "https://www.googleapis.com/auth/gmail.compose",
            required: false,
            reason: "Permettre plus tard la creation de brouillons dans la boite de l utilisateur depuis une offre retenue.",
          },
          {
            id: "gmail.send",
            label: "Envoi Gmail",
            scope: "https://www.googleapis.com/auth/gmail.send",
            required: false,
            reason: "Permettre plus tard l envoi explicite d un email valide depuis l interface apres validation humaine.",
          },
        ],
        constraints: [
          "Cibler en priorite un label dedie du type `jobs`, `internships` ou `career-alerts`, ou une requete Gmail definie par l utilisateur.",
          "La lecture seule doit suffire pour la detection des reponses et le suivi des conversations au MVP.",
          "Les scopes `gmail.compose` et `gmail.send` ne doivent etre demandes qu au moment ou les brouillons et l envoi sont reellement actives.",
        ],
      },
      {
        id: "outlook",
        label: "Outlook / Microsoft 365",
        priority: 2,
        connectionMode: "oauth",
        trustBoundary: "user_mailbox",
        implementationStatus: "planned",
        recommendedUseCases: [
          "Utilisateur qui recoit ses alertes via Outlook personnel ou universitaire",
          "Reception de newsletters emploi, messages RH et ATS relies a Microsoft 365",
        ],
        supportedSignals: [
          "job_alert",
          "career_site_digest",
          "recruiter_outreach",
          "school_career_digest",
          "application_update",
        ],
        permissions: [
          {
            id: "mail.read",
            label: "Lecture des emails Outlook",
            scope: "Mail.Read",
            required: true,
            reason: "Lire les messages et extraire les opportunites pertinentes sans modifier la boite.",
          },
          {
            id: "offline_access",
            label: "Renouvellement de session",
            scope: "offline_access",
            required: true,
            reason: "Permettre une synchronisation reguliere sans reconnecter l utilisateur a chaque execution.",
          },
          {
            id: "user.read",
            label: "Identification du compte",
            scope: "User.Read",
            required: false,
            reason: "Associer proprement le connecteur au bon compte Microsoft.",
          },
        ],
        constraints: [
          "Limiter la lecture a un dossier ou a une categorie dediee aux offres quand c est possible.",
          "Ne pas demander `Mail.Send`, `Mail.ReadWrite` ni permissions calendrier.",
          "Verifier les quotas Graph et les fenetres de synchronisation pour eviter les scans trop larges.",
        ],
      },
      {
        id: "forwarding",
        label: "Forwarding vers une boite dediee",
        priority: 3,
        connectionMode: "forwarding",
        trustBoundary: "dedicated_inbox",
        implementationStatus: "ready",
        recommendedUseCases: [
          "Utilisateur qui ne veut pas connecter sa boite principale en OAuth",
          "Centralisation manuelle d alertes de plusieurs sources vers une adresse reservee au projet",
          "Cas ou l equipe veut isoler strictement les emails lies aux opportunites",
        ],
        supportedSignals: [
          "job_alert",
          "career_site_digest",
          "recruiter_outreach",
          "school_career_digest",
        ],
        permissions: [
          {
            id: "forwarding-address",
            label: "Adresse de reception dediee",
            scope: null,
            required: true,
            reason: "Recevoir uniquement les emails transferes volontairement par l utilisateur.",
          },
        ],
        constraints: [
          "Aucun acces a la boite principale de l utilisateur, seulement aux emails forwardes.",
          "Demande une hygiene utilisateur: il faut choisir quelles alertes renvoyer vers la boite dediee.",
          "Bonne option pour un MVP securise, mais couverture plus faible qu une vraie connexion OAuth.",
        ],
      },
    ],
    nextTasks: [710, 720, 730, 740, 750, 760, 770, 780, 790, 795],
  });
}
