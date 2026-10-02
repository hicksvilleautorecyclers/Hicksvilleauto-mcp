export const WEBSITE = "https://hicksvilleautorecyclers.com";
export const PHONE = "+14195428500";
export const VERSION = "0.1.0";
export const SITE_NOTICE = "HAR’s website currently shows Coming Soon to visitors without preview access. Product links may show that screen. Call 419-542-8500 to confirm fitment, stock and purchasing; this tool does not place an order.";

export type Config = { supabaseUrl: string; publishableKey: string; origin: string };
export function configFromEnv(env: Record<string, string | undefined> = process.env): Config {
  const supabaseUrl = env.HAR_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey = env.HAR_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  const url = new URL(supabaseUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid public catalogue configuration.");
  let publicKey = publishableKey.startsWith("sb_publishable_");
  if (!publicKey) {
    try { publicKey = JSON.parse(Buffer.from(publishableKey.split(".")[1] ?? "", "base64url").toString()).role === "anon"; } catch { /* Refuse unknown credentials. */ }
  }
  if (!publicKey) throw new Error("A public publishable/anon key is required. Secret and service-role keys are refused.");
  const origin = new URL(env.HAR_MCP_ORIGIN ?? WEBSITE);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/" || !["https:", "http:"].includes(origin.protocol)) throw new Error("Invalid MCP origin.");
  if (origin.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw new Error("Remote MCP must use HTTPS.");
  return { supabaseUrl: url.origin, publishableKey, origin: origin.origin };
}
