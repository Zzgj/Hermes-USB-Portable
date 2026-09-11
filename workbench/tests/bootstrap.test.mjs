import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {parseLaunchArgs} from '../scripts/launch-managed.mjs';
import {resolve} from 'node:path';
const source=await readFile(new URL('../src/domain/bootstrap.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {readControlBootstrap}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('bootstrap strips fragment credential while preserving route and other parameters',()=>{
 const token='x'.repeat(43);assert.deepEqual(readControlBootstrap(`#/chat/live?control=${token}&view=test`),{token,cleanHash:'#/chat/live?view=test'});
 assert.equal(readControlBootstrap('#/chat/live'),null);
});
test('malformed, duplicate and wrong-route credentials are removed but rejected',()=>{
 for(const hash of ['#/chat/live?control=short','#/chat/live?control='+ 'x'.repeat(43)+'&control='+ 'x'.repeat(43),'#/settings?control='+ 'x'.repeat(43)]){
  const result=readControlBootstrap(hash);assert.equal(result.token,'');assert.equal(result.cleanHash.includes('control='),false);
 }
});
test('launcher requires explicit opt-in and unambiguous absolute paths',()=>{
 assert.throws(()=>parseLaunchArgs([]));assert.throws(()=>parseLaunchArgs(['--experimental','--root','relative']));
 const root=resolve('test-portable');
 assert.throws(()=>parseLaunchArgs(['--experimental','--root',root,'--home',resolve('private')]));
 assert.equal(parseLaunchArgs(['--experimental','--root',root]).root,root);
});
