import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { handleMcp } from "../dist/src/handler.js";
import { PublicData } from "../dist/src/public-data.js";
import { Catalogue, SearchInput, classify, CATALOG_COLUMNS } from "../dist/src/catalog.js";
import { Knowledge, documentText } from "../dist/src/knowledge.js";
import { configFromEnv } from "../dist/src/config.js";
import { ReadLimiter } from "../dist/src/limiter.js";

const config={supabaseUrl:"https://fixture.supabase.co",publishableKey:"sb_publishable_fixture",origin:"http://localhost:3333"};
const item={slug:"fixture-transmission",title:"Allison 1000 6 Speed Transmission",code:"OEM",sku:"A-1",part_number:"123",short_description:"Public listing only",system:"Transmission",systems:["Transmission"],condition:"used",condition_label:"Used",price:"1500.00",fitment:"Check part number",years:["2007"],trucks:["Chevrolet Silverado"],engines:["LBZ"],primary_image:"https://hicksvilleautorecyclers.com/har-mark.png",stock_quantity:1,freight_only:true,pickup_only:false,status:"published"};
const response=rows=>Response.json(rows);
function reads(rows=[item]){const calls=[];return {calls,fetch:async(url,init)=>{calls.push({url:new URL(url),init});return response(String(url).includes("blog_posts")?[]:rows);}};}
async function clientFor(fetcher){const client=new Client({name:"isolated-har-test",version:"1"});await client.connect(new StreamableHTTPClientTransport(new URL(config.origin+"/mcp"),{fetch:async(input,init)=>handleMcp(new Request(input,init),config,fetcher)}));return client;}

test("real SDK initialization, tool discovery, structured calls and rechecks use public reads only",async()=>{
  let available=true;const requests=[];
  const client=await clientFor(async(url,init)=>{const u=new URL(url);requests.push({u,init});return response(u.pathname.endsWith("blog_posts")?[]:available?[{...item,customer_email:"private@example.test",cost:1}]:[]);});
  try{
    const tools=await client.listTools();assert.equal(tools.tools.length,4);assert.ok(tools.tools.every(t=>t.annotations.readOnlyHint&&!t.annotations.destructiveHint&&t.outputSchema));
    const found=await client.callTool({name:"search_inventory",arguments:{kind:"transmission",engine:"LBZ",year:"2007"}});
    assert.ok(!found.isError);assert.equal(found.structuredContent.listings.length,1);assert.equal(found.structuredContent.listings[0].price,1500);
    assert.equal(found.structuredContent.listings[0].fitment.status,"catalog_candidate");assert.doesNotMatch(JSON.stringify(found),/private@example|customer_email|"cost"/);
    available=false;const again=await client.callTool({name:"get_inventory_item",arguments:{id:item.slug}});assert.equal(again.structuredContent.status,"not_available");
    const guide=await client.callTool({name:"get_har_knowledge",arguments:{id:"guide:identify-duramax"}});assert.equal(guide.structuredContent.status,"found");
    const invalid=await client.callTool({name:"search_inventory",arguments:{limit:1000}});assert.equal(invalid.isError,true);
    assert.ok(requests.every(({u,init})=>["/rest/v1/parts","/rest/v1/blog_posts"].includes(u.pathname)&&!init.method&&init.cache==="no-store"));
    assert.ok(requests.every(({u,init})=>u.searchParams.get("status")==="eq.published"&&init.headers.apikey===config.publishableKey&&!init.headers.Authorization));
  }finally{await client.close();}
});
test("unavailable catalogue is an error, not an empty search; valid zero inventory remains zero",async()=>{
  const client=await clientFor(async()=>new Response("private upstream failure",{status:503}));
  try{const result=await client.callTool({name:"search_inventory",arguments:{query:"engine"}});assert.equal(result.isError,true);assert.equal(result.structuredContent,undefined);assert.match(result.content[0].text,/unavailable/);assert.doesNotMatch(JSON.stringify(result),/private upstream/);}finally{await client.close();}
  const fake=reads([]);const result=await new Catalogue(new PublicData(config,fake.fetch)).search(SearchInput.parse({query:"engine"}));assert.equal(result.total,0);assert.match(result.note,/No matching published/);
});
test("catalogue reads exact fields and drains all pages; a cap or malformed row refuses an incomplete answer",async()=>{
  let count=0;const pages=Array.from({length:250},(_,i)=>({...item,slug:`part-${i}`}));
  const db=new PublicData(config,async(url)=>{assert.equal(new URL(url).searchParams.get("select"),CATALOG_COLUMNS);return response(count++===0?pages:[{...item,slug:"final-part"}]);});
  const all=await new Catalogue(db).all();assert.equal(all.length,251);
  await assert.rejects(new Catalogue(new PublicData(config,async()=>response(pages))).all(),/unavailable/);
  await assert.rejects(new Catalogue(new PublicData(config,async()=>response([{...item,status:"draft"}]))).all(),/unavailable/);
  await assert.rejects(new Catalogue(new PublicData(config,async()=>response([{...item,price:"invalid"}]))).all(),/unavailable/);
});
test("complete units never include known transmission components, engine harnesses or whole vehicles",()=>{
  assert.equal(classify(item),"transmission");
  for(const title of ["Allison Transmission Valve Body","Allison Transmission Output Shaft","Allison Transmission Control Module","Allison Torque Converter"]){assert.equal(classify({...item,title}),"part");}
  const engine={...item,system:"Engine",systems:["Engine"]};
  for(const title of ["Duramax Complete Engine Wiring Harness","Duramax Engine Oil Cooler","Duramax Engine Head"]){assert.equal(classify({...engine,title}),"part");}
  assert.equal(classify({...engine,title:"LML Duramax Long Block Engine"}),"engine");
  assert.equal(classify({...engine,title:"Complete Duramax Engine with Turbo and Injectors"}),"engine");
  assert.equal(classify({...item,system:"Whole Trucks"}),"vehicle");
  assert.equal(classify({...item,freight_only:false}),"part");
});
test("explicit incompatible tags are excluded; missing fitment is disclosed, never claimed verified",async()=>{
  const c=new Catalogue(new PublicData(config,reads([item,{...item,slug:"unknown",years:[],trucks:[],engines:[]}]).fetch));
  const answer=await c.search(SearchInput.parse({engine:"L5P",year:"2022",truck:"GMC Sierra"}));
  assert.equal(answer.listings.length,1);assert.equal(answer.listings[0].id,"unknown");assert.equal(answer.listings[0].fitment.status,"not_confirmed");assert.deepEqual(answer.listings[0].fitment.missing_fields,["engine","year","truck"]);
});
test("related keyword results are marked and strict price bounds remain effective",async()=>{
  const c=new Catalogue(new PublicData(config,reads().fetch));
  const answer=await c.search(SearchInput.parse({query:"Allison special-unlisted-feature"}));assert.equal(answer.query_match,"related_only");
  const none=await c.search(SearchInput.parse({max_price:1000}));assert.equal(none.total,0);
});
test("knowledge preserves partial-read failure and only renders text from published documents",async()=>{
  const k=new Knowledge(new PublicData(config,async()=>new Response("bad",{status:500})));
  const result=await k.search("Duramax");assert.equal(result.status,"partial");assert.ok(result.warnings.length);assert.ok(result.results.length);
  assert.equal((await k.get("guide:missing")).status,"not_found");
  assert.equal(documentText({type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"A real article"}]},{type:"image",attrs:{src:"secret"}}]}),"A real article ");
});
test("secret keys are refused and only safe configured public endpoints are accepted",()=>{
  const valid={HAR_SUPABASE_URL:config.supabaseUrl,HAR_SUPABASE_PUBLISHABLE_KEY:config.publishableKey,HAR_MCP_ORIGIN:config.origin};
  assert.deepEqual(configFromEnv(valid),config);
  for(const key of ["sb_secret_bad","unknown",`x.${Buffer.from('{"role":"service_role"}').toString('base64url')}.x`])assert.throws(()=>configFromEnv({...valid,HAR_SUPABASE_PUBLISHABLE_KEY:key}),/public/);
  for(const url of ["http://fixture.supabase.co","https://fixture.supabase.co/private","https://evil.example","https://u:p@fixture.supabase.co"])assert.throws(()=>configFromEnv({...valid,HAR_SUPABASE_URL:url}));
});
test("HTTP origin/host, unsupported methods, payload limits and cache headers are enforced",async()=>{
  const forbidden=()=>{throw new Error("No data read expected");};
  const req=(headers={},body='{}')=>new Request(config.origin+"/mcp",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json, text/event-stream",...headers},body});
  assert.equal((await handleMcp(req({Origin:"https://evil.example"}),config,forbidden)).status,403);
  assert.equal((await handleMcp(req({Host:"evil.example"}),config,forbidden)).status,403);
  assert.equal((await handleMcp(new Request(config.origin+"/mcp"),config,forbidden)).status,405);
  assert.equal((await handleMcp(req({},'x'.repeat(70000)),config,forbidden)).status,413);
  const options=await handleMcp(new Request(config.origin+"/mcp",{method:"OPTIONS",headers:{Origin:"https://chatgpt.com"}}),config,forbidden);
  assert.equal(options.status,204);assert.equal(options.headers.get("Access-Control-Allow-Origin"),"https://chatgpt.com");assert.equal(options.headers.get("Cache-Control"),"no-store");
});
test("load limits cap concurrent and repeated requests without retaining visitor identities",()=>{
  let clock=60000;const limit=new ReadLimiter(()=>clock,2,1);
  const first=limit.acquire();assert.ok(first);assert.equal(limit.acquire(),null);first();first();
  const second=limit.acquire();assert.ok(second);second();assert.equal(limit.acquire(),null);clock+=60001;assert.ok(limit.acquire());
});
test("upload manifest uses portable root layout, no authentication secrets and the company endpoint",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../plugin.json",import.meta.url)));const mcp=JSON.parse(readFileSync(new URL("../mcp.json",import.meta.url)));
  assert.equal(manifest.name,"hicks-help");assert.equal(mcp.mcpServers.har.url,"https://hicksvilleautorecyclers.com/api/mcp");assert.equal(mcp.mcpServers.har.type,"streamable-http");
  assert.doesNotMatch(JSON.stringify({manifest,mcp}),/Bearer|sb_secret|service_role|OPENAI_API_KEY/);
});
