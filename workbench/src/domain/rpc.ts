/** Hermes JSON-RPC envelopes. Payload remains unknown until a method-specific decoder validates it. */
export type RpcId=string|number;
export type RpcMessage=
 | {readonly kind:'event';readonly type:string;readonly payload:unknown;readonly sessionId?:string;readonly seq?:number}
 | {readonly kind:'result';readonly id:RpcId;readonly result:unknown}
 | {readonly kind:'error';readonly id:RpcId|null;readonly code:number;readonly message:string};
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const validId=(value:unknown):value is RpcId=>typeof value==='string'||(typeof value==='number'&&Number.isSafeInteger(value));
export function decodeMessage(value:unknown):RpcMessage {
 if(!object(value)||value.jsonrpc!=='2.0')throw new Error('Invalid JSON-RPC envelope');
 if(value.method==='event'){
  const p=value.params;
  if(!object(p)||typeof p.type!=='string'||!p.type||'id' in value)throw new Error('Invalid event');
  if(p.session_id!==undefined&&typeof p.session_id!=='string')throw new Error('Invalid session identity');
  if(p.seq!==undefined&&(!Number.isSafeInteger(p.seq)||Number(p.seq)<0))throw new Error('Invalid event sequence');
  return {kind:'event',type:p.type,payload:p.payload,sessionId:p.session_id as string|undefined,seq:p.seq as number|undefined};
 }
 if('method' in value||('result' in value)===('error' in value))throw new Error('Invalid response shape');
 if('error' in value){
  if((value.id!==null&&!validId(value.id))||!object(value.error)||!Number.isInteger(value.error.code)||typeof value.error.message!=='string')throw new Error('Invalid RPC error');
  return {kind:'error',id:value.id as RpcId|null,code:value.error.code as number,message:value.error.message};
 }
 if(!validId(value.id))throw new Error('Invalid response identity');
 return {kind:'result',id:value.id,result:value.result};
}
/** Accept individual JSON objects and newline-delimited transport input; reject JSON-RPC batch arrays. */
export function decodeFrame(raw:string):readonly RpcMessage[] {
 if(raw.length>1_048_576)throw new Error('Frame exceeds client limit');
 const lines=raw.split('\n').filter(line=>line.trim());
 if(lines.length>4096)throw new Error('Too many messages in frame');
 return lines.map(line=>decodeMessage(JSON.parse(line)));
}
export function encodeRequest(id:RpcId,method:string,params:Readonly<Record<string,unknown>>={}):string {
 if(!validId(id)||!method.trim())throw new Error('Invalid RPC request');
 return JSON.stringify({jsonrpc:'2.0',id,method,params});
}

export interface SessionIdentity {
 readonly runtimeId:string;
 readonly storedId:string;
 readonly cwd:string;
 readonly contract:number;
}
/** Validated shape, not an assertion that this backend version is supported. */
export function decodeSession(value:unknown):SessionIdentity {
 if(!object(value)||typeof value.session_id!=='string'||!value.session_id||
    typeof value.stored_session_id!=='string'||!value.stored_session_id||!object(value.info)||
    typeof value.info.cwd!=='string'||!Number.isSafeInteger(value.info.desktop_contract))throw new Error('Invalid session identity');
 return {runtimeId:value.session_id,storedId:value.stored_session_id,cwd:value.info.cwd,contract:value.info.desktop_contract as number};
}
export function decodeInterrupt(value:unknown):'acknowledged'|'not-interrupted' {
 if(!object(value))throw new Error('Invalid interrupt result');
 if(value.status==='not_interrupted'&&value.interrupted===false)return 'not-interrupted';
 if(value.status==='interrupted'&&value.interrupted!==false)return 'acknowledged';
 throw new Error('Invalid interrupt result');
}

export class RpcFailure extends Error {
 constructor(readonly reason:'timeout'|'disconnected'|'send'|'protocol'|'remote'|'capacity',readonly code?:number){super(`RPC ${reason}`);this.name='RpcFailure';}
}
interface Pending {
 readonly resolve:(value:unknown)=>void;
 readonly reject:(reason:RpcFailure)=>void;
 readonly timer:ReturnType<typeof setTimeout>;
}
/** A single transport lifetime. Disconnect is terminal: create a new instance, never replay requests. */
export class RpcChannel {
 private readonly pending=new Map<RpcId,Pending>();
 private nextId=0;
 private closed=false;
 constructor(private readonly send:(text:string)=>void,private readonly onEvent:(event:Extract<RpcMessage,{kind:'event'}>)=>void){}
 get pendingCount(){return this.pending.size;}
 get isClosed(){return this.closed;}
 request(method:string,params:Readonly<Record<string,unknown>>={},timeoutMs=30_000):Promise<unknown>{
  if(this.closed)return Promise.reject(new RpcFailure('disconnected'));
  if(this.pending.size>=128)return Promise.reject(new RpcFailure('capacity'));
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>300_000)return Promise.reject(new RangeError('Invalid request timeout'));
  const id=++this.nextId;
  let text:string;
  try{text=encodeRequest(id,method,params);}catch{return Promise.reject(new RpcFailure('protocol'));}
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(new RpcFailure('timeout'));},timeoutMs);
   this.pending.set(id,{resolve,reject,timer});
   try{this.send(text);}catch{this.close('send');}
  });
 }
 receive(text:string):void {
  if(this.closed)return;
  let messages:readonly RpcMessage[];
  try{messages=decodeFrame(text);}catch{this.close('protocol');return;}
  for(const message of messages){
   if(this.closed)break;
   if(message.kind==='event'){this.onEvent(message);continue;}
   if(message.id===null){this.close('protocol');break;}
   const request=this.pending.get(message.id);
   if(!request)continue; // Unknown, duplicate or late response cannot complete another request.
   this.pending.delete(message.id);clearTimeout(request.timer);
   if(message.kind==='result')request.resolve(message.result);
   else request.reject(new RpcFailure('remote',message.code)); // Do not propagate unredacted server payloads into UI errors.
  }
 }
 close(reason:'disconnected'|'send'|'protocol'='disconnected'):void {
  if(this.closed)return;
  this.closed=true;
  for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(new RpcFailure(reason));}
  this.pending.clear();
 }
}

export type ConnectionState='connecting'|'ready'|'closed'|'failed';
type SocketLike=Pick<WebSocket,'send'|'close'|'addEventListener'|'removeEventListener'>;
export interface ConnectionOptions {
 readonly endpoint:string;
 readonly onState:(state:ConnectionState)=>void;
 readonly onEvent:(event:Extract<RpcMessage,{kind:'event'}>)=>void;
 readonly createSocket?:(endpoint:string)=>SocketLike;
 readonly timeoutMs?:number;
}
/** Explicit local connection only. Socket open is NOT protocol readiness. No retry or command replay. */
export function connectHermes(options:ConnectionOptions){
 const url=new URL(options.endpoint);
 if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||url.pathname!=='/api/ws'||url.username||url.password||url.hash)
  throw new Error('Only the managed loopback Hermes endpoint is allowed');
 const timeoutMs=options.timeoutMs??15_000;
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>60_000)throw new Error('Invalid handshake timeout');
 let state:ConnectionState='connecting';
 let socket:SocketLike|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const channel=new RpcChannel(text=>{if(state!=='ready'||!socket)throw new Error('Not ready');socket.send(text);},event=>{
  if(event.type==='gateway.ready'&&state==='connecting'){
   clearTimeout(timer);state='ready';options.onState(state);
  }
  if(state==='ready')options.onEvent(event);
 });
 const dispose=(next:'closed'|'failed')=>{
  if(state==='closed'||state==='failed')return;
  state=next;clearTimeout(timer);channel.close();
  if(socket){
   socket.removeEventListener('message',message);
   socket.removeEventListener('close',closed);
   socket.removeEventListener('error',failed);
   try{socket.close();}catch{/* Transport is already unusable. */}
  }
  options.onState(state);
 };
 const message:EventListener=event=>{
  const data=(event as MessageEvent).data;
  if(typeof data!=='string'){dispose('failed');return;}
  try{channel.receive(data);}catch{dispose('failed');return;}
  if(channel.isClosed)dispose('failed');
 };
 const closed:EventListener=()=>dispose('closed');
 const failed:EventListener=()=>dispose('failed');
 options.onState(state);
 timer=setTimeout(()=>dispose('failed'),timeoutMs);
 try{
  socket=(options.createSocket??(endpoint=>new WebSocket(endpoint)))(url.href);
  socket.addEventListener('message',message);socket.addEventListener('close',closed);socket.addEventListener('error',failed);
 }catch{dispose('failed');}
 return {
  get state(){return state;},
  request(method:string,params:Readonly<Record<string,unknown>>={},timeout?:number){
   if(state!=='ready')return Promise.reject(new RpcFailure('disconnected'));
   return channel.request(method,params,timeout).catch(error=>{if(channel.isClosed)dispose('failed');throw error;});
  },
  close:()=>dispose('closed'),
 };
}
