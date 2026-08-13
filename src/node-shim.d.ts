declare module 'node:fs' { export const existsSync:any; export const mkdirSync:any; export const readFileSync:any; export const writeFileSync:any; }
declare module 'node:path' { export const dirname:any; export const join:any; }
declare module 'node:http' { export const createServer:any; }
declare module 'node:test' { const test:any; export default test; }
declare module 'node:assert/strict' { const assert:any; export default assert; }
declare const process: any;
