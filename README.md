# Hicks Help — HAR's Duramax plugin

A customer-facing, read-only MCP server for live Hicksville Auto Recyclers
inventory and HAR's public Duramax knowledge. ChatGPT supplies the conversation;
this server makes no OpenAI API calls and needs no OpenAI API key.

## Public ChatGPT submission

The owner reports the public Hicks Help submission is submitted as of October 2.
Its package is `artifacts/hicks-help-0.1.4.zip`; OpenAI approval is not confirmed.
The archive has `plugin.json`, `mcp.json` and the HAR logo at the portable plugin
root. Its MCP connection is `https://hicksvilleautorecyclers.com/api/mcp`, with
no authentication. Installation in a particular ChatGPT account and publication
in the public directory are separate steps; neither is established by a build.

The requested product is regular ChatGPT on the web, using the hosted MCP; a
desktop-only listing does not satisfy this requirement. The public submission
is `plugin_asdk_app_6abfcfb8b4548191a3bdff9cbdc2688b`, draft
`appsub_6abfcfb8b4808191be3814433d6b86f1`. Keep this identity and the `hicks-help`
package name. Preserve this submitted package when updating a separate personal
testing app.

The ZIP imports all-supported-country availability, the English base listing,
five positive and three negative cases, commerce details and release notes.
Translations are optional. Package 0.1.4 adds the owner-supplied transmission
shopping recording under `review.demo_recording_url`. The recording shows live
inventory and related-parts guidance; it does not demonstrate every submitted
test case. Any further review requirements depend on OpenAI's response. See the
[official review fields](https://developers.openai.com/plugins/deploy/submission#configure-onboarding-review-and-publication).

Once Hicks Help is installed and connected, start a new ChatGPT chat. ChatGPT
can choose installed tools for a relevant task; type `@Hicks Help` to explicitly
select it. No automatic recommendation on every Duramax question is promised.

## Personal browser testing update

The separate browser testing app's exported package has the internal name
`dev-6abfd65360c08191a60b89fbe27f0024`, so the public `hicks-help` ZIP cannot
update it. Use `artifacts/hicks-help-personal-1.0.1.zip` in that existing app's
**Upload new version** dialog. It preserves the original registered browser
app connection and adds HAR's logo, developer details, support links and prompts.
The ZIP is prepared and checked; acceptance and rendered branding still require
verification in ChatGPT. It needs no desktop executable or local server.

Rebuild from the actual exported personal package, never a guessed app identity:

```sh
python3 scripts/package-personal-plugin.py /path/to/export.zip 1.0.1
```

Keep this personal update separate from the submitted public package.

Try “Find complete Allison transmissions at HAR” or “What should I confirm before
ordering a rebuilt Duramax?” Give the year, truck model, engine/RPO and 2WD/4WD
when discussing fitment. Product links currently encounter the website's Coming
Soon page without preview access. Call 419-542-8500 for purchasing.

## Tools and sources

| Tool | Result |
| --- | --- |
| `search_inventory` | Fresh published, in-stock listings, with optional engine, truck, year, kind and price filters. |
| `get_inventory_item` | Fresh listing details; reports a removed or sold listing as unavailable. |
| `search_har_knowledge` | Relevant curated HAR guides and live published blog articles, with sources. |
| `get_har_knowledge` | A guide or article's text and its source. |

Only explicit public `parts` and `blog_posts` columns are queried, using a
Supabase publishable key and anonymous row policies. Credentials, cookies and
authorization headers supplied by visitors are never forwarded to the database.
There are no write tools, private records, payment actions or automatic messages.
The curated guides come from the public website source at `Main-website` commit
`2379551`; Dan's private sample quote and unapproved add-ons are not a price list.

Catalogue matching distinguishes complete engines/transmissions from components
and excludes explicitly incompatible fitment tags. Missing tags are disclosed;
a match is a candidate, never VIN verification. Knowledge is guidance, not an OEM
repair manual. Prices, warranty, core terms and shipping must not be invented.

Reads are uncached, bounded and timed out. Inventory failures produce an MCP
error, never a false empty search; failed blog reads leave a visible partial
knowledge result. Published text is untrusted data, not tool instructions.

## Development

Use Node 24. Copy `.env.example` to `.env.local` and set the project's public
Supabase URL and publishable/anon key. Service-role and secret keys are refused.

```sh
npm ci
npm run build
npm run check
npm start
# Separate terminal: live read-only protocol checks
npm run smoke
```

Tests exercise the real MCP SDK over in-memory HTTP with controlled data: schema
discovery, calls, stale-stock rechecks, failures vs empty results, pagination,
fitment, unit classification, metadata and HTTP boundaries. `smoke` exercises
the actual configured public database without writing anything. To verify the
hosted deployment: `npm run smoke -- https://hicksvilleautorecyclers.com/api/mcp`.

## Hosting and packaging

The existing HAR Next.js website hosts this runtime at `/api/mcp`; no separate
Vercel project is required. After checking and committing a source revision:

```sh
python3 scripts/export-website.py /path/to/Main-website
python3 scripts/package-plugin.py
```

The exporter writes compiled modules, declarations, exact dependencies and
per-file hashes to `vendor/har-mcp`. The website imports that local package through
a small Node route and uses its existing public Supabase environment. Regenerate
the vendor package from this repository; do not edit it in the website. Run the
website's release checks and deploy, then run the remote smoke before handing
out a new ZIP. The ZIP contains no server source, environment file or credentials.

The endpoint is stateless Streamable HTTP with JSON responses. POST and OPTIONS
are supported; GET/SSE subscriptions and DELETE sessions are not used. Bodies
are capped at 64 KiB, and each warm process permits 8 concurrent requests and
240 POSTs per minute. This is a local load guard, not a distributed per-person
quota. It retains no visitor identifiers. Infrastructure access logs may still
be retained by the existing website host; the server's own error logs contain
only an operation label, never prompts, tokens or customer details.

## Maintenance

Keep the existing Coming Soon gate intact. Update the tool's site notice when
the owner opens the website. New public knowledge should include its source and
review date; prices should remain live inventory values. Changing tools never
authorizes orders, staff access or outreach. See `AGENTS.md` and `CLAUDE.md`.

Format references: [OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins)
and [MCP server guidance](https://developers.openai.com/plugins/build/mcp-server).
