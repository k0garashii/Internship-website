import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";

import { SignInForm } from "./_components/sign-in-form";

type SignInPageProps = {
  searchParams?: Promise<{
    redirectTo?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const viewer = await getCurrentViewer();
  const resolvedSearchParams = await searchParams;
  const redirectTo = resolvedSearchParams?.redirectTo;

  if (viewer) {
    redirect(redirectTo?.startsWith("/") ? redirectTo : "/workspace");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <div className="space-y-4">
        <Link href="/" className="back-link">
          Retour accueil
        </Link>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Reprends ton espace personnel.
        </h1>
        <p className="app-copy max-w-2xl">
          Connecte-toi avec ton email et ton mot de passe pour retrouver tes recherches,
          tes brouillons et l etat courant de ton profil. La connexion Gmail se propose
          ensuite directement sur le tableau de bord.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SignInForm />
        <aside className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="app-kicker">
            Avant de continuer
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground md:text-base">
            <li>Tu recuperes directement tes recherches, tes offres et tes brouillons.</li>
            <li>Si tu venais d une page protegee, tu y es renvoye apres la connexion.</li>
            <li>Les erreurs de saisie restent affichees sous les champs concernes.</li>
          </ul>
          <p className="mt-6 text-sm leading-7 text-muted">
            Pas encore de compte ?
            {" "}
            <Link href="/sign-up" className="font-medium text-foreground underline">
              Cree ton espace.
            </Link>
          </p>
        </aside>
      </section>
    </main>
  );
}
