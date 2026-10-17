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
const {learningSourceFromTurn}=await import(await moduleUrl('../src/domain/learning-source.ts'));

test('selected completed task is untrusted learning material, not a verification certificate',()=>{
 const raw=learningSourceFromTurn({sessionId:'s1',status:'complete',text:'Summary',truncated:false,capability:{cardId:'card',methodFingerprint:'a'.repeat(64)},token:'must-not-copy',tools:[{secret:'must-not-copy'}]});
 assert.ok(raw.includes('untrusted source material'));
 const observation=JSON.parse(raw.slice(raw.indexOf('\n')+1));
 assert.equal(observation.businessVerified,false);
 assert.equal(observation.cardId,'card');
 assert.equal(raw.includes('must-not-copy'),false);
});

test('learning source rejects active tasks and bounds failed/interrupted observations',()=>{
 assert.throws(()=>learningSourceFromTurn({sessionId:'s1',status:'streaming',text:'running'}));
 for(const status of ['failed','interrupted']){
  const raw=learningSourceFromTurn({sessionId:'s1',status,text:'x'.repeat(10000),truncated:false});
  assert.ok(raw.length<=4000);
  assert.ok(raw.includes('"summaryTruncated":true'));
  assert.ok(raw.includes('do not label them successful methods'));
 }
});

test('unconnected settings render unavailable with disabled actions, not fake update results',async()=>{
 const panel=await moduleUrl('../src/components/Panel.tsx');
 const copy=await moduleUrl('../src/data/mockData.ts');
 const domain=await moduleUrl('../src/domain/entry-capabilities.ts');
 const hook=await moduleUrl('../src/hooks/useEntryCapabilities.ts',{'../domain/entry-capabilities':domain});
 const entryPanel=await moduleUrl('../src/components/EntryCapabilitiesPanel.tsx',{'./Panel':panel});
 const nativeDomain=await moduleUrl('../src/domain/native-entry.ts');
 const nativeHook=await moduleUrl('../src/hooks/useNativeEntry.ts',{'../domain/native-entry':nativeDomain});
 const nativePanel=await moduleUrl('../src/components/NativeEntryPanel.tsx',{'./Panel':panel,'../data/mockData':copy});
 const {SettingsPage}=await import(await moduleUrl('../src/pages/SettingsPage.tsx',{'../components/Panel':panel,'../data/mockData':copy,'../components/EntryCapabilitiesPanel':entryPanel,'../hooks/useEntryCapabilities':hook,'../components/NativeEntryPanel':nativePanel,'../hooks/useNativeEntry':nativeHook}));
 const html=renderToStaticMarkup(React.createElement(SettingsPage,{}));
 for(const match of html.matchAll(/<button\b([^>]*)>/g))assert.match(match[1],/disabled=""/);
 assert.ok(html.includes('原生 CLI / Dashboard'));
 assert.ok(html.includes('读取原生入口状态'));
 assert.ok(html.includes('更新接口尚未接入'));
 assert.ok(html.includes('未认证'));
 assert.equal(html.includes('暂无更新'),false);
 assert.equal(html.includes('未检测到可用入口'),false);
 assert.equal(html.includes('0.21.0'),false);
});
