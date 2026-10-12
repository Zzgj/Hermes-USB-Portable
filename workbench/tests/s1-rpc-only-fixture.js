// Synthetic RPC only. The browser's fetch and XMLHttpRequest are never replaced.
// Inject only into an owned disposable page; reload restores the real WebSocket.
(()=>{
 window.__p2RpcRequests=[];
 window.WebSocket=class extends EventTarget{
  constructor(url){
   super();const endpoint=new URL(url);if(endpoint.hostname!=='127.0.0.1')throw new Error('FIXTURE_LOOPBACK_ONLY');
   this.closed=false;this.seq=0;this.readyState=0;window.__p2Socket=this;
   setTimeout(()=>{if(this.closed)return;this.readyState=1;this.dispatchEvent(new Event('open'));this.event('gateway.ready',{});},10);
  }
  frame(data){if(!this.closed)this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));}
  event(type,payload){this.frame({jsonrpc:'2.0',method:'event',params:{type,payload,seq:++this.seq,session_id:'p2-browser'}});}
  send(raw){
   if(this.closed)throw new Error('FIXTURE_CLOSED');
   const request=JSON.parse(raw);window.__p2RpcRequests.push(request);
   const result=value=>this.frame({jsonrpc:'2.0',id:request.id,result:value});
   if(request.method==='session.create')result({session_id:'p2-browser',stored_session_id:'p2-stored',info:{cwd:'/fixture',desktop_contract:6}});
   else if(request.method==='session.list')result({sessions:[{id:'hist-1',title:'History session 1',message_count:3},{id:'hist-2',title:'History session 2',message_count:0}]});
   else if(request.method==='prompt.submit'){
    result({status:'streaming'});
    if(request.params.text!=='hold')setTimeout(()=>this.event('message.complete',{text:'Synthetic RPC reply; business not verified.',status:'complete'}),50);
   }else if(request.method==='session.interrupt'){result({status:'interrupted'});this.event('message.complete',{text:'Synthetic interrupt',status:'interrupted'});}
   else this.frame({jsonrpc:'2.0',id:request.id,error:{code:-32601,message:'Synthetic method unavailable'}});
  }
  close(){if(this.closed)return;this.closed=true;this.readyState=3;this.dispatchEvent(new Event('close'));}
 };
})();
