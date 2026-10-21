import raw from "@/data/resorts.json";
import { resortsSchema, type Resort } from "@/lib/schemas/resort";

// Parsed once at module load; an invalid seed fails the build rather than rendering bad data.
const resorts: Resort[] = resortsSchema.parse(raw);

export function getResorts(): Resort[] {
  return resorts;
}

export function getResortBySlug(slug: string): Resort | undefined {
  return resorts.find((r) => r.slug === slug);
}
