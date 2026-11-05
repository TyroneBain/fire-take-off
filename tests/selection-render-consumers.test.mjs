import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {runDrawingRecount} from '../apps/local/web/drawing-recount.mjs';
import {editedTemplate,ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {inkImage} from '../apps/local/web/matcher.mjs';
import {setupCountInk} from '../apps/local/web/count-ink.mjs';

// Original fixture deliberately triggers display optimization before the saved
// selection. The reference PDF omits the pipe in its source content, without
// using any filter or identity mapper to establish expected cleaned pixels.
function original(size,pipe=true){
 const c=size/2,texts=Array.from({length:5},(_,i)=>`BT /F1 6 Tf 1 0 0 1 ${10+i*15} 20 Tm (DATA) Tj ET`).join('\n'),content=`${texts}\n0 G 0 g 1 w q 1 0 0 1 ${c} ${c} cm -5 -5 10 10 re S Q q 1 0 0 1 ${c} ${c} cm -1 -1 2 2 re f Q ${pipe?`1 0 1 RG q 1 0 0 1 ${c} ${c} cm -15 0 m 15 0 l S Q`:''}`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${size} ${size}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>`,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=pdf.length;pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
const fontUrl=new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname;
const pathIds=list=>list.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);
async function reference(bytes){const task=getDocument({data:bytes.slice(),isEvalSupported:false,standardFontDataUrl:fontUrl});try{const page=await(await task.promise).getPage(1),raw=await page.getOperatorList(),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(40,40);let display;try{await page.render({canvas,canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport,transform:[1,0,0,1,-viewport.width/2+20,-viewport.height/2+20],operationsFilter:(id,list)=>{display=list;return true;}}).promise;return{ids:pathIds(raw),displayIds:pathIds(display),image:inkImage(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height)};}finally{canvas.width=canvas.height=0;}}finally{await task.destroy();}}
for(const size of [256,1200])test(`drawing recount keeps original saved exclusions in ${size}pt optimized source and tile renders`,async t=>{
 const bytes=original(size),beforeBytes=bytes.slice(),full=await reference(bytes),clean=await reference(original(size,false));assert.notDeepEqual(full.ids,full.displayIds,'original fixture must exercise changed display indices');
 const expected=editedTemplate(full.image,clean.image,[0,0,40,40]),drawing={id:'original',digest:'a'.repeat(64),discipline_id:'fire',pages:[{view:[0,0,size,size]}]},elements={renderer:ELEMENT_RENDERER,ids:full.ids,excluded:[full.ids.at(-1)]},record={id:'saved',version:3,item_id:'heads',created:'2026-11-06',example:{drawing_id:drawing.id,digest:drawing.digest,page:1,bounds:[size/2-10,size/2-10,size/2+10,size/2+10],algorithm:'binary-elements-2',elements}},state={drawings:[drawing],countItems:[{id:'heads',discipline_id:'fire',version:4}],countExamples:[record],countMarks:[{id:'reviewed',drawing_id:drawing.id,page:1,example_id:record.id,version:7,included:0,reviewed:1}]},before=structuredClone(state),captured=[];
 const priorDocument=globalThis.document,priorWorker=globalThis.Worker,canvases=[];globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');const c=createCanvas(1,1);canvases.push(c);return c;}};
 globalThis.Worker=class{postMessage(value){captured.push(value.template);queueMicrotask(()=>this.onmessage?.({data:{matches:[]}}));}terminate(){}};
 t.after(()=>{globalThis.document=priorDocument;globalThis.Worker=priorWorker;for(const c of canvases)c.width=c.height=0;});
 const pdfjs={OPS,version,getDocument:options=>getDocument({...options,url:undefined,data:bytes.slice(),standardFontDataUrl:fontUrl})},result=await runDrawingRecount({state,target:drawing,pdfjs,run:{cancelled:false},progress(){}});
 assert.ok(captured.length>0);for(const template of captured)for(const key of ['data','ignore','count','width','height','anchorX','anchorY'])assert.deepEqual(template[key],expected[key],`cleaned ${key} must match independently authored no-pipe original`);
 assert.deepEqual(result.expected_marks,[{id:'reviewed',version:7}]);assert.deepEqual(state,before);assert.deepEqual(bytes,beforeBytes);
});

test('navigation during legacy filter preparation does not cache a permanent failed glyph',async()=>{
 const bytes=original(256),full=await reference(bytes),drawing={id:'source',digest:'a'.repeat(64)},other={id:'other',digest:'b'.repeat(64)},record={id:'selection',version:1,example:{drawing_id:drawing.id,digest:drawing.digest,page:1,bounds:[118,118,138,138],algorithm:'binary-elements-2',elements:{renderer:ELEMENT_RENDERER,ids:full.ids,excluded:[full.ids.at(-1)]}}},mark={id:'mark',drawing_id:drawing.id,page:1,example_id:record.id,origin:'automatic',included:1,x:128,y:128},state={drawings:[drawing,other],countExamples:[record],countMarks:[mark]},before=structuredClone(state);let contextValue={drawing,pageNumber:1,viewport:{},state},opens=0;
 const pdfjs={OPS,version,getDocument(options){const index=opens++,task=getDocument({...options,url:undefined,data:bytes.slice(),standardFontDataUrl:fontUrl});return{destroy:()=>task.destroy(),promise:task.promise.then(doc=>({getPage:async number=>{const page=await doc.getPage(number);if(index===1){const get=page.getOperatorList.bind(page);page.getOperatorList=(...args)=>{contextValue={...contextValue,drawing:other};return get(...args);};}return page;}}))};}};
 const canvases=[],ink=setupCountInk({context:()=>contextValue,pdfjs,onReady(){},createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});
 try{await ink.prepare();assert.equal(contextValue.drawing.id,other.id);contextValue={...contextValue,drawing};await ink.prepare();assert.ok(ink.get(mark),'revisiting source must retry cancelled mapping and recover original cleaned glyph');assert.equal(opens,3);assert.deepEqual(state,before);}finally{for(const c of canvases)c.width=c.height=0;}
});
