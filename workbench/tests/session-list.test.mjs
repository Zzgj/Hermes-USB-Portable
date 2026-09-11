import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/domain/session-list.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {decodeSessionList}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const row={id:'stored-id',title:'<script>literal</script>',message_count:3};
test('session list retains only validated identity title and count, not previews',()=>{
 assert.deepEqual(decodeSessionList({sessions:[{...row,preview:'private',token:'secret'}]}),[{id:row.id,title:row.title,messages:3}]);
 assert.deepEqual(decodeSessionList({sessions:[]}),[]);
});
test('reject malformed, duplicate and over-limit session lists',()=>{
 for(const value of [null,{}, {sessions:[row,row]}, {sessions:[{...row,message_count:-1}]},{sessions:[{...row,id:''}]},{sessions:Array(51).fill(row)}])assert.throws(()=>decodeSessionList(value));
});
