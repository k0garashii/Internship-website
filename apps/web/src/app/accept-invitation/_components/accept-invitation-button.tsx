"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);

          startTransition(async () => {
            try {
              const response = await fetch("/api/workspace/invitations/accept", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ token }),
              });

              const payload = (await response.json()) as { error?: string };

              if (!response.ok) {
                throw new Error(payload.error ?? "Unable to accept invitation");
              }

              router.push("/workspace/workspace");
              router.refresh();
            } catch (acceptError) {
              setError(
                acceptError instanceof Error
                  ? acceptError.message
                  : "Unable to accept invitation",
              );
            }
          });
        }}
        className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 disabled:opacity-60"
      >
        {isPending ? "Acceptation..." : "Accepter l invitation"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
