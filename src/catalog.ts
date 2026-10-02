import { z } from "zod";
import { PublicData, DataUnavailable } from "./public-data.js";
import { WEBSITE, SITE_NOTICE } from "./config.js";

export const CATALOG_COLUMNS = "slug,title,code,sku,part_number,short_description,system,systems,condition,condition_label,price,fitment,years,trucks,engines,primary_image,stock_quantity,freight_only,pickup_only,status";
const strings = z.array(z.string()).nullable();
const money = z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)]).transform(Number).pipe(z.number().finite().nonnegative());
export const PublicPart = z.object({
  slug: z.string().min(1).max(300), title: z.string().min(1).max(1000), code: z.string().nullable(), sku: z.string().nullable(), part_number: z.string().nullable(),
  short_description: z.string().nullable(), system: z.string(), systems: strings,
  condition: z.string(), condition_label: z.string(), price: money, fitment: z.string().nullable(),
  years: strings, trucks: strings, engines: strings, primary_image: z.string().nullable(),
  stock_quantity: z.number().int().positive(), freight_only: z.boolean(), pickup_only: z.boolean(), status: z.literal("published"),
});
export type Part = z.infer<typeof PublicPart>;
export const SearchInput = z.object({
  query: z.string().trim().max(200).default(""),
  kind: z.enum(["part", "engine", "transmission", "any"]).default("any").describe("Use engine/transmission only for complete units, not components."),
  engine: z.enum(["LB7", "LLY", "LBZ", "LMM", "LML", "L5P", "L5D"]).optional(),
  year: z.string().regex(/^20\d{2}(?:\.5)?$/).optional().describe("Exact model year, including 2004.5 or 2007.5 when known. Do not guess from engine code."),
  truck: z.enum(["Chevrolet Silverado", "GMC Sierra", "Medium Duty", "Heavy Duty"]).optional(),
  max_price: z.number().finite().nonnegative().max(1000000).optional(),
  limit: z.number().int().min(1).max(12).default(6),
});
export type SearchArgs = z.infer<typeof SearchInput>;

// Mirrors the website's conservative category + freight + component exclusion.
// Long/short blocks count as engine assemblies; a complete harness never does.
const ENGINE_COMPONENT = /\b(harness(?:es)?|wiring|covers?|dipsticks?|tubes?|coolers?|adapters?|elbows?|housings?|thermostats?|brackets?|heads?|crankshafts?|camshafts?|pistons?|rods?|turbos?|pumps?|injectors?|manifolds?|sensors?|mounts?|pans?|gaskets?|valves?|pulleys?|belts?|modules?|pipes?|flywheels?|flexplates?|balancers?|heaters?|lifters?|rockers?|shafts?|spacers?|hoses?|clamps?|stands?)\b/i;
const TRANSMISSION_COMPONENT = /\b(valve bod(?:y|ies)|bellhousings?|housings?|drums?|shafts?|yokes?|plates?|hubs?|gears?|planetar(?:y|ies)|spacers?|nuts?|switch(?:es)?|sensors?|solenoids?|harness(?:es)?|dipsticks?|tubes?|coolers?|modules?|tcm|converters?)\b/i;
export function classify(part: Part): "part" | "engine" | "transmission" | "vehicle" {
  if (part.system === "Whole Trucks") return "vehicle";
  const categories = new Set([part.system, ...(part.systems ?? [])]);
  if (part.freight_only && categories.has("Transmission") && /\btransmission\b/i.test(part.title) && !TRANSMISSION_COMPONENT.test(part.title)) return "transmission";
  const base = part.title.replace(/\s+(?:with|w\/)\s+.*/i, "");
  if (part.freight_only && categories.has("Engine") && /\b(?:engine|motor|long\s*block|short\s*block)\b/i.test(base) && !ENGINE_COMPONENT.test(base)) return "engine";
  return "part";
}
const stop = new Set("a an and any are can do for find got have i in is looking me my need of or part parts please the to used want with you complete".split(" "));
export function queryTerms(query: string): string[] {
  return [...new Set(query.toLowerCase().replace(/[^a-z0-9.]+/g, " ").split(/\s+/).filter(word => word && !stop.has(word)))].slice(0,12);
}
const forms = (word: string) => word === "tranny" || word === "trans" ? ["transmission"] : [word, ...(word.length > 4 && word.endsWith("s") ? [word.slice(0,-1)] : [])];
const normal = (value: string) => value.toLowerCase().replace(/[^a-z0-9.]/g, "");
function matchTag(values: string[] | null, requested?: string): boolean { return !requested || !values?.length || values.some(v => normal(v) === normal(requested)); }
function imageUrl(value: string | null): string | null {
  if (!value) return null;
  try { const u = new URL(value, WEBSITE); return u.protocol === "https:" && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function listing(part: Part, args: Partial<SearchArgs> = {}) {
  const checked = ["engine", "year", "truck"] as const;
  const tags = { engine: part.engines, year: part.years, truck: part.trucks };
  const matched = checked.filter(key => args[key] && tags[key]?.some(v => normal(v) === normal(args[key]!)));
  const missing = checked.filter(key => !args[key] || !tags[key]?.length);
  return {
    id: part.slug, title: part.title, kind: classify(part), url: `${WEBSITE}/shop/product/${encodeURIComponent(part.slug)}`,
    image_url: imageUrl(part.primary_image), price: part.price, currency: "USD", stock_quantity: part.stock_quantity,
    condition: part.condition_label, part_number: part.part_number, sku: part.sku,
    description: part.short_description?.slice(0,1200) ?? "", category: part.system,
    fitment: { text: part.fitment ?? "Confirm application with HAR.", engines: part.engines ?? [], years: part.years ?? [], trucks: part.trucks ?? [],
      status: matched.length ? "catalog_candidate" : "not_confirmed", matched_fields: matched, missing_fields: missing,
      note: "Catalogue tags are candidate matches, not verified interchange. Confirm the exact application and OEM part/RPO numbers with HAR before purchase." },
    fulfillment: part.pickup_only ? "Pickup only" : part.freight_only ? "Freight quote required" : "Shipping quote confirmed before payment",
    ...(part.system === "Whole Trucks" ? { purchase_note: "Call HAR about whole vehicles; do not treat this as a parts checkout." } : {}),
  };
}

export class Catalogue {
  constructor(private readonly data: PublicData) {}
  async all(): Promise<Part[]> {
    const items: Part[] = []; const seen = new Set<string>();
    for (let page = 0; page < 12; page++) {
      const raw = await this.data.read("parts", new URLSearchParams({ select: CATALOG_COLUMNS, status: "eq.published", stock_quantity: "gt.0", order: "id.asc", limit: "250", offset: String(page*250) }));
      for (const row of raw) {
        const part = PublicPart.safeParse(row); if (!part.success) throw new DataUnavailable("Live HAR inventory");
        if (!seen.has(part.data.slug)) { items.push(part.data); seen.add(part.data.slug); }
      }
      if (raw.length < 250) return items;
    }
    throw new DataUnavailable("The complete HAR catalogue"); // Never call a truncated catalogue empty.
  }
  async search(args: SearchArgs) {
    const parts = await this.all(); const terms = queryTerms(args.query);
    const ranked = parts.filter(p => (args.kind === "any" || classify(p) === args.kind) && matchTag(p.engines,args.engine) && matchTag(p.years,args.year) && matchTag(p.trucks,args.truck) && (args.max_price === undefined || p.price <= args.max_price))
      .map(part => {
        const haystack = [part.title,part.short_description,part.part_number,part.sku,part.fitment,part.system,...part.engines??[],...part.years??[],...part.trucks??[]].join(" ").toLowerCase();
        const matched = terms.filter(term => forms(term).some(form => haystack.includes(form))).length;
        return { part, matched };
      }).filter(entry => !terms.length || entry.matched > 0).sort((a,b) => b.matched-a.matched || a.part.slug.localeCompare(b.part.slug));
    const exact = ranked.filter(r => r.matched === terms.length); const selected = exact.length ? exact : ranked;
    return { checked_at: new Date().toISOString(), currency: "USD", query: args, total: selected.length, query_match: exact.length || !terms.length ? "all_search_terms" : "related_only",
      listings: selected.slice(0,args.limit).map(({part})=>listing(part,args)),
      note: selected.length ? "Listed stock is not reserved. Confirm application before purchasing. Prices exclude any separately quoted shipping, core costs and tax." : "No matching published listing was found. This does not establish that HAR has no unlisted engines or transmissions; call the team.",
      website_notice: SITE_NOTICE, contact_url: `${WEBSITE}/contact`,
    };
  }
  async get(id: string) {
    const raw = await this.data.read("parts",new URLSearchParams({select:CATALOG_COLUMNS,slug:`eq.${id}`,status:"eq.published",stock_quantity:"gt.0",limit:"1"}));
    if (!raw.length) return { checked_at:new Date().toISOString(), status:"not_available", listing:null, website_notice:SITE_NOTICE };
    const part=PublicPart.safeParse(raw[0]); if(!part.success)throw new DataUnavailable("Live HAR inventory");
    return { checked_at:new Date().toISOString(),status:"available",listing:listing(part.data),website_notice:SITE_NOTICE };
  }
}
