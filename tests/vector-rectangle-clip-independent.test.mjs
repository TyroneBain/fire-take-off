import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {rectangleClipQaFixture} from '../scripts/vector-contours-qa-fixture.mjs';
import {extractRawPathProvenance,RAW_REDUNDANT_CLIP_VERSION} from '../apps/local/web/vector-paint-provenance.mjs';

async function fixture(t){const f=rectangleClipQaFixture(),tasks=[f.bytes,f.unclippedBytes].map(bytes=>getDocument({data:new Uint8Array(bytes),isEvalSupported:false}));t.after(()=>Promise.all(tasks.map(t=>t.destroy())));const [doc,unclipped]=await Promise.all(tasks.map(t=>t.promise));return {...f,doc,unclipped};}
const idsOf=ops=>ops.fnArray.flatMap((op,id)=>op===OPS.constructPath&&ops.argsArray[id][0]!==OPS.endPath?[id]:[]);
async function render(page,scale=2){const viewport=page.getViewport({scale,rotation:0}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d',{willReadFrequently:true});try{await page.render({canvas,canvasContext:ctx,viewport}).promise;return ctx.getImageData(0,0,canvas.width,canvas.height).data;}finally{canvas.width=canvas.height=0;}}

test('independent original rectangle clips preserve full-paint provenance and refuse partial footprints',async t=>{
 const f=await fixture(t),results=[];
 for(const c of f.manifest.cases){const page=await f.doc.getPage(c.page),ops=await page.getOperatorList(),before=structuredClone(ops),ids=idsOf(ops),viewportTransform=Array.from(page.getViewport({scale:2,rotation:0}).transform),baseline=extractRawPathProvenance({operatorList:ops,OPS,ids}),raw=extractRawPathProvenance({operatorList:ops,OPS,ids,viewportTransform});
  assert.equal(baseline.requestedComplete,false,'no viewport means no implicit clip removal');assert.equal(raw.requestedComplete,c.admit,c.id+': '+JSON.stringify(raw.failures));assert.deepEqual(ops,before,'admission must not alter original commands');
  for(const r of raw.records){assert.ok(r.clipDepth>0);assert.equal(r.effectiveClipDepth,0);assert.ok(r.clipPathIds.length>0);assert.equal(r.clipRedundancyProof.version,RAW_REDUNDANT_CLIP_VERSION);assert.deepEqual(r.clipRedundancyProof.viewportTransform,viewportTransform);assert.equal(r.clipRedundancyProof.clips.length,r.clipPathIds.length);assert.equal(r.requiresRenderVerification,true);assert.equal('score' in r,false);}
  results.push({id:c.id,admitted:raw.requestedComplete,physicallyRedundant:c.physicallyRedundant,failures:raw.failures.map(p=>p.reason)});
 }
 t.diagnostic(JSON.stringify({fixture:f.manifest.id,sha256:f.manifest.sha256,results,scope:'Original synthetic source admission, not symbol-count accuracy. Unsupported redundant clip shapes remain explicit coverage limitations.'}));
});

test('independent actual-PDF paired oracle proves admitted rectangles remove no visible source ink',async t=>{
 const f=await fixture(t),rows=[];for(const c of f.manifest.cases){const [a,b]=await Promise.all([render(await f.doc.getPage(c.page)),render(await f.unclipped.getPage(c.page))]);let differences=0;for(let i=0;i<a.length;i+=4)if([0,1,2,3].some(k=>a[i+k]!==b[i+k]))differences++;assert.equal(differences===0,c.physicallyRedundant,c.id);rows.push({id:c.id,differentPixels:differences});}
 t.diagnostic(JSON.stringify({renderer:'Pinned PDF.js with Node readback canvas; actual Chrome separately required',rows}));
});

test('independent hairline clipping is viewport-bound and cannot reuse a higher-scale guard',async t=>{
 const f=await fixture(t),c=f.manifest.cases.find(c=>c.id==='hairline-device-pixel-guard'),page=await f.doc.getPage(c.page),ops=await page.getOperatorList(),ids=idsOf(ops),high=Array.from(page.getViewport({scale:2,rotation:0}).transform),low=Array.from(page.getViewport({scale:.25,rotation:0}).transform);
 assert.equal(extractRawPathProvenance({operatorList:ops,OPS,ids,viewportTransform:high}).requestedComplete,true);const refused=extractRawPathProvenance({operatorList:ops,OPS,ids,viewportTransform:low});assert.equal(refused.requestedComplete,false);assert.equal(refused.records.length,0);
 const nonuniform=[2,0,0,-1,0,340];assert.equal(extractRawPathProvenance({operatorList:ops,OPS,ids,viewportTransform:nonuniform}).requestedComplete,false);assert.equal(extractRawPathProvenance({operatorList:ops,OPS,ids,viewportTransform:high,cancelled:()=>true}).requestedComplete,false);
});
