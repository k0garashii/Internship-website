import { BillingProvider, SubscriptionStatus, WorkspaceFeature, WorkspaceMemberRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentViewer } from "@/lib/auth/session";
import { getStripeConfig } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { resolveWorkspaceEntitlements } from "@/server/application/entitlements/entitlement-service";
import { getFeatureUsage } from "@/server/application/entitlements/feature-usage-service";
import { FREE_MONTHLY_AI_GENERATIONS } from "@/server/domain/billing/plan-catalog";

import { BillingActions } from "./_components/billing-actions";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const COMPARISON = [
  { label: "Recherche d’offres, suivi des candidatures, statistiques", free: "Inclus", pro: "Inclus" },
  { label: "Recherche quotidienne et récapitulatif email", free: "Inclus", pro: "Inclus" },
  {
    label: "Générations IA (candidatures, relances, lettres, import de CV)",
    free: `${FREE_MONTHLY_AI_GENERATIONS} par mois`,
    pro: "Illimitées",
  },
  { label: "Sources officielles étendues (France Travail, La Bonne Alternance à venir)", free: "—", pro: "Incluses" },
];

const CHECKOUT_MESSAGES: Record<string, { tone: "ok" | "info"; text: string }> = {
  success: {
    tone: "ok",
    text: "Paiement confirmé, merci ! L’offre Pro s’active dans quelques secondes : recharge la page si besoin.",
  },
  canceled: { tone: "info", text: "Paiement annulé : rien n’a été débité." },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/sign-in");
  }

  const workspaceId = viewer.workspaceId as string;
  const [entitlements, aiUsage, workspace, params] = await Promise.all([
    resolveWorkspaceEntitlements(workspaceId),
    getFeatureUsage(workspaceId, WorkspaceFeature.AI_GENERATION),
    db.workspace.findUnique({ where: { id: workspaceId }, select: { stripeCustomerId: true } }),
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const checkoutParam = Array.isArray(params.checkout) ? params.checkout[0] : params.checkout;
  const checkoutMessage = checkoutParam ? CHECKOUT_MESSAGES[checkoutParam] : undefined;
  const aiLimit = entitlements.features[WorkspaceFeature.AI_GENERATION].limitValue ?? null;
  const subscription = entitlements.subscription;
  const hasPaidSubscription = subscription?.provider === BillingProvider.STRIPE;
  const canManage =
    viewer.workspaceRole === WorkspaceMemberRole.OWNER || viewer.workspaceRole === WorkspaceMemberRole.ADMIN;

  return (
    <main className="flex min-h-full flex-col gap-8">
      <section className="app-hero p-6 md:p-8">
        <p className="app-kicker">Abonnement</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Offre {entitlements.planName}.
        </h1>
        <p className="app-copy mt-4 max-w-3xl">
          L’essentiel reste gratuit. L’offre Pro lève la limite de générations par IA et ajoute
          des sources d’offres officielles.
        </p>
      </section>

      {checkoutMessage ? (
        <section
          className={
            checkoutMessage.tone === "ok"
              ? "rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800"
              : "rounded-[1.5rem] border border-line bg-card px-5 py-4 text-sm text-foreground"
          }
        >
          {checkoutMessage.text}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <article className="space-y-4 rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Ce mois-ci</p>
          <p className="text-4xl font-semibold tracking-tight text-foreground">
            {aiUsage}
            <span className="text-lg text-muted">{aiLimit === null ? " générations IA" : ` / ${aiLimit} générations IA`}</span>
          </p>
          {aiLimit !== null ? (
            <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]" aria-hidden="true">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.min(100, (aiUsage / Math.max(1, aiLimit)) * 100)}%` }}
              />
            </div>
          ) : null}
          {subscription && hasPaidSubscription ? (
            <p className="text-sm leading-7 text-muted">
              {subscription.status === SubscriptionStatus.PAST_DUE
                ? "Le dernier paiement a échoué : mets à jour ta carte pour garder l’offre Pro."
                : subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd
                  ? `Abonnement résilié : l’offre Pro reste active jusqu’au ${dateFormatter.format(subscription.currentPeriodEnd)}.`
                  : subscription.currentPeriodEnd
                    ? `Prochain renouvellement le ${dateFormatter.format(subscription.currentPeriodEnd)}.`
                    : "Abonnement Pro actif."}
            </p>
          ) : null}
          {entitlements.isDeveloperWorkspace ? (
            <p className="text-sm text-muted">Compte développeur : toutes les fonctionnalités Pro sont actives.</p>
          ) : (
            <BillingActions
              canManage={canManage}
              hasPaidSubscription={hasPaidSubscription}
              hasStripeCustomer={Boolean(workspace?.stripeCustomerId)}
              paymentsConfigured={getStripeConfig() !== null}
            />
          )}
        </article>

        <article className="rounded-[1.5rem] border border-line bg-card p-6 shadow-[0_18px_45px_rgba(31,41,55,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-4 font-medium">Fonctionnalité</th>
                  <th className="py-2 pr-4 font-medium">Gratuit</th>
                  <th className="py-2 font-medium">Pro · 4,99 €/mois</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-0">
                    <td className="py-3 pr-4 text-foreground">{row.label}</td>
                    <td className="py-3 pr-4 text-muted">{row.free}</td>
                    <td className="py-3 font-medium text-foreground">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted">
            Sans engagement : résiliable à tout moment depuis « Gérer mon abonnement ». Paiement
            sécurisé par Stripe, aucune donnée bancaire n’est stockée sur ce site.
          </p>
        </article>
      </section>
    </main>
  );
}
