import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {realpath,readFile,stat} from 'node:fs/promises';
import {join,relative,extname,isAbsolute} from 'node:path';

export async function startControlServer({assets,startInstance,prepareLearn,readCatalog}) {
 if(typeof startInstance!=='function'||!isAbsolute(assets))throw new Error('INVALID_CONTROL_OPTIONS');
 const root=await realpath(assets),token=randomBytes(32).toString('base64url');
 let origin,instance=null,busy=false,closing=false,pending=Promise.resolve();
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
    if(url.pathname==='/api/learn/prepare'&&request.method==='POST'){
     if(typeof prepareLearn!=='function'){json(response,404,{error:'UNAVAILABLE'});return;}
     if(busy||instance?.state!=='ready'){json(response,409,{error:'NOT_READY'});return;}
     if(request.headers['content-type']!=='application/json'||request.headers['transfer-encoding']||!Number.isInteger(Number(request.headers['content-length']))||Number(request.headers['content-length'])>16384||Number(request.headers['content-length'])<1){request.resume();json(response,400,{error:'INVALID_REQUEST'});return;}
     busy=true;
     pending=(async()=>{
      try{
       const chunks=[];let bytes=0;for await(const chunk of request){bytes+=chunk.length;if(bytes>16384)throw new Error();chunks.push(chunk);}
       const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
       if(!input||Array.isArray(input)||Object.keys(input).sort().join(',')!=='scope,source'||typeof input.source!=='string'||typeof input.scope!=='string'||!input.source.trim()||!input.scope.trim()||input.source.length>4000||input.scope.length>4000)throw new Error();
       const prepared=await prepareLearn(input);
       if(instance?.state!=='ready')throw new Error();
       json(response,200,{prepared,connection:await instance.connection});
      }catch{json(response,400,{error:'LEARN_PREPARATION_FAILED'});}finally{busy=false;}
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
       instance=await startInstance();
       const connection=await instance.connection;
       json(response,200,{state:instance.state,connection});
      }else{
       if(instance){await instance.stop();instance=null;}
       json(response,200,{state:'idle'});
      }
     }catch{
      // Keep the handle on failure: the caller can explicitly stop; don't auto-restart.
      json(response,500,{error:'OPERATION_FAILED'});
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
 let closePromise;
 return {origin,token,close:()=>{
  if(closePromise)return closePromise;
  closing=true;
  closePromise=(async()=>{
   await pending;
   if(instance){await instance.stop();instance=null;}
   await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  })();return closePromise;
 }};
}
