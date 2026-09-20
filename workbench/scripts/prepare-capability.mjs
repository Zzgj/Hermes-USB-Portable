import {readSkillCatalog} from './skill-catalog.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
/** Prepare a task for Hermes, never evaluate Skill scripts or slash-command dispatch. */
export async function prepareCapability(home,input){
 if(!object(input)||Object.keys(input).sort().join(',')!=='card,values'||!object(input.card)||!object(input.values))throw new Error('CAPABILITY_INVALID');
 const card=input.card,method=card.method;
 if(!text(card.id,128)||!text(card.name,256)||!text(card.goal,4000)||!object(method)||method.kind!=='skill'||!text(method.name,256)||!/^[a-f0-9]{64}$/.test(method.fingerprint)||!Array.isArray(card.inputs)||card.inputs.length>30)throw new Error('CAPABILITY_INVALID');
 const values=Object.create(null),seen=new Set();
 for(const field of card.inputs){
  if(!object(field)||typeof field.id!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(field.id)||seen.has(field.id)||!text(field.label,256)||typeof field.required!=='boolean')throw new Error('CAPABILITY_INVALID');
  seen.add(field.id);const value=Object.hasOwn(input.values,field.id)?input.values[field.id]:'';
  if(typeof value!=='string'||value.length>4000||(field.required&&!value.trim()))throw new Error('CAPABILITY_INVALID');values[field.id]=value;
 }
 if(Object.keys(input.values).some(key=>!seen.has(key)))throw new Error('CAPABILITY_INVALID');
 const catalog=await readSkillCatalog(home);
 const match=catalog.cards.find(item=>item.method.name===method.name);
 if(!match||match.method.fingerprint!==method.fingerprint)throw new Error('CAPABILITY_CHANGED');
 // Ordinary task text is intentional: /skill text is not guaranteed to invoke a command.
 // The Agent must use its actual skill/file tools and report inability, not substitute silently.
 const task={cardId:card.id,name:card.name,goal:card.goal,skill:match.method.name,fingerprint:match.method.fingerprint,parameters:values};
 const prompt='The user requests the following capability task. First locate and read the specified Skill from the current instance home/skills using your available tools. Do not silently substitute another Skill. If unavailable, disabled, incompatible, or required dependencies/permissions are missing, report that and stop or request confirmation. Follow actual Hermes tool approvals; this request grants no persistent permission. Verify the business outcome and report evidence; a completed model turn alone is not verification. Do not publish a capability or record it as trusted automatically.\n\nTask data:\n'+JSON.stringify(task);
 if(Buffer.byteLength(prompt)>15000)throw new Error('CAPABILITY_LIMIT');
 return {kind:'capability',cardId:card.id,method:{...match.method},prompt,availability:'unknown'};
}
