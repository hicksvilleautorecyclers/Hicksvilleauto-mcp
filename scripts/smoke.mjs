import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const endpoint=process.argv[2]??"http://localhost:3333/mcp";
const client=new Client({name:"har-public-read-verification",version:"0.1.0"});
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
try {
  const {tools}=await client.listTools();assert.equal(tools.length,4);assert.ok(tools.every(t=>t.annotations?.readOnlyHint));
  console.log("MCP initialize and four read-only tool schemas passed.");
  const searched=await client.callTool({name:"search_inventory",arguments:{query:"",kind:"transmission",limit:3}});
  assert.ok(!searched.isError,JSON.stringify(searched.content));const result=searched.structuredContent;
  assert.ok(Array.isArray(result.listings));
  assert.deepEqual(result.results,result.listings.map(({id,title,url})=>({id,title,url})));
  assert.ok(result.results.every(source=>new URL(source.url).origin==="https://hicksvilleautorecyclers.com"));
  console.log("Live complete-transmission search and public citation sources passed; count:",result.total);
  if(result.listings[0]){
    const checked=await client.callTool({name:"get_inventory_item",arguments:{id:result.listings[0].id}});
    assert.ok(!checked.isError);assert.equal(checked.structuredContent.status,"available");
    assert.equal(checked.structuredContent.url,checked.structuredContent.listing.url);
    assert.equal(checked.structuredContent.id,checked.structuredContent.listing.id);
    assert.ok(checked.structuredContent.text.includes(checked.structuredContent.listing.title));
    console.log("A returned public listing was rechecked with its public source URL.");
  }
  const missing=await client.callTool({name:"get_inventory_item",arguments:{id:"har-mcp-verification-no-such-listing"}});
  assert.ok(!missing.isError);assert.equal(missing.structuredContent.status,"not_available");assert.equal(missing.structuredContent.url,null);
  const found=await client.callTool({name:"search_har_knowledge",arguments:{query:"Duramax Allison",limit:3}});
  assert.ok(!found.isError);assert.equal(found.structuredContent.status,"ok");assert.ok(found.structuredContent.results.length);
  const guide=await client.callTool({name:"get_har_knowledge",arguments:{id:found.structuredContent.results[0].id}});
  assert.ok(!guide.isError);assert.equal(guide.structuredContent.status,"found");
  assert.equal(guide.structuredContent.url,guide.structuredContent.article.url);
  assert.equal(guide.structuredContent.text,guide.structuredContent.article.text);
  assert.equal(new URL(guide.structuredContent.url).origin,"https://hicksvilleautorecyclers.com");
  console.log("Published article read, curated guide search/fetch and missing-listing handling passed. No production writes.");
} finally { await client.close(); }
