"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { trackSearchInteraction, type SearchInteractionPayload } from "./search-interactions";

type Props = Omit<ComponentPropsWithoutRef<"a">, "children"> & {
  children: ReactNode;
  interaction?: SearchInteractionPayload | null;
};

export function TrackedSearchLink({ children, interaction, onClick, ...props }: Props) {
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented || !interaction) {
          return;
        }

        void trackSearchInteraction(interaction);
      }}
    >
      {children}
    </a>
  );
}
