// Fragment is not sent in HTTP requests. The component removes it immediately.
export function readControlBootstrap(hash:string):{token:string;cleanHash:string}|null {
 const question=hash.indexOf('?');if(question<0)return null;
 const route=hash.slice(0,question),params=new URLSearchParams(hash.slice(question+1));
 if(!params.has('control'))return null;
 const values=params.getAll('control');params.delete('control');
 const remainder=params.toString(),cleanHash=route+(remainder?'?'+remainder:'');
 const token=values.length===1&&/^[A-Za-z0-9_-]{43}$/.test(values[0])&&route==='#/chat/live'?values[0]:'';
 return {token,cleanHash};
}
