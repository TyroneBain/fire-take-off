import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {contourQaFixture,quantizedContourQaFixture,contourPipeContextQaFixture,contourWindingQaFixture} from '../scripts/vector-contours-qa-fixture.mjs';
import {extractVectorPage} from '../apps/local/web/vector-recognition.mjs';
import {createContourTemplate,findContourCandidates} from '../apps/local/web/vector-contours.mjs';

async function fixture(t){
 const f=contourQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());
 const doc=await task.promise,pages=[],vectors=[];for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i);pages.push(p);vectors.push(extractVectorPage({operatorList:await p.getOperatorList(),OPS}));}
 return {...f,pages,vectors,template:createContourTemplate(vectors[0],{bounds:f.manifest.selection,anchor:f.manifest.anchor})};
}
const at=(hits,p)=>hits.find(h=>Math.hypot(h.x-p.x,h.y-p.y)<=.25);
function score(hits,manifest){const used=new Set(),matched=[],falsePositives=[];for(const h of hits){const p=manifest.labels.find(p=>p.page===1&&!used.has(p.id)&&Math.hypot(h.x-p.x,h.y-p.y)<=.25);if(p){used.add(p.id);matched.push(p.id);}else falsePositives.push(h);}return {TP:matched.length,FP:falsePositives.length,FN:manifest.labels.length-matched.length,matched,missed:manifest.labels.filter(p=>!used.has(p.id)).map(p=>p.id),falsePositives};}

test('independent actual-PDF contour proposals retain detail and report synthetic recall including unsupported pages',async t=>{
 const f=await fixture(t);assert.ok(f.template.supported,f.template.reason);const before=structuredClone(f.vectors),start=performance.now(),hits=findContourCandidates(f.vectors[0],f.template),ms=performance.now()-start,report=score(hits,f.manifest);
 // Exact re-encoding must work. Approximate CAD/tessellation and grouping cases
 // remain labelled positives in the denominator whether or not implemented.
 for(const id of ['source','collinear-subdivision','reversed-walk','changed-start','quarter-turn'])assert.ok(at(hits,f.manifest.labels.find(p=>p.id===id)),id+' lost');
 assert.equal(report.FP,0,'semantic negatives cannot become geometry proposals');
 for(const h of hits){assert.equal(h.requiresRenderVerification,true);assert.equal('score' in h,false);assert.equal(h.wholeOperations,true);assert.deepEqual(h.provenance.map(p=>p.elementId).sort((a,b)=>a-b),[...h.elementIds].sort((a,b)=>a-b));for(const p of h.provenance){const e=f.vectors[0].elements.find(e=>e.id===p.elementId);assert.deepEqual(p.segmentIndices,e.segments.map((_,i)=>i));}}
 assert.deepEqual(f.vectors,before);assert.deepEqual(findContourCandidates(f.vectors[0],f.template),hits,'repeat must preserve exact anchors and provenance');
 assert.equal(f.vectors[1].supported,false);assert.throws(()=>findContourCandidates(f.vectors[1],f.template));
 t.diagnostic(JSON.stringify({fixture:f.manifest.id,sha256:f.manifest.sha256,geometryProposals:report,ms,acceptedCount:null,scope:'Synthetic original actual PDF, unsupported positive retained in recall; no product accuracy or visibility acceptance claim'}));
});

test('independent contour cancellation and budget failure are atomic and preserve source identity',async t=>{
 const f=await fixture(t),before=structuredClone(f.template);assert.throws(()=>findContourCandidates(f.vectors[0],f.template,{maxComparisons:1}),e=>/budget/i.test(e.message));assert.throws(()=>findContourCandidates(f.vectors[0],f.template,{cancelled:()=>true}),e=>/cancel/i.test(e.message));assert.deepEqual(f.template,before);
 const noTurns=findContourCandidates(f.vectors[0],f.template,{rotations:false});assert.equal(at(noTurns,f.manifest.labels.find(p=>p.id==='quarter-turn')),undefined);
 const anchor=[39.6,50.2],template=createContourTemplate(f.vectors[0],{bounds:f.manifest.selection,anchor}),hits=findContourCandidates(f.vectors[0],template),turn=f.manifest.labels.find(p=>p.id==='quarter-turn');assert.ok(hits.some(h=>Math.hypot(h.x-(turn.x-.2),h.y-(turn.y-.4))<1e-5),'preserve transformed original anchor instead of recentering');
});

async function render(page,x,y){const v=page.getViewport({scale:8,rotation:0}),[left,top]=v.convertToViewportPoint(x-8,y+8),canvas=createCanvas(128,128),ctx=canvas.getContext('2d');try{await page.render({canvas,canvasContext:ctx,viewport:v.clone({offsetX:-left,offsetY:-top})}).promise;return ctx.getImageData(0,0,128,128).data;}finally{canvas.width=canvas.height=0;}}
test('independent original-PDF raster evidence distinguishes equivalent retessellation from hidden and shifted detail',async t=>{
 const f=await fixture(t),source=f.manifest.labels[0],a=await render(f.pages[0],source.x,source.y),report=[];
 for(const id of ['collinear-subdivision','circle-64-segments','shifted-centre','white-overpaint-centre','wrong-fill','wrong-stroke-width']){const p=[...f.manifest.labels,...f.manifest.negatives].find(p=>p.id===id),b=await render(f.pages[p.page-1],p.x,p.y);let changed=0,lostBlack=0,addedBlack=0;for(let i=0;i<a.length;i+=4){if([0,1,2].some(k=>a[i+k]!==b[i+k]))changed++;if(a[i]===0&&b[i]===255)lostBlack++;if(a[i]===255&&b[i]===0)addedBlack++;}report.push({id,changed,lostBlack,addedBlack});if(id==='collinear-subdivision')assert.equal(lostBlack,0);if(id==='shifted-centre'||id==='white-overpaint-centre')assert.ok(lostBlack>0,id);if(id==='wrong-stroke-width')assert.ok(addedBlack>0);}
 t.diagnostic(JSON.stringify({renderer:'Node @napi-rs/canvas; actual Chrome separately required',scale:8,comparisons:report}));
});

test('independent same continuous glyph under global CAD phase quantization distinguishes noise from class changes',async t=>{
 const f=quantizedContourQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),v=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),template=createContourTemplate(v,{bounds:f.manifest.selection,anchor:f.manifest.anchor});assert.ok(template.supported,template.reason);
 const start=performance.now(),hits=findContourCandidates(v,template),elapsedMs=performance.now()-start,near=(h,p)=>Math.hypot(h.x-p.x,h.y-p.y)<=f.manifest.anchorScoringTolerance,sensitivityHits=hits.filter(h=>f.manifest.sensitivity.some(p=>near(h,p))),scored=hits.filter(h=>!sensitivityHits.includes(h)),used=new Set(),falsePositives=[];
 for(const h of scored){const p=f.manifest.labels.find(p=>!used.has(p.id)&&near(h,p));if(p)used.add(p.id);else falsePositives.push(h);}
 assert.ok(used.has('global-grid-phase-0'),'exact source must remain a proposal');assert.equal(falsePositives.length,0,'class-changing details outside the rounding bound must not be admitted');
 t.diagnostic(JSON.stringify({fixture:f.manifest.id,sha256:f.manifest.sha256,TP:used.size,FP:falsePositives.length,FN:f.manifest.labels.length-used.size,matched:[...used],missed:f.manifest.labels.filter(p=>!used.has(p.id)).map(p=>p.id),sensitivityHits,elapsedMs,policy:f.manifest.policy,scope:'Synthetic geometric proposal coverage only; sensitivity control excluded from accuracy claim'}));
 const gridStart=performance.now(),gridHits=findContourCandidates(v,template,{knownGrid:f.manifest.grid}),gridMs=performance.now()-gridStart,gridSensitivity=gridHits.filter(h=>f.manifest.sensitivity.some(p=>near(h,p))),gridUsed=new Set(),gridFP=[];
 for(const h of gridHits.filter(h=>!gridSensitivity.includes(h))){const p=f.manifest.labels.find(p=>!gridUsed.has(p.id)&&near(h,p));if(p)gridUsed.add(p.id);else gridFP.push(h);}
 assert.equal(gridUsed.size,f.manifest.labels.length,'a declared whole-symbol grid policy must recover all unchanged positive glyphs');assert.deepEqual(gridFP,[],'large class-changing detail cannot be dismissed as CAD noise');assert.deepEqual(findContourCandidates(v,template),hits,'opt-in must not change defaults or mutate source');
 for(const h of gridHits){assert.equal(h.requiresRenderVerification,true);assert.equal('score' in h,false);}
 t.diagnostic(JSON.stringify({policy:'opt-in knownGrid',grid:f.manifest.grid,TP:gridUsed.size,FP:gridFP.length,FN:f.manifest.labels.length-gridUsed.size,sensitivityHits:gridSensitivity,gridMs,acceptedDetections:null}));
});

test('independent explicitly erased pipe permits changing exterior context without discarding internal detail or partial operations',async t=>{
 const f=contourPipeContextQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),v=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),b=f.manifest.selection,ids=v.elements.filter(e=>e.bounds[0]<=b[2]&&e.bounds[2]>=b[0]&&e.bounds[1]<=b[3]&&e.bounds[3]>=b[1]).map(e=>e.id),excluded=v.elements.filter(e=>e.bounds.every((n,i)=>Math.abs(n-f.manifest.sourceExcludedBounds[i])<1e-6)).map(e=>e.id);
 assert.equal(ids.length,3);assert.equal(excluded.length,1);const template=createContourTemplate(v,{bounds:b,anchor:f.manifest.anchor,ids,excluded});assert.ok(template.supported,template.reason);
 const strict=findContourCandidates(v,template),before=structuredClone(v),start=performance.now(),hits=findContourCandidates(v,template,{excludedContext:'straight-exterior'}),ms=performance.now()-start;
 for(const p of f.manifest.labels)assert.ok(at(hits,p),'authorized context lost: '+p.id);
 for(const p of [...f.manifest.semanticNegatives,...f.manifest.policyNegatives])assert.equal(at(hits,p),undefined,'unsafe context or wrong symbol proposed: '+p.id);
 assert.equal(hits.length,f.manifest.labels.length);assert.deepEqual(findContourCandidates(v,template),strict,'default must remain exact');assert.deepEqual(v,before);
 for(const h of hits){assert.equal(h.requiresRenderVerification,true);assert.equal('score' in h,false);for(const c of h.contextExclusions||[]){assert.ok(excluded.includes(c.sourceExcludedElementId));const e=v.elements.find(e=>e.id===c.elementId);assert.deepEqual(c.segmentIndices,e.segments.map((_,i)=>i),'context may only exclude an entire paint operation');assert.ok(!h.elementIds.includes(c.elementId),'context pipe must not be returned as glyph paint');}}
 const unapproved=createContourTemplate(v,{bounds:b,anchor:f.manifest.anchor,ids:ids.filter(id=>!excluded.includes(id)),excluded:[]});assert.ok(unapproved.supported,unapproved.reason);assert.equal(findContourCandidates(v,unapproved,{excludedContext:'straight-exterior'}).length,0,'opt-in cannot invent permission to erase a pipe absent explicit source exclusion');
 assert.throws(()=>findContourCandidates(v,template,{excludedContext:'straight-exterior',cancelled:()=>true}),e=>/cancel/i.test(e.message));
 t.diagnostic(JSON.stringify({fixture:f.manifest.id,sha256:f.manifest.sha256,strictProposals:strict.length,authorizedContextCoverage:{TP:hits.length,FP:0,FN:f.manifest.labels.length-hits.length},totalGlyphChallenges:{TP:hits.length,FP:0,FN:f.manifest.labels.length+f.manifest.policyNegatives.length-hits.length},policyRefusals:f.manifest.policyNegatives.map(p=>p.id),semanticNegativesRejected:f.manifest.semanticNegatives.length,ms,acceptedDetections:null,scope:'Synthetic opt-in exclusion safety and geometric proposals; four refused contexts still contain true glyphs and remain in total recall denominator'}));
});

test('independent actual PDF proves equal boundary segments can have unequal winding ink and must fail closed',async t=>{
 const f=contourWindingQaFixture(),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),v=extractVectorPage({operatorList:await page.getOperatorList(),OPS});assert.ok(v.supported,v.reason);assert.equal(v.elements.length,2);
 const canonical=(e,p)=>e.segments.map(s=>{assert.equal(s[0],1);const a=[s[1]-p.x,s[2]-p.y],b=[s[3]-p.x,s[4]-p.y];return [a,b].map(JSON.stringify).sort().join('|');}).sort();assert.deepEqual(canonical(v.elements[0],f.manifest.source),canonical(v.elements[1],f.manifest.negative),'two distinct filled regions have exactly equal undirected boundary-segment multisets');
 const a=await render(page,f.manifest.source.x,f.manifest.source.y),b=await render(page,f.manifest.negative.x,f.manifest.negative.y);let lostBlack=0;for(let i=0;i<a.length;i+=4)if(a[i]===0&&b[i]===255)lostBlack++;assert.ok(lostBlack>0,'opposite winding removes visible interior even when boundaries match');
 for(const p of [f.manifest.source,f.manifest.negative]){const template=createContourTemplate(v,{bounds:[p.x-8,p.y-8,p.x+8,p.y+8],anchor:[p.x,p.y]});assert.equal(template.supported,false,'nonsimple fill cannot supply a safe geometry template');assert.match(template.reason,/simple|fill|topolog/i);}
 t.diagnostic(JSON.stringify({fixture:f.manifest.id,sha256:f.manifest.sha256,equalUndirectedSegments:true,fullyBlackPixelsLost:lostBlack,bothNonsimpleTemplatesRejected:true,renderer:'Node actual-PDF raster; Chrome separately required'}));
});
