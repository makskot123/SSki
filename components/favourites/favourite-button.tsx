"use client";

import { useTranslations } from "next-intl";
import { useFavourites } from "@/components/favourites/use-favourites";

/** Star toggle that saves a resort on this device. */
export function FavouriteButton({
  slug,
  name,
  className = "",
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const t = useTranslations("Favourites");
  const { favourites, toggle } = useFavourites();
  const saved = favourites.includes(slug);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={t("toggle", { name })}
      title={t(saved ? "saved" : "save")}
      onClick={() => toggle(slug)}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-accent hover:border-accent ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        aria-hidden="true"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      >
        <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
      </svg>
    </button>
  );
}
