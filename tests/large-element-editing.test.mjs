import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inspectPdfElements,elementAt,editedTemplate,ELEMENT_RENDERER,validElementSelection} from '../apps/local/web/pdf-elements.mjs';
import {inkImage} from '../apps/local/web/matcher.mjs';
import {matchRequestResult} from '../apps/local/web/match-worker.mjs';
import {renderMatchSelection,tiledMatchPage,searchMatchTiles} from '../apps/local/web/pdf-match-tiles.mjs';

// Original literal geometry, fixed native labels and adversarial drawing order.
// This fixture contains no customer/competitor content.
function pdf(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1684 2384] /Rotate 90 /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let data='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${o}\nendobj\n`;}const at=Buffer.byteLength(data);data+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;return new Uint8Array(Buffer.from(data));
}
async function pageFor(t,content){const task=getDocument({data:pdf(content),isEvalSupported:false});t.after(()=>task.destroy());return(await task.promise).getPage(1);}
const bounds=[732,1188,756,1212],labels=[[744,1200],[1000,1200],[744,1600]],glyph=(x,y)=>`q 1 0 0 1 ${x} ${y} cm 0 g 0 G 1 w -8 -8 16 16 re S -2 -2 4 4 re f .5 w -30 0 m 30 0 l S Q`,drawing=`q 0 0 1684 2384 re W n ${labels.map(p=>glyph(...p)).join('\n')} Q`;

test('A1 clipped path editor preserves operation IDs, native anchor and exact source pixels; cleaned source counts three owned symbols',async t=>{
 const page=await pageFor(t,drawing),allocations=[],factory=(w,h)=>{assert.ok(w*h<=1000000);const c=createCanvas(w,h);allocations.push(c);return c;},model=await inspectPdfElements({page,OPS,bounds,createCanvas:factory});
 assert.equal(model.elements.length,3);assert.deepEqual(model.anchor,[24,24]);assert.deepEqual(model.viewport.convertToPdfPoint(model.box[0]+model.anchor[0],model.box[1]+model.anchor[1]),labels[0]);
 const ids=model.elements.map(e=>e.id),pipe=ids.at(-1),selection={renderer:ELEMENT_RENDERER,ids,excluded:[pipe]};assert.ok(validElementSelection(selection));assert.equal(elementAt(model.elements,2,24,48,48),pipe);
 const original=await model.render(),clean=await model.render([pipe]),restored=await model.render();assert.deepEqual(restored.data,original.data);assert.notDeepEqual(clean.data,original.data);assert.ok(allocations.every(c=>c.width<=1&&c.height<=1));
 const reference=await renderMatchSelection({page,viewport:page.getViewport({scale:2,rotation:0}),bounds,createCanvas}),point=reference.viewport.convertToViewportPoint(bounds[0],bounds[3]),referenceCrop=new Uint8ClampedArray(48*48*4);for(let y=0;y<48;y++)for(let x=0;x<48;x++){const p=((Math.round(point[1])+y)*reference.width+Math.round(point[0])+x)*4;referenceCrop.set(reference.data.subarray(p,p+4),(y*48+x)*4);}assert.deepEqual(original.data,referenceCrop);
 const template={...editedTemplate(inkImage(original.data,48,48),inkImage(clean.data,48,48),[0,0,48,48]),matchRotations:true,matchThreshold:.95},raster=tiledMatchPage({page,viewport:model.viewport,createCanvas}),hits=await searchMatchTiles({raster,template,search:async(r,template)=>matchRequestResult({rgba:r.data,width:r.width,height:r.height,template}).matches});assert.deepEqual(hits.map(h=>[h.x,h.y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),labels);
 const second=await inspectPdfElements({page,OPS,bounds:[988,1188,1012,1212],createCanvas:factory});assert.equal(second.elements.length,3);assert.deepEqual(second.viewport.convertToPdfPoint(second.box[0]+second.anchor[0],second.box[1]+second.anchor[1]),labels[1]);
 await assert.rejects(model.render([0]),/Invalid excluded/);
});

test('large editor retains structural clipping and rejects combined clip-and-paint without exposing clipped paths',async t=>{
 const page=await pageFor(t,'q 736 1190 16 20 re W n 0 g 730 1194 30 12 re f Q'),model=await inspectPdfElements({page,OPS,bounds,createCanvas});assert.equal(model.elements.length,1);
 for(let y=0;y<model.height;y++)for(let x=0;x<model.width;x++)if(x<8||x>=40)assert.equal(model.elements[0].ink[y*model.width+x],0);
 const unsafe=await pageFor(t,'q 736 1190 16 20 re W S 0 g 730 1194 30 12 re f Q');await assert.rejects(inspectPdfElements({page:unsafe,OPS,bounds,createCanvas}),/combined clipping/);
});

test('opaque overpaint and coincident hidden paths cannot become editable; partial hidden regions are not hit targets',async t=>{
 for(const cover of ['1 g','1 0 0 rg']){const page=await pageFor(t,`0 g 734 1196 20 4 re f ${cover} 732 1194 24 8 re f 0 g 734 1196 20 4 re f`);await assert.rejects(inspectPdfElements({page,OPS,bounds,createCanvas}),/hidden|redundant|obscured/);}
 const partial=await pageFor(t,'0 g 734 1196 20 4 re f 1 g 744 1194 12 8 re f 0 g 744 1196 10 4 re f'),model=await inspectPdfElements({page:partial,OPS,bounds,createCanvas});assert.equal(model.elements.length,2);
 const left=model.elements[0],right=model.elements[1],x=32,y=28;assert.equal(left.ink[y*48+x],0);assert.equal(elementAt(model.elements,x,y,48,48),right.id);
 const removed=await model.render([right.id]);assert.equal(inkImage(removed.data,48,48).data[y*48+x],0,'white overpaint must remain when the later black path is removed');
});

test('unknown or cancelled bbox provenance, cancellation, oversize selection and element count fail closed',async t=>{
 const unknown=await pageFor(t,drawing),canvas=createCanvas(32,32);await unknown.render({canvas,canvasContext:canvas.getContext('2d'),viewport:unknown.getViewport({scale:2,rotation:0}),recordOperations:true}).promise;await assert.rejects(inspectPdfElements({page:unknown,OPS,bounds,createCanvas}),/another or incomplete render/);
 const cancelled=await pageFor(t,drawing);await assert.rejects(inspectPdfElements({page:cancelled,OPS,bounds,createCanvas,cancelled:()=>true}),/cancelled/);
 await assert.rejects(inspectPdfElements({page:cancelled,OPS,bounds:[700,1100,900,1300],createCanvas}),/128 PDF/);
 const many=await pageFor(t,Array.from({length:129},(_,i)=>`${i%2?'1 0 0 rg':'0 g'} 740 1196 4 4 re f`).join('\n'));await assert.rejects(inspectPdfElements({page:many,OPS,bounds,createCanvas}),/too many elements/);
 const interrupted=await pageFor(t,drawing),originalRender=interrupted.render.bind(interrupted);interrupted.render=options=>{const task=originalRender(options);if(options.recordOperations)task.onContinue=()=>task.cancel();return task;};await assert.rejects(inspectPdfElements({page:interrupted,OPS,bounds,createCanvas}),/cancelled/i);interrupted.render=originalRender;assert.ok(interrupted.recordedBBoxes,'PDF.js records incomplete bounds even when rendering is cancelled');await assert.rejects(inspectPdfElements({page:interrupted,OPS,bounds,createCanvas}),/another or incomplete render/);
});
