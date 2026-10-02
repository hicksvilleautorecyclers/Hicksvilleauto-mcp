import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Config } from "./config.js";
import { createServer } from "./server.js";
import { ReadLimiter } from "./limiter.js";

const limiter=new ReadLimiter();

/** One request, one transport. No sessions, staff cookies or bearer-token forwarding. */
export async function handleMcp(request:Request,config:Config,fetcher:typeof fetch=fetch):Promise<Response>{
  const origin=request.headers.get("origin");
  const allowed=new Set([config.origin,"https://chatgpt.com","https://chat.openai.com"]);
  if(origin&&!allowed.has(origin))return new Response("Origin not allowed",{status:403});
  const host=request.headers.get("host");
  if(host&&host!==new URL(config.origin).host)return new Response("Host not allowed",{status:403});
  const headers=new Headers({"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Vary":"Origin","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id","Access-Control-Expose-Headers":"MCP-Protocol-Version, MCP-Session-Id"});
  if(origin)headers.set("Access-Control-Allow-Origin",origin);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method!=="POST"){headers.set("Allow","POST, OPTIONS");return new Response("Use MCP Streamable HTTP POST.",{status:405,headers});}
  const release=limiter.acquire();
  if(!release){headers.set("Retry-After","60");return new Response("HAR lookup capacity is busy. Try again shortly.",{status:429,headers});}
  const server=createServer(config,fetcher);
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:65536});
  try{
    await server.connect(transport);
    const reply=await transport.handleRequest(request);
    // JSON mode resolves the entire response before closing this per-request server.
    const body=await reply.arrayBuffer();
    reply.headers.forEach((value,key)=>headers.set(key,value));
    headers.set("Cache-Control","no-store");
    return new Response(reply.status===204||reply.status===202?null:body,{status:reply.status,headers});
  }catch{
    console.error("har_mcp_protocol_failed");
    return Response.json({jsonrpc:"2.0",id:null,error:{code:-32603,message:"MCP request failed. Try again."}},{status:500,headers});
  }finally{try{await server.close();}finally{release();}}
}
