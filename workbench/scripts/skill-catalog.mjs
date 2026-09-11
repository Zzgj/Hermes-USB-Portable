import {lstat,readdir,open} from 'node:fs/promises';
import {join,isAbsolute,parse,relative,sep} from 'node:path';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';

// Filesystem inventory only: neither loads Python nor evaluates Skill instructions.
// Availability (platform, disabled skills, tool dependencies) is deliberately unknown.
export async function readSkillCatalog(home){
 if(!isAbsolute(home))throw new Error('CATALOG_INVALID_HOME');
 const root=join(home,'skills');
 let current=parse(root).root;
 for(const part of relative(current,root).split(/[\\/]/).filter(Boolean)){
  current=join(current,part);
  try{const info=await lstat(current);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('CATALOG_UNSAFE_PATH');}
  catch(error){if(error.code==='ENOENT'&&current===root)return {cards:[],availability:'unknown'};throw error;}
 }
 let entries=0,total=0;const cards=[];
 async function walk(directory,files){
  const names=(await readdir(directory)).sort();const folded=new Set();
  for(const name of names){
   if(++entries>5000)throw new Error('CATALOG_LIMIT');
   const key=name.normalize('NFC').toLowerCase();if(folded.has(key))throw new Error('CATALOG_COLLISION');folded.add(key);
   const path=join(directory,name),info=await lstat(path);
   if(info.isSymbolicLink()||(!info.isDirectory()&&!info.isFile()))throw new Error('CATALOG_UNSAFE_PATH');
   if(info.isDirectory())await walk(path,files);else files.push({path,info});
  }
 }
 const files=[];await walk(root,files);
 const definitions=files.filter(file=>file.path.endsWith('/SKILL.md')||file.path.endsWith('\\SKILL.md'));
 if(definitions.length>100)throw new Error('CATALOG_LIMIT');
 for(const definition of definitions){
  const directory=definition.path.slice(0,-9),name=relative(root,directory).split(/[\\/]/).join('/');
  if(!name||name.length>256)throw new Error('CATALOG_INVALID_SKILL');
  const hash=createHash('sha256');hash.update('hermes-skill-tree-v1\0');
  for(const file of files.filter(file=>file.path.startsWith(directory+sep))){
   if(file.info.size>1024*1024||(total+=file.info.size)>16*1024*1024)throw new Error('CATALOG_LIMIT');
   const handle=await open(file.path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));let bytes;
   try{
    const before=await handle.stat();if(before.ino!==file.info.ino||before.dev!==file.info.dev||!before.isFile())throw new Error('CATALOG_CHANGED');
    bytes=Buffer.alloc(file.info.size+1);const {bytesRead}=await handle.read(bytes,0,bytes.length,0);bytes=bytes.subarray(0,bytesRead);
    const after=await handle.stat();if(bytes.length!==file.info.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw new Error('CATALOG_CHANGED');
   }finally{await handle.close();}
   hash.update(JSON.stringify([relative(directory,file.path).split(/[\\/]/).join('/'),bytes.length]));hash.update(bytes);
  }
  cards.push({id:createHash('sha256').update(name).digest('hex'),name,goal:'从实例发现的 Skill 定义；适用范围、参数和验证步骤待人工审核。',method:{kind:'skill',name,fingerprint:hash.digest('hex')},inputs:[],state:'draft'});
 }
 if(Buffer.byteLength(JSON.stringify(cards))>65536)throw new Error('CATALOG_LIMIT');
 return {cards,availability:'unknown'};
}
