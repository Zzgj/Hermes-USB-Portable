import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {launcherCommand} from '../scripts/launcher-ui.mjs';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
test('Chinese Windows launcher keeps menu routing and enables UTF-8 before Chinese text',async()=>{
 const text=await read('../../launch.bat');
 assert.ok(text.indexOf('chcp 65001')>=0&&text.indexOf('chcp 65001')<text.search(/[\u4e00-\u9fff]/));
 for(const label of ['便携工作台','打开 P2 工作台','配置模型','高级工具','安全退出'])assert.ok(text.includes(label),label);
 assert.match(text,/choice \/C 12345P \/N/);assert.match(text,/if errorlevel 6 goto :menu_p2/);

 assert.ok(text.includes('call "%PORTABLE_ROOT%\\P2-Workbench.bat"'));
 assert.ok(text.includes('set "APPDATA=%P2_HOST_APPDATA%"'));
 assert.ok(text.includes('set "LOCALAPPDATA=%P2_HOST_LOCALAPPDATA%"'));
 for(const key of ['HERMES_HOME','NEED_RUNTIME_SETUP','SETUP_EXIT','invoke-hermes-update.ps1'])assert.ok(text.includes(key));
 assert.ok(!text.includes('Start Hermes Chat'));
 assert.ok(!/(?<!\r)\n|\r(?!\n)/.test(text),'CMD labels require CRLF throughout');
});
test('P2 entry is repository-owned and uses a relative root without policy overrides',async()=>{
 const raw=await read('../../P2-Workbench.bat');
 assert.ok(raw.includes('chcp 65001'));assert.ok(raw.includes('浏览器'));
 assert.ok(raw.includes('-Root "%~dp0." -Experimental'));
 assert.ok(!raw.includes('-ExecutionPolicy'));
 assert.ok(raw.includes('if not exist'));assert.ok(raw.includes('exit /b 1'));
 assert.ok(!/(?<!\r)\n|\r(?!\n)/.test(raw));
});
test('Chinese launch presentation is readable without ANSI and rejects credential URLs',async()=>{
 const {formatLauncherBanner,launcherCommand}=await import('../scripts/launcher-ui.mjs');
 const details={origin:'http://127.0.0.1:12345',commit:'a'.repeat(40)};
 const plain=formatLauncherBanner(details,{color:false});
 assert.ok(plain.includes('浏览器'));assert.ok(plain.includes('尚未启动'));assert.ok(plain.includes('开发测试版'));
 assert.ok(plain.includes('[1]'));assert.ok(plain.includes('[0]'));assert.ok(!plain.includes('\u001b'));
 assert.ok(plain.includes('尚未完成兼容验收'));
 assert.ok(formatLauncherBanner({...details,baselineStatus:'known-baseline-partial'}).includes('仍有未验收项目'));
 assert.ok(formatLauncherBanner(details,{color:true}).includes('\u001b['));
 for(const origin of [details.origin+'/?token=synthetic',details.origin+'/#secret','http://remote.invalid:12345'])assert.throws(()=>formatLauncherBanner({...details,origin}),/INVALID_LAUNCHER_DISPLAY/);
 for(const value of ['1','OPEN','open','打开'])assert.equal(launcherCommand(value),'open');
 for(const value of ['0','EXIT','exit','退出'])assert.equal(launcherCommand(value),'exit');
 assert.equal(launcherCommand('do anything'),'unknown');
});
test('launcher manager uses Chinese commands while preserving close retry',async()=>{
 const text=await read('../scripts/launch-managed.mjs');
 assert.ok(text.includes('formatLauncherBanner'));assert.ok(text.includes('launcherCommand(line)'));
 assert.ok(text.includes('停止尚未确认'));assert.ok(text.includes('请勿拔出 U 盘'));
 assert.ok(text.includes('await control.close();input.close();'));
 const {packageFiles,allowedPackagePath}=await import('../scripts/package-policy.mjs');
 assert.ok(packageFiles.includes('workbench/scripts/launcher-ui.mjs'));
 assert.ok(packageFiles.includes('P2-Workbench.bat'));assert.ok(allowedPackagePath('P2-Workbench.bat'));
 assert.ok(!allowedPackagePath('launch.bat'),'P2 incremental updates must not acquire ownership of the P0 launcher');
});
test('actual manager line callback dispatches Chinese/numeric commands and blocks opens while stopping',async()=>{
 const text=await read('../scripts/launch-managed.mjs');
 const tree=ts.createSourceFile('launch-managed.mjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),handlers=[];
 function visit(node){
  if(ts.isCallExpression(node)&&node.expression.getText(tree)==='input.on'&&node.arguments[0]?.text==='line')handlers.push(node.arguments[1].getText(tree));
  ts.forEachChild(node,visit);
 }
 visit(tree);assert.equal(handlers.length,1);
 let opens=0,stops=0,hints=0;
 const instantiate=stopping=>new Function('launcherCommand','shutdown','open','stopping','console',`return ${handlers[0]};`)(launcherCommand,()=>stops++,()=>opens++,stopping,{log:()=>hints++});
 const handler=instantiate(false);
 for(const value of ['1','打开','OPEN'])handler(value);
 for(const value of ['0','退出','EXIT'])handler(value);
 handler('invalid');assert.equal(opens,3);assert.equal(stops,3);assert.equal(hints,1);
 const stopping=instantiate(true);stopping('1');stopping('OPEN');assert.equal(opens,3);
});
