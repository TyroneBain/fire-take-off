import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startApp} from '../apps/local/server.mjs';

test('local context browser dependency is executable, carries notices and does not expose package directories',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'context-vendor-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const app=await startApp({directory,port:0});t.after(()=>app.close());
 const response=await fetch(app.origin+'/vendor/polygon-clipping.mjs');
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
 const source=await response.text();assert.match(source,/Copyright \(c\) 2018 Mike Fogel/);assert.match(source,/free and unencumbered software/);
 const previous=globalThis.polygonClipping;
 try{
  const {default:geometry}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const merged=geometry.union([[[0,0],[2,0],[2,2],[0,2],[0,0]]],[[[1,0],[3,0],[3,2],[1,2],[1,0]]]);
  assert.deepEqual(merged,[[[[0,0],[3,0],[3,2],[0,2],[0,0]]]]);
 }finally{if(previous===undefined)delete globalThis.polygonClipping;else globalThis.polygonClipping=previous;}
 assert.equal((await fetch(app.origin+'/vendor/polygon-clipping/package.json')).status,404);
});
