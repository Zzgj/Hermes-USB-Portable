/** Minimal configuration inventory, not an Agent factory or a session restore request. */
export interface ProfileSummary {
 readonly name:string;
 readonly displayName:string;
 readonly isDefault:boolean;
 readonly model:string;
 readonly provider:string;
 readonly skillCount:number;
}
export const profileListRequest=()=>({include_sessions:false as const});
const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length<=max;
const optionalText=(value:unknown):value is string|null=>value===null||text(value,256);
export function decodeProfiles(value:unknown):readonly ProfileSummary[]{
 if(!object(value)||!Array.isArray(value.profiles)||value.profiles.length>100)throw new Error('Invalid profile list');
 const names=new Set<string>();
 return value.profiles.map(row=>{
  if(!object(row)||!text(row.name,128)||!row.name.trim()||names.has(row.name)||typeof row.is_default!=='boolean'||!text(row.display_name,256)||!optionalText(row.model)||!optionalText(row.provider)||!Number.isSafeInteger(row.skill_count)||Number(row.skill_count)<0)throw new Error('Invalid profile summary');
  names.add(row.name);
  // Do not retain paths, prompts, session previews, metadata or unknown credentials.
  return {name:row.name,displayName:row.display_name,isDefault:row.is_default,model:row.model??'',provider:row.provider??'',skillCount:Number(row.skill_count)};
 });
}
