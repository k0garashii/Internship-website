import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";

import { SignUpForm } from "./_components/sign-up-form";

export default async function SignUpPage() {
  const viewer = await getCurrentViewer();

  if (viewer) {
    redirect("/workspace");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10 md:py-14">
      <div className="space-y-4">
        <Link href="/" className="font-mono text-sm uppercase tracking-[0.22em] text-muted">
          Retour accueil
        </Link>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Cree ton espace personnel.
        </h1>
        <p className="max-w-2xl text-base leading-8 text-muted md:text-lg">
          Cette premiere version cree le compte, initialise un profil vide et ouvre
          une session HTTP-only pour rediriger vers un espace personnel minimal.
        </p>
        <p className="text-sm leading-7 text-muted">
          Tu as deja un compte ?
          {" "}
          <Link href="/sign-in" className="font-medium text-foreground underline">
            Connecte-toi ici.
          </Link>
        </p>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <SignUpForm />
        <aside className="rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Ce que cree l inscription
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground md:text-base">
            <li>Un `User` avec email normalise et mot de passe hashe.</li>
            <li>Un `UserProfile` vide pour preparer l onboarding.</li>
            <li>Une `AuthSession` avec cookie HTTP-only.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
