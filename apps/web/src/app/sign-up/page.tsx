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
        <Link href="/" className="back-link">
          Retour accueil
        </Link>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Cree ton espace personnel.
        </h1>
        <p className="app-copy max-w-2xl">
          L inscription sert a ouvrir ton espace de travail, poser un premier profil
          vide et te faire entrer directement dans l application.
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
          <p className="app-kicker">
            Ce qui se passe ensuite
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-foreground md:text-base">
            <li>Tu arrives ensuite dans ton espace personnel sans devoir te reconnecter.</li>
            <li>Le profil complet et les preferences restent modifiables a tout moment.</li>
            <li>Les prochains ecrans te guident vers la recherche et les brouillons email.</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}
