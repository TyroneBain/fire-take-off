import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {extractRawPathProvenance} from '../apps/local/web/vector-paint-provenance.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';

// Original geometry, including same-edge winding/grouping counterexamples.
function pdf(content){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 80] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let data='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${o}\nendobj\n`;});const at=Buffer.byteLength(data);data+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`;return new Uint8Array(Buffer.from(data));}
async function fixture(t,content){const task=getDocument({data:pdf(content),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),operatorList=await page.getOperatorList(),ids=operatorList.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]);return {doc,page,operatorList,ids};}
const outer='-8 -8 m 8 -8 l 8 8 l -8 8 l h',hole='-3 -3 m -3 3 l 3 3 l 3 -3 l h',solid='-3 -3 m 3 -3 l 3 3 l -3 3 l h';
const place=(x,paths,{matrix='1 0 0 1',paint='b'}={})=>`q ${matrix} ${x} 24.25 cm 0 g 0 G 0 w ${paths} ${paint} Q`;

test('closed compound commands retain original operation identity, hole winding and exact original proof through poses',async t=>{
 const f=await fixture(t,[place(24.25,outer+' '+hole),place(64.25,outer+' '+hole,{matrix:'0 1 -1 0'}),place(104.25,outer+' '+hole,{matrix:'1.25 0 0 1.25'}),place(144.25,outer+' '+solid),place(184.25,outer+' '+hole,{paint:'b*'})].join('\n')),before=structuredClone(f.operatorList),vector=extractVectorPage({operatorList:f.operatorList,OPS});
 assert.equal(vector.supported,true,vector.reason);assert.ok(vector.elements.every(e=>e.orderedCompound===true));assert.deepEqual(vector.elements.map(e=>e.id),f.ids);
 const template=createVectorTemplate(vector,{bounds:[14,14,35,35],anchor:[24.25,24.25],ids:[f.ids[0]],excluded:[]}),hits=findVectorMatches(vector,template,{scaleRange:[.75,1.5]});assert.deepEqual(hits.map(h=>[h.x,h.y,h.rotation,h.scale]),[[24.25,24.25,0,1],[64.25,24.25,90,1],[104.25,24.25,0,1.25]]);
 const raw=extractRawPathProvenance({operatorList:f.operatorList,OPS,ids:f.ids});assert.equal(raw.requestedComplete,true);raw.records.forEach(r=>assert.deepEqual(r.sourceCommands,Array.from(before.argsArray[r.id][1][0])));assert.deepEqual(f.operatorList,before);
 const optionalContentConfig=await f.doc.getOptionalContentConfig(),handles=[];for(const hit of hits)handles.push(await preparePdfContourPaints({page:f.page,OPS,elementIds:hit.elementIds,optionalContentConfig}));
 for(const prepared of handles){assert.equal(prepared.supported,true,prepared.reason);const proof=await verifyPdfContourPaints({prepared,createCanvas,pdfjsVersion});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.diagnostics.mismatchedPixels,0);}
 const v=f.page.getViewport({scale:2}),canvas=createCanvas(v.width,v.height),ctx=canvas.getContext('2d');try{await f.page.render({canvas,canvasContext:ctx,viewport:v}).promise;const sample=x=>{const [px,py]=v.convertToViewportPoint(x,24.25);return ctx.getImageData(Math.floor(px),Math.floor(py),1,1).data[0];};assert.equal(sample(24.25),255,'opposing winding leaves the source hole empty');assert.equal(sample(144.25),0,'same directed edge inventory with reversed inner winding fills the hole');}finally{canvas.width=canvas.height=0;}
});

test('same undirected edges with different subpath grouping cannot use unordered segment matching',async t=>{
 const separate='0 0 m 8 0 l 8 8 l 0 8 l h 0 0 m -8 0 l -8 -8 l 0 -8 l h',joined='0 0 m 8 0 l 8 8 l 0 8 l 0 0 l -8 0 l -8 -8 l 0 -8 l h',f=await fixture(t,place(24.25,separate)+' '+place(64.25,joined)),v=extractVectorPage({operatorList:f.operatorList,OPS});assert.equal(v.supported,true);
 const localEdges=e=>e.segments.map(s=>{const p=[[s[1]-(e.id===f.ids[0]?24.25:64.25),s[2]-24.25],[s[3]-(e.id===f.ids[0]?24.25:64.25),s[4]-24.25]].map(p=>p.join(',')).sort();return p.join('|');}).sort();assert.deepEqual(localEdges(v.elements[0]),localEdges(v.elements[1]));
 const template=createVectorTemplate(v,{bounds:[14,14,35,35],anchor:[24.25,24.25],ids:[f.ids[0]],excluded:[]});assert.deepEqual(findVectorMatches(v,template).map(h=>h.elementIds),[[f.ids[0]]]);
 assert.throws(()=>findVectorMatches(v,template,{maxComparisons:1}),/budget/);assert.throws(()=>findVectorMatches(v,template,{cancelled:()=>true}),/cancelled/);
});

test('zero-area closed stroked subpath and repeated close commands are retained in full',async t=>{
 const paths='-4 -4 m 4 -4 l -4 4 l h -4 -4 m 0 -4 l -2 -4 l h h',f=await fixture(t,place(24.25,paths)+' '+place(64.25,paths,{matrix:'0 1 -1 0'})),v=extractVectorPage({operatorList:f.operatorList,OPS});assert.equal(v.supported,true);assert.equal(v.elements[0].segments.length,6);assert.equal(v.elements[0].pathCommands.filter(n=>n===4).length>=3,true);
 const raw=extractRawPathProvenance({operatorList:f.operatorList,OPS,ids:f.ids});assert.equal(raw.requestedComplete,true);assert.equal(raw.records[0].sourceCommands.length,22,'three h commands plus original final b closure are not normalized away');
 const template=createVectorTemplate(v,{bounds:[14,14,35,35],anchor:[24.25,24.25],ids:[f.ids[0]],excluded:[]}),hits=findVectorMatches(v,template);assert.deepEqual(hits.map(h=>h.rotation),[0,90]);const config=await f.doc.getOptionalContentConfig(),prepared=[];for(const h of hits)prepared.push(await preparePdfContourPaints({page:f.page,OPS,elementIds:h.elementIds,optionalContentConfig:config}));for(const handle of prepared){const proof=await verifyPdfContourPaints({prepared:handle,createCanvas,pdfjsVersion});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.diagnostics.mismatchedPixels,0);}
});

test('open, curved or resumed-after-close compound subpaths still refuse instead of inventing stroke closures',async t=>{
 const cases=['0 0 m 8 0 l 8 8 l 2 2 m 4 2 l 4 4 l h','0 0 m 1 2 3 4 8 8 c h 2 2 m 4 2 l 4 4 l h','0 0 m 8 0 l 8 8 l h 0 8 l h 2 2 m 4 2 l 4 4 l h'];
 for(const paths of cases){const f=await fixture(t,place(24.25,paths)),v=extractVectorPage({operatorList:f.operatorList,OPS}),raw=extractRawPathProvenance({operatorList:f.operatorList,OPS,ids:f.ids});assert.equal(v.supported,false);assert.match(v.reason,/Open or curved compound/);assert.equal(raw.requestedComplete,false);assert.deepEqual(raw.records,[]);}
});
