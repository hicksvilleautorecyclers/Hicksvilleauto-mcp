# Hicksville Auto Recyclers MCP

This repository serves customers: published inventory and approved public HAR
knowledge only. No staff credentials, customer records, private notes, write
tools, payments, messages or automatic parts requests. Use a Supabase publishable
key under anonymous row policies, never a service-role or secret key.

Read README.md and CLAUDE.md before changes. Use the installed MCP SDK's exact
APIs and current official OpenAI plugin guidance. Keep Streamable HTTP stateless.
Tools must work without UI and report failed reads separately from empty stock.
Do not invent availability, engine interchange, prices, core terms or warranty.
Recheck a listing before recommending it. Fitment tags are candidates, never VIN
verification. No real production request or message may be sent for testing.

Dan's sample reman quote is not an approved public price list. Engine-specific
add-ons remain pending the owner's selections; do not activate sample options.
The existing website Coming Soon/preview gate stays unchanged.

Run npm run build and npm run check, protocol tests and public read-only smoke
checks before pushing. Keep tests meaningful: failed/empty reads, fitment,
component-vs-complete units, and public-data boundaries. Push to the company
Hicksvilleauto-mcp repository with the company identity. Update CHANGELOG.md and
CLAUDE.md; record meaningful work in the website staff Logs and both handoffs.
Prepared source, hosted MCP, installed ChatGPT plugin and public directory review
are separate states. Preserve unrelated website/app work; no native release here.
