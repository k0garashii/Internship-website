"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignOut() {
    setIsSubmitting(true);

    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
    });

    const payload = (await response.json()) as {
      redirectTo?: string;
    };

    startTransition(() => {
      router.push(payload.redirectTo ?? "/sign-in");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSubmitting}
      className="inline-flex items-center rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSubmitting ? "Deconnexion..." : "Me deconnecter"}
    </button>
  );
}
