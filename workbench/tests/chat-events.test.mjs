import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/chat-events.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {beginTurn,reduceChatEvent,appendChatPrompt}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const event=(seq,text,type='message.delta',status)=>({kind:'event',sessionId:'demo',seq,type,payload:{text,status}});
const tool=(seq,id,type='tool.start',extra={})=>({...event(seq,''),type,payload:{tool_id:id,name:'terminal',...extra}});
test('next prompt preserves prior failure and tool evidence without modifying history',()=>{
 const history=appendChatPrompt([],null,'first');
 let turn=reduceChatEvent(beginTurn('demo'),tool(1,'a'));
 assert.throws(()=>appendChatPrompt(history,turn,'second'),/unfinished/);
 turn=reduceChatEvent(turn,event(2,'failure','message.complete','error'));
 const next=appendChatPrompt(history,turn,'second');
 assert.equal(history.length,1);assert.equal(next.length,3);
 assert.equal(next[1].turn.status,'failed');assert.equal(next[1].turn.tools[0].status,'unknown');
 assert.equal(next[2].text,'second');assert.throws(()=>appendChatPrompt(next,null,'  '));
});
test('tool lifecycle correlates IDs without retaining raw args or results',()=>{
 let turn=reduceChatEvent(beginTurn('demo'),tool(1,'a','tool.start',{args:{secret:'private'}}));
 assert.equal(turn.tools[0].status,'running');
 turn=reduceChatEvent(turn,tool(2,'a','tool.complete',{result:{error:'failed'},duration_s:2}));
 assert.deepEqual(turn.tools,[{id:'a',name:'terminal',status:'finished',duration:2}]);
 assert.strictEqual(reduceChatEvent(turn,tool(3,'a')),turn);
 assert.equal(JSON.stringify(turn).includes('private'),false);
});
test('terminal reply leaves unclosed tools unknown, not successful or rolled back',()=>{
 const started=reduceChatEvent(beginTurn('demo'),tool(1,'a'));
 for(const status of ['complete','error','interrupted']){
  const turn=reduceChatEvent(started,event(2,'end','message.complete',status));
  assert.equal(turn.tools[0].status,'unknown');
 }
 assert.strictEqual(reduceChatEvent(started,{...tool(2,'b'),sessionId:'other'}),started);
 assert.strictEqual(reduceChatEvent(started,tool(1,'b')),started);
});
test('tool activity is bounded and malformed IDs are ignored',()=>{
 let turn=beginTurn('demo');assert.strictEqual(reduceChatEvent(turn,tool(1,'')),turn);
 for(let i=0;i<101;i++)turn=reduceChatEvent(turn,tool(i,String(i)));
 assert.equal(turn.tools.length,100);assert.equal(turn.toolsTruncated,true);
 turn=reduceChatEvent(turn,tool(102,'0','tool.complete',{duration_s:Infinity}));
 assert.equal(turn.tools[0].status,'finished');assert.equal(turn.tools[0].duration,undefined);
});
test('stream chunks append, terminal full text replaces the stream',()=>{
 let turn=beginTurn('demo');turn=reduceChatEvent(turn,event(1,'a'));turn=reduceChatEvent(turn,event(2,'b'));
 assert.equal(turn.text,'ab');turn=reduceChatEvent(turn,event(3,'answer','message.complete','complete'));
 assert.equal(turn.text,'answer');assert.equal(turn.status,'complete');
 assert.strictEqual(reduceChatEvent(turn,event(4,'late')),turn);
});
test('ignore other sessions and duplicate or reordered events',()=>{
 const turn=reduceChatEvent(beginTurn('demo'),event(4,'once'));
 assert.strictEqual(reduceChatEvent(turn,event(4,'duplicate')),turn);
 assert.strictEqual(reduceChatEvent(turn,event(2,'old')),turn);
 assert.strictEqual(reduceChatEvent(turn,{...event(5,'other'),sessionId:'other'}),turn);
});
test('failure and interruption never become successful completion',()=>{
 assert.equal(reduceChatEvent(beginTurn('demo'),event(1,'failed','message.complete','error')).status,'failed');
 assert.equal(reduceChatEvent(beginTurn('demo'),event(1,'stopped','message.complete','interrupted')).status,'interrupted');
 const turn=beginTurn('demo');assert.strictEqual(reduceChatEvent(turn,event(1,'unknown','message.complete','unknown')),turn);
});
test('bound streamed text and reject malformed payloads',()=>{
 const turn=beginTurn('demo');assert.strictEqual(reduceChatEvent(turn,{...event(1,''),payload:null}),turn);
 const large=reduceChatEvent(turn,event(1,'x'.repeat(200_001)));
 assert.equal(large.text.length,200_000);assert.equal(large.truncated,true);
});
