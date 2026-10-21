import { useFormatter, useTranslations } from "next-intl";
import type { DataStatus } from "@/lib/fetch-with-fallback";

/** Always shown next to forecast data so sample data can never be mistaken for the real thing. */
export function DataStatusTag({
  status,
  generatedAt,
}: {
  status: DataStatus;
  generatedAt?: string;
}) {
  const t = useTranslations("Forecast");
  const format = useFormatter();

  if (status === "mock") {
    return (
      <p
        role="status"
        className="inline-block rounded-md border border-dashed border-fg px-3 py-1.5 text-sm font-medium"
      >
        {t("statusMock")}
      </p>
    );
  }
  return (
    <p className="text-sm text-muted">
      {t("statusLive")}
      {generatedAt &&
        ` · ${t("updated", {
          time: format.dateTime(new Date(generatedAt), {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        })}`}
    </p>
  );
}
