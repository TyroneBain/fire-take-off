import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';

function pdf(content){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 180 60] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let out='%PDF-1.4\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=Buffer.byteLength(out);out+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return new Uint8Array(Buffer.from(out));}
function glyph(x,{collapsed=false,opposite=false,rotate=false,paint='B',width=0,quad=false}={}){
 const base=opposite?.06:0,tip=collapsed||opposite?0:.06;
 return`q ${rotate?'0 1 -1 0':'1 0 0 1'} ${x} 24 cm .2 w -4 -4 8 8 re S ${width} w -1 -1 m 1 -1 l 0 1 l h -.3 ${base} m .3 ${base} l ${quad?`.15 ${tip} l`:''} 0 ${tip} l h ${paint} Q`;
}
async function input(t,options={}){const task=getDocument({data:pdf([glyph(24,options),glyph(60,{...options,collapsed:true}),glyph(96,{...options,collapsed:true,rotate:true}),glyph(132,{...options,opposite:true})].join('\n')),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),vector=extractVectorPage({operatorList:await page.getOperatorList(),OPS});assert.equal(vector.supported,true,vector.reason);const template=createVectorTemplate(vector,{bounds:[18,18,30,30],anchor:[24.3,24.2],ids:vector.elements.slice(0,2).map(e=>e.id)});assert.equal(template.supported,true,template.reason);return{doc,page,vector,template};}

test('closed hairline fill triangles retain whole operations through collapse and quarter turn with original paint proof',async t=>{
 const{doc,page,vector,template}=await input(t),before=structuredClone({vector,template}),hits=findVectorMatches(vector,template);
 assert.equal(hits.length,3);assert.deepEqual([...hits].sort((a,b)=>a.x-b.x).map(h=>h.rotation),[0,0,90]);assert.ok(hits.every(h=>h.elementIds.length===2));assert.deepEqual({vector,template},before);
 const config=await doc.getOptionalContentConfig(),prepared=[];for(const h of hits)prepared.push(await preparePdfContourPaints({page,OPS,elementIds:h.elementIds,optionalContentConfig:config}));
 for(const handle of prepared){assert.equal(handle.supported,true,handle.reason);const proof=await verifyPdfContourPaints({prepared:handle,createCanvas,pdfjsVersion});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.diagnostics.mismatchedPixels,0);}
});

test('opposite nonzero triangle winding remains distinct despite coordinate-compatible thin geometry',async t=>{
 const{vector,template}=await input(t),hits=findVectorMatches(vector,template);assert.equal(hits.some(h=>h.x>120),false);
 // Reverse direction of comparison: a collapsed source also retains each full
 // operation and permits either nonzero direction only within existing coords.
 const collapsed=createVectorTemplate(vector,{bounds:[54,18,66,30],anchor:[60.3,24.2],ids:vector.elements.slice(2,4).map(e=>e.id)});
 const reverse=findVectorMatches(vector,collapsed);assert.ok(reverse.some(h=>h.x<30));
 assert.throws(()=>findVectorMatches(vector,template,{maxComparisons:1}),/budget/);assert.throws(()=>findVectorMatches(vector,template,{cancelled:()=>true}),/cancel/);
});

test('fill-only, positive-width strokes and quadrilateral subpaths retain strict collapse winding',async t=>{
 for(const options of [{paint:'f'},{width:.2},{quad:true}]){const{vector,template}=await input(t,options),hits=findVectorMatches(vector,template);assert.equal(hits.length,1,JSON.stringify(options));assert.deepEqual(hits[0].elementIds,template.elements.map(e=>e.id));}
});

test('eligible triangle family preserves an existing quarter-turn anchor through the extra collapse pass',async t=>{
 const glyph=(x,rotation)=>`q ${rotation?'0 1 -1 0':'1 0 0 1'} ${x} 24 cm .2 w -4 -4 8 8 re S 0 w .026 .026 m .034 .026 l .03 .034 l h .026 .03 m .034 .03 l .03 .03 l h B Q`;
 const task=getDocument({data:pdf(glyph(24,false)+' '+glyph(80,true)),isEvalSupported:false});t.after(()=>task.destroy());const vector=extractVectorPage({operatorList:await(await(await task.promise).getPage(1)).getOperatorList(),OPS});assert.equal(vector.supported,true);
 const template=createVectorTemplate(vector,{bounds:[18,18,30,30],anchor:[24.7,24.4],ids:vector.elements.slice(0,2).map(e=>e.id)}),fixed=findVectorMatches(vector,template,{rotations:false}),hits=findVectorMatches(vector,template);
 assert.equal(fixed.length,1);assert.equal(hits.length,2);
 const target=hits.find(h=>h.x>50);assert.equal(target.rotation,90);assert.ok(Math.abs(target.x-79.6)<1e-6);assert.ok(Math.abs(target.y-24.7)<1e-6);assert.deepEqual(target.elementIds,vector.elements.slice(2).map(e=>e.id));
});
