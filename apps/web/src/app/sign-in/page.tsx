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
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.22em] text-muted">
          Retour accueil
        </Link>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Reprends ton espace personnel.
        </h1>
        <p className="max-w-2xl text-base leading-8 text-muted md:text-lg">
          Connecte-toi avec ton email et ton mot de passe pour recuperer la session
          HTTP-only et revenir dans ton espace de travail.
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SignInForm />
        <aside className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Ce que fait la connexion
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground md:text-base">
            <li>Valide le mot de passe hashe stocke en base.</li>
            <li>Cree une nouvelle `AuthSession` persistante.</li>
            <li>Rend la session recuperable via cookie et `/api/auth/session`.</li>
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
