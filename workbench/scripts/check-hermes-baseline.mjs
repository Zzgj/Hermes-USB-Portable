import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function assessBaseline(commit,dirty,manifest){
 const baseline=manifest.baselines.find(item=>item.commit===commit);
 return {
  schema_version:1,commit,tracked_changes:dirty,
  baseline_role:baseline?.role??'unknown',
  status:dirty?'modified-source':baseline?'known-baseline-partial':'unverified-source',
  verified:baseline?.verified??[],not_verified:baseline?.not_verified??['p2-integration'],
  // Recognition is not qualification. The current manifest intentionally enables no release.
  release_qualified:!dirty&&manifest.release_ready===true&&Boolean(baseline)&&baseline.not_verified.length===0,
 };
}
export function inspectBaseline(repo,git='git'){
 const manifest=JSON.parse(readFileSync(new URL('../hermes-compatibility.json',import.meta.url),'utf8'));
 const call=args=>execFileSync(git,['-C',resolve(repo),...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15_000,windowsHide:true}).trim();
 const commit=call(['rev-parse','--verify','HEAD']);
 if(!/^[a-f0-9]{40}$/.test(commit))throw new Error('Invalid source identity');
 const dirty=Boolean(call(['status','--porcelain=v1','--untracked-files=no']));
 return assessBaseline(commit,dirty,manifest);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  if(process.argv.length<3||process.argv.length>4)throw new Error('Usage: node scripts/check-hermes-baseline.mjs SOURCE [GIT_EXECUTABLE]');
  const result=inspectBaseline(process.argv[2],process.argv[3]);
  console.log(JSON.stringify(result,null,2));
  process.exitCode=result.release_qualified?0:2;
 }catch{
  console.error('Hermes baseline check failed. Check source path and Git availability. No changes applied.');
  process.exitCode=1;
 }
}
