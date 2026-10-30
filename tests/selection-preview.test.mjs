import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {createSelectionPreview,selectionPreviewPixels} from '../apps/local/web/selection-editor.mjs';
import {inspectPdfElements} from '../apps/local/web/pdf-elements.mjs';
const tick=()=>new Promise(resolve=>setTimeout(resolve,2));
async function until(predicate){const deadline=performance.now()+5000;while(!predicate()){if(performance.now()>deadline)throw Error('Preview test timed out');await tick();}}
const image=value=>({width:1,height:1,data:new Uint8ClampedArray([value,0,0,255])});

test('preview serializes renders, coalesces rapid edits and never enables a stale exclusion set',async()=>{
 const calls=[],frames=[],errors=[];let active=0,peak=0,pending=0;
 const preview=createSelectionPreview({delay:0,render:ids=>{active++;peak=Math.max(peak,active);return new Promise((resolve,reject)=>calls.push({ids,resolve:v=>{active--;resolve(v);},reject}));},onPending:()=>pending++,onReady:frame=>frames.push(frame),onError:e=>errors.push(e)});
 preview.update([]);assert.equal(preview.ready([]),false);await until(()=>calls.length===1);
 preview.update([2]);preview.update([2,1]);preview.update([1]);assert.equal(preview.ready([1]),false);await tick();assert.equal(calls.length,1);
 calls[0].resolve(image(10));await until(()=>calls.length===2);assert.deepEqual(calls[1].ids,[1]);assert.equal(frames.length,0,'old pixels may not repaint newer edits');assert.equal(preview.ready([1]),false);
 calls[1].resolve(image(20));await until(()=>frames.length===1);assert.equal(preview.ready([1]),true);assert.equal(preview.ready([]),false);assert.equal(peak,1);assert.equal(pending,4);assert.deepEqual(errors,[]);
 preview.update([1]);await tick();assert.equal(calls.length,2,'hover/mode changes with identical exclusions must not rerender');preview.dispose();
});

test('closed previews ignore late completion and render errors cannot enable saving',async()=>{
 let resolve,ready=0,error=0;const closed=createSelectionPreview({delay:0,render:()=>new Promise(r=>resolve=r),onPending(){},onReady:()=>ready++,onError:()=>error++});closed.update([]);await until(()=>resolve);closed.dispose();resolve(image(1));await tick();assert.equal(ready,0);assert.equal(error,0);assert.equal(closed.ready([]),false);
 const failed=createSelectionPreview({delay:0,render:async()=>{throw Error('Controlled PDF render failure');},onPending(){},onReady:()=>ready++,onError:e=>{assert.match(e.message,/Controlled/);error++;}});failed.update([4]);await until(()=>error===1);assert.equal(failed.ready([4]),false);assert.equal(ready,0);failed.dispose();
});

function layeredPDF(){
 const content='1 0 0 rg 734 1196 20 8 re f 0 g 744 1196 10 8 re f\n',objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1684 2384] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(x=>`${String(x).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}

test('actual filtered PDF preview reveals an occluded red underlayer before Done becomes ready, then restores exact original pixels',async()=>{
 const task=getDocument({data:layeredPDF(),isEvalSupported:false});let preview;
 try{const page=await(await task.promise).getPage(1),model=await inspectPdfElements({page,OPS,bounds:[732,1188,756,1212],createCanvas}),excluded=new Set(),frames=[],errors=[],upper=model.elements.at(-1).id,index=(24*48+32)*4;
  assert.equal(model.elements[0].ink[index/4],0,'initial contribution masks omit the hidden underlayer');
  preview=createSelectionPreview({delay:0,render:ids=>model.render(ids),onPending(){},onReady:rgba=>frames.push(selectionPreviewPixels(model,excluded,rgba)),onError:e=>errors.push(e)});
  preview.update(excluded);await until(()=>preview.ready(excluded));const original=frames.at(-1);assert.deepEqual([...original.slice(index,index+4)],[0,0,0,255]);
  excluded.add(upper);preview.update(excluded);assert.equal(preview.ready(excluded),false);await until(()=>preview.ready(excluded));assert.deepEqual([...frames.at(-1).slice(index,index+4)],[255,0,0,255],'retained real colour replaces the erased ghost across the revealed area');
  excluded.clear();preview.update(excluded);assert.equal(preview.ready(excluded),false);await until(()=>preview.ready(excluded));assert.deepEqual(frames.at(-1),original);assert.deepEqual(errors,[]);
 }finally{preview?.dispose();await task.destroy();}
});

test('excluded ghosts appear only behind actual retained pixels; changed render dimensions fail closed',()=>{
 const model={width:2,height:1,elements:[{id:1,ink:new Uint8Array([1,1])}]},excluded=new Set([1]),rgba={width:2,height:1,data:new Uint8ClampedArray([255,0,0,255,255,255,255,255])},pixels=selectionPreviewPixels(model,excluded,rgba);assert.deepEqual([...pixels],[255,0,0,255,150,150,150,85]);assert.throws(()=>selectionPreviewPixels(model,excluded,image(1)),/dimensions/);
});
