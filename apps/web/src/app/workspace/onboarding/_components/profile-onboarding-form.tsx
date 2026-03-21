"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type ProfileDraft = {
  headline: string;
  summary: string;
  school: string;
  degree: string;
  graduationYear: string;
  city: string;
  countryCode: string;
  remotePreference: string;
  experienceLevel: string;
  availabilityDate: string;
  availabilityEndDate: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  visaNeedsSponsorship: boolean;
  skills: string;
  targetRoles: string;
  searchKeywords: string;
  preferredLocations: string;
  preferredDomains: string;
  preferencesNotes: string;
  employmentTypes: string[];
};

type Props = {
  initialFullName: string;
  initialEmail: string;
  initialProfile: ProfileDraft;
};

type SavedDraft = {
  fullName: string;
  profile: ProfileDraft;
};

type NormalizedUrlFields = Pick<
  ProfileDraft,
  "linkedinUrl" | "githubUrl" | "portfolioUrl" | "resumeUrl"
>;

const experienceLevelOptions = [
  { value: "", label: "A definir" },
  { value: "INTERN", label: "Stage" },
  { value: "ENTRY_LEVEL", label: "Debutant" },
  { value: "JUNIOR", label: "Junior" },
  { value: "MID", label: "Intermediaire" },
  { value: "SENIOR", label: "Senior" },
  { value: "LEAD", label: "Responsable" },
];

const employmentTypeOptions = [
  { value: "INTERNSHIP", label: "Stage" },
  { value: "APPRENTICESHIP", label: "Alternance" },
  { value: "FULL_TIME", label: "CDI / temps plein" },
  { value: "PART_TIME", label: "Temps partiel" },
  { value: "FREELANCE", label: "Freelance" },
];

function createProfileSnapshotKey(profile: ProfileDraft) {
  return JSON.stringify(profile);
}

function FieldErrorList({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <>
      {messages.map((message) => (
        <p key={message} className="text-sm text-red-700">
          {message}
        </p>
      ))}
    </>
  );
}

function buildSavedDraft(fullName: string, profile: ProfileDraft): SavedDraft {
  return {
    fullName,
    profile,
  };
}

function fallbackPlaceholder(savedValue: string, defaultPlaceholder: string) {
  return savedValue.trim() || defaultPlaceholder;
}

function formatDateLabel(value: string) {
  if (!value) {
    return "Non renseignee";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("fr-FR");
}

function formatListPreview(value: string) {
  return value.trim() || "Aucune donnee sauvegardee";
}

function SavedFieldHint({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <p className="text-xs leading-6 text-muted">
      {label} {value.trim() || "Non renseigne"}
    </p>
  );
}

export function ProfileOnboardingForm({
  initialFullName,
  initialEmail,
  initialProfile,
}: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [email] = useState(initialEmail);
  const [profile, setProfile] = useState<ProfileDraft>(initialProfile);
  const [savedDraft, setSavedDraft] = useState(() =>
    buildSavedDraft(initialFullName, initialProfile),
  );
  const [savedFullName, setSavedFullName] = useState(initialFullName);
  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(() =>
    createProfileSnapshotKey(initialProfile),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const currentProfileSnapshot = createProfileSnapshotKey(profile);
  const hasUnsavedChanges =
    fullName !== savedFullName || currentProfileSnapshot !== savedProfileSnapshot;
  const fieldErrorCount = Object.values(fieldErrors).reduce(
    (count, messages) => count + (messages?.length ?? 0),
    0,
  );

  function updateProfile<K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleEmploymentType(value: string) {
    setProfile((current) => ({
      ...current,
      employmentTypes: current.employmentTypes.includes(value)
        ? current.employmentTypes.filter((item) => item !== value)
        : [...current.employmentTypes, value],
    }));
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch("/api/profile/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName,
        ...profile,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      savedAt?: string;
      normalizedUrls?: Partial<NormalizedUrlFields>;
    };

    if (!response.ok) {
      setFormError(payload.error ?? "Impossible d enregistrer le profil");
      setFieldErrors(payload.fieldErrors ?? {});
      setIsSubmitting(false);
      return;
    }

    const normalizedProfile = {
      ...profile,
      ...payload.normalizedUrls,
    };

    setSavedAt(
      new Date(payload.savedAt ?? Date.now()).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setProfile(normalizedProfile);
    setSavedFullName(fullName);
    setSavedProfileSnapshot(createProfileSnapshotKey(normalizedProfile));
    setSavedDraft(buildSavedDraft(fullName, normalizedProfile));
    setIsSubmitting(false);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSaveProfile}
      aria-busy={isSubmitting}
      className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8"
    >
      <section className="space-y-4 rounded-[1.5rem] border border-line bg-slate-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Utilisation
            </p>
            <p className="text-sm leading-7 text-foreground">
              Renseigne ici le profil, la fenetre de disponibilite et les contraintes de
              candidature. Les listes acceptent des virgules ou des retours a la ligne.
            </p>
            <p className="text-xs leading-6 text-muted">
              Les champs vides reutilisent la derniere valeur sauvegardee comme repere
              visuel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={
                hasUnsavedChanges
                  ? "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                  : "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
              }
            >
              {hasUnsavedChanges ? "Modifications non sauvegardees" : "Profil a jour"}
            </span>
            {savedAt ? (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
                Sauvegarde {savedAt}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 rounded-[1.25rem] border border-line bg-white/70 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Nom en base
            </p>
            <p className="text-sm font-medium text-foreground">
              {savedDraft.fullName || "Non renseigne"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Titre en base
            </p>
            <p className="text-sm font-medium text-foreground">
              {savedDraft.profile.headline || "Non renseigne"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Zone en base
            </p>
            <p className="text-sm font-medium text-foreground">
              {savedDraft.profile.city || "Non renseignee"}
              {savedDraft.profile.countryCode ? `, ${savedDraft.profile.countryCode}` : ""}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Fenetre en base
            </p>
            <p className="text-sm font-medium text-foreground">
              {savedDraft.profile.availabilityDate
                ? formatDateLabel(savedDraft.profile.availabilityDate)
                : "Non renseignee"}
              {savedDraft.profile.availabilityEndDate
                ? ` -> ${formatDateLabel(savedDraft.profile.availabilityEndDate)}`
                : ""}
            </p>
          </div>
        </div>
        {fieldErrorCount > 0 ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fieldErrorCount} erreur{fieldErrorCount > 1 ? "s" : ""} de validation a
            corriger avant de continuer.
          </div>
        ) : null}
        {formError ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {formError}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Informations de base
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Identite et positionnement
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Nom complet</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(savedDraft.fullName, "Sasha Martin")}
            />
            <FieldErrorList messages={fieldErrors.fullName} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Email</span>
            <input
              value={email}
              disabled
              className="w-full rounded-2xl border border-line bg-slate-100 px-4 py-3 text-slate-500 outline-none"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-sm font-medium text-foreground">
              Titre du profil
            </span>
            <input
              value={profile.headline}
              onChange={(event) => updateProfile("headline", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.headline,
                "Etudiant ingenieur backend a la recherche d un stage",
              )}
            />
            <FieldErrorList messages={fieldErrors.headline} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="block text-sm font-medium text-foreground">Resume</span>
            <textarea
              value={profile.summary}
              onChange={(event) => updateProfile("summary", event.target.value)}
              rows={5}
              className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.summary,
                "Quelques lignes sur ton profil, ce que tu sais faire et ce que tu recherches.",
              )}
            />
            <FieldErrorList messages={fieldErrors.summary} />
          </label>
        </div>
      </section>

      <section className="space-y-4 border-t border-line pt-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Formation et disponibilite
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Cadre academique et calendrier
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Ecole</span>
            <input
              value={profile.school}
              onChange={(event) => updateProfile("school", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(savedDraft.profile.school, "EPITA")}
            />
            <FieldErrorList messages={fieldErrors.school} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Diplome</span>
            <input
              value={profile.degree}
              onChange={(event) => updateProfile("degree", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.degree,
                "Cycle ingenieur",
              )}
            />
            <FieldErrorList messages={fieldErrors.degree} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Annee de fin</span>
            <input
              value={profile.graduationYear}
              onChange={(event) => updateProfile("graduationYear", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(savedDraft.profile.graduationYear, "2027")}
            />
            <FieldErrorList messages={fieldErrors.graduationYear} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Niveau vise</span>
            <select
              value={profile.experienceLevel}
              onChange={(event) => updateProfile("experienceLevel", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            >
              {experienceLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SavedFieldHint
              label="Valeur sauvegardee :"
              value={
                experienceLevelOptions.find(
                  (option) => option.value === savedDraft.profile.experienceLevel,
                )?.label ?? ""
              }
            />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              Disponibilite de debut
            </span>
            <input
              type="date"
              value={profile.availabilityDate}
              onChange={(event) => updateProfile("availabilityDate", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            />
            <FieldErrorList messages={fieldErrors.availabilityDate} />
            <SavedFieldHint
              label="Date en base :"
              value={formatDateLabel(savedDraft.profile.availabilityDate)}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              Disponibilite de fin
            </span>
            <input
              type="date"
              value={profile.availabilityEndDate}
              onChange={(event) => updateProfile("availabilityEndDate", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            />
            <FieldErrorList messages={fieldErrors.availabilityEndDate} />
            <SavedFieldHint
              label="Date en base :"
              value={formatDateLabel(savedDraft.profile.availabilityEndDate)}
            />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Ville</span>
            <input
              value={profile.city}
              onChange={(event) => updateProfile("city", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(savedDraft.profile.city, "Paris")}
            />
            <FieldErrorList messages={fieldErrors.city} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Pays</span>
            <input
              value={profile.countryCode}
              onChange={(event) => updateProfile("countryCode", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 uppercase outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(savedDraft.profile.countryCode, "FR")}
              maxLength={2}
            />
            <FieldErrorList messages={fieldErrors.countryCode} />
          </label>
        </div>
      </section>

      <section className="space-y-4 border-t border-line pt-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Competences et cibles
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Signal pour le matching
          </h2>
        </div>

        <label className="space-y-2">
          <span className="block text-sm font-medium text-foreground">
            Competences clefs
          </span>
          <textarea
            value={profile.skills}
            onChange={(event) => updateProfile("skills", event.target.value)}
            rows={4}
            className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            placeholder={fallbackPlaceholder(
              savedDraft.profile.skills,
              "TypeScript, Python, Prisma, data analysis...",
            )}
          />
          <SavedFieldHint
            label="Competences en base :"
            value={formatListPreview(savedDraft.profile.skills)}
          />
          <FieldErrorList messages={fieldErrors.skills} />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Roles cibles</span>
            <textarea
              value={profile.targetRoles}
              onChange={(event) => updateProfile("targetRoles", event.target.value)}
              rows={4}
              className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.targetRoles,
                "Backend engineer intern, software engineer...",
              )}
            />
            <SavedFieldHint
              label="Roles en base :"
              value={formatListPreview(savedDraft.profile.targetRoles)}
            />
            <FieldErrorList messages={fieldErrors.targetRoles} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              Mots cles de recherche
            </span>
            <textarea
              value={profile.searchKeywords}
              onChange={(event) => updateProfile("searchKeywords", event.target.value)}
              rows={4}
              className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.searchKeywords,
                "automation, backend, api, typescript...",
              )}
            />
            <SavedFieldHint
              label="Mots cles en base :"
              value={formatListPreview(savedDraft.profile.searchKeywords)}
            />
            <FieldErrorList messages={fieldErrors.searchKeywords} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              Localisations preferees
            </span>
            <textarea
              value={profile.preferredLocations}
              onChange={(event) =>
                updateProfile("preferredLocations", event.target.value)
              }
              rows={4}
              className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.preferredLocations,
                "Paris, Saclay, Lyon...",
              )}
            />
            <SavedFieldHint
              label="Zones en base :"
              value={formatListPreview(savedDraft.profile.preferredLocations)}
            />
            <FieldErrorList messages={fieldErrors.preferredLocations} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              Domaines a explorer
            </span>
            <textarea
              value={profile.preferredDomains}
              onChange={(event) =>
                updateProfile("preferredDomains", event.target.value)
              }
              rows={4}
              className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.preferredDomains,
                "Deeptech, energie, outils developpeur...",
              )}
            />
            <SavedFieldHint
              label="Domaines en base :"
              value={formatListPreview(savedDraft.profile.preferredDomains)}
            />
            <FieldErrorList messages={fieldErrors.preferredDomains} />
          </label>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">
            Types de contrat vises
          </span>
          <div className="grid gap-3 md:grid-cols-2">
            {employmentTypeOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 rounded-[1.25rem] border border-line bg-white/60 px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={profile.employmentTypes.includes(option.value)}
                  onChange={() => toggleEmploymentType(option.value)}
                  className="h-4 w-4 rounded border-line"
                />
                <span className="text-sm text-foreground">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-line pt-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Liens et contraintes
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Contexte de candidature
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">LinkedIn</span>
            <input
              value={profile.linkedinUrl}
              onChange={(event) => updateProfile("linkedinUrl", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.linkedinUrl,
                "https://linkedin.com/in/...",
              )}
            />
            <FieldErrorList messages={fieldErrors.linkedinUrl} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">GitHub</span>
            <input
              value={profile.githubUrl}
              onChange={(event) => updateProfile("githubUrl", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.githubUrl,
                "https://github.com/...",
              )}
            />
            <FieldErrorList messages={fieldErrors.githubUrl} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">Portfolio</span>
            <input
              value={profile.portfolioUrl}
              onChange={(event) => updateProfile("portfolioUrl", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(
                savedDraft.profile.portfolioUrl,
                "https://ton-portfolio.dev",
              )}
            />
            <FieldErrorList messages={fieldErrors.portfolioUrl} />
          </label>
          <label className="space-y-2">
            <span className="block text-sm font-medium text-foreground">CV en ligne</span>
            <input
              value={profile.resumeUrl}
              onChange={(event) => updateProfile("resumeUrl", event.target.value)}
              className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
              placeholder={fallbackPlaceholder(savedDraft.profile.resumeUrl, "https://...")}
            />
            <FieldErrorList messages={fieldErrors.resumeUrl} />
          </label>
        </div>

        <label className="space-y-2">
          <span className="block text-sm font-medium text-foreground">
            Notes de preferences
          </span>
          <textarea
            value={profile.preferencesNotes}
            onChange={(event) => updateProfile("preferencesNotes", event.target.value)}
            rows={4}
            className="w-full rounded-[1.5rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            placeholder={fallbackPlaceholder(
              savedDraft.profile.preferencesNotes,
              "Ex: equipe produit, stack TypeScript, pas de secteur defense...",
            )}
          />
          <SavedFieldHint
            label="Notes en base :"
            value={formatListPreview(savedDraft.profile.preferencesNotes)}
          />
          <FieldErrorList messages={fieldErrors.preferencesNotes} />
        </label>

        <label className="flex items-start gap-3 rounded-[1.5rem] border border-line bg-white/60 p-4">
          <input
            type="checkbox"
            checked={profile.visaNeedsSponsorship}
            onChange={(event) =>
              updateProfile("visaNeedsSponsorship", event.target.checked)
            }
            className="mt-1 h-4 w-4 rounded border-line"
          />
          <span className="text-sm leading-7 text-foreground">
            J ai besoin d un sponsoring de visa ou d une prise en charge
            administrative specifique.
          </span>
        </label>
      </section>

      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm leading-7 text-muted">
          {savedAt
            ? `Profil sauvegarde a ${savedAt}. Les donnees sont rechargees depuis la base.`
            : "Ce formulaire structure et sauvegarde le profil en base pour les prochaines etapes de recherche."}
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/workspace/preferences"
              className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5"
            >
              Ouvrir les preferences
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Enregistrement..." : "Enregistrer le profil"}
            </button>
          </div>
          <p className="text-xs leading-6 text-muted">
            Les contraintes restent ici. Les preferences de recherche sont editees a
            part pour eviter les doublons.
          </p>
        </div>
      </div>
    </form>
  );
}
