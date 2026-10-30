import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {constituentQaFixture,quantizedConstituentFixture} from '../scripts/vector-constituents-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {createConstituentTemplate,findConstituentMatches} from '../apps/local/web/vector-constituents.mjs';

async function fixture(t){
 const f=constituentQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,pages=[],vectors=[];
 for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);pages.push(page);vectors.push(extractVectorPage({operatorList:await page.getOperatorList(),OPS}));}
 const source=vectors[0],b=f.manifest.selection,ids=source.elements.filter(e=>e.bounds[0]<=b[2]&&e.bounds[2]>=b[0]&&e.bounds[1]<=b[3]&&e.bounds[3]>=b[1]).map(e=>e.id),excluded=source.elements.filter(e=>f.manifest.excludedNativeBounds.some(bounds=>bounds.every((v,i)=>v===e.bounds[i]))).map(e=>e.id);
 assert.equal(ids.length,3);assert.equal(excluded.length,1);return {...f,pages,vectors,options:{bounds:b,ids,excluded,anchor:f.manifest.anchor}};
}
function score(hits,labels){const remaining=new Set(labels.map(p=>p.id)),fp=[];for(const hit of hits){const p=labels.find(p=>remaining.has(p.id)&&p.page===hit.page&&Math.hypot(p.x-hit.x,p.y-hit.y)<=.05);if(p)remaining.delete(p.id);else fp.push(hit);}return {TP:labels.length-remaining.size,FP:fp.length,FN:remaining.size,missed:[...remaining]};}

test('independent actual PDF constituent proposals improve split-paint coverage while retaining all declared misses and semantic negatives',async t=>{
 const f=await fixture(t),source=f.vectors[0],old=createVectorTemplate(source,f.options),template=createConstituentTemplate(source,f.options);assert.ok(old.supported);assert.ok(template.supported);
 const original=structuredClone(source),before=findVectorMatches(source,old,{rotations:true}).map(h=>({...h,page:1})),after=findConstituentMatches(source,template).map(h=>({...h,page:1})),baseline=score(before,f.manifest.labels),candidate=score(after,f.manifest.labels);
 assert.deepEqual([baseline.TP,baseline.FP,baseline.FN],[4,0,9]);assert.deepEqual([candidate.TP,candidate.FP,candidate.FN],[10,0,3]);
 assert.deepEqual(candidate.missed,['pipe-merged-in-ring-paint','different-crossing-pipe','clipped-positive']);
 for(const h of after){assert.equal(h.requiresRenderVerification,true);assert.equal(h.geometryScore,1);assert.equal('score' in h,false,'proposal must not masquerade as accepted worker hit');assert.equal(h.wholeOperations,true);assert.deepEqual(h.provenance.map(p=>p.elementId),h.elementIds);for(const p of h.provenance){const e=source.elements.find(e=>e.id===p.elementId);assert.deepEqual(p.segmentIndices,e.segments.map((_,i)=>i));}}
 assert.deepEqual(source,original,'matcher must not mutate extraction or source identities');
 assert.equal(f.vectors[1].supported,false);assert.match(f.vectors[1].reason,/clipping/);assert.throws(()=>findConstituentMatches(f.vectors[1],template),/supported source and target/);
 t.diagnostic(JSON.stringify({baseline,candidate,scope:'Original actual-PDF geometry proposals only; unsupported positive included in recall. No accepted detection, real-drawing or competitor accuracy claim.'}));
});

test('independent original anchor, explicit pipe exclusion and quarter-turn policy remain exact',async t=>{
 const f=await fixture(t),source=f.vectors[0],anchor=[69,71],template=createConstituentTemplate(source,{...f.options,anchor}),hits=findConstituentMatches(source,template),rotate=(x,y,a)=>a===90?[-y,x]:a===180?[-x,-y]:a===270?[y,-x]:[x,y];
 assert.equal(hits.length,10);
 for(const h of hits){const target=f.manifest.labels.find(p=>{const d=rotate(-1,1,p.rotation);return p.page===1&&Math.hypot(h.x-p.x-d[0],h.y-p.y-d[1])<1e-6;});assert.ok(target,'use transformed original anchor, never recompute a crop centre');}
 assert.equal(findConstituentMatches(source,template,{rotations:false}).length,5);
 const unsafe=createConstituentTemplate(source,{...f.options,excluded:[]});assert.equal(unsafe.supported,false,'a pipe cut by the selection cannot silently become source detail');
 assert.throws(()=>findConstituentMatches(source,template,{maxComparisons:1}),e=>e.code==='VECTOR_CONSTITUENTS_BUDGET');
 assert.throws(()=>findConstituentMatches(source,template,{cancelled:()=>true}),e=>e.code==='VECTOR_CONSTITUENTS_CANCELLED');
});

async function renderOperationCrop(page,ids,x,y,rotation=0){
 const viewport=page.getViewport({scale:4,rotation}),corners=[[x-14,y-14],[x+14,y-14],[x-14,y+14],[x+14,y+14]].map(p=>viewport.convertToViewportPoint(...p)),left=Math.min(...corners.map(p=>p[0])),top=Math.min(...corners.map(p=>p[1])),canvas=createCanvas(112,112),ctx=canvas.getContext('2d');
 try{await page.render({canvas,canvasContext:ctx,viewport:viewport.clone({offsetX:-left,offsetY:-top}),operationsFilter:(id,list)=>list.fnArray[id]!==OPS.constructPath||ids.includes(id)}).promise;return ctx.getImageData(0,0,112,112).data;}finally{canvas.width=canvas.height=0;}
}
test('independent actual rendering proves cap/join proposals need verification and grouping changes antialiasing',async t=>{
 const f=await fixture(t),main=createConstituentTemplate(f.vectors[0],f.options),hits=findConstituentMatches(f.vectors[0],main),seed=await renderOperationCrop(f.pages[0],f.options.ids.filter(id=>!f.options.excluded.includes(id)),70,70),split=hits.find(h=>h.x===230&&h.y===70),splitPixels=await renderOperationCrop(f.pages[0],split.elementIds,230,70);
 assert.notDeepEqual(splitPixels,seed,'equal stroke constituents across paint operations can have different edge antialiasing');
 const c=f.manifest.capJoinControl,source=createConstituentTemplate(f.vectors[2],{bounds:c.selection,anchor:c.anchor}),proposals=findConstituentMatches(f.vectors[2],source),original=proposals.find(h=>h.x===70&&h.y===70),negative=proposals.find(h=>h.x===150&&h.y===70);
 assert.ok(original);assert.ok(negative,'current candidate kernel intentionally leaves physical verification unresolved');assert.equal(negative.requiresRenderVerification,true);assert.equal('score' in negative,false);
 const full=await renderOperationCrop(f.pages[2],original.elementIds,70,70),butted=await renderOperationCrop(f.pages[2],negative.elementIds,150,70);let lostBlack=0;for(let i=0;i<full.length;i+=4)if(full[i]===0&&butted[i]===255)lostBlack++;
 assert.ok(lostBlack>0,'split butt-capped square loses fully black corner pixels; it is a negative, not mere antialias noise');
 t.diagnostic(JSON.stringify({capJoinNegativeProposed:true,fullyBlackPixelsMissing:lostBlack,automaticAcceptanceApproved:false}));
});

test('independent quantized-circle self and reordered equivalents survive explicit tolerance while default rejects shifted centre',async t=>{
 const f=quantizedConstituentFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());
 const page=await(await task.promise).getPage(1),vector=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),template=createConstituentTemplate(vector,{bounds:f.manifest.selection,anchor:f.manifest.anchor});
 assert.ok(template.supported);
 const summary=[];
 for(const tolerance of f.manifest.explicitToleranceChecks){
  const hits=findConstituentMatches(vector,template,{tolerance});
  for(const [x,y]of f.manifest.positiveAnchors)assert.ok(hits.some(h=>Math.hypot(h.x-x,h.y-y)<1e-6),`exact positive must survive tolerance ${tolerance}`);
  summary.push({tolerance,candidates:hits.length});
 }
 const defaults=findConstituentMatches(vector,template);assert.deepEqual(defaults.map(h=>[h.x,h.y]),f.manifest.positiveAnchors,'default stays .05; do not hide assignment failure by accepting shifted centre');
 t.diagnostic(JSON.stringify({quantizedSegments:f.manifest.polygonSegments,summary,defaultShiftedCentreRejected:true,scope:'Larger tolerances are diagnostic only; they can admit the declared shifted-centre negative and are not proposed defaults'}));
});
