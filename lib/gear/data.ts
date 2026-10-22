import raw from "@/data/gear.json";
import { gearDataSchema, type GearProduct } from "@/lib/schemas/gear";

// Parsed once at module load; an invalid seed fails the build rather than showing wrong specs.
const products: GearProduct[] = gearDataSchema.parse(raw).products;

export function getGearProducts(): GearProduct[] {
  return products;
}
