import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {realpath,readFile,stat} from 'node:fs/promises';
import {join,relative,extname,isAbsolute} from 'node:path';
import {inspectEntryCapabilities,projectEntryCapabilities} from './entry-capabilities.mjs';

// Only fixed codes cross the HTTP boundary; never expose exception text, paths or output.
const operationReasons=new Set(['INSTANCE_LOCKED','LOCK_CREATE_FAILED','LOCK_INITIALIZATION_FAILED','LOCK_IDENTITY_CHANGED','LOCK_OWNER_CHANGED','INTERRUPTED_INSTALL_REQUIRES_RECOVERY','SOURCE_ENV_REQUIRES_REVIEW','INVALID_HERMES_PATHS','INVALID_HERMES_LAYOUT','HERMES_ENTRY_MISSING','PROCESS_SPAWN_FAILED','PROCESS_STARTUP_TIMEOUT','PROCESS_HEALTH_FAILED','PROCESS_EXITED_BEFORE_READY','PROCESS_STOPPED_BEFORE_READY','PROCESS_CONTROL_FAILED','PROCESS_OUTPUT_LIMIT','PROCESS_INVALID_PORT']);

export async function startControlServer({assets,startInstance,prepareLearn,readCatalog,prepareCapability,detectEntries,source,home,inspectEntries=inspectEntryCapabilities,nativeEntries}) {
 if(typeof startInstance!=='function'||!isAbsolute(assets))throw new Error('INVALID_CONTROL_OPTIONS');
 const root=await realpath(assets),token=randomBytes(32).toString('base64url');
 let origin,instance=null,busy=false,closing=false,pending=Promise.resolve();
 // Read requests are bounded separately; they must not hold the lifecycle mutex.
 const historyReads=new Map();let historyGeneration=0;
 const entryReads=new Map();
 const cancelHistory=()=>{historyGeneration++;for(const controller of historyReads.keys())controller.abort();};
 const json=(response,status,value)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));};
 const authorized=request=>{
  const value=request.headers.authorization;
  if(typeof value!=='string')return false;
  const actual=Buffer.from(value),expected=Buffer.from(`Bearer ${token}`);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
 };
 const server=createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Frame-Options','DENY');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* http://127.0.0.1:*; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try{
   if(request.headers.host!==new URL(origin).host||closing){json(response,403,{error:'UNAVAILABLE'});return;}
   const url=new URL(request.url,origin);
   if(url.pathname.startsWith('/api/')){
    const incomingOrigin=request.headers.origin;
    if(!authorized(request)||(incomingOrigin!==undefined&&incomingOrigin!==origin)||(request.method==='POST'&&incomingOrigin!==origin)){json(response,403,{error:'FORBIDDEN'});return;}
    if(url.pathname==='/api/capabilities/catalog'&&request.method==='GET'){
     if(typeof readCatalog!=='function'){json(response,404,{error:'UNAVAILABLE'});return;}
     if(busy||instance?.state!=='ready'){json(response,409,{error:'NOT_READY'});return;}
     busy=true;pending=(async()=>{try{json(response,200,await readCatalog());}catch{json(response,400,{error:'CATALOG_FAILED'});}finally{busy=false;}})();await pending;return;
    }
    if(['/api/learn/prepare','/api/capabilities/prepare'].includes(url.pathname)&&request.method==='POST'){
     const learning=url.pathname==='/api/learn/prepare',prepare=learning?prepareLearn:prepareCapability;
     if(typeof prepare!=='function'){json(response,404,{error:'UNAVAILABLE'});return;}
     if(busy||instance?.state!=='ready'){json(response,409,{error:'NOT_READY'});return;}
     if(request.headers['content-type']!=='application/json'||request.headers['transfer-encoding']||!Number.isInteger(Number(request.headers['content-length']))||Number(request.headers['content-length'])>16384||Number(request.headers['content-length'])<1){request.resume();json(response,400,{error:'INVALID_REQUEST'});return;}
     busy=true;
     pending=(async()=>{
      try{
       const chunks=[];let bytes=0;for await(const chunk of request){bytes+=chunk.length;if(bytes>16384)throw new Error();chunks.push(chunk);}
       const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
       if(!input||Array.isArray(input))throw new Error();
       if(learning&&(Object.keys(input).sort().join(',')!=='scope,source'||typeof input.source!=='string'||typeof input.scope!=='string'||!input.source.trim()||!input.scope.trim()||input.source.length>4000||input.scope.length>4000))throw new Error();
       if(!learning&&Object.keys(input).sort().join(',')!=='card,values')throw new Error();
       const prepared=await prepare(input);
       if(instance?.state!=='ready')throw new Error();
       json(response,200,{prepared,connection:await instance.connection});
      }catch{json(response,400,{error:learning?'LEARN_PREPARATION_FAILED':'CAPABILITY_PREPARATION_FAILED'});}finally{busy=false;}
     })();await pending;return;
    }
    if(url.pathname.startsWith('/api/sessions/')&&url.pathname.endsWith('/messages')&&request.method==='GET'){
     const match=url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
     if(!match){json(response,404,{error:'NOT_FOUND'});return;}
     const sessionId=match[1];
     if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/.test(sessionId)){json(response,400,{error:'INVALID_SESSION'});return;}
     if(busy||instance?.state!=='ready'){json(response,409,{error:'NOT_READY'});return;}
     if(historyReads.size>=8){json(response,429,{error:'HISTORY_BUSY'});return;}
     const owner=instance,generation=historyGeneration,controller=new AbortController();
     const timer=setTimeout(()=>controller.abort(),15000);
     const disconnected=()=>{if(!response.writableEnded)controller.abort();};
     response.once('close',disconnected);
     const reply=(status,value)=>{if(!response.destroyed&&!response.writableEnded)json(response,status,value);};
     let rejectAbort;
     const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(new Error('HISTORY_CANCELLED'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
     // The initial await ensures registration before any asynchronous completion.
     const reading=(async()=>{
      try{
       const connection=await Promise.race([Promise.resolve(owner.connection),aborted]);
       if(closing||instance!==owner||generation!==historyGeneration||owner.state!=='ready'||controller.signal.aborted)throw new Error('HISTORY_CANCELLED');
       if(!connection||!Number.isInteger(connection.port)||connection.port<1||connection.port>65535||typeof connection.token!=='string'||!connection.token){reply(503,{error:'NO_BACKEND'});return;}
       const upstreamUrl=`http://127.0.0.1:${connection.port}/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=50&offset=0&order=latest`;
       let upstreamResponse;
       try{upstreamResponse=await fetch(upstreamUrl,{method:'GET',headers:{Authorization:'Bearer '+connection.token},redirect:'error',signal:controller.signal});}
       catch{reply(502,{error:'UPSTREAM_UNREACHABLE'});return;}
       if(!upstreamResponse.ok||!upstreamResponse.body){await upstreamResponse.body?.cancel().catch(()=>{});reply(502,{error:'UPSTREAM_ERROR'});return;}
       // Server-side size limit: read and decode, reject over 1 MiB.
       const reader=upstreamResponse.body.getReader();const chunks=[];let length=0;
       try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>1_048_576){reply(502,{error:'UPSTREAM_TOO_LARGE'});return;}chunks.push(value);}}
       finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
       if(length===0){reply(502,{error:'UPSTREAM_EMPTY'});return;}
       const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
       let decoded;
       try{decoded=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{reply(502,{error:'UPSTREAM_INVALID'});return;}
       // Server-side projection: only return safe transcript shape, never raw upstream data.
       try{
        if(typeof decoded!=='object'||decoded===null||Array.isArray(decoded)||typeof decoded.session_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/.test(decoded.session_id)||!Array.isArray(decoded.messages)||decoded.messages.length>50)throw new Error();
        const messages=[];let omitted=false,total=0;
        for(const row of decoded.messages){
         if(typeof row!=='object'||row===null||Array.isArray(row)){omitted=true;continue;}
         if(row.display_kind==='hidden'){omitted=true;continue;}
         if(row.role!=='user'&&row.role!=='assistant'){omitted=true;continue;}
         const content=Object.hasOwn(row,'display_content')?row.display_content:row.content;
         if(typeof content!=='string'){omitted=true;continue;}
         const text=content.slice(0,Math.max(0,Math.min(20_000,100_000-total)));
         total+=text.length;omitted=omitted||text.length<content.length;
         if(text)messages.push({role:row.role,text});
        }
        if(closing||instance!==owner||generation!==historyGeneration||owner.state!=='ready'||controller.signal.aborted)throw new Error();
        reply(200,{sessionId:decoded.session_id,messages,omitted});
       }catch{reply(502,{error:'UPSTREAM_INVALID'});return;}
      }catch{reply(502,{error:'UPSTREAM_ERROR'});}
      finally{clearTimeout(timer);response.removeListener('close',disconnected);controller.signal.removeEventListener('abort',rejectAbort);historyReads.delete(controller);}
     })();historyReads.set(controller,reading);await reading;return;
    }
    if(url.pathname==='/api/entry-capabilities'&&request.method==='GET'){
     if(url.search||request.headers['transfer-encoding']||Number(request.headers['content-length']??0)!==0){request.resume();json(response,400,{error:'INVALID_REQUEST'});return;}
     if(entryReads.size>=8){json(response,429,{error:'ENTRY_CAPABILITIES_BUSY'});return;}
     const controller=new AbortController();
     const timer=setTimeout(()=>controller.abort(),5000);
     const disconnected=()=>{if(!response.writableEnded)controller.abort();};
     response.once('close',disconnected);
     let rejectAbort;
     const aborted=new Promise((_,reject)=>{rejectAbort=()=>reject(new Error('ENTRY_READ_CANCELLED'));controller.signal.addEventListener('abort',rejectAbort,{once:true});});
     const reading=(async()=>{
      try{
       const value=await Promise.race([Promise.resolve().then(()=>{
        controller.signal.throwIfAborted();return inspectEntries({source,assetsDir:root,signal:controller.signal});
       }),aborted]);
       if(closing||controller.signal.aborted||response.destroyed)return;
       json(response,200,projectEntryCapabilities(value));
      }catch{
       if(!response.destroyed&&!response.writableEnded)json(response,400,{error:'ENTRY_CAPABILITIES_FAILED'});
      }finally{clearTimeout(timer);response.removeListener('close',disconnected);controller.signal.removeEventListener('abort',rejectAbort);entryReads.delete(controller);}
     })();entryReads.set(controller,reading);await reading;return;
    }
    if(url.pathname==='/api/entries'&&request.method==='GET'){
     if(typeof detectEntries!=='function'){json(response,404,{error:'UNAVAILABLE'});return;}
     try{
      const entries=await detectEntries({source:source??null,home:home??null});
      if(!Array.isArray(entries)||entries.length>20)throw new Error('INVALID_ENTRIES');
      json(response,200,{entries});
     }catch{json(response,400,{error:'ENTRY_DETECTION_FAILED'});}
     return;
    }
    if(url.pathname==='/api/native-entry/status'&&request.method==='GET'){
     if(!nativeEntries){json(response,404,{error:'UNAVAILABLE'});return;}
     if(url.search||request.headers['transfer-encoding']||Number(request.headers['content-length']??0)!==0){request.resume();json(response,400,{error:'BODY_NOT_ALLOWED'});return;}
     const value=nativeEntries.status();
     json(response,200,{kind:['cli','dashboard'].includes(value.kind)?value.kind:null,
      state:['idle','starting','running','stopping','unknown'].includes(value.state)?value.state:'unknown'});return;
    }
    const nativeAction=new Map([
     ['/api/native-entry/cli/start','cli'],['/api/native-entry/dashboard/start','dashboard'],
     ['/api/native-entry/stop','stop'],['/api/native-entry/dashboard/open','open'],
    ]).get(url.pathname);
    if(nativeAction&&request.method==='POST'){
     if(!nativeEntries){json(response,404,{error:'UNAVAILABLE'});return;}
     if(url.search||request.headers['transfer-encoding']||Number(request.headers['content-length']??0)!==0){request.resume();json(response,400,{error:'BODY_NOT_ALLOWED'});return;}
     if(busy){json(response,409,{error:'OPERATION_PENDING'});return;}
     if(['cli','dashboard'].includes(nativeAction)&&instance){json(response,409,{error:'INSTANCE_EXISTS'});return;}
     busy=true;
     pending=(async()=>{
      try{
       if(nativeAction==='stop')await nativeEntries.stop();
       else if(nativeAction==='open')await nativeEntries.open();
       else await nativeEntries.start(nativeAction);
       json(response,202,{accepted:true});
      }catch{json(response,409,{error:'NATIVE_ENTRY_OPERATION_FAILED'});}
      finally{busy=false;}
     })();await pending;return;
    }
    if(url.pathname==='/api/status'&&request.method==='GET'){
     json(response,200,{state:busy?'changing':instance?.state??'idle'});return;
    }
    if(url.pathname==='/api/connection'&&request.method==='GET'){
     if(busy||instance?.state!=='ready'){json(response,409,{error:'NOT_READY'});return;}
     json(response,200,{state:'ready',connection:await instance.connection});return;
    }
    if(!['/api/start','/api/stop'].includes(url.pathname)||request.method!=='POST'){json(response,404,{error:'NOT_FOUND'});return;}
    // Commands have no payload; arbitrary command/path forwarding is not supported.
    if(request.headers['transfer-encoding']||Number(request.headers['content-length']??0)!==0){request.resume();json(response,400,{error:'BODY_NOT_ALLOWED'});return;}
    if(busy){json(response,409,{error:'OPERATION_PENDING'});return;}
    busy=true;
    pending=(async()=>{
     try{
      if(url.pathname==='/api/start'){
       if(instance){json(response,409,{error:'INSTANCE_EXISTS'});return;}
       if(nativeEntries&&nativeEntries.status().state!=='idle'){json(response,409,{error:'NATIVE_ENTRY_ACTIVE'});return;}
       instance=await startInstance();
       const connection=await instance.connection;
       json(response,200,{state:instance.state,connection});
      }else{
       cancelHistory();await Promise.allSettled([...historyReads.values()]);
       if(instance){await instance.stop();instance=null;}
       json(response,200,{state:'idle'});
      }
     }catch(error){
      // Keep the handle on failure: the caller can explicitly stop; don't auto-restart.
      const reason=error instanceof Error&&operationReasons.has(error.message)?error.message:'UNKNOWN';
      json(response,500,{error:'OPERATION_FAILED',reason});
     }finally{busy=false;}
    })();await pending;return;
   }
   if(!['GET','HEAD'].includes(request.method)){json(response,405,{error:'METHOD_NOT_ALLOWED'});return;}
   const pathname=decodeURIComponent(url.pathname);
   if(pathname.includes('\\')||pathname.includes('\0')){json(response,404,{error:'NOT_FOUND'});return;}
   const file=await realpath(join(root,pathname==='/'?'index.html':pathname.slice(1)));
   const rel=relative(root,file);
   if(rel.startsWith('..')||isAbsolute(rel)||!(await stat(file)).isFile()){json(response,404,{error:'NOT_FOUND'});return;}
   const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'};
   if(!types[extname(file)]){json(response,404,{error:'NOT_FOUND'});return;}
   response.writeHead(200,{'Content-Type':types[extname(file)]});response.end(request.method==='HEAD'?undefined:await readFile(file));
  }catch{if(!response.headersSent)json(response,404,{error:'NOT_FOUND'});else response.end();}
 });
 server.requestTimeout=10_000;server.headersTimeout=5_000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 origin=`http://127.0.0.1:${server.address().port}`;
 let closePromise,listenerClosePromise;
 const closeListener=()=>listenerClosePromise??=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 return {origin,token,close:()=>{
  if(closePromise)return closePromise;
  closing=true;
  for(const controller of entryReads.keys())controller.abort();
  cancelHistory();
  closePromise=(async()=>{
   let failure;
   try{await pending;await Promise.allSettled([...historyReads.values(),...entryReads.values()]);if(instance){await instance.stop();instance=null;}}catch(error){failure=error;}
   // A failed instance stop must not retain an unusable HTTP listener.
   try{
    if(nativeEntries&&nativeEntries.status().state!=='idle'){
     if(nativeEntries.status().state!=='stopping')await nativeEntries.stop();
     if(nativeEntries.status().state!=='idle')throw new Error('NATIVE_ENTRY_EXIT_UNCONFIRMED');
    }
   }catch(error){failure??=error;}
   // Keep the instance handle and original error for an explicit cleanup retry.
   try{await closeListener();}catch(error){failure??=error;}
   if(failure)throw failure;
  })();
  void closePromise.catch(()=>{closePromise=undefined;});
  return closePromise;
 }};
}
