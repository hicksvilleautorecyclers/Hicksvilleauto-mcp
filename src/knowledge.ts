import { z } from "zod";
import { PublicData, DataUnavailable } from "./public-data.js";
import { queryTerms } from "./catalog.js";
import { WEBSITE, SITE_NOTICE } from "./config.js";

type Guide = { id: string; title: string; text: string; url: string; reviewed_at: string; source: string; text_scope?: string };
// Curated from HAR website copy at 2379551. No private email/quote prices.
// Year bands describe HAR's catalogue groups; they are not a VIN decoder.
export const GUIDES: Guide[] = [
  {
    id:"guide:identify-duramax", title:"Identify a Duramax before choosing parts", url:`${WEBSITE}/engines`, reviewed_at:"2026-10-02", source:"HAR engine guide and catalogue",
    text:"HAR groups its Duramax catalogue by LB7 (2001–2004), LLY (2004.5–2005), LBZ (2006–2007), LMM (2007.5–2010), LML (2011–2016), and L5P (2017 onward). These are catalogue groupings, not an exhaustive VIN/RPO identification rule. Transition years and medium-duty applications need special care. L5D medium-duty and L5P pickup applications must not be assumed interchangeable. Ask for exact model year, truck model/series, engine RPO and the old part number. A year alone does not prove engine identity or fitment.",
  },
  {
    id:"guide:used-engines",title:"Choosing a used HAR engine",url:`${WEBSITE}/engines/used`,reviewed_at:"2026-10-02",source:"HAR used-engine page",
    text:"HAR describes its used engines as complete, test-run and secured to a skid for shipping. Use live inventory for a particular engine’s listed condition, price and availability. A head, harness, oil cooler or other engine component is not a complete engine. If no complete unit is listed, call HAR about unlisted options; an empty online result does not mean the yard cannot supply one. Confirm what accessories are included for that specific engine before ordering.",
  },
  {
    id:"guide:rebuilt-engines",title:"HAR rebuilt and reman engine enquiries",url:`${WEBSITE}/engines/rebuilt`,reviewed_at:"2026-10-02",source:"HAR rebuilt-engine page",
    text:"HAR offers rebuilt Duramax engines using serviceable core components. Its website describes assemblies including upper/lower oil pans, front damper, flywheel, front cover/seal, rear engine plate and main seal, ready for accessories. Confirm the exact configuration, stock, lead time and included components with the engine team. No approved public package or add-on price list is included in this guide. Do not quote a sample email or imply an engine is in stock merely because a rebuilding service is offered.",
  },
  {
    id:"guide:allison-fitment",title:"Selecting an Allison transmission",url:`${WEBSITE}/transmissions`,reviewed_at:"2026-10-02",source:"HAR transmissions page and application workflow",
    text:"HAR supplies complete transmissions and transmission components. Search complete units separately so a valve body, shaft, drum or control module is not recommended as a whole transmission. For an Allison/Duramax enquiry, establish model year, truck series, engine code, transmission ID/RPO and 2WD or 4WD. Compare the original part number and listed application before purchase. The name Allison alone does not establish interchange, and five-, six- and ten-speed units are not interchangeable just because they share that branding. Ask the team about an uncertain application.",
  },
  {
    id:"guide:fitment-and-costs",title:"Fitment, freight and core questions before buying",url:`${WEBSITE}/contact`,reviewed_at:"2026-10-02",source:"HAR catalogue and purchasing workflow",
    text:"Catalogue year, truck and engine tags help find candidates; they do not replace application confirmation. For engines and transmissions, ask HAR to confirm the engine/unit price, any core cost and return conditions, freight or pickup arrangements, included accessories and applicable warranty in writing. Do not assume core charges are refundable, shipping is included or a warranty has a particular duration. Quotes and payment happen through the yard’s existing reviewed process. Call 419-542-8500.",
  },
  {
    id:"guide:diagnostic-enquiry",title:"Prepare a useful Duramax problem description",url:`${WEBSITE}/contact`,reviewed_at:"2026-10-02",source:"HAR customer enquiry guidance",
    text:"Before recommending a replacement part, collect the exact truck year/model, engine or transmission code, the symptom and when it occurs, reported diagnostic codes and tests already performed. A fault code or symptom alone does not prove a component needs replacing. Separate general explanations from confirmed findings. Use the exact vehicle’s manufacturer service information for specifications, torque values and repair procedures. For unsafe operation, stop driving and arrange professional assessment; do not promise that continuing is safe. Recommend HAR inventory only when relevant to the established need.",
  },
];
export const BLOG_COLUMNS="slug,title,excerpt,body,published_at,status,updated_at";
const Blog=z.object({slug:z.string().min(1).max(200),title:z.string(),excerpt:z.string(),body:z.unknown(),published_at:z.string(),status:z.literal("published"),updated_at:z.string()});
/** Read text only from the published Tiptap document, never HTML or embeds. */
export function documentText(value:unknown, depth=0):string {
  if(depth>18 || !value || typeof value!=="object")return "";
  const node=value as {type?:unknown;text?:unknown;content?:unknown};
  if(node.type==="text" && typeof node.text==="string")return node.text.slice(0,12000);
  return Array.isArray(node.content)?node.content.slice(0,150).map(child=>documentText(child,depth+1)).join(" ").slice(0,16000):"";
}
export class Knowledge {
  constructor(private readonly data:PublicData){}
  async articles(slug?:string):Promise<Guide[]> {
    const rows=await this.data.read("blog_posts",new URLSearchParams({select:BLOG_COLUMNS,status:"eq.published",published_at:`lte.${new Date().toISOString()}`,order:"published_at.desc,id.desc",limit:slug?"1":"101",...(slug?{slug:`eq.${slug}`}:{})}));
    if(rows.length>100)throw new DataUnavailable("The complete HAR article index");
    return rows.map(row=>{const parsed=Blog.safeParse(row);if(!parsed.success)throw new DataUnavailable("HAR published articles");const a=parsed.data;
      return {id:`blog:${a.slug}`,title:a.title,text:documentText(a.body)||a.excerpt,url:`${WEBSITE}/blog/${encodeURIComponent(a.slug)}`,reviewed_at:a.updated_at,source:"Published HAR article",text_scope:"Published text extract, limited to 16,000 characters with media omitted. Read the source page for the complete article."};
    });
  }
  async search(query:string,limit=6){
    let articles:Guide[]=[];const warnings:string[]=[];
    try{articles=await this.articles();}catch{warnings.push("Published HAR articles could not be checked. Results below cover the curated guides only; this is not an empty-article result.");}
    const terms=queryTerms(query);
    const results=[...GUIDES,...articles].map(g=>({g,score:terms.filter(t=>(g.title+" "+g.text).toLowerCase().includes(t)).length})).filter(x=>!terms.length||x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(({g})=>({id:g.id,title:g.title,url:g.url,excerpt:g.text.slice(0,450),reviewed_at:g.reviewed_at,source:g.source}));
    return {status:warnings.length?"partial":"ok",checked_at:new Date().toISOString(),results,warnings,website_notice:SITE_NOTICE};
  }
  async get(id:string){
    const guide=GUIDES.find(g=>g.id===id)??(id.startsWith("blog:")?(await this.articles(id.slice(5)))[0]:undefined);
    // Keep the article object for existing clients and expose the standard
    // document fields at the root for URL-backed citation handling.
    return {status:guide?"found":"not_found",article:guide??null,
      id:guide?.id??null,title:guide?.title??null,url:guide?.url??null,text:guide?.text??null,
      checked_at:new Date().toISOString(),website_notice:SITE_NOTICE};
  }
}
