import type { ReactNode } from "react";

import { getCurrentViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";

import { WorkspaceNav } from "./_components/workspace-nav";

type Props = {
  children: ReactNode;
};

export default async function WorkspaceLayout({ children }: Props) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return <>{children}</>;
  }

  const account = await db.user.findUnique({
    where: {
      id: viewer.userId,
    },
    select: {
      fullName: true,
      email: true,
    },
  });

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(circle_at_top_left,rgba(167,136,164,0.16),transparent_55%),radial-gradient(circle_at_top_right,rgba(180,241,240,0.12),transparent_48%)]"
      />
      <div className="mx-auto flex w-full max-w-[1480px] gap-6 px-4 py-4 md:px-6 lg:px-8">
        <WorkspaceNav
          fullName={account?.fullName ?? null}
          email={account?.email ?? viewer.email ?? "compte@local"}
        />
        <div className="min-w-0 flex-1 py-14 lg:py-8">{children}</div>
      </div>
    </div>
  );
}
