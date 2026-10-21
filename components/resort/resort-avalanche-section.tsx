"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DangerBadge } from "@/components/avalanche/danger-badge";
import { useNow } from "@/components/avalanche/use-now";
import { Disclaimer } from "@/components/ui/disclaimer";
import { Link } from "@/i18n/navigation";
import {
  summariseResort,
  type ResortRegion,
} from "@/lib/avalanche/resort-status";

export type ResortAvalancheProps =
  | { kind: "no_service" }
  | { kind: "not_covered"; links: OfficialLink[] }
  | {
      kind: "covered";
      regions: ResortRegion[];
      /** Names of feeds that could not be reached. */
      feedsDown: string[];
      links: OfficialLink[];
      /** ISO time of the server render, used until the browser clock is available. */
      renderedAt: string;
    };

export interface OfficialLink {
  name: string;
  url: string;
}

const ZONE = "Europe/Vienna"; // fixed so server and browser print the same text

function Links({ links }: { links: OfficialLink[] }) {
  const t = useTranslations("ResortAvalanche");
  if (links.length === 0) return null;
  return (
    <div className="space-y-1 text-sm">
      <p className="text-muted">{t("officialLinks")}</p>
      <ul className="space-y-0.5">
        {links.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              {l.name}
              <span className="sr-only"> {t("opensInNewTab")}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The resort's avalanche situation. It never shows a level unless a bulletin is current RIGHT NOW,
 * judged with the visitor's clock (the page itself may be cached for several minutes).
 */
export function ResortAvalancheSection(props: ResortAvalancheProps) {
  const t = useTranslations("ResortAvalanche");
  const format = useFormatter();
  const browserNow = useNow();

  const when = (iso: string) =>
    format.dateTime(new Date(iso), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ZONE,
      timeZoneName: "short",
    });

  let body: React.ReactNode;

  if (props.kind === "no_service") {
    body = <p>{t("noService")}</p>;
  } else if (props.kind === "not_covered") {
    body = (
      <>
        <p>{t("notCovered")}</p>
        <Links links={props.links} />
      </>
    );
  } else {
    const now = browserNow ?? new Date(props.renderedAt);
    const summary = summariseResort(props.regions, now);
    const firstCurrent = summary.current[0];

    if (summary.state === "current" && firstCurrent) {
      const stillCurrent = new Set(summary.current.map((r) => r.regionId));
      body = (
        <>
          <div className="space-y-1">
            <p className="text-sm text-muted">{t("highest")}</p>
            {summary.maxLevel ? (
              <DangerBadge level={summary.maxLevel} large />
            ) : (
              <p className="font-semibold">{t("noRating")}</p>
            )}
          </div>
          <ul className="space-y-2">
            {props.regions.map((r) => (
              <li
                key={r.regionId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              >
                <span className="font-medium">{r.name}</span>
                {stillCurrent.has(r.regionId) && r.bulletin ? (
                  <>
                    {r.bulletin.maxDangerLevel ? (
                      <DangerBadge level={r.bulletin.maxDangerLevel} />
                    ) : (
                      <span>{t("noRating")}</span>
                    )}
                    <span className="text-muted">
                      {t("validUntil", { time: when(r.bulletin.validUntil) })}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">{t("noCurrent")}</span>
                )}
              </li>
            ))}
          </ul>
          <p>
            <Link
              href={`/avalanche#r=${encodeURIComponent(firstCurrent.regionId)}`}
              className="text-sm font-medium text-accent underline"
            >
              {t("openMap")}
            </Link>
          </p>
          {firstCurrent.bulletin && (
            <p className="text-xs text-muted">
              {t("source", {
                provider: firstCurrent.bulletin.provider.name,
                license: firstCurrent.bulletin.provider.license,
              })}
            </p>
          )}
          <Links links={props.links} />
        </>
      );
    } else if (summary.state === "stale") {
      const latest = props.regions
        .flatMap((r) => (r.bulletin ? [r.bulletin.publicationTime] : []))
        .sort()
        .at(-1);
      body = (
        <>
          <p className="font-semibold">{t("staleTitle")}</p>
          <p>
            {latest
              ? t("staleBody", { time: when(latest) })
              : t("staleBodyShort")}
          </p>
          <Links links={props.links} />
        </>
      );
    } else {
      body = (
        <>
          <p className="font-semibold">{t("noCurrent")}</p>
          <p>{t("missingBody")}</p>
          {props.feedsDown.length > 0 && (
            <p className="text-muted">
              {t("feedDown", { feeds: props.feedsDown.join(", ") })}
            </p>
          )}
          <Links links={props.links} />
        </>
      );
    }
  }

  return (
    <section
      id="avalanche"
      aria-labelledby="avalanche-title"
      className="scroll-mt-4 space-y-3"
    >
      <h2 id="avalanche-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
        {body}
        <Disclaimer />
      </div>
    </section>
  );
}
