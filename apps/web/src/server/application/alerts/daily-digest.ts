export type DigestOffer = {
  title: string;
  companyName: string;
  locationLabel: string | null;
  scorePercent: number | null;
  url: string;
};

export type DigestApplication = {
  title: string;
  companyName: string;
  date: Date;
};

export type DailyDigestInput = {
  firstName: string | null;
  appBaseUrl: string;
  newOffers: DigestOffer[];
  followUpsDue: DigestApplication[];
  upcomingInterviews: DigestApplication[];
  expiredOfferCount: number;
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count > 1 ? plural : singular}`;
}

// Returns null when there is nothing worth an email, so no empty digest is sent.
export function buildDailyDigest(input: DailyDigestInput) {
  const { newOffers, followUpsDue, upcomingInterviews, expiredOfferCount } = input;

  if (newOffers.length === 0 && followUpsDue.length === 0 && upcomingInterviews.length === 0) {
    return null;
  }

  const subjectParts = [
    newOffers.length > 0 ? pluralize(newOffers.length, "nouvelle offre", "nouvelles offres") : null,
    followUpsDue.length > 0 ? pluralize(followUpsDue.length, "relance", "relances") : null,
    upcomingInterviews.length > 0
      ? pluralize(upcomingInterviews.length, "entretien", "entretiens")
      : null,
  ].filter(Boolean);
  const lines = [`Bonjour${input.firstName ? ` ${input.firstName}` : ""},`, ""];

  if (upcomingInterviews.length > 0) {
    lines.push("Entretiens à venir :");
    for (const interview of upcomingInterviews) {
      lines.push(`- ${interview.title} chez ${interview.companyName}, ${dateFormatter.format(interview.date)}`);
    }
    lines.push("");
  }

  if (followUpsDue.length > 0) {
    lines.push("Candidatures à relancer :");
    for (const application of followUpsDue) {
      lines.push(`- ${application.title} chez ${application.companyName}`);
    }
    lines.push(`Génère une relance depuis ${input.appBaseUrl}/workspace/applications`, "");
  }

  if (newOffers.length > 0) {
    lines.push("Nouvelles offres pour ton profil :");
    for (const offer of newOffers) {
      const details = [
        offer.companyName,
        offer.locationLabel,
        offer.scorePercent !== null ? `match ${offer.scorePercent} %` : null,
      ].filter(Boolean);
      lines.push(`- ${offer.title} (${details.join(" · ")})`, `  ${offer.url}`);
    }
    lines.push("");
  }

  if (expiredOfferCount > 0) {
    lines.push(
      `${pluralize(expiredOfferCount, "offre suivie a expiré", "offres suivies ont expiré")} depuis hier.`,
      "",
    );
  }

  lines.push(
    `Tout retrouver : ${input.appBaseUrl}/workspace`,
    "",
    `Pour ne plus recevoir ce récapitulatif : ${input.appBaseUrl}/workspace/profile`,
  );

  return {
    subject: `Ta recherche du jour : ${subjectParts.join(", ")}`,
    text: lines.join("\n"),
  };
}
