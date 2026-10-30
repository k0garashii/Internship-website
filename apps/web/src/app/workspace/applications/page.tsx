import Link from "next/link";
import { redirect } from "next/navigation";

import { listApplicationsForUser } from "@/lib/applications/pipeline";
import { getCurrentViewer } from "@/lib/auth/session";

import { ApplicationsBoard } from "./_components/applications-board";

export default async function ApplicationsPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  const applications = await listApplicationsForUser(viewer.userId);

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">Candidatures</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Suis chaque candidature jusqu’à la réponse.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          Déplace les cartes au fil de l’avancement. Une relance est proposée 10 jours
          après l’envoi, et tu peux générer une relance ou une lettre de motivation pour
          chaque offre.
        </p>
      </section>

      {applications.length === 0 ? (
        <section className="rounded-[1.5rem] border border-dashed border-line bg-card p-6 text-sm leading-7 text-muted">
          Aucune candidature suivie pour l’instant. Ouvre une offre depuis la{" "}
          <Link href="/workspace/search" className="font-medium text-foreground underline">
            collecte d’offres
          </Link>{" "}
          et marque-la « Pertinente » pour l’ajouter ici, dans la colonne « À postuler ».
        </section>
      ) : null}

      <ApplicationsBoard initialApplications={applications} />
    </main>
  );
}
