"use client";

import Link from "next/link";
import { type DragEvent, useState } from "react";

import { buildGoogleCalendarUrl } from "@/lib/applications/calendar";
import type { ApplicationCard, ApplicationStage } from "@/lib/applications/pipeline";

const COLUMNS: Array<{ stage: ApplicationStage; label: string; hint: string }> = [
  { stage: "FAVORITE", label: "À postuler", hint: "Offres retenues" },
  { stage: "APPLIED", label: "Candidature envoyée", hint: "En attente de réponse" },
  { stage: "INTERVIEWING", label: "Entretien", hint: "Échanges en cours" },
  { stage: "OFFER_ACCEPTED", label: "Offre acceptée", hint: "Bravo !" },
  { stage: "REJECTED", label: "Refus", hint: "Pour mémoire" },
];

type DraftKind = "FOLLOW_UP" | "COVER_LETTER";

type Props = {
  initialApplications: ApplicationCard[];
};

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function toLocalDateTimeInput(iso: string | null) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toLocalDateInput(iso: string | null) {
  return toLocalDateTimeInput(iso).slice(0, 10);
}

function isFollowUpDue(card: ApplicationCard) {
  return Boolean(card.nextFollowUpAt && new Date(card.nextFollowUpAt).getTime() <= Date.now());
}

export function ApplicationsBoard({ initialApplications }: Props) {
  const [cards, setCards] = useState(initialApplications);
  const [draggedOfferId, setDraggedOfferId] = useState<string | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { tone: "ok" | "error"; text: string }>>(
    {},
  );

  function setMessage(offerId: string, tone: "ok" | "error", text: string) {
    setMessages((current) => ({ ...current, [offerId]: { tone, text } }));
  }

  async function updateCard(
    offerId: string,
    update: { stage?: ApplicationStage; interviewAt?: string | null; nextFollowUpAt?: string | null },
  ) {
    setPendingOfferId(offerId);

    const response = await fetch(`/api/applications/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      application?: ApplicationCard | null;
      error?: string;
    };

    setPendingOfferId(null);

    if (!response.ok || !payload.application) {
      setMessage(offerId, "error", payload.error ?? "La mise à jour a échoué.");
      return;
    }

    const updated = payload.application;
    setCards((current) => current.map((card) => (card.offerId === offerId ? updated : card)));
  }

  async function generateDraft(card: ApplicationCard, kind: DraftKind) {
    setPendingOfferId(card.offerId);

    const response = await fetch("/api/email/drafts/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobOfferId: card.offerId, kind }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    setPendingOfferId(null);

    if (!response.ok) {
      setMessage(card.offerId, "error", payload.error ?? "La génération a échoué.");
      return;
    }

    setCards((current) =>
      current.map((item) =>
        item.offerId === card.offerId
          ? {
              ...item,
              draftCounts: {
                ...item.draftCounts,
                followUp: item.draftCounts.followUp + (kind === "FOLLOW_UP" ? 1 : 0),
                coverLetter: item.draftCounts.coverLetter + (kind === "COVER_LETTER" ? 1 : 0),
              },
            }
          : item,
      ),
    );
    setMessage(
      card.offerId,
      "ok",
      kind === "FOLLOW_UP"
        ? "Relance générée : relis-la dans Brouillons."
        : "Lettre de motivation générée : relis-la dans Brouillons.",
    );
  }

  function handleDrop(event: DragEvent<HTMLElement>, stage: ApplicationStage) {
    event.preventDefault();
    const offerId = draggedOfferId ?? event.dataTransfer.getData("text/plain");
    setDraggedOfferId(null);
    const card = cards.find((item) => item.offerId === offerId);

    if (card && card.stage !== stage) {
      void updateCard(card.offerId, { stage });
    }
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4 px-1">
        {COLUMNS.map((column) => {
          const columnCards = cards.filter((card) => card.stage === column.stage);

          return (
            <section
              key={column.stage}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.stage)}
              className="flex w-[18rem] flex-col gap-3 rounded-[1.5rem] border border-line bg-white/50 p-3"
              aria-label={column.label}
            >
              <header className="px-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">{column.label}</h2>
                  <span className="rounded-full border border-line px-2 text-xs text-muted">
                    {columnCards.length}
                  </span>
                </div>
                <p className="text-xs text-muted">{column.hint}</p>
              </header>

              {columnCards.map((card) => {
                const message = messages[card.offerId];
                const isPending = pendingOfferId === card.offerId;
                const interviewDate = card.interviewAt ? new Date(card.interviewAt) : null;

                return (
                  <article
                    key={card.offerId}
                    draggable={!isPending}
                    onDragStart={(event) => {
                      setDraggedOfferId(card.offerId);
                      event.dataTransfer.setData("text/plain", card.offerId);
                    }}
                    className="space-y-3 rounded-[1.25rem] border border-line bg-card p-4 shadow-[0_10px_25px_rgba(31,41,55,0.05)]"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/workspace/search/offers/${card.offerId}`}
                        className="block text-sm font-semibold leading-6 text-foreground hover:underline"
                      >
                        {card.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {[card.companyName, card.locationLabel].filter(Boolean).join(" · ")}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {card.stage === "APPLIED" && isFollowUpDue(card) ? (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                          À relancer
                        </span>
                      ) : null}
                      {card.expiredAt ? (
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          Offre expirée
                        </span>
                      ) : null}
                      {interviewDate ? (
                        <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs text-sky-900">
                          Entretien {dateTimeFormatter.format(interviewDate)}
                        </span>
                      ) : null}
                      {card.stage === "APPLIED" && card.nextFollowUpAt && !isFollowUpDue(card) ? (
                        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
                          Relance le {dateFormatter.format(new Date(card.nextFollowUpAt))}
                        </span>
                      ) : null}
                    </div>

                    <label className="block space-y-1">
                      <span className="text-xs text-muted">Étape</span>
                      <select
                        value={card.stage}
                        disabled={isPending}
                        onChange={(event) =>
                          void updateCard(card.offerId, {
                            stage: event.target.value as ApplicationStage,
                          })
                        }
                        className="w-full rounded-xl border border-line bg-white/80 px-3 py-2 text-sm"
                      >
                        {COLUMNS.map((option) => (
                          <option key={option.stage} value={option.stage}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <details className="space-y-3 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-foreground">
                        Dates et documents
                      </summary>
                      <label className="mt-3 block space-y-1">
                        <span className="text-xs text-muted">Entretien</span>
                        <input
                          type="datetime-local"
                          defaultValue={toLocalDateTimeInput(card.interviewAt)}
                          disabled={isPending}
                          onBlur={(event) => {
                            const value = event.target.value
                              ? new Date(event.target.value).toISOString()
                              : null;

                            if (value !== card.interviewAt) {
                              void updateCard(card.offerId, { interviewAt: value });
                            }
                          }}
                          className="w-full rounded-xl border border-line bg-white/80 px-3 py-2 text-sm"
                        />
                      </label>
                      {interviewDate ? (
                        <a
                          href={buildGoogleCalendarUrl({
                            title: `Entretien – ${card.title} (${card.companyName})`,
                            details: `Candidature suivie dans Internship Scrapper.\n${card.sourceUrl}`,
                            start: interviewDate,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs font-medium text-foreground underline"
                        >
                          Ajouter à Google Agenda
                        </a>
                      ) : null}
                      <label className="block space-y-1">
                        <span className="text-xs text-muted">Date de relance</span>
                        <input
                          type="date"
                          defaultValue={toLocalDateInput(card.nextFollowUpAt)}
                          disabled={isPending}
                          onBlur={(event) => {
                            const value = event.target.value
                              ? new Date(`${event.target.value}T09:00`).toISOString()
                              : null;

                            if (value?.slice(0, 10) !== card.nextFollowUpAt?.slice(0, 10)) {
                              void updateCard(card.offerId, { nextFollowUpAt: value });
                            }
                          }}
                          className="w-full rounded-xl border border-line bg-white/80 px-3 py-2 text-sm"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {card.stage === "APPLIED" || card.stage === "INTERVIEWING" ? (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => void generateDraft(card, "FOLLOW_UP")}
                            className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60"
                          >
                            Générer une relance
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => void generateDraft(card, "COVER_LETTER")}
                          className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-60"
                        >
                          Lettre de motivation
                        </button>
                      </div>
                      {card.draftCounts.followUp + card.draftCounts.coverLetter > 0 ? (
                        <Link href="/workspace/drafts" className="block text-xs text-muted underline">
                          {card.draftCounts.coverLetter} lettre(s), {card.draftCounts.followUp}{" "}
                          relance(s) dans Brouillons
                        </Link>
                      ) : null}
                    </details>

                    {isPending ? <p className="text-xs text-muted">Enregistrement…</p> : null}
                    {message ? (
                      <p
                        role={message.tone === "error" ? "alert" : undefined}
                        className={
                          message.tone === "error" ? "text-xs text-red-700" : "text-xs text-emerald-800"
                        }
                      >
                        {message.text}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
