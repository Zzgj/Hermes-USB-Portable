// P2-ENTRY-VIEW-02: EntryCapabilitiesPanel component tests.
// Tests import the actual transpiled component and render to static markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

async function moduleUrl(relative,replacements={}){
 const source=await readFile(new URL(relative,import.meta.url),'utf8');
 let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 for(const [specifier,url] of Object.entries({'react':import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),...replacements})){
  code=code.replaceAll(`from "${specifier}"`,`from "${url}"`).replaceAll(`from '${specifier}'`,`from '${url}'`);
 }
 return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

const panelUrl=await moduleUrl('../src/components/Panel.tsx');
const {EntryCapabilitiesPanel}=await import(await moduleUrl('../src/components/EntryCapabilitiesPanel.tsx',{'./Panel':panelUrl}));

const ALL_ROWS=[
 {kind:'workbench',assetState:'present'},
 {kind:'cli',assetState:'present'},
 {kind:'tui',assetState:'missing'},
 {kind:'dashboard',assetState:'unknown'},
 {kind:'desktop',assetState:'invalid'},
];

// Test 1: renders five entries with correct Chinese titles
test('renders five entry kinds with Chinese titles',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:false,failed:false,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('本工作台'));
 assert.ok(html.includes('CLI'));
 assert.ok(html.includes('TUI'));
 assert.ok(html.includes('原生 Dashboard'));
 assert.ok(html.includes('Desktop'));
});

// Test 2: four asset states have distinct descriptions, not "installed/runnable"
test('asset states are described distinctly, not as installed or runnable',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:false,failed:false,canInspect:true,onInspect:()=>{}}));
 // present: file exists but not runnable
 assert.ok(html.includes('入口文件存在'));
 assert.ok(!html.includes('已安装'));
 assert.ok(!html.includes('可运行'));
 // missing: not found at expected path
 assert.ok(html.includes('未发现入口文件'));
 // unknown: detection not connected
 assert.ok(html.includes('探测尚未接入'));
 // invalid: check failed
 assert.ok(html.includes('检测异常'));
});

// Test 3: loading state overrides rows — no stale success
test('loading state shows checking message and hides row results',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:true,failed:false,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('正在检测'));
 // Should not show entry file results while loading
 assert.ok(!html.includes('入口文件存在'));
});

// Test 4: failed state overrides rows — no stale success
test('failed state shows error and hides row results',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:false,failed:true,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('检测失败'));
 assert.ok(!html.includes('入口文件存在'));
});

// Test 5: null rows with no loading/failed shows "not yet inspected"
test('null rows without loading or failed shows not yet inspected',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:null,loading:false,failed:false,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('尚未检测'));
 assert.ok(!html.includes('入口文件存在'));
});

// Test 6: priority — unauthenticated (canInspect=false) shows first
test('canInspect false shows unauthenticated message and disables button',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:false,failed:false,canInspect:false,onInspect:()=>{}}));
 assert.ok(html.includes('未认证'));
 assert.ok(!html.includes('入口文件存在'));
 // Button must be disabled
 assert.ok(html.includes('disabled'));
});

// Test 7: inspect button enabled only when canInspect && !loading
test('inspect button disabled when loading even if canInspect',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:null,loading:true,failed:false,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('disabled'));
});

// Test 8: inspect button disabled when !canInspect
test('inspect button disabled when not canInspect',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:null,loading:false,failed:false,canInspect:false,onInspect:()=>{}}));
 assert.ok(html.includes('disabled'));
});

// Test 9: no launch/open button present
test('no launch or open button in any state',()=>{
 for(const props of [
  {rows:ALL_ROWS,loading:false,failed:false,canInspect:true,onInspect:()=>{}},
  {rows:null,loading:false,failed:false,canInspect:true,onInspect:()=>{}},
  {rows:ALL_ROWS,loading:false,failed:true,canInspect:true,onInspect:()=>{}},
 ]){
  const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,props));
  assert.ok(!html.includes('启动'));
  assert.ok(!html.includes('打开'));
 }
});

// Test 10: shows dependency unverified and lifecycle not connected disclaimers
test('shows dependency and lifecycle disclaimers',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:false,failed:false,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('依赖未验证'));
 assert.ok(html.includes('运行状态未知'));
 assert.ok(html.includes('生命周期未接入'));
});

// Test 11: loading priority over failed
test('loading priority over failed when both true',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:ALL_ROWS,loading:true,failed:true,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('正在检测'));
 assert.ok(!html.includes('检测失败'));
});

// Test 12: failed priority over null rows
test('failed priority over null rows',()=>{
 const html=renderToStaticMarkup(React.createElement(EntryCapabilitiesPanel,{rows:null,loading:false,failed:true,canInspect:true,onInspect:()=>{}}));
 assert.ok(html.includes('检测失败'));
 assert.ok(!html.includes('尚未检测'));
});
