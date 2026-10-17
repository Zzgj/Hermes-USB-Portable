import {spawn} from 'node:child_process';
import {join,isAbsolute} from 'node:path';

export function openLocalBrowser(value,{platform=process.platform,systemRoot=process.env.SystemRoot,spawnBrowser=spawn,timeoutMs=10_000}={}){
 let url;try{url=new URL(value);}catch{throw new Error('INVALID_LOCAL_BROWSER_URL');}
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.username||url.password||
  !Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30_000)throw new Error('INVALID_LOCAL_BROWSER_URL');
 if(platform==='win32'&&(!systemRoot||!isAbsolute(systemRoot)))throw new Error('BROWSER_OPEN_FAILED');
 const command=platform==='win32'?join(systemRoot,'System32','rundll32.exe'):platform==='darwin'?'/usr/bin/open':'xdg-open';
 const args=platform==='win32'?['url.dll,FileProtocolHandler',url.href]:[url.href];
 return new Promise((resolve,reject)=>{
  const child=spawnBrowser(command,args,{stdio:'ignore',shell:false,windowsHide:true});
  let done=false;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timer);ok?resolve():reject(new Error('BROWSER_OPEN_FAILED'));};
  const timer=setTimeout(()=>{try{child.kill();}catch{}finish(false);},timeoutMs);
  child.once('error',()=>finish(false));child.once('exit',code=>finish(code===0));
 });
}
