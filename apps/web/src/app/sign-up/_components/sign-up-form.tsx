"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type FormState = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FieldErrors = Record<string, string[] | undefined>;

const initialState: FormState = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export function SignUpForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (formState.password !== formState.confirmPassword) {
      setFieldErrors({
        confirmPassword: ["Passwords do not match"],
      });
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: formState.fullName,
        email: formState.email,
        password: formState.password,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      redirectTo?: string;
      fieldErrors?: FieldErrors;
    };

    if (!response.ok) {
      setFormError(payload.error ?? "Unable to create account");
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
        <label className="block text-sm font-medium text-foreground" htmlFor="fullName">
          Nom complet
        </label>
        <input
          id="fullName"
          value={formState.fullName}
          onChange={(event) => updateField("fullName", event.target.value)}
          className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
          placeholder="Sasha Martin"
          autoComplete="name"
          required
        />
        {fieldErrors.fullName?.map((message) => (
          <p key={message} className="text-sm text-red-700">
            {message}
          </p>
        ))}
      </div>

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

      <div className="grid gap-5 md:grid-cols-2">
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
            placeholder="10 caracteres minimum"
            autoComplete="new-password"
            required
          />
          {fieldErrors.password?.map((message) => (
            <p key={message} className="text-sm text-red-700">
              {message}
            </p>
          ))}
        </div>

        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-foreground"
            htmlFor="confirmPassword"
          >
            Confirmation
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={formState.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            className="w-full rounded-2xl border border-line bg-white/80 px-4 py-3 outline-none transition focus:border-slate-900"
            placeholder="Retape le mot de passe"
            autoComplete="new-password"
            required
          />
          {fieldErrors.confirmPassword?.map((message) => (
            <p key={message} className="text-sm text-red-700">
              {message}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-dashed border-line bg-white/50 p-4 text-sm leading-7 text-muted">
        Le mot de passe doit contenir au moins 10 caracteres, avec au moins une
        lettre et un chiffre.
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
        {isSubmitting ? "Creation du compte..." : "Creer mon espace personnel"}
      </button>
    </form>
  );
}
