import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {assessBaseline} from '../scripts/check-hermes-baseline.mjs';
const manifest=JSON.parse(readFileSync(new URL('../hermes-compatibility.json',import.meta.url),'utf8'));
test('known development SHA is not a release qualification',()=>{
 const result=assessBaseline(manifest.baselines[0].commit,false,manifest);
 assert.equal(result.status,'known-baseline-partial');assert.equal(result.release_qualified,false);
 assert.ok(result.not_verified.includes('windows'));
});
test('unknown source never inherits compatibility by version number',()=>{
 const result=assessBaseline('0'.repeat(40),false,manifest);
 assert.equal(result.status,'unverified-source');assert.equal(result.release_qualified,false);
});
test('tracked edits invalidate even a known source',()=>{
 const result=assessBaseline(manifest.baselines[0].commit,true,manifest);
 assert.equal(result.status,'modified-source');assert.equal(result.release_qualified,false);
});
