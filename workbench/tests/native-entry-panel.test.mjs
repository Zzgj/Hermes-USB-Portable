import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
async function moduleUrl(path,replacements={}){
 let code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 for(const [name,url] of Object.entries({'react':import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),...replacements}))code=code.replaceAll(`from '${name}'`,`from '${url}'`).replaceAll(`from \"${name}\"`,`from \"${url}\"`);
 return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const panel=await moduleUrl('../src/components/Panel.tsx'),copyUrl=await moduleUrl('../src/data/mockData.ts');
const {nativeEntryCopy:copy}=await import(copyUrl);
// Real-React instance for static markup assertions (keeps the existing contract checks unchanged).
const {NativeEntryPanel:StaticPanel}=await import(await moduleUrl('../src/components/NativeEntryPanel.tsx',{'./Panel':panel,'../data/mockData':copyUrl}));
// Synthetic dispatcher: only useState is emulated so the real component's own handlers can be invoked.
const hooks={slots:[],cursor:0};
globalThis.__nativePanelHooks=hooks;
const fakeReactUrl='data:text/javascript;base64,'+Buffer.from(
 "export function useState(initial){const h=globalThis.__nativePanelHooks;const i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;"+
 "return [h.slots[i],update=>{h.slots[i]=typeof update==='function'?update(h.slots[i]):update;}];}"
).toString('base64');
const {NativeEntryPanel}=await import(await moduleUrl('../src/components/NativeEntryPanel.tsx',{'react':fakeReactUrl,'./Panel':panel,'../data/mockData':copyUrl}));
const baseProps={status:{kind:null,state:'unknown'},pending:false,failed:false,canInspect:true,onRefresh:()=>{throw new Error('render must not fetch');},onAction:()=>{throw new Error('render must not act');}};
const render=props=>renderToStaticMarkup(React.createElement(StaticPanel,{...baseProps,...props}));
const buttons=html=>Object.fromEntries([...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(match=>[match[2],match[1].includes('disabled=\"\"')]));
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
// ---- T2 coverage: real component event callbacks through a synthetic dispatcher (not a browser click) ----
function flatten(node,out=[]){
 if(node===null||node===undefined||typeof node==='boolean')return out;
 if(Array.isArray(node)){for(const child of node)flatten(child,out);return out;}
 if(typeof node==='string'||typeof node==='number'){out.push({text:String(node)});return out;}
 if(typeof node.type==='function')return flatten(node.type(node.props),out);
 if(typeof node.type==='string')out.push(node);
 return flatten(node.props?.children,out);
}
function mount(overrides={}){hooks.cursor=0;return flatten(NativeEntryPanel({...baseProps,...overrides}));}
const button=(nodes,label)=>{const found=nodes.find(node=>node.type==='button'&&node.props.children===label);assert.ok(found,'missing button '+label);return found;};
const checkbox=nodes=>{const found=nodes.find(node=>node.type==='input');assert.ok(found,'missing confirmation checkbox');return found;};
const statusText=nodes=>{const found=nodes.find(node=>node.props?.role==='status');assert.ok(found,'missing status text');return found.props.children;};
const confirm=nodes=>checkbox(nodes).props.onChange({target:{checked:true}});
test('unconfirmed gate blocks every mutating action even for stray events',()=>{
 const calls=[];const props={status:{kind:null,state:'idle'},onAction:action=>calls.push(action),onRefresh:()=>calls.push('refresh')};
 const nodes=mount(props);assert.equal(checkbox(nodes).props.checked,false);
 for(const label of [copy.cli,copy.dashboard,copy.stop])assert.equal(button(nodes,label).props.disabled,true,label);
 for(const label of [copy.cli,copy.dashboard,copy.stop])button(nodes,label).props.onClick({});
 assert.deepEqual(calls,[]);
});
test('confirming enables the idle start action and the click consumes the confirmation',()=>{
 const calls=[];const props={status:{kind:null,state:'idle'},onAction:action=>calls.push(action)};
 confirm(mount(props));
 let nodes=mount(props);assert.equal(checkbox(nodes).props.checked,true);
 assert.equal(button(nodes,copy.cli).props.disabled,false);assert.equal(button(nodes,copy.dashboard).props.disabled,false);
 button(nodes,copy.cli).props.onClick({});
 assert.deepEqual(calls,['cli']);
 nodes=mount(props);assert.equal(checkbox(nodes).props.checked,false);assert.equal(button(nodes,copy.cli).props.disabled,true);
 button(nodes,copy.cli).props.onClick({});assert.deepEqual(calls,['cli']);
});
test('refresh clears the confirmation and only refreshes',()=>{
 const calls=[];const props={status:{kind:null,state:'idle'},onAction:action=>calls.push(action),onRefresh:()=>calls.push('refresh')};
 confirm(mount(props));
 let nodes=mount(props);button(nodes,copy.refresh).props.onClick({});
 assert.deepEqual(calls,['refresh']);
 nodes=mount(props);assert.equal(checkbox(nodes).props.checked,false);assert.equal(button(nodes,copy.cli).props.disabled,true);
});
test('pending unauthenticated and failed states hide stale success and block actions',()=>{
 for(const [overrides,expected] of [[{pending:true},copy.pending],[{canInspect:false},copy.unauthenticated],[{failed:true},copy.failed]]){
  const calls=[];const props={...overrides,status:{kind:'dashboard',state:'running'},onAction:action=>calls.push(action)};
  const nodes=mount(props);
  assert.equal(statusText(nodes),expected);
  assert.equal(nodes.some(node=>node.text===copy.kinds.dashboard),false);
  // Re-reading status is the only action kept open after a failure; it must stay closed while pending or unauthenticated.
  assert.equal(button(nodes,copy.refresh).props.disabled,overrides.failed!==true);
  for(const label of [copy.cli,copy.dashboard,copy.open,copy.stop])assert.equal(button(nodes,label).props.disabled,true,label);
  for(const label of [copy.cli,copy.dashboard,copy.open,copy.stop])button(nodes,label).props.onClick({});
  assert.deepEqual(calls,[]);
 }
});
test('a CLI entry can never open a Dashboard view',()=>{
 const calls=[];const cli={status:{kind:'cli',state:'running'},onAction:action=>calls.push(action)};
 let nodes=mount(cli);assert.equal(button(nodes,copy.open).props.disabled,true);button(nodes,copy.open).props.onClick({});
 const failedDashboard={status:{kind:'dashboard',state:'running'},failed:true,onAction:action=>calls.push(action)};
 nodes=mount(failedDashboard);button(nodes,copy.open).props.onClick({});
 assert.deepEqual(calls,[]);
});
test('stop requires an explicit confirmation and never applies to an idle entry',()=>{
 const calls=[];const props={status:{kind:'dashboard',state:'running'},onAction:action=>calls.push(action)};
 let nodes=mount(props);assert.equal(button(nodes,copy.stop).props.disabled,true);button(nodes,copy.stop).props.onClick({});
 confirm(mount(props));nodes=mount(props);assert.equal(button(nodes,copy.stop).props.disabled,false);
 button(nodes,copy.stop).props.onClick({});assert.deepEqual(calls,['stop']);
 const idleProps={status:{kind:null,state:'idle'},onAction:action=>calls.push(action)};
 confirm(mount(idleProps));nodes=mount(idleProps);
 assert.equal(button(nodes,copy.stop).props.disabled,true);
 assert.deepEqual(calls,['stop']);
});
