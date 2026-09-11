export interface LearnDraft {readonly source:string;readonly scope:string;readonly prompt:string;readonly fingerprint:string;readonly port:number;readonly token:string;}
export async function prepareLearning(token:string,source:string,scope:string,signal:AbortSignal,send:typeof fetch=fetch):Promise<LearnDraft>{
 if(!token.trim()||!source.trim()||!scope.trim()||source.length>4000||scope.length>4000)throw new Error('LEARN_INVALID');
 const body=JSON.stringify({source,scope});if(new TextEncoder().encode(body).length>16384)throw new Error('LEARN_INVALID');
 const response=await send('/api/learn/prepare',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body,signal,credentials:'omit',redirect:'error',cache:'no-store'});
 if(!response.ok)throw new Error('LEARN_FAILED');
 const text=await response.text();if(text.length>150000)throw new Error('LEARN_FAILED');
 const value=JSON.parse(text),p=value?.prepared,c=value?.connection;
 if(p?.kind!=='learn'||typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>64000||typeof p.builderFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(p.builderFingerprint)||!Number.isInteger(c?.port)||c.port<1||c.port>65535||typeof c.token!=='string'||!c.token||c.token.length>4096)throw new Error('LEARN_FAILED');
 return {source,scope,prompt:p.prompt,fingerprint:p.builderFingerprint,port:c.port,token:c.token};
}
export function learningMatches(draft:LearnDraft,connection:{readonly port:number;readonly token:string}|null):boolean{
 return !!connection&&draft.port===connection.port&&draft.token===connection.token;
}
