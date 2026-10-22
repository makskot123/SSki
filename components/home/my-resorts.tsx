"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AvalancheCell } from "@/components/compare/avalanche-cell";
import { FavouriteButton } from "@/components/favourites/favourite-button";
import { useFavourites } from "@/components/favourites/use-favourites";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Link } from "@/i18n/navigation";
import type { ResortAvalanche } from "@/lib/avalanche/resort-status";
import { nearest, type LatLon } from "@/lib/geo/distance";

export interface HomeResort {
  slug: string;
  name: string;
  /** "Tyrol, Austria", already localised. */
  place: string;
  coordinates: LatLon;
  avalanche: ResortAvalanche;
}

const NEAR_COUNT = 5;

function ResortRow({
  resort,
  renderedAt,
  km,
}: {
  resort: HomeResort;
  renderedAt: string;
  km?: number;
}) {
  const t = useTranslations("Home");
  const format = useFormatter();
  return (
    <li className="flex gap-3 rounded-xl bg-surface-2 p-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <h3 className="font-semibold">
            <Link href={`/resorts/${resort.slug}`} className="underline">
              {resort.name}
            </Link>
          </h3>
          <p className="text-sm text-muted">{resort.place}</p>
          {km !== undefined && (
            <p className="text-sm text-muted">
              {t("distance", {
                km: format.number(km, { maximumFractionDigits: 0 }),
              })}
            </p>
          )}
        </div>
        <div className="text-sm">
          <AvalancheCell
            avalanche={resort.avalanche}
            slug={resort.slug}
            renderedAt={renderedAt}
          />
        </div>
      </div>
      <FavouriteButton slug={resort.slug} name={resort.name} />
    </li>
  );
}

type NearState =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "unavailable" }
  | { kind: "found"; results: { item: HomeResort; km: number }[] };

/**
 * "Your resorts" (favourites, saved on the device) and "Resorts near me" (device location, used once in the
 * browser and never sent or stored). Avalanche levels follow the usual freshness rule.
 */
export function MyResorts({
  resorts,
  renderedAt,
}: {
  resorts: HomeResort[];
  renderedAt: string;
}) {
  const t = useTranslations("Home");
  const slugs = useMemo(() => resorts.map((r) => r.slug), [resorts]);
  const { favourites } = useFavourites(slugs);
  const bySlug = useMemo(
    () => new Map(resorts.map((r) => [r.slug, r])),
    [resorts],
  );
  const saved = favourites.flatMap((s) => bySlug.get(s) ?? []);
  const [near, setNear] = useState<NearState>({ kind: "idle" });

  function locate() {
    if (!("geolocation" in navigator)) {
      setNear({ kind: "unavailable" });
      return;
    }
    setNear({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        // The position is only used here, to sort resorts by distance; it is not kept or sent.
        setNear({
          kind: "found",
          results: nearest(
            resorts,
            { lat: coords.latitude, lon: coords.longitude },
            (r) => r.coordinates,
            NEAR_COUNT,
          ),
        }),
      (error) =>
        setNear({
          kind:
            error.code === error.PERMISSION_DENIED ? "denied" : "unavailable",
        }),
      { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 15_000 },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="my-resorts"
        className="card space-y-3 p-5 sm:p-6"
      >
        <h2 id="my-resorts" className="text-xl font-semibold">
          {t("myTitle")}
        </h2>
        <p className="max-w-2xl text-sm text-muted">{t("myIntro")}</p>
        {saved.length === 0 ? (
          <p className="max-w-2xl">
            {t("myEmpty")}{" "}
            <Link href="/resorts" className="text-accent underline">
              {t("browseResorts")}
            </Link>
          </p>
        ) : (
          <ul className="grid gap-3" data-testid="my-resorts">
            {saved.map((r) => (
              <ResortRow key={r.slug} resort={r} renderedAt={renderedAt} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="near-me" className="card space-y-3 p-5 sm:p-6">
        <h2 id="near-me" className="text-xl font-semibold">
          {t("nearTitle")}
        </h2>
        <p className="max-w-2xl text-sm text-muted">{t("nearIntro")}</p>
        <button
          type="button"
          onClick={locate}
          disabled={near.kind === "locating"}
          className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-fg hover:opacity-90 disabled:opacity-60"
        >
          {t("nearButton")}
        </button>
        <div aria-live="polite">
          {near.kind === "locating" && (
            <p className="text-sm">{t("nearLocating")}</p>
          )}
          {(near.kind === "denied" || near.kind === "unavailable") && (
            <p className="text-sm">
              {t(near.kind === "denied" ? "nearDenied" : "nearUnavailable")}{" "}
              <Link href="/resorts" className="text-accent underline">
                {t("browseResorts")}
              </Link>
            </p>
          )}
          {near.kind === "found" && (
            <ol className="grid gap-3" data-testid="near-me">
              {near.results.map(({ item, km }) => (
                <ResortRow
                  key={item.slug}
                  resort={item}
                  renderedAt={renderedAt}
                  km={km}
                />
              ))}
            </ol>
          )}
        </div>
      </section>

      {(saved.length > 0 || near.kind === "found") && (
        <Disclaimer className="lg:col-span-2" />
      )}
    </div>
  );
}
