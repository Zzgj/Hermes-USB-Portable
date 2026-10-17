import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
async function moduleUrl(path,replacements={}){
 let code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 for(const [name,url] of Object.entries({'react':import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),...replacements}))code=code.replaceAll(`from '${name}'`,`from '${url}'`).replaceAll(`from "${name}"`,`from "${url}"`);
 return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const panel=await moduleUrl('../src/components/Panel.tsx'),copy=await moduleUrl('../src/data/mockData.ts');
const {NativeEntryPanel}=await import(await moduleUrl('../src/components/NativeEntryPanel.tsx',{'./Panel':panel,'../data/mockData':copy}));
const render=props=>renderToStaticMarkup(React.createElement(NativeEntryPanel,{status:{kind:null,state:'unknown'},pending:false,failed:false,canInspect:true,onRefresh:()=>{throw new Error('render must not fetch');},onAction:()=>{throw new Error('render must not act');},...props}));
const buttons=html=>Object.fromEntries([...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(match=>[match[2],match[1].includes('disabled=""')]));
test('unauthenticated and pending panels cannot invoke any action',()=>{
 for(const props of [{canInspect:false},{pending:true}]){
  const html=render({...props,status:{kind:'dashboard',state:'running'}});
  const result=buttons(html);assert.ok(Object.hasOwn(result,'启动 CLI'));assert.ok(Object.values(result).every(Boolean));
  assert.equal(html.includes('当前入口：原生 Dashboard'),false);
 }
});
test('unknown and idle require confirmation, only running Dashboard can open',()=>{
 for(const state of ['unknown','idle']){
  const result=buttons(render({status:{kind:null,state}}));
  assert.equal(result['启动 CLI'],true);assert.equal(result['启动原生 Dashboard'],true);assert.equal(result['打开已运行的 Dashboard'],true);assert.equal(result['读取原生入口状态'],false);
 }
 const running=buttons(render({status:{kind:'dashboard',state:'running'}}));assert.equal(running['打开已运行的 Dashboard'],false);assert.equal(running['停止本管理器的原生入口'],true);
 const failed=buttons(render({status:{kind:'dashboard',state:'running'},failed:true}));assert.equal(failed['打开已运行的 Dashboard'],true);
});
