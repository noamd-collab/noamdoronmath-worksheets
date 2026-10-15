/** Local/CI only: real compiled Astro query-shell routing, never an HTML rewrite. */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const project = fileURLToPath(new URL('../../headless/astro-poc/', import.meta.url));
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf','.wasm':'application/wasm' };
export function isQueryShellRequest(url) {
  const parsed = new URL(url, 'http://preview.local');
  return Boolean(parsed.search) && ['/worksheet-viewer-noam.html','/learning.html'].includes(parsed.pathname);
}
export function safeAssetPath(clientRoot, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.split(/[\\/]/).some(part=>part.startsWith('.'))) return null;
  const root = resolve(clientRoot), target = resolve(root, '.'+decoded);
  return target.startsWith(root+sep) ? target : null;
}
export async function startPreview() {
  const {handler,options} = await import(pathToFileURL(resolve(project,'dist/server/entry.mjs')).href);
  if(options.mode!=='middleware') throw new Error('Build the Node middleware preview configuration first.');
  const clientRoot = await realpath(resolve(project,'dist/client'));
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    if(!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
    try {
      const url=new URL(req.url,'http://preview.local');
      if(!isQueryShellRequest(req.url)) {
        const candidate=safeAssetPath(clientRoot,url.pathname);
        if(candidate) {
          try {
            const actual=await realpath(candidate), info=await stat(actual);
            if(actual.startsWith(clientRoot+sep)&&info.isFile()) {
              res.setHeader('Content-Type',mime[extname(actual).toLowerCase()]||'application/octet-stream');
              res.setHeader('Content-Length',String(info.size));
              if(req.method==='HEAD')res.end();else createReadStream(actual).on('error',()=>res.destroy()).pipe(res);
              return;
            }
          } catch { /* Missing assets proceed through actual Astro routing. */ }
        }
      }
      // No post-processing or mocked metadata: this is the built app's handler.
      await handler(req,res);
    } catch { if(!res.headersSent)res.writeHead(500);res.end('Preview request failed.'); }
  });
  const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4321);
  server.listen(port,host,()=>console.log(`Read-only compiled Astro query preview listening on ${host}:${port}`));
  return server;
}
const main=process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(main)startPreview().catch(()=>{console.error('Could not start the compiled Astro query preview.');process.exit(1);});
