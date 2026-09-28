import {startControlServer} from '../scripts/control-server.mjs';
import {fileURLToPath} from 'node:url';
import {writeFile,readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// This script starts a control server and prints the URL for the browser to connect to.
const server = await startControlServer({
  assets: fileURLToPath(new URL('../dist', import.meta.url)),
  startInstance: async () => ({state:'ready',connection:Promise.resolve({port:12345,token:'fixture-rpc-token'}),stop:async()=>{}}),
  prepareCapability: async ({card,values}) => ({kind:'capability',cardId:card.id,method:card.method,availability:'unknown',prompt:`Synthetic capability ${card.id}: ${JSON.stringify(values)}`})
});
console.log(JSON.stringify({url:`${server.origin}/#/chat/live?control=${server.token}`,origin:server.origin,token:server.token}));
const close = async () => { await server.close(); process.exit(0); };
process.on('SIGINT', close); process.on('SIGTERM', close);
process.stdin.resume(); process.stdin.on('data', close); process.stdin.on('end', close);
