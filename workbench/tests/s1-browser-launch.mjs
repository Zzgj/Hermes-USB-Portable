// Import from an owned browser runner. Pass credentials in memory, never via stdout,
// stderr, command-line arguments, shared files or a public bootstrap endpoint.
// No import-time server; the caller must await the returned close() in finally.
export {startS1Harness} from './s1-control-server.mjs';
