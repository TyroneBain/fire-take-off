import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {setupSelectionEditor} from '../apps/local/web/selection-editor.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

// Independently authored, small clipped PDF: the legacy full-page inspector
// refuses clipping, while native inspection can retain these original paths.
function original(alpha=false){
 const stream=`q 80 80 40 40 re W n ${alpha?'/A gs ':''}0 G 1 w 90 90 20 20 re S 98 98 4 4 re f Q`,objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /ExtGState << /A << /Type /ExtGState /CA .5 /ca .5 >> >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o] of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=pdf.length;
 pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new Uint8Array(Buffer.from(pdf));
}
const until=async predicate=>{const deadline=performance.now()+5000;while(!predicate()){if(performance.now()>deadline)throw Error('Editor did not settle');await new Promise(r=>setTimeout(r,5));}};
function decorate(node={}){return Object.assign(node,{style:{},classList:{toggle(){}},parentElement:{clientWidth:360},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},click(){if(!this.disabled)return this.onclick?.({shiftKey:false});}});}
async function fixture(t,{alpha=false,delayFirst=false}={}){
 const bytes=original(alpha),probe=getDocument({data:bytes.slice(),isEvalSupported:false});let ids;
 try{const page=await(await probe.promise).getPage(1),ops=await page.getOperatorList();ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath&&[OPS.stroke,OPS.fill].includes(ops.argsArray[i][0])?[i]:[]);}finally{await probe.destroy();}
 const priorDocument=globalThis.document,priorWindow=globalThis.window,nodes=new Map(),tasks=[],destructions=[],reviews=[],applies=[];let release;
 const gate=new Promise(r=>release=r),node=id=>{if(!nodes.has(id))nodes.set(id,decorate(id==='selection-canvas'?createCanvas(1,1):{}));return nodes.get(id);};
 globalThis.document={getElementById:node,createElement:tag=>{assert.equal(tag,'canvas');return createCanvas(1,1);}};globalThis.window={addEventListener(){},requestAnimationFrame:callback=>setTimeout(callback,0),cancelAnimationFrame:clearTimeout};
 const record={id:'selection',item_id:'heading',version:7,example:{drawing_id:'drawing',page:1,bounds:[85,85,115,115],algorithm:'binary-elements-2',elements:{renderer:ELEMENT_RENDERER,ids,excluded:[ids[0]]}}},before=structuredClone(record);
 const editor=setupSelectionEditor({pdfjs:{OPS,getDocument(options){assert.equal(options.isEvalSupported,false);const task=getDocument({data:bytes.slice(),isEvalSupported:false}),index=tasks.push(task)-1;return {promise:delayFirst&&index===0?Promise.all([task.promise,gate]).then(([pdf])=>pdf):task.promise,destroy(){destructions.push(index);return task.destroy();}};}},context:()=>({state:{countMarks:[]},drawing:{id:'drawing'}}),apply:async(...args)=>applies.push(args),remove:async()=>{throw Error('Unexpected delete');},cancelMatching(){},reviewVector:async(...args)=>reviews.push(args)});
 t.after(async()=>{release();editor.close();await Promise.all(tasks.map(task=>task.destroy()));globalThis.document=priorDocument;globalThis.window=priorWindow;});
 return {editor,node,record,before,ids,reviews,applies,tasks,destructions,release};
}

test('clipped legacy selection retries native with exact saved IDs/exclusions and Done invokes only review',async t=>{
 const f=await fixture(t);await f.editor.open(f.record);
 assert.match(f.node('selection-error').textContent,/clipped or composited/);assert.equal(f.node('selection-done').disabled,true);assert.equal(f.node('selection-native-review').disabled,false);assert.equal(f.node('selection-native-review').textContent,'Inspect visible vector elements');
 await f.node('selection-native-review').click();await until(()=>!f.node('selection-done').disabled);
 assert.equal(f.tasks.length,2,'retry opens a fresh original document');assert.ok(f.destructions.includes(0));assert.equal(f.node('selection-vector').disabled,true);assert.equal(f.node('selection-scales').disabled,true);assert.equal(f.node('selection-done').textContent,'Review matches');assert.equal(f.node('selection-elements').textContent,'1');
 await f.node('selection-done').click();assert.equal(f.reviews.length,1);assert.equal(f.applies.length,0);assert.deepEqual(f.reviews[0][1],{renderer:ELEMENT_RENDERER,ids:f.ids,excluded:[f.ids[0]]});assert.equal(f.reviews[0][2],true);assert.deepEqual(f.record,f.before);assert.equal(f.node('selection-dialog').open,false);
});

test('native retry still refuses actual alpha composition and cannot enable either save path',async t=>{
 const f=await fixture(t,{alpha:true});await f.editor.open(f.record);assert.equal(f.node('selection-native-review').disabled,false);await f.node('selection-native-review').click();
 assert.match(f.node('selection-error').textContent,/composited drawings/);assert.equal(f.node('selection-native-review').disabled,true);assert.equal(f.node('selection-done').disabled,true);await f.node('selection-done').onclick({});assert.deepEqual(f.reviews,[]);assert.deepEqual(f.applies,[]);assert.deepEqual(f.record,f.before);
});

test('cancelled slow inspection cannot overwrite a newer native preview or its saved identities',async t=>{
 const f=await fixture(t,{delayFirst:true}),stale=f.editor.open(f.record);await until(()=>f.tasks.length===1);f.editor.close();
 await f.editor.open(f.record,{nativeReviewOnly:true});await until(()=>!f.node('selection-done').disabled);const ready=f.node('selection-error').textContent;f.release();await stale;
 assert.equal(f.node('selection-dialog').open,true);assert.equal(f.node('selection-error').textContent,ready);assert.equal(f.node('selection-done').disabled,false);assert.equal(f.node('selection-native-review').textContent,'Find on this page');assert.deepEqual(f.reviews,[]);assert.deepEqual(f.applies,[]);assert.deepEqual(f.record,f.before);
 f.editor.close();assert.equal(f.node('selection-dialog').open,false);assert.ok(f.destructions.includes(0));assert.ok(f.destructions.includes(1));
});

test('native retry refuses changed saved paint IDs without dropping exclusions or invoking save',async t=>{
 const f=await fixture(t),stale=structuredClone(f.record);stale.example.elements.ids=[...f.ids,999];const before=structuredClone(stale);
 await f.editor.open(stale);assert.equal(f.node('selection-native-review').disabled,false);await f.node('selection-native-review').click();
 assert.match(f.node('selection-error').textContent,/element identity changed/);assert.equal(f.node('selection-done').disabled,true);assert.equal(f.node('selection-native-review').disabled,true);assert.deepEqual(stale,before);assert.deepEqual(f.reviews,[]);assert.deepEqual(f.applies,[]);
});
