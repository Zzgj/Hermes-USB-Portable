export interface AvailableSkill {readonly name:string;readonly category:string;}
/** This is an upstream availability snapshot, not an installation or trust manifest. */
export function decodeAvailableSkills(value:unknown):readonly AvailableSkill[]{
 if(typeof value!=='object'||value===null||!('skills' in value))throw new Error('Invalid skills response');
 const groups=value.skills;
 if(typeof groups!=='object'||groups===null||Array.isArray(groups)||Object.keys(groups).length>100)throw new Error('Invalid skill groups');
 const result:AvailableSkill[]=[],seen=new Set<string>();
 for(const [category,names] of Object.entries(groups)){
  if(!category||category.length>256||!Array.isArray(names)||names.length>1000)throw new Error('Invalid skill category');
  for(const name of names){
   if(typeof name!=='string'||!name||name.length>256||seen.has(name)||result.length>=1000)throw new Error('Invalid skill name');
   seen.add(name);result.push({name,category});
  }
 }
 return result;
}
