import { createServer } from "node:http";
import { Readable } from "node:stream";
import { configFromEnv, VERSION } from "./config.js";
import { handleMcp } from "./handler.js";

const config=configFromEnv();
const port=Number(process.env.PORT??3333);
const server=createServer(async(req,res)=>{
  try{
    if(req.url!=="/mcp"&&req.url!=="/api/mcp"){
      res.writeHead(req.url==="/health"?200:404,{"Content-Type":"application/json"});res.end(JSON.stringify({name:"hicksvilleauto-mcp",version:VERSION}));return;
    }
    const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(","):value);
    const init={method:req.method,headers,...(!["GET","HEAD"].includes(req.method??"GET")?{body:Readable.toWeb(req),duplex:"half"}:{})} as RequestInit;
    const response=await handleMcp(new Request(new URL(req.url,config.origin),init),config);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end("MCP unavailable");}
});
server.listen(port,"127.0.0.1",()=>console.log(`Hicks Help MCP: http://localhost:${port}/mcp`));
process.once("SIGTERM",()=>server.close());process.once("SIGINT",()=>server.close());
