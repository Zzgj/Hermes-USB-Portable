export interface StoredSession {readonly id:string;readonly title:string;readonly messages:number;}
export function decodeSessionList(value:unknown):readonly StoredSession[]{
 if(typeof value!=='object'||value===null||!('sessions' in value)||!Array.isArray(value.sessions)||value.sessions.length>50)throw new Error('Invalid session list');
 const seen=new Set<string>();
 return value.sessions.map(row=>{
  if(typeof row!=='object'||row===null||typeof row.id!=='string'||!row.id||row.id.length>256||seen.has(row.id)||typeof row.title!=='string'||row.title.length>4096||!Number.isSafeInteger(row.message_count)||row.message_count<0)throw new Error('Invalid session row');
  seen.add(row.id);
  // Do not retain conversation previews or unknown credential-bearing fields.
  return {id:row.id,title:row.title,messages:row.message_count};
 });
}
