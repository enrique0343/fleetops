import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const result = await build({
  entryPoints: ['design/driver-progress-demo.tsx'], bundle: true, write: false,
  outdir: 'driver-progress-demo', format: 'iife', minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = result.outputFiles.find((file) => file.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = result.outputFiles.find((file) => file.path.endsWith('.css')).text;
const output = resolve(process.argv[2] || 'driver-progress-demo.html');
await writeFile(output, `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FleetOps · Seguimiento del conductor</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log(output);
