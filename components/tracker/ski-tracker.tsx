"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLocalStore } from "@/components/ui/local-store";
import {
  addFix,
  initialTracker,
  summarise,
  type SkiDay,
  type TrackerState,
} from "@/lib/tracker";
import {
  addSkiDay,
  parseSkiDays,
  removeSkiDay,
  SKI_DAYS_STORAGE_KEY,
} from "@/lib/tracker/storage";

const store = createLocalStore(SKI_DAYS_STORAGE_KEY);

type Status = "idle" | "tracking" | "paused" | "denied" | "unavailable";

/** Minimal typing for the Screen Wake Lock API (not in every TS DOM lib). */
type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

function useClock(format: ReturnType<typeof useFormatter>) {
  return useCallback(
    (ms: number) => {
      const total = Math.floor(ms / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      const two = (n: number) => format.number(n, { minimumIntegerDigits: 2 });
      return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
    },
    [format],
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">
        {value}
        <span className="ml-1 text-base font-medium text-muted">{unit}</span>
      </dd>
    </div>
  );
}

/**
 * Ski-day tracker. GPS positions are read only while tracking and only used on this device; finished days
 * are saved in localStorage. A web app cannot track in the background, so the screen is kept awake.
 */
export function SkiTracker() {
  const t = useTranslations("Tracker");
  const format = useFormatter();
  const clock = useClock(format);
  const [status, setStatus] = useState<Status>("idle");
  const [tracker, setTracker] = useState<TrackerState>(initialTracker);
  const [lastDay, setLastDay] = useState<SkiDay | null>(null);
  const [signalLost, setSignalLost] = useState(false);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  const startedAt = useRef<Date | null>(null);
  const raw = store.useValue();
  const days = useMemo(() => parseSkiDays(raw), [raw]);

  const km = (m: number) =>
    format.number(m / 1000, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  const whole = (n: number) => format.number(Math.round(n));

  const releaseWakeLock = useCallback(() => {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);
  const requestWakeLock = useCallback(async () => {
    try {
      wakeLock.current =
        (await (navigator as WakeLockNavigator).wakeLock?.request("screen")) ??
        null;
    } catch {
      // Not supported or refused (battery saver): tracking still works while the screen is on.
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current !== null)
      navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    releaseWakeLock();
  }, [releaseWakeLock]);

  const startWatching = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    // After a pause, start a new segment: the gap is not distance.
    setTracker((s) => ({
      ...s,
      last: null,
      recentKmh: [],
      currentSpeedKmh: 0,
    }));
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        setSignalLost(false);
        setTracker((s) =>
          addFix(s, {
            t: timestamp,
            lat: coords.latitude,
            lon: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            altitudeAccuracy: coords.altitudeAccuracy,
            speed: coords.speed,
          }),
        );
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stopWatching();
          setStatus("denied");
          return;
        }
        // Signal lost for a moment (tunnel, gondola, cliffs) or a timeout: keep listening.
        setSignalLost(true);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
    void requestWakeLock();
    setStatus("tracking");
  }, [requestWakeLock, stopWatching]);

  // The wake lock is dropped when the page is hidden; take it again when the visitor comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && watchId.current !== null) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stopWatching();
    };
  }, [requestWakeLock, stopWatching]);

  function start() {
    startedAt.current = new Date();
    setTracker(initialTracker());
    setLastDay(null);
    startWatching();
  }

  function stop() {
    stopWatching();
    const day = summarise(tracker, startedAt.current ?? new Date(), new Date());
    if (tracker.used > 1) {
      store.write(JSON.stringify(addSkiDay(parseSkiDays(store.read()), day)));
      setLastDay(day);
    }
    setTracker(initialTracker());
    setStatus("idle");
  }

  const active = status === "tracking" || status === "paused";
  const accuracy = tracker.last?.accuracy;
  const gps =
    status !== "tracking"
      ? null
      : signalLost
        ? "lost"
        : accuracy === undefined
          ? "searching"
          : accuracy <= 10
            ? "good"
            : "fair";

  const date = (iso: string) =>
    format.dateTime(new Date(iso), {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="live-title"
        className="overflow-hidden rounded-3xl border border-border bg-surface"
      >
        <h2 id="live-title" className="sr-only">
          {t("liveTitle")}
        </h2>
        <div className="bg-gradient-to-b from-accent/10 to-transparent px-6 pt-8 pb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            {t("speed")}
          </p>
          <p
            className="mt-2 text-7xl font-bold tabular-nums sm:text-8xl"
            data-testid="current-speed"
          >
            {active ? whole(tracker.currentSpeedKmh) : "0"}
            <span className="ml-2 text-2xl font-semibold text-muted">km/h</span>
          </p>
          <p className="mt-3 min-h-6 text-sm" role="status">
            {status === "paused" && t("paused")}
            {gps === "searching" && t("gpsSearching")}
            {gps === "good" && t("gpsGood")}
            {gps === "fair" && t("gpsFair")}
            {gps === "lost" && t("gpsLost")}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <Stat
            label={t("topSpeed")}
            value={whole(tracker.maxSpeedKmh)}
            unit="km/h"
          />
          <Stat label={t("distance")} value={km(tracker.distanceM)} unit="km" />
          <Stat label={t("descent")} value={whole(tracker.descentM)} unit="m" />
          <Stat
            label={t("movingTime")}
            value={clock(tracker.movingMs)}
            unit=""
          />
        </dl>

        <div className="flex gap-3 p-4 pt-0">
          {!active ? (
            <button
              type="button"
              onClick={start}
              className="flex-1 rounded-2xl bg-accent px-6 py-4 text-lg font-semibold text-accent-fg shadow-sm transition-transform active:scale-[0.98]"
            >
              {t("start")}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (status === "tracking") {
                    stopWatching();
                    setStatus("paused");
                  } else {
                    startWatching();
                  }
                }}
                className="flex-1 rounded-2xl border border-border bg-bg px-6 py-4 text-lg font-semibold transition-transform active:scale-[0.98]"
              >
                {status === "tracking" ? t("pause") : t("resume")}
              </button>
              <button
                type="button"
                onClick={stop}
                className="flex-1 rounded-2xl bg-fg px-6 py-4 text-lg font-semibold text-bg transition-transform active:scale-[0.98]"
              >
                {t("stop")}
              </button>
            </>
          )}
        </div>
      </section>

      {(status === "denied" || status === "unavailable") && (
        <p
          role="alert"
          className="rounded-2xl border border-border bg-surface p-4"
        >
          {t(status === "denied" ? "denied" : "unavailable")}
        </p>
      )}

      {lastDay && (
        <p
          role="status"
          className="rounded-2xl border border-accent bg-surface p-4 font-medium"
        >
          {t("saved", {
            distance: km(lastDay.distanceM),
            descent: whole(lastDay.descentM),
          })}
        </p>
      )}

      <div className="space-y-2 text-sm text-muted">
        <p>{t("safetyNote")}</p>
        <p>{t("privacyNote")}</p>
        <p>{t("screenNote")}</p>
      </div>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="text-xl font-semibold">
          {t("historyTitle")}
        </h2>
        {days.length === 0 ? (
          <p className="text-muted">{t("historyEmpty")}</p>
        ) : (
          <ul className="space-y-3" data-testid="ski-days">
            {days.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface p-4"
              >
                <p className="w-full font-semibold sm:w-auto sm:flex-1">
                  {date(d.startedAt)}
                </p>
                <p className="tabular-nums">
                  {km(d.distanceM)} km · {whole(d.descentM)} m ↓ ·{" "}
                  {t("topShort", { speed: whole(d.maxSpeedKmh) })} ·{" "}
                  {clock(d.movingMs)}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    store.write(
                      JSON.stringify(
                        removeSkiDay(parseSkiDays(store.read()), d.id),
                      ),
                    )
                  }
                  aria-label={t("deleteLabel", { date: date(d.startedAt) })}
                  className="text-sm text-accent underline"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
