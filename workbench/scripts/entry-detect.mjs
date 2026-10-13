// Read-only detection of Hermes entry points (CLI/TUI/Desktop/Web).
// Does not spawn processes or execute code; only checks file existence.
import {stat} from 'node:fs/promises';
import {join} from 'node:path';

// Detects available entries based on the portable package layout.
// source: path to hermes-agent source tree (contains hermes_cli/)
// home: path to the Hermes data directory
// assetsDir: path to workbench dist (for Web Dashboard)
export async function detectEntries({source,home,assetsDir}) {
 const results=[];
 // CLI: check hermes_cli/main.py exists (same check as hermes-instance.mjs:19)
 try{
  if(source){const file=await stat(join(source,'hermes_cli','main.py'));results.push({kind:'cli',available:file.isFile(),note:file.isFile()?'hermes_cli 入口文件存在；运行条件未验证':'hermes_cli 入口不是普通文件'});}
  else results.push({kind:'cli',available:false,note:'未提供源码路径'});
 }catch{results.push({kind:'cli',available:false,note:'未找到 hermes_cli 入口'});}
 // TUI: portable package has no standalone TUI entry
 results.push({kind:'tui',available:false,note:'独立 TUI 探测尚未接入；不代表未安装'});
 // Desktop: portable package has no standalone Desktop app
 results.push({kind:'desktop',available:false,note:'独立 Desktop 探测尚未接入；不代表未安装'});
 // Web Dashboard: check workbench dist/index.html exists
 try{
  if(assetsDir){const file=await stat(join(assetsDir,'index.html'));results.push({kind:'web',available:file.isFile(),note:file.isFile()?'本工作台入口文件存在；不代表原生 Dashboard 可用':'工作台入口不是普通文件'});}
  else results.push({kind:'web',available:false,note:'未提供工作台路径'});
 }catch{results.push({kind:'web',available:false,note:'Web 工作台未构建'});}
 return results;
}
