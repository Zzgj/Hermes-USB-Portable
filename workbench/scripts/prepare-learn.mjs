import {execFile} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
export function prepareLearn({python,source,environment},request){
 if(!isAbsolute(python)||!isAbsolute(source)||!request||typeof request.source!=='string'||typeof request.scope!=='string'||!request.source.trim()||!request.scope.trim()||request.source.length>4000||request.scope.length>4000)throw new Error('LEARN_INVALID');
 const input=JSON.stringify({source:request.source,scope:request.scope});if(Buffer.byteLength(input)>16384)throw new Error('LEARN_INVALID');
 return new Promise((resolve,reject)=>{
  const child=execFile(python,['-I',fileURLToPath(new URL('./prepare-learn.py',import.meta.url)),source],{env:{...environment,PYTHONDONTWRITEBYTECODE:'1'},shell:false,windowsHide:true,timeout:5000,maxBuffer:131072},(error,stdout)=>{
   if(error){reject(new Error('LEARN_PREPARATION_FAILED'));return;}
   try{const result=JSON.parse(stdout);if(result.kind!=='learn'||! /^[a-f0-9]{64}$/.test(result.builderFingerprint)||typeof result.prompt!=='string'||result.prompt.length>64000)throw new Error();resolve(result);}
   catch{reject(new Error('LEARN_PREPARATION_FAILED'));}
  });
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
