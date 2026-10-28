import test from 'node:test';
import assert from 'node:assert/strict';
import {overlayInkPixels,overlayPlacement,moveOverlay} from '../apps/local/web/overlay.mjs';
import {MAX_COMPARISON_PIXELS} from '../apps/local/web/comparison.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';

test('overlay paper is transparent while dark and antialiased ink preserve alpha without modifying the source',()=>{
  const source=new Uint8ClampedArray([255,255,255,255,0,0,0,255,128,128,128,255,0,0,0,128,0,0,0,0]),before=source.slice();
  const pixels=overlayInkPixels(source,5,1);assert.deepEqual([...pixels],[40,100,220,0,40,100,220,255,40,100,220,127,40,100,220,128,40,100,220,0]);assert.deepEqual(source,before);
  // Source-over composition: white paper must not erase a red base feature.
  const background=[220,48,48];assert.deepEqual(background.map((v,i)=>pixels[i]*(pixels[3]/255)+v*(1-pixels[3]/255)),background);
  for(const [w,h]of [[0,1],[1.5,1],[1,Infinity],[MAX_COMPARISON_PIXELS+1,1]])assert.throws(()=>overlayInkPixels(source,w,h),RangeError);
  assert.throws(()=>overlayInkPixels(source,1,1),RangeError);
});

test('overlay translation preserves native offsets across zoom and actual cropped rotated PDF dimensions',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'fire-overlay-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  execFileSync(process.execPath,['scripts/generate-drawing-fixture.mjs',directory,'cropped']);
  const task=getDocument({data:new Uint8Array(await readFile(join(directory,'small-vector.pdf'))),isEvalSupported:false});t.after(()=>task.destroy());
  const pdf=await task.promise,page=await pdf.getPage(1),view=page.getViewport({scale:1});
  assert.equal(view.rotation,90);assert.equal(view.width,700);assert.equal(view.height,400);
  const original=[10,20],offset=moveOverlay(original,30,-10,.5);assert.deepEqual(offset,[70,0]);assert.deepEqual(original,[10,20]);
  assert.deepEqual(overlayPlacement(view.width,view.height,offset,.5),{left:35,top:0,width:350,height:200});
  assert.deepEqual(overlayPlacement(view.width,view.height,offset,2),{left:140,top:0,width:1400,height:800});
  assert.deepEqual(moveOverlay(offset,-120,40,2),original);
  for(const scale of [0,-1,NaN,Infinity])assert.throws(()=>moveOverlay(offset,1,0,scale),RangeError);
  assert.throws(()=>moveOverlay([NaN,0],1,1,1),RangeError);assert.throws(()=>moveOverlay(offset,Infinity,0,1),RangeError);assert.throws(()=>overlayPlacement(0,10,offset,1),RangeError);
});
