// Authenticated, read-only RPC probe. No sessions, prompts, or tool calls.
export function probeHermes({port,token,signal,timeoutMs=5000,createSocket=url=>new WebSocket(url)}) {
 if(!Number.isInteger(port)||port<1||port>65535||typeof token!=='string'||token.length<16||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)return Promise.resolve(false);
 return new Promise(resolve=>{
  let socket,done=false,ready=false;
  const finish=ok=>{
   if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   if(socket){socket.removeEventListener('message',message);socket.removeEventListener('close',closed);socket.removeEventListener('error',closed);try{socket.close();}catch{}}
   resolve(ok);
  };
  const abort=()=>finish(false),closed=()=>finish(false);
  const message=event=>{
   if(typeof event.data!=='string'||event.data.length>65536){finish(false);return;}
   try{
    const frame=JSON.parse(event.data);
    if(frame.jsonrpc!=='2.0'){finish(false);return;}
    if(!ready&&frame.method==='event'&&frame.params?.type==='gateway.ready'){
     ready=true;socket.send(JSON.stringify({jsonrpc:'2.0',id:'p2-health',method:'p2.health.unsupported',params:{}}));
    }else if(frame.id==='p2-health')finish(ready&&frame.error?.code===-32601&&!Object.hasOwn(frame,'result'));
   }catch{finish(false);}
  };
  const timer=setTimeout(()=>finish(false),timeoutMs);
  if(signal?.aborted){finish(false);return;}
  signal?.addEventListener('abort',abort,{once:true});
  try{
   socket=createSocket(`ws://127.0.0.1:${port}/api/ws?token=${encodeURIComponent(token)}`);
   socket.addEventListener('message',message);socket.addEventListener('close',closed);socket.addEventListener('error',closed);
  }catch{finish(false);}
 });
}
