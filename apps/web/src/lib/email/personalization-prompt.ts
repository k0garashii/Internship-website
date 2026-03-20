import type { OfferGeminiContext } from "@/lib/email/gemini-offer-context";

export type OfferEmailPersonalizationPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "Aucun element fourni";
}

function formatNullable(value: string | null) {
  return value && value.trim().length > 0 ? value : "Non renseigne";
}

export function buildOfferEmailPersonalizationPrompt(
  context: OfferGeminiContext,
): OfferEmailPersonalizationPrompt {
  return {
    systemPrompt: [
      "Tu es un assistant de redaction d emails de candidature.",
      "Tu rediges en francais un email professionnel, sobre, concis et credible.",
      "Tu n inventes aucun fait, aucune competence, aucune experience, aucun resultat ni aucun lien absent du contexte fourni.",
      "Tu ne mentionnes pas Gemini, l IA, un score interne ou le fonctionnement du systeme.",
      "Tu adaptes le ton a une candidature stage / jeune profil: poli, direct, humble, oriente contribution.",
      "Tu relies explicitement le profil du candidat a l offre en t appuyant uniquement sur les signaux fournis.",
      "Tu privilegies les experiences, competences et mots cles les plus alignes avec l offre.",
      "Si une information importante manque, tu l omets plutot que de la supposer.",
      "La sortie doit contenir exactement deux sections:",
      "SUBJECT: une ligne d objet email.",
      "BODY: le corps de l email sur quelques paragraphes courts, sans markdown, sans puces, sans signature inventee.",
    ].join(" "),
    userPrompt: [
      "Contexte candidat",
      `Nom: ${context.candidate.fullName}`,
      `Headline: ${formatNullable(context.candidate.headline)}`,
      `Resume: ${formatNullable(context.candidate.summary)}`,
      `Ecole: ${formatNullable(context.candidate.school)}`,
      `Diplome: ${formatNullable(context.candidate.degree)}`,
      `Annee de diplomation: ${context.candidate.graduationYear ?? "Non renseignee"}`,
      `Localisation: ${formatNullable(context.candidate.city)} / ${formatNullable(context.candidate.countryCode)}`,
      `Disponibilite debut: ${formatNullable(context.candidate.availabilityDate)}`,
      `Disponibilite fin: ${formatNullable(context.candidate.availabilityEndDate)}`,
      `Competences: ${formatList(context.candidate.skills)}`,
      `Roles cibles: ${formatList(context.candidate.targetRoles)}`,
      `Domaines preferes: ${formatList(context.candidate.preferredDomains)}`,
      `Zones preferees: ${formatList(context.candidate.preferredLocations)}`,
      `Mots cles: ${formatList(context.candidate.searchKeywords)}`,
      `Types de contrat: ${formatList(context.candidate.employmentTypes)}`,
      `Notes de preferences: ${formatNullable(context.candidate.preferencesNotes)}`,
      `LinkedIn: ${formatNullable(context.candidate.links.linkedinUrl)}`,
      `GitHub: ${formatNullable(context.candidate.links.githubUrl)}`,
      `Portfolio: ${formatNullable(context.candidate.links.portfolioUrl)}`,
      `CV: ${formatNullable(context.candidate.links.resumeUrl)}`,
      "",
      "Contexte offre",
      `Titre: ${context.offer.title}`,
      `Entreprise: ${context.offer.companyName}`,
      `Source: ${context.offer.sourceSite}`,
      `URL: ${context.offer.sourceUrl}`,
      `Localisation: ${formatNullable(context.offer.locationLabel)}`,
      `Statut interne: ${context.offer.lifecycleStatus}`,
      `Contrat: ${formatNullable(context.offer.contractType)}`,
      `Mode de travail: ${formatNullable(context.offer.workMode)}`,
      `Date de publication: ${formatNullable(context.offer.postedAt)}`,
      `Resume de l offre: ${formatNullable(context.offer.summary)}`,
      `Description: ${formatNullable(context.offer.description)}`,
      "",
      "Signaux internes",
      `Dernier score de match: ${context.signals.latestMatchScore ?? "Non renseigne"}`,
      `Dernier rang: ${context.signals.latestRank ?? "Non renseigne"}`,
      `Derniere recherche: ${formatNullable(context.signals.latestSearchLabel)}`,
      `Statut du dernier run: ${formatNullable(context.signals.latestSearchStatus)}`,
      `Justification du match: ${formatNullable(context.signals.matchExplanation)}`,
      `Decision utilisateur: ${formatNullable(context.signals.latestFeedbackDecision)}`,
      `Note utilisateur: ${formatNullable(context.signals.latestFeedbackNote)}`,
      `Shortlist: ${context.signals.isShortlisted ? "Oui" : "Non"}`,
      "",
      "Tache demandee",
      "Redige un email de candidature concis et personnalise pour cette offre.",
      "Ne promets pas de pieces jointes non confirmees.",
      "Ne fais reference qu aux informations presentes ci-dessus.",
      "Mets en avant au maximum trois axes de correspondance vraiment solides.",
    ].join("\n"),
  };
}
