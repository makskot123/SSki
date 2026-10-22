import { z } from "zod";

export const GEAR_CATEGORIES = [
  "transceiver",
  "probe",
  "shovel",
  "airbag",
  "helmet",
] as const;
export const gearCategorySchema = z.enum(GEAR_CATEGORIES);
export type GearCategory = z.infer<typeof gearCategorySchema>;

const grams = z.number().int().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/*
 * Specs per category: only published manufacturer figures. Optional fields are skipped in the score when
 * missing (never counted as zero). The fields the minimum standards need are required, so a product can
 * always be checked against them.
 */
const transceiverSpecs = z.strictObject({
  digital: z.boolean(),
  antennas: z.number().int().min(1).max(5),
  frequencyKHz: z.number().positive(),
  en300718: z.boolean(),
  multipleBurialMarking: z.boolean(),
  rangeM: z.number().positive().optional(),
  searchStripM: z.number().positive().optional(),
  weightG: grams.optional(),
  /** Manufacturer figure for transmit mode, in hours. */
  batterySendHours: z.number().positive().optional(),
});

const probeSpecs = z.strictObject({
  lengthCm: z.number().int().positive(),
  quickLock: z.boolean(),
  material: z.enum(["aluminium", "carbon", "steel"]),
  weightG: grams.optional(),
});

const shovelSpecs = z.strictObject({
  bladeMaterial: z.enum(["metal", "plastic"]),
  extendableShaft: z.boolean(),
  weightG: grams.optional(),
  /** Longest working length with the shaft extended. */
  maxLengthCm: z.number().int().positive().optional(),
  hoeMode: z.boolean().optional(),
});

const airbagSpecs = z.strictObject({
  en16716: z.boolean(),
  system: z.enum(["cartridge", "electric"]),
  /** Several deployments on one charge/cartridge without a refill. */
  multipleDeployments: z.boolean().optional(),
  weightG: grams.optional(),
  volumeL: z.number().positive().optional(),
});

const helmetSpecs = z.strictObject({
  en1077: z.boolean(),
  /** Mountaineering standard as well, common for ski touring helmets. */
  en12492: z.boolean().optional(),
  rotationalProtection: z.boolean().optional(),
  weightG: grams.optional(),
});

const localizedText = z.strictObject({
  en: z.string().min(1),
  pl: z.string().min(1),
});

const base = {
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  brand: z.string().min(1),
  model: z.string().min(1),
  /** Manufacturer RRP, never a shop price. */
  priceEUR: z.number().positive(),
  priceCheckedAt: isoDate,
  /** Manufacturer spec page; checked by `npm run data:gear-check`. */
  sourceUrl: z.url({ protocol: /^https$/ }),
  notes: localizedText.optional(),
};

export const gearProductSchema = z.discriminatedUnion("category", [
  z.strictObject({
    ...base,
    category: z.literal("transceiver"),
    specs: transceiverSpecs,
  }),
  z.strictObject({ ...base, category: z.literal("probe"), specs: probeSpecs }),
  z.strictObject({
    ...base,
    category: z.literal("shovel"),
    specs: shovelSpecs,
  }),
  z.strictObject({
    ...base,
    category: z.literal("airbag"),
    specs: airbagSpecs,
  }),
  z.strictObject({
    ...base,
    category: z.literal("helmet"),
    specs: helmetSpecs,
  }),
]);
export type GearProduct = z.infer<typeof gearProductSchema>;
export type GearProductOf<C extends GearCategory> = Extract<
  GearProduct,
  { category: C }
>;

export const gearDataSchema = z
  .strictObject({ products: z.array(gearProductSchema) })
  .refine(
    (d) => new Set(d.products.map((p) => p.id)).size === d.products.length,
    { message: "Duplicate gear product id" },
  );
