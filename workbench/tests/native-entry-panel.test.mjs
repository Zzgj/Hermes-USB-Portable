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
const panel=await moduleUrl('../src/components/Panel.tsx'),copyUrl=await moduleUrl('../src/data/mockData.ts');
const {nativeEntryCopy:copy}=await import(copyUrl);
// Real-React instance for static markup assertions (keeps the existing contract checks unchanged).
const {NativeEntryPanel:StaticPanel}=await import(await moduleUrl('../src/components/NativeEntryPanel.tsx',{'./Panel':panel,'../data/mockData':copyUrl}));
// Synthetic dispatcher: only useState is emulated so the real component's own handlers can be invoked.
// State lives in a per-test harness object and the global slot is deleted on dispose, so tests stay order-independent.
const fakeReactUrl='data:text/javascript;base64,'+Buffer.from(
 "export function useState(initial){const h=globalThis.__nativePanelHooks;const i=h.cursor++;if(!(i in h.slots))h.slots[i]=typeof initial==='function'?initial():initial;"+
 "return [h.slots[i],update=>{h.slots[i]=typeof update==='function'?update(h.slots[i]):update;}];}"
).toString('base64');
const {NativeEntryPanel}=await import(await moduleUrl('../src/components/NativeEntryPanel.tsx',{'react':fakeReactUrl,'./Panel':panel,'../data/mockData':copyUrl}));
const baseProps={status:{kind:null,state:'unknown'},pending:false,failed:false,canInspect:true,onRefresh:()=>{throw new Error('render must not fetch');},onAction:()=>{throw new Error('render must not act');}};
const render=props=>renderToStaticMarkup(React.createElement(StaticPanel,{...baseProps,...props}));
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
// ---- T2 coverage: real component event callbacks through a synthetic dispatcher (not a browser click) ----
function flatten(node,out=[]){
 if(node===null||node===undefined||typeof node==='boolean')return out;
 if(Array.isArray(node)){for(const child of node)flatten(child,out);return out;}
 if(typeof node==='string'||typeof node==='number'){out.push({text:String(node)});return out;}
 if(typeof node.type==='function')return flatten(node.type(node.props),out);
 if(typeof node.type==='string')out.push(node);
 return flatten(node.props?.children,out);
}
function createHarness(){
 const state={slots:[],cursor:0};
 return {
  mount(overrides={}){globalThis.__nativePanelHooks=state;state.cursor=0;return flatten(NativeEntryPanel({...baseProps,...overrides}));},
  dispose(){delete globalThis.__nativePanelHooks;},
 };
}
const button=(nodes,label)=>{const found=nodes.find(node=>node.type==='button'&&node.props.children===label);assert.ok(found,'missing button '+label);return found;};
const checkbox=nodes=>{const found=nodes.find(node=>node.type==='input');assert.ok(found,'missing confirmation checkbox');return found;};
const statusText=nodes=>{const found=nodes.find(node=>node.props?.role==='status');assert.ok(found,'missing status text');return found.props.children;};
const confirm=nodes=>checkbox(nodes).props.onChange({target:{checked:true}});
test('unconfirmed gate blocks every mutating action even for stray events',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const props={status:{kind:null,state:'idle'},onAction:action=>calls.push(action),onRefresh:()=>calls.push('refresh')};
 const nodes=h.mount(props);assert.equal(checkbox(nodes).props.checked,false);
 for(const label of [copy.cli,copy.dashboard,copy.stop])assert.equal(button(nodes,label).props.disabled,true,label);
 for(const label of [copy.cli,copy.dashboard,copy.stop])button(nodes,label).props.onClick({});
 assert.deepEqual(calls,[]);
});
test('confirming enables the idle start action and the click consumes the confirmation',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const props={status:{kind:null,state:'idle'},onAction:action=>calls.push(action)};
 confirm(h.mount(props));
 let nodes=h.mount(props);assert.equal(checkbox(nodes).props.checked,true);
 assert.equal(button(nodes,copy.cli).props.disabled,false);assert.equal(button(nodes,copy.dashboard).props.disabled,false);
 button(nodes,copy.cli).props.onClick({});
 assert.deepEqual(calls,['cli']);
 nodes=h.mount(props);assert.equal(checkbox(nodes).props.checked,false);assert.equal(button(nodes,copy.cli).props.disabled,true);
 button(nodes,copy.cli).props.onClick({});assert.deepEqual(calls,['cli']);
});
test('refresh clears the confirmation and only refreshes',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const props={status:{kind:null,state:'idle'},onAction:action=>calls.push(action),onRefresh:()=>calls.push('refresh')};
 confirm(h.mount(props));
 let nodes=h.mount(props);button(nodes,copy.refresh).props.onClick({});
 assert.deepEqual(calls,['refresh']);
 nodes=h.mount(props);assert.equal(checkbox(nodes).props.checked,false);assert.equal(button(nodes,copy.cli).props.disabled,true);
});
test('pending and unauthenticated states hide stale success and block every action',(t)=>{
 for(const [overrides,expected] of [[{pending:true},copy.pending],[{canInspect:false},copy.unauthenticated]]){
  const h=createHarness();t.after(()=>h.dispose());
  const calls=[];const props={...overrides,status:{kind:'dashboard',state:'running'},onAction:action=>calls.push(action)};
  const nodes=h.mount(props);
  assert.equal(statusText(nodes),expected);
  assert.equal(nodes.some(node=>node.text===copy.kinds.dashboard),false);
  for(const label of [copy.refresh,copy.cli,copy.dashboard,copy.open,copy.stop])assert.equal(button(nodes,label).props.disabled,true,label);
  for(const label of [copy.cli,copy.dashboard,copy.open,copy.stop])button(nodes,label).props.onClick({});
  assert.deepEqual(calls,[]);
 }
});
test('failed state blocks start and open but keeps refresh and an explicit confirmed stop',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const props={status:{kind:'dashboard',state:'running'},failed:true,onAction:action=>calls.push(action),onRefresh:()=>calls.push('refresh')};
 let nodes=h.mount(props);
 assert.equal(statusText(nodes),copy.failed);
 assert.equal(nodes.some(node=>node.text===copy.kinds.dashboard),false);
 assert.equal(button(nodes,copy.refresh).props.disabled,false);
 assert.equal(button(nodes,copy.cli).props.disabled,true);assert.equal(button(nodes,copy.dashboard).props.disabled,true);
 // An unconfirmed stop must stay inert even when the caller dispatches the handler directly.
 assert.equal(button(nodes,copy.stop).props.disabled,true);button(nodes,copy.stop).props.onClick({});
 // Open is visually available for a running Dashboard, but the failure guard must suppress the callback.
 button(nodes,copy.open).props.onClick({});
 assert.deepEqual(calls,[]);
 confirm(h.mount(props));nodes=h.mount(props);
 assert.equal(button(nodes,copy.stop).props.disabled,false);
 assert.equal(button(nodes,copy.cli).props.disabled,true);assert.equal(button(nodes,copy.dashboard).props.disabled,true);
 button(nodes,copy.stop).props.onClick({});button(nodes,copy.cli).props.onClick({});button(nodes,copy.dashboard).props.onClick({});
 assert.deepEqual(calls,['stop']);
});
test('unknown after a failed request still permits an explicit confirmed stop',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const props={status:{kind:null,state:'unknown'},failed:true,onAction:action=>calls.push(action)};
 let nodes=h.mount(props);
 assert.equal(statusText(nodes),copy.failed);
 assert.equal(button(nodes,copy.stop).props.disabled,true);
 confirm(h.mount(props));nodes=h.mount(props);
 assert.equal(button(nodes,copy.stop).props.disabled,false);
 for(const label of [copy.cli,copy.dashboard,copy.open])assert.equal(button(nodes,label).props.disabled,true,label);
 for(const label of [copy.cli,copy.dashboard,copy.open])button(nodes,label).props.onClick({});
 button(nodes,copy.stop).props.onClick({});
 assert.deepEqual(calls,['stop']);
});
test('a CLI entry can never open a Dashboard view',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const cli={status:{kind:'cli',state:'running'},onAction:action=>calls.push(action)};
 let nodes=h.mount(cli);assert.equal(button(nodes,copy.open).props.disabled,true);button(nodes,copy.open).props.onClick({});
 const failedDashboard={status:{kind:'dashboard',state:'running'},failed:true,onAction:action=>calls.push(action)};
 nodes=h.mount(failedDashboard);button(nodes,copy.open).props.onClick({});
 assert.deepEqual(calls,[]);
});
test('stop requires an explicit confirmation; only the disabled state is asserted while idle',(t)=>{
 const h=createHarness();t.after(()=>h.dispose());
 const calls=[];const props={status:{kind:'dashboard',state:'running'},onAction:action=>calls.push(action)};
 let nodes=h.mount(props);assert.equal(button(nodes,copy.stop).props.disabled,true);button(nodes,copy.stop).props.onClick({});
 confirm(h.mount(props));nodes=h.mount(props);assert.equal(button(nodes,copy.stop).props.disabled,false);
 button(nodes,copy.stop).props.onClick({});assert.deepEqual(calls,['stop']);
 // Idle case: the assertion is limited to the rendered disabled state. It does not claim that every
 // internal handler path is unreachable; the component keeps defence-in-depth guards for open/start only.
 const idleProps={status:{kind:null,state:'idle'},onAction:action=>calls.push(action)};
 confirm(h.mount(idleProps));nodes=h.mount(idleProps);
 assert.equal(button(nodes,copy.stop).props.disabled,true);
 assert.deepEqual(calls,['stop']);
});
