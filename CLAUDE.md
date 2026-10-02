@AGENTS.md

# Hicks Help MCP handoff

October 2, 2026: first implementation checked locally. The owner authorized building
and pushing to hicksvilleautorecyclers/Hicksvilleauto-mcp and chose customers
using public inventory. The remote repository began empty. Build a read-only
MCP with public live catalogue search/details and sourced HAR/Duramax knowledge.
ChatGPT supplies reasoning; no extra model/API key is needed for these tools.
Four read-only tools, six sourced guides, published blog reads and the portable
upload ZIP are implemented. Build/types and all 11 protocol/data-boundary tests
pass. A real SDK client exercised local HTTP against the live public database:
12 complete transmission matches, fresh listing recheck, missing listing,
knowledge search and guide retrieval. No production writes. The ZIP has only
the two manifests, public instructions and HAR's logo; no credentials.

Next: export the committed runtime to Main-website's vendor/har-mcp package,
deploy /api/mcp through the existing company website, run the same SDK smoke
against HTTPS, and deliver the ZIP. Update release records with actual outcomes.
No custom ChatGPT UI is required: the tools return structured text and source
links. Website deployment and ChatGPT installation/review are not yet complete.
Existing website, Android
build 13, pending Meta review discussion and the held sample add-ons stay separate.
