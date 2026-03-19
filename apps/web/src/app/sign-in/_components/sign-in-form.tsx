"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { startTransition, useState } from "react";

type FormState = {
  email: string;
  password: string;
};

type FieldErrors = Record<string, string[] | undefined>;

const initialState: FormState = {
  email: "",
  password: "",
};

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState<FormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const redirectTo = searchParams.get("redirectTo");
    const endpoint = redirectTo
      ? `/api/auth/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`
      : "/api/auth/sign-in";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formState),
    });

    const payload = (await response.json()) as {
      error?: string;
      redirectTo?: string;
      fieldErrors?: FieldErrors;
    };

    if (!response.ok) {
      setFormError(payload.error ?? "Unable to sign in");
      setFieldErrors(payload.fieldErrors ?? {});
      setIsSubmitting(false);
      return;
    }

    startTransition(() => {
      router.push(payload.redirectTo ?? "/workspace");
      router.refresh();
    });
  }

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[1.75rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)] md:p-8"
    >
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={formState.email}
          onChange={(event) => updateField("email", event.target.value)}
          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          placeholder="toi@example.com"
          autoComplete="email"
          required
        />
        {fieldErrors.email?.map((message) => (
          <p key={message} className="text-sm text-red-700">
            {message}
          </p>
        ))}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          value={formState.password}
          onChange={(event) => updateField("password", event.target.value)}
          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          placeholder="Ton mot de passe"
          autoComplete="current-password"
          required
        />
        {fieldErrors.password?.map((message) => (
          <p key={message} className="text-sm text-red-700">
            {message}
          </p>
        ))}
      </div>

      <div className="rounded-[1.25rem] border border-dashed border-line bg-white/50 p-4 text-sm leading-7 text-muted">
        Cette action recree une session navigateur HTTP-only et recharge ton espace.
      </div>

      {formError ? (
        <div className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Connexion..." : "Me connecter"}
      </button>

      <p className="text-sm leading-7 text-muted">
        Pas encore de compte ?
        {" "}
        <Link href="/sign-up" className="font-medium text-foreground underline">
          Cree-en un ici.
        </Link>
      </p>
    </form>
  );
}
