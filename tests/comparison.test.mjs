import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {compareRasters,comparisonScale,comparisonKey,MAX_COMPARISON_PIXELS} from '../apps/local/web/comparison.mjs';

test('visual comparison distinguishes removed, added, shared and transparent pixels without mutating sources',()=>{
  const a=new Uint8ClampedArray([0,0,0,255,255,255,255,255,0,0,0,255,0,0,0,0]);
  const b=new Uint8ClampedArray([255,255,255,255,0,0,0,255,0,0,0,255,255,255,255,255]),oldA=a.slice(),oldB=b.slice();
  const result=compareRasters(a,b,4,1);
  assert.deepEqual([...result.pixels],[220,48,48,255,40,100,220,255,30,30,30,255,255,255,255,255]);
  assert.deepEqual(result.counts,{original:1,revised:1,shared:1});assert.deepEqual(a,oldA);assert.deepEqual(b,oldB);
});

test('comparison dimensions, raster lengths and work budget are checked before allocation',()=>{
  for(const [w,h]of [[0,1],[1.5,1],[Infinity,1],[MAX_COMPARISON_PIXELS+1,1]])assert.throws(()=>compareRasters(new Uint8ClampedArray(),new Uint8ClampedArray(),w,h),RangeError);
  assert.throws(()=>compareRasters(new Uint8ClampedArray(4),new Uint8ClampedArray(8),1,1),/dimensions/);
  assert.throws(()=>comparisonScale([{width:0,height:100}]),RangeError);assert.throws(()=>comparisonScale([]),RangeError);
  const views=[{width:100000,height:60000},{width:3000,height:4000}],scale=comparisonScale(views);assert.equal(scale,.018);
  for(const v of views){assert.ok(Math.max(v.width,v.height)*scale<=1800);assert.ok(v.width*v.height*scale**2<=MAX_COMPARISON_PIXELS);}
  const c={drawing:{id:'owned'},pageNumber:1,viewport:{rotation:90,scale:1}};assert.equal(comparisonKey(c),comparisonKey({...c,viewport:{rotation:90,scale:4}}));assert.notEqual(comparisonKey(c),comparisonKey({...c,pageNumber:2}));assert.notEqual(comparisonKey(c),comparisonKey({...c,viewport:{rotation:0}}));assert.equal(comparisonKey({...c,viewport:null}),null);
});

async function render(bytes){
  const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,isEvalSupported:false});
  try{const pdf=await task.promise,page=await pdf.getPage(1),viewport=page.getViewport({scale:1}),canvas=createCanvas(viewport.width,viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;return {canvas,data:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data};}finally{await task.destroy();}
}

test('independent original/revision PDF fixture exposes one removal and one addition even when symbol totals are equal',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'fire-comparison-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  for(const variant of ['base','revision'])execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',join(directory,variant),variant]);
  const baseBytes=await readFile(join(directory,'base','small-vector.pdf')),revisionBytes=await readFile(join(directory,'revision','small-vector.pdf'));
  const [base,revision]=await Promise.all([render(baseBytes),render(revisionBytes)]),{pixels,counts}=compareRasters(base.data,revision.data,595,842);
  assert.ok(counts.original>0&&counts.revised>0&&counts.shared>0);
  function colorAt(x,y){const i=(y*595+x)*4;return [...pixels.slice(i,i+3)];}
  // Independently declared native centres: old (100,100), new (350,150), five common locations.
  let red=0,blue=0;
  for(let y=0;y<842;y++)for(let x=0;x<595;x++){
    const color=colorAt(x,y);
    if(color[0]===220){red++;assert.ok(x>=92&&x<=108&&y>=734&&y<=750,`Unexpected removed pixel ${x},${y}`);}
    if(color[2]===220){blue++;assert.ok(x>=342&&x<=358&&y>=684&&y<=700,`Unexpected added pixel ${x},${y}`);}
  }
  assert.equal(red,counts.original);assert.equal(blue,counts.revised);
  for(const [x,y]of [[200,100],[300,100],[100,200],[200,200],[300,200]])assert.deepEqual(colorAt(x,842-y),[30,30,30]);
  assert.deepEqual(compareRasters(base.data,base.data,595,842).counts,{original:0,revised:0,shared:counts.shared+counts.original});
  // A translated source can be aligned without changing either source raster.
  const shifted=createCanvas(595,842),ctx=shifted.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,595,842);ctx.drawImage(revision.canvas,10,0);
  const unaligned=compareRasters(base.data,ctx.getImageData(0,0,595,842).data,595,842);assert.ok(unaligned.counts.original>counts.original&&unaligned.counts.revised>counts.revised);
});
