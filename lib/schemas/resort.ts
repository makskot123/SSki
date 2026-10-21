import { z } from "zod";

export const aspectSchema = z.enum([
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
]);
export type Aspect = z.infer<typeof aspectSchema>;

const localizedTextSchema = z.strictObject({
  en: z.string().min(1),
  pl: z.string().min(1),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

const pointSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const metres = z.number().int().positive();
const monthDay = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);

export const resortSchema = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(1),
    /** ISO 3166-1 alpha-2 */
    country: z.string().regex(/^[A-Z]{2}$/),
    region: z.string().min(1),
    /** Main base area. */
    coordinates: pointSchema,
    /** Used to downscale the weather forecast to summit elevation. */
    summitPoint: pointSchema.extend({ elevation: metres }),
    elevation: z.strictObject({ top: metres, bottom: metres }),
    verticalDrop: metres,
    offPiste: z.strictObject({
      liftAccessedTerrainHa: z.number().positive().optional(),
      /** Editorial 1 (limited) to 5 (huge variety); documented on /how-we-rank. */
      terrainVariety: z.number().int().min(1).max(5),
      typicalSteepnessDeg: z.strictObject({
        min: z.number().min(0).max(90),
        max: z.number().min(0).max(90),
      }),
      mainAspects: z.array(aspectSchema).min(1),
      freerideZones: z.array(
        z.strictObject({
          name: z.string().min(1),
          description: localizedTextSchema.optional(),
        }),
      ),
      beginnerFriendly: z.boolean(),
    }),
    guidesAvailable: z.boolean(),
    liftPass: z.strictObject({
      dayPriceEUR: z.strictObject({
        min: z.number().positive(),
        max: z.number().positive(),
      }),
      /** Season the price range refers to, e.g. "2025/26". */
      season: z.string().regex(/^\d{4}\/\d{2}$/),
    }),
    season: z.strictObject({ opens: monthDay, closes: monthDay }),
    climatology: z
      .strictObject({
        avgSeasonSnowfallCm: z.number().positive(),
        source: z.enum(["era5", "resort"]),
      })
      .optional(),
    /** EAWS micro-region ids; filled by scripts/assign-regions.ts (M5a). */
    avalancheRegionIds: z.array(z.string()),
    links: z.strictObject({
      official: z.url(),
      /** Omitted where no official bulletin is known. */
      avalancheBulletin: z.url().optional(),
      webcams: z.array(z.url()).optional(),
    }),
    description: localizedTextSchema,
    /** null = values are estimates that have not been checked against official sources yet. */
    lastVerified: z.iso.date().nullable(),
  })
  .superRefine((r, ctx) => {
    const issue = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: "custom", message, path });

    if (r.elevation.top <= r.elevation.bottom) {
      issue("top must be above bottom", ["elevation", "top"]);
    }
    if (r.verticalDrop !== r.elevation.top - r.elevation.bottom) {
      issue("verticalDrop must equal top - bottom", ["verticalDrop"]);
    }
    if (
      r.summitPoint.elevation < r.elevation.bottom ||
      r.summitPoint.elevation > r.elevation.top
    ) {
      issue("summit elevation must be between bottom and top", [
        "summitPoint",
        "elevation",
      ]);
    }
    if (
      r.offPiste.typicalSteepnessDeg.min > r.offPiste.typicalSteepnessDeg.max
    ) {
      issue("min steepness exceeds max", ["offPiste", "typicalSteepnessDeg"]);
    }
    if (r.liftPass.dayPriceEUR.min > r.liftPass.dayPriceEUR.max) {
      issue("min price exceeds max", ["liftPass", "dayPriceEUR"]);
    }
  });

export type Resort = z.infer<typeof resortSchema>;

export const resortsSchema = z.array(resortSchema).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((r, i) => {
    if (seen.has(r.slug)) {
      ctx.addIssue({
        code: "custom",
        message: `duplicate slug "${r.slug}"`,
        path: [i, "slug"],
      });
    }
    seen.add(r.slug);
  });
});
