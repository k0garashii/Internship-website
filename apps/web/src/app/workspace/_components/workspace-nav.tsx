"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SignOutButton } from "./sign-out-button";

type Props = {
  fullName: string | null;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  description: string;
  shortLabel: string;
};

const primaryItems: NavItem[] = [
  {
    href: "/workspace",
    label: "Tableau de bord",
    description: "Indicateurs clefs",
    shortLabel: "TB",
  },
  {
    href: "/workspace/profile",
    label: "Gestion de profil",
    description: "Profil, preferences et domaines",
    shortLabel: "GP",
  },
  {
    href: "/workspace/search",
    label: "Recherche d offres",
    description: "Collecte web et pistes email",
    shortLabel: "RO",
  },
];

const secondaryGroups = [
  {
    title: "Profil",
    items: [
      {
        href: "/workspace/onboarding",
        label: "Profil complet",
        description: "Identite, parcours et contraintes",
        shortLabel: "PC",
      },
      {
        href: "/workspace/preferences",
        label: "Preferences",
        description: "Roles, zones et domaines",
        shortLabel: "PR",
      },
    ],
  },
  {
    title: "Recherche",
    items: [
      {
        href: "/workspace/search",
        label: "Collecte d offres",
        description: "Sources publiques et scoring",
        shortLabel: "CO",
      },
      {
        href: "/workspace/email",
        label: "Ingestion email",
        description: "Forwarding et messages recus",
        shortLabel: "EM",
      },
      {
        href: "/workspace/drafts",
        label: "Brouillons",
        description: "Relire et copier les emails generes",
        shortLabel: "BR",
      },
    ],
  },
] as const;

function isCurrentPath(pathname: string, href: string) {
  if (href === "/workspace") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isCurrent = isCurrentPath(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isCurrent ? "page" : undefined}
      className={
        isCurrent
          ? "block w-full rounded-[1.2rem] border border-transparent bg-foreground px-4 py-3 text-white shadow-[0_16px_30px_rgba(43,36,51,0.18)]"
          : "block w-full rounded-[1.2rem] border border-transparent px-4 py-3 text-foreground transition hover:border-line hover:bg-white/80"
      }
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">
        {isCurrent ? "Ouvert" : "Acces"}
      </p>
      <p className="mt-2 text-sm font-medium">{item.label}</p>
      <p className={isCurrent ? "mt-1 text-xs text-slate-200" : "mt-1 text-xs text-muted"}>
        {item.description}
      </p>
    </Link>
  );
}

function SidebarContent({
  pathname,
  fullName,
  email,
  onNavigate,
}: Props & {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-[2rem] border border-line bg-card/95 p-4 shadow-[0_18px_45px_rgba(31,41,55,0.05)] backdrop-blur">
      <div className="space-y-4 border-b border-line pb-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="inline-flex items-center rounded-full border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted transition hover:bg-white/80"
        >
          Retour page de garde
        </Link>
        <div className="surface-muted rounded-[1.5rem] p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Espace utilisateur
          </p>
          <p className="mt-3 text-base font-semibold text-foreground">
            {fullName || "Utilisateur"}
          </p>
          <p className="mt-1 text-sm text-muted">{email}</p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <p className="px-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Navigation principale
          </p>
          <div className="space-y-2">
            {primaryItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>

        {secondaryGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <p className="px-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-line pt-5">
        <SignOutButton />
      </div>
    </div>
  );
}

export function WorkspaceNav({ fullName, email }: Props) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed left-4 top-4 z-40 inline-flex items-center rounded-full border border-line bg-white/95 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground shadow-[0_12px_24px_rgba(31,41,55,0.12)] backdrop-blur lg:hidden"
      >
        {isOpen ? "Fermer" : "Menu"}
      </button>

      {isOpen ? (
        <button
          type="button"
          aria-label="Fermer la navigation"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/25 lg:hidden"
        />
      ) : null}

      <aside
        className={
          isOpen
            ? "fixed inset-y-4 left-4 z-40 w-[292px] max-w-[calc(100vw-2rem)] lg:hidden"
            : "hidden"
        }
      >
        <SidebarContent
          pathname={pathname}
          fullName={fullName}
          email={email}
          onNavigate={() => setIsOpen(false)}
        />
      </aside>

      <aside className="hidden w-[292px] shrink-0 lg:block">
        <div className="sticky top-4 h-[calc(100vh-2rem)]">
          <SidebarContent pathname={pathname} fullName={fullName} email={email} />
        </div>
      </aside>
    </>
  );
}
