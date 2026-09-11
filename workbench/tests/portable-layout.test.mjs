import test from 'node:test';
import assert from 'node:assert/strict';
import {windowsEnvironment} from '../scripts/portable-layout.mjs';
test('portable environment rebases paths and excludes inherited credentials and Python overrides',()=>{
 const env=windowsEnvironment('F:\\Hermes Test',{SystemRoot:'C:\\Windows',PATH:'E:\\old',PYTHONHOME:'E:\\python',HERMES_HOME:'E:\\private',OPENAI_API_KEY:'secret'});
 assert.equal(env.HERMES_HOME,'F:\\Hermes Test\\data');assert.equal(env.TERMINAL_CWD,'F:\\Hermes Test\\src\\hermes-agent');
 assert.equal(env.PYTHONHOME,undefined);assert.equal(env.OPENAI_API_KEY,undefined);assert.equal(env.PATH.includes('E:\\'),false);
 assert.ok(env.PATH.startsWith('F:\\Hermes Test\\.cache\\runtimes\\windows-x64\\venv\\Scripts;'));
 assert.equal(env.LOCALAPPDATA,'F:\\Hermes Test\\.cache\\windows-localappdata');
});
test('system root must be explicit and absolute',()=>{
 assert.throws(()=>windowsEnvironment('F:\\test',{}));assert.throws(()=>windowsEnvironment('F:\\test',{SystemRoot:'relative'}));
});
