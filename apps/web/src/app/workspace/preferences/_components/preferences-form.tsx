"use client";

import Link from "next/link";
import { useState } from "react";

type FullProfilePayload = {
  fullName: string;
  headline: string;
  summary: string;
  school: string;
  degree: string;
  graduationYear: string;
  city: string;
  countryCode: string;
  experienceLevel: string;
  availabilityDate: string;
  availabilityEndDate: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  skills: string;
  targetRoles: string;
  searchKeywords: string;
  preferredLocations: string;
  preferredDomains: string;
  remotePreference?: string;
  employmentTypes: string[];
  salaryExpectationMin: string;
  salaryExpectationMax: string;
  visaNeedsSponsorship: boolean;
  preferencesNotes: string;
};

type DomainSelectionDraft = {
  id: string;
  label: string;
  rationale: string;
  source: "MANUAL" | "GEMINI";
  isValidated: boolean;
};

type Props = {
  initialPayload: FullProfilePayload;
  initialDomains: DomainSelectionDraft[];
};

function mergeUniqueListText(currentValue: string, suggestions: string[]) {
  const existingItems = currentValue
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set([...existingItems, ...suggestions.map((item) => item.trim())]))
    .filter(Boolean)
    .join(", ");
}

function createPayloadSnapshotKey(payload: FullProfilePayload) {
  return JSON.stringify(payload);
}

function createDomainSnapshotKey(domains: DomainSelectionDraft[]) {
  return JSON.stringify(
    domains.map((domain) => ({
      label: domain.label.trim(),
      rationale: domain.rationale.trim(),
      source: domain.source,
      isValidated: domain.isValidated,
    })),
  );
}

function buildValidatedDomainText(domains: DomainSelectionDraft[]) {
  return domains
    .filter((domain) => domain.isValidated && domain.label.trim())
    .map((domain) => domain.label.trim())
    .join(", ");
}

function mergeGeneratedDomains(
  currentDomains: DomainSelectionDraft[],
  suggestions: Array<{ label: string; rationale: string }>,
) {
  const merged = new Map<string, DomainSelectionDraft>();

  for (const domain of currentDomains) {
    const key = domain.label.trim().toLowerCase();

    if (!key) {
      continue;
    }

    merged.set(key, domain);
  }

  for (const suggestion of suggestions) {
    const label = suggestion.label.trim();
    const key = label.toLowerCase();

    if (!label || merged.has(key)) {
      continue;
    }

    merged.set(key, {
      id: crypto.randomUUID(),
      label,
      rationale: suggestion.rationale.trim(),
      source: "GEMINI",
      isValidated: false,
    });
  }

  return Array.from(merged.values());
}

function reorderDomains(
  currentDomains: DomainSelectionDraft[],
  sourceId: string,
  targetId: string,
) {
  const sourceIndex = currentDomains.findIndex((domain) => domain.id === sourceId);
  const targetIndex = currentDomains.findIndex((domain) => domain.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return currentDomains;
  }

  const next = [...currentDomains];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function moveDomainByOffset(
  currentDomains: DomainSelectionDraft[],
  domainId: string,
  offset: -1 | 1,
) {
  const index = currentDomains.findIndex((domain) => domain.id === domainId);

  if (index === -1) {
    return currentDomains;
  }

  const targetIndex = index + offset;

  if (targetIndex < 0 || targetIndex >= currentDomains.length) {
    return currentDomains;
  }

  return reorderDomains(currentDomains, domainId, currentDomains[targetIndex].id);
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

export function PreferencesForm({ initialPayload, initialDomains }: Props) {
  const [payload, setPayload] = useState<FullProfilePayload>(initialPayload);
  const [savedPayloadSnapshot, setSavedPayloadSnapshot] = useState(() =>
    createPayloadSnapshotKey(initialPayload),
  );
  const [domains, setDomains] = useState<DomainSelectionDraft[]>(initialDomains);
  const [savedDomainSnapshot, setSavedDomainSnapshot] = useState(() =>
    createDomainSnapshotKey(initialDomains),
  );
  const [draggedDomainId, setDraggedDomainId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSummary, setGenerationSummary] = useState<string | null>(null);
  const [generationProvider, setGenerationProvider] = useState<string | null>(null);
  const validatedDomainText = buildValidatedDomainText(domains);
  const syncedPayload = {
    ...payload,
    preferredDomains: validatedDomainText,
  };
  const currentPayloadSnapshot = createPayloadSnapshotKey(syncedPayload);
  const currentDomainSnapshot = createDomainSnapshotKey(domains);
  const hasUnsavedChanges =
    currentPayloadSnapshot !== savedPayloadSnapshot ||
    currentDomainSnapshot !== savedDomainSnapshot;
  const fieldErrorCount = Object.values(fieldErrors).reduce(
    (count, messages) => count + (messages?.length ?? 0),
    0,
  );
  const validatedCount = domains.filter(
    (domain) => domain.isValidated && domain.label.trim(),
  ).length;

  function updateField<K extends keyof FullProfilePayload>(
    field: K,
    value: FullProfilePayload[K],
  ) {
    setPayload((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateDomain(
    id: string,
    field: keyof Omit<DomainSelectionDraft, "id">,
    value: string | boolean,
  ) {
    setDomains((current) =>
      current.map((domain) =>
        domain.id === id
          ? {
              ...domain,
              [field]: value,
            }
          : domain,
      ),
    );
  }

  function addManualDomain() {
    setDomains((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "",
        rationale: "",
        source: "MANUAL",
        isValidated: true,
      },
    ]);
  }

  function removeDomain(id: string) {
    setDomains((current) => current.filter((domain) => domain.id !== id));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const requestPayload = {
      ...syncedPayload,
      domainSelections: domains.map(({ label, rationale, source, isValidated }) => ({
        label,
        rationale,
        source,
        isValidated,
      })),
    };

    const response = await fetch("/api/profile/onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const result = (await response.json()) as {
      error?: string;
      fieldErrors?: Record<string, string[] | undefined>;
      savedAt?: string;
    };

    if (!response.ok) {
      setFormError(result.error ?? "Impossible de sauvegarder les preferences");
      setFieldErrors(result.fieldErrors ?? {});
      setIsSubmitting(false);
      return;
    }

    setSavedAt(
      new Date(result.savedAt ?? Date.now()).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setSavedPayloadSnapshot(currentPayloadSnapshot);
    setSavedDomainSnapshot(currentDomainSnapshot);
    setIsSubmitting(false);
  }

  async function handleGenerateBase() {
    setGenerationError(null);
    setIsGenerating(true);

    const response = await fetch("/api/profile/domain-bootstrap", {
      method: "POST",
    });

    const result = (await response.json()) as {
      error?: string;
      provider?: string;
      summary?: string;
      domains?: Array<{ label: string; rationale: string }>;
      targetRoles?: string[];
      locations?: string[];
      keywords?: string[];
    };

    if (!response.ok) {
      setGenerationError(result.error ?? "Impossible de generer une base initiale");
      setIsGenerating(false);
      return;
    }

    setPayload((current) => ({
      ...current,
      targetRoles: mergeUniqueListText(current.targetRoles, result.targetRoles ?? []),
      preferredLocations: mergeUniqueListText(
        current.preferredLocations,
        result.locations ?? [],
      ),
      searchKeywords: mergeUniqueListText(current.searchKeywords, result.keywords ?? []),
    }));
    setDomains((current) => mergeGeneratedDomains(current, result.domains ?? []));
    setGenerationSummary(result.summary ?? null);
    setGenerationProvider(result.provider ?? null);
    setIsGenerating(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSubmitting || isGenerating}
      className="space-y-6 rounded-[2rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8"
    >
      <section className="space-y-4 rounded-[1.5rem] border border-line bg-slate-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Utilisation
            </p>
            <p className="text-sm leading-7 text-foreground">
              Modifie ici uniquement les parametres de recherche et l ordre des domaines.
              Les contraintes de candidature sont gerees depuis le profil complet.
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
              {hasUnsavedChanges ? "Modifications non sauvegardees" : "Preferences a jour"}
            </span>
            {savedAt ? (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
                Sauvegarde {savedAt}
              </span>
            ) : null}
          </div>
        </div>
        {fieldErrorCount > 0 ? (
          <div
            role="alert"
            className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {fieldErrorCount} erreur{fieldErrorCount > 1 ? "s" : ""} de validation a
            corriger avant de sauvegarder.
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

      <section className="flex flex-col gap-4 rounded-[1.5rem] border border-dashed border-line bg-white/50 p-5">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Base initiale
          </p>
          <p className="text-sm leading-7 text-foreground">
            Genere une premiere base de domaines, cibles, localisations et mots cles a
            partir du profil deja sauvegarde. Rien n est applique tant que tu n
            enregistres pas.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-7 text-muted">
            {generationSummary
              ? `${generationSummary}${generationProvider ? ` Genere avec ${generationProvider}.` : ""}`
              : null}
          </div>
          <button
            type="button"
            onClick={handleGenerateBase}
            disabled={isGenerating || isSubmitting}
            className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating ? "Generation..." : "Generer une base initiale"}
          </button>
        </div>
        {generationError ? (
          <p role="alert" className="text-sm text-red-700">
            {generationError}
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[1.5rem] border border-line bg-white/60 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
              Domaines
            </p>
            <p className="text-sm leading-7 text-foreground">
              Glisse les cartes pour reordonner, ajuste le titre du domaine et decris
              en une phrase le type de poste vise. Seuls les domaines retenus seront
              persistes.
            </p>
          </div>
          <button
            type="button"
            onClick={addManualDomain}
            disabled={isSubmitting || isGenerating}
            className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm font-medium text-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ajouter un domaine
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900">
            {validatedCount} retenu{validatedCount > 1 ? "s" : ""}
          </span>
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            {domains.length} carte{domains.length > 1 ? "s" : ""} au total
          </span>
        </div>

        {domains.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-line bg-slate-50 px-4 py-4 text-sm leading-7 text-muted">
            Aucun domaine n est encore liste. Genere une base initiale avec Gemini ou
            ajoute une carte manuelle.
          </div>
        ) : (
          <div className="space-y-4">
            {domains.map((domain, index) => (
              <article
                key={domain.id}
                draggable
                onDragStart={() => setDraggedDomainId(domain.id)}
                onDragEnd={() => setDraggedDomainId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (!draggedDomainId) {
                    return;
                  }

                  setDomains((current) =>
                    reorderDomains(current, draggedDomainId, domain.id),
                  );
                  setDraggedDomainId(null);
                }}
                className={
                  draggedDomainId === domain.id
                    ? "space-y-4 rounded-[1.5rem] border border-foreground bg-white p-5 shadow-[0_12px_28px_rgba(31,41,55,0.08)]"
                    : "space-y-4 rounded-[1.5rem] border border-line bg-white p-5 shadow-[0_12px_28px_rgba(31,41,55,0.04)]"
                }
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        domain.source === "GEMINI"
                          ? "rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-900"
                          : "rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900"
                      }
                    >
                      {domain.source === "GEMINI" ? "Suggestion Gemini" : "Ajout manuel"}
                    </span>
                    <span
                      className={
                        domain.isValidated
                          ? "rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
                          : "rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900"
                      }
                    >
                      {domain.isValidated ? "Retenu" : "A valider"}
                    </span>
                    <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      Carte {index + 1}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDomains((current) =>
                          moveDomainByOffset(current, domain.id, -1),
                        )
                      }
                      className="inline-flex items-center justify-center rounded-full border border-line px-3 py-2 text-xs font-medium text-foreground transition hover:-translate-y-0.5"
                    >
                      Monter
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDomains((current) =>
                          moveDomainByOffset(current, domain.id, 1),
                        )
                      }
                      className="inline-flex items-center justify-center rounded-full border border-line px-3 py-2 text-xs font-medium text-foreground transition hover:-translate-y-0.5"
                    >
                      Descendre
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDomain(domain.id)}
                      className="inline-flex items-center justify-center rounded-full border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:-translate-y-0.5 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <label className="space-y-2">
                    <span className="block text-sm font-medium text-foreground">
                      Titre du domaine
                    </span>
                    <input
                      value={domain.label}
                      onChange={(event) =>
                        updateDomain(domain.id, "label", event.target.value)
                      }
                      className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
                      placeholder="Outils developpeur"
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-[1.25rem] border border-line bg-slate-50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={domain.isValidated}
                      onChange={(event) =>
                        updateDomain(domain.id, "isValidated", event.target.checked)
                      }
                      className="h-4 w-4 rounded border-line"
                    />
                    <span className="text-sm leading-6 text-foreground">
                      Retenir ce domaine
                    </span>
                  </label>
                </div>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-foreground">
                    Courte description du poste
                  </span>
                  <textarea
                    value={domain.rationale}
                    onChange={(event) =>
                      updateDomain(domain.id, "rationale", event.target.value)
                    }
                    rows={3}
                    className="w-full rounded-[1.25rem] border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
                    placeholder="Ex: stages backend orientes APIs, outils internes et automatisation."
                  />
                </label>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-line bg-slate-50 p-5">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
          Contraintes gerees ailleurs
        </p>
        <p className="mt-3 text-sm leading-7 text-foreground">
          Disponibilites, remuneration, visa, liens et notes de candidature restent
          modifies depuis le profil complet pour eviter les doublons d edition.
        </p>
        <div className="mt-4">
          <Link
            href="/workspace/onboarding"
            className="inline-flex items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5"
          >
            Ouvrir le profil complet
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm leading-7 text-muted">
          {savedAt
            ? `Preferences sauvegardees a ${savedAt}.`
            : "Cette page ajuste les parametres de recherche et les domaines sans modifier les contraintes globales."}
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <FieldErrorList messages={fieldErrors.domainSelections} />
          <button
            type="submit"
            disabled={isSubmitting || isGenerating}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enregistrement..." : "Sauvegarder les preferences"}
          </button>
        </div>
      </div>
    </form>
  );
}
