import {readFile,readdir,lstat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,dirname,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

import {packageFiles,allowedPackagePath} from './package-policy.mjs';
export {packageFiles} from './package-policy.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function stageP2Package(repo,output){
 if(!isAbsolute(repo)||!isAbsolute(output))throw new Error('ABSOLUTE_PATHS_REQUIRED');
 const files=[...packageFiles];
 async function collect(relative){
  const path=join(repo,relative),info=await lstat(path);
  if(info.isSymbolicLink())throw new Error('PACKAGE_LINK_REJECTED');
  if(info.isDirectory()){
   for(const name of (await readdir(path)).sort())await collect(relative+'/'+name);
  }else if(info.isFile()){
   if(!allowedPackagePath(relative))throw new Error('UNEXPECTED_BUILD_ASSET');
   files.push(relative);
  }else throw new Error('UNSUPPORTED_PACKAGE_ENTRY');
 }
 await collect('workbench/dist');
 if(!files.includes('workbench/dist/index.html'))throw new Error('BUILD_REQUIRED');
 const entries=[];
 for(const path of files.sort()){
  const parts=path.split('/');let current=repo;
  for(const part of parts){current=join(current,part);if((await lstat(current)).isSymbolicLink())throw new Error('PACKAGE_LINK_REJECTED');}
  const bytes=await readFile(join(repo,path));entries.push({path,bytes,sha256:digest(bytes)});
 }
 // Output must be new. No overwrite of a prior package or user instance.
 await mkdir(output);
 for(const entry of entries){const destination=join(output,entry.path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,entry.bytes,{flag:'wx'});}
 const manifest={schema:1,package:'Hermes-Portable-P2',status:'development-snapshot',release_ready:false,files:entries.map(({path,bytes,sha256})=>({path,size:bytes.length,sha256}))};
 await writeFile(join(output,'p2-package.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [repoArg,outArg]=process.argv.slice(2);if(!repoArg||!outArg)throw new Error('PATHS_REQUIRED');
  const repo=resolve(repoArg),output=resolve(outArg),stage=join(output,'Hermes-Portable-P2');
  await mkdir(output);const manifest=await stageP2Package(repo,stage);
  const archive=join(output,'Hermes-Portable-P2-development.zip');
  execFileSync('zip',['-q','-r',archive,'Hermes-Portable-P2'],{cwd:output,stdio:'pipe'});
  const hash=digest(await readFile(archive));await writeFile(archive+'.sha256',hash+'  Hermes-Portable-P2-development.zip\n',{flag:'wx'});
  console.log(JSON.stringify({status:manifest.status,files:manifest.files.length,archive,sha256:hash}));
 }catch{console.error('P2 packaging failed. Existing output was not overwritten; any partial output is preserved.');process.exitCode=1;}
}
