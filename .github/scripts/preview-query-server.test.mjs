import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isQueryShellRequest, safeAssetPath } from './preview-query-server.mjs';
describe('real compiled Astro query preview',()=>{
 it('routes only query-bearing HTML shells through Astro first',()=>{
  assert.equal(isQueryShellRequest('/worksheet-viewer-noam.html?g=9&pdf=valid'),true);
  assert.equal(isQueryShellRequest('/learning.html?grade=9'),true);
  assert.equal(isQueryShellRequest('/worksheet-viewer-noam.html'),false);
  assert.equal(isQueryShellRequest('/fonts/site-fonts.css?version=1'),false);
 });
 it('keeps static candidates inside the built client directory',()=>{
  assert.equal(safeAssetPath('/tmp/client','/fonts/site.woff2'),'/tmp/client/fonts/site.woff2');
  for(const path of ['/../../outside','/..%2foutside','/.env','/%00file','/%ZZ'])assert.equal(safeAssetPath('/tmp/client',path),null);
 });
});
