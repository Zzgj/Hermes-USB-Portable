// Development-only HTTP fixture: cannot launch Hermes or execute commands.
import {startControlServer} from '../scripts/control-server.mjs';
import {fileURLToPath} from 'node:url';
const server=await startControlServer({assets:fileURLToPath(new URL('../dist',import.meta.url)),startInstance:async()=>({state:'ready',connection:Promise.resolve({port:12345,token:'fixture-no-real-backend-token'}),stop:async()=>{}}),prepareLearn:async request=>({kind:'learn',prompt:`P2 synthetic learn prompt: ${request.source}; ${request.scope}`,builderFingerprint:'a'.repeat(64)})});
// Test runner receives a disposable fixture credential; never use real user tokens here.
console.log(JSON.stringify({url:`${server.origin}/#/chat/live?control=${server.token}`}));
const close=async()=>{await server.close();process.exit(0);};
process.on('SIGINT',close);process.on('SIGTERM',close);
process.stdin.resume();process.stdin.on('data',close);process.stdin.on('end',close);
