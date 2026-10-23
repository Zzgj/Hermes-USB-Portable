// Browser-entry check for the fixed NATIVE_BASELINE, not a replacement for the
// authenticated RPC probe. No credential is sent in a URL/header or returned.
// The loopback SPA injects its process token; headless serve does not provide
// the embedded-chat bootstrap plus root and prebuilt module entry together.
const maximumHtml=2*1024*1024;
function attribute(tag,name){
 const matches=[...tag.matchAll(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(["\\\'])(.*?)\\1','gi'))];
 return matches.length===1?matches[0][2]:null;
}
function entryAssets(html,token){
 const page=html.replace(/<!--[\s\S]*?-->/g,'');
 const bootstrap='<script>window.__HERMES_SESSION_TOKEN__="'+token+'";'+
  'window.__HERMES_DASHBOARD_EMBEDDED_CHAT__=true;window.__HERMES_BASE_PATH__="";'+
  'window.__HERMES_AUTH_REQUIRED__=false;</script>';
 if(!page.includes(bootstrap)||![...page.matchAll(/<div\b[^>]*>/gi)].some(m=>attribute(m[0],'id')==='root'))return null;
 const assets=new Map();let modules=0;
 for(const match of page.matchAll(/<(?:script|link)\b[^>]*>/gi)){
  const tag=match[0],script=/^<script\b/i.test(tag);
  const module=script&&attribute(tag,'type')==='module';
  const relation=script?null:attribute(tag,'rel');
  if(!module&&!['stylesheet','modulepreload'].includes(relation))continue;
  const path=attribute(tag,script?'src':'href'),extension=relation==='stylesheet'?'css':'js';
  // Fixed local Vite assets only. Never follow an external/protocol-relative,
  // encoded, query-bearing or traversing resource advertised by a response.
  if(!path||!new RegExp('^/assets/[A-Za-z0-9_./-]+\\.'+extension+'$').test(path)||
   path.slice(1).split('/').some(part=>!part||part==='.'||part==='..'))return null;
  if(module)modules++;
  assets.set(path,extension);if(assets.size>16)return null;
 }
 return modules?assets:null;
}

export async function probeNativeDashboardPage({port,token,signal,timeoutMs=5000}){
 if(!Number.isInteger(port)||port<1||port>65535||typeof token!=='string'||
  !/^[A-Za-z0-9_-]{16,128}$/.test(token)||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||signal?.aborted)return false;
 const controller=new AbortController(),abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 let reader;
 const request=async path=>fetch(`http://127.0.0.1:${port}${path}`,{
  method:'GET',signal:controller.signal,redirect:'manual',credentials:'omit',cache:'no-store',
  headers:{Accept:path==='/'?'text/html':'*/*'},
 });
 try{
  const response=await request('/');
  if(response.status!==200||!/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type')||'')||!response.body){
   void response.body?.cancel().catch(()=>{});return false;
  }
  const length=response.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maximumHtml)){
   void response.body.cancel().catch(()=>{});return false;
  }
  reader=response.body.getReader();const decoder=new TextDecoder('utf-8',{fatal:true});
  let bytes=0,html='';
  while(true){
   const chunk=await reader.read();if(chunk.done)break;
   bytes+=chunk.value.byteLength;if(bytes>maximumHtml)return false;
   html+=decoder.decode(chunk.value,{stream:true});
  }
  html+=decoder.decode();controller.signal.throwIfAborted();
  const assets=entryAssets(html,token);if(!assets)return false;
  let remaining=32*1024*1024;
  for(const [path,extension] of assets){
   // The pinned FastAPI CSS route promises GET, not HEAD. Consume bounded
   // bodies too: headers alone cannot distinguish a stalled asset download.
   const asset=await request(path);
   const type=asset.headers.get('content-type')||'';
   if(asset.status!==200||!asset.body||!(extension==='css'?/^text\/css(?:\s*;|$)/i:/^(?:text|application)\/javascript(?:\s*;|$)/i).test(type)){
    void asset.body?.cancel().catch(()=>{});return false;
   }
   const assetLength=asset.headers.get('content-length');
   if(assetLength!==null&&(!/^\d+$/.test(assetLength)||Number(assetLength)>Math.min(16*1024*1024,remaining))){
    void asset.body.cancel().catch(()=>{});return false;
   }
   const assetReader=asset.body.getReader();let size=0;
   try{
    while(true){
     const chunk=await assetReader.read();if(chunk.done)break;
     size+=chunk.value.byteLength;remaining-=chunk.value.byteLength;
     if(size>16*1024*1024||remaining<0)return false;
    }
    if(extension==='js'&&size===0)return false;
   }finally{void assetReader.cancel().catch(()=>{});assetReader.releaseLock();}
  }
  controller.signal.throwIfAborted();return true;
 }catch{return false;}
 finally{
  clearTimeout(timer);signal?.removeEventListener('abort',abort);abort();
  if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}
 }
}
