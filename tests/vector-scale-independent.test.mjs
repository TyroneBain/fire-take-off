import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {vectorScaleQaFixture} from '../scripts/vector-scale-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches,VECTOR_SCALE_RANGE} from '../apps/local/web/vector-recognition.mjs';
import {benchmarkVectorPreview} from '../scripts/run-vector-preview-benchmark.mjs';
import {scoreInstances} from '../scripts/vector-qa-benchmark.mjs';

async function input(options={},anchor=[80,80]){
 const fixture=vectorScaleQaFixture(options),task=getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false});
 try{const document=await task.promise,page=extractVectorPage({operatorList:await(await document.getPage(1)).getOperatorList(),OPS}),template=createVectorTemplate(page,{bounds:fixture.manifest.selection,anchor,ids:[5,6,7,8,13],excluded:[13]});assert.ok(page.supported,page.reason);assert.ok(template.supported,template.reason);return {fixture,task,document,page,template};}catch(e){await task.destroy();throw e;}
}
function adjudicate(hits,labels,{offset=[0,0]}={}){
 const expected=labels.map(s=>{const angle=s.angle*Math.PI/180,c=Math.cos(angle),z=Math.sin(angle);return {...s,x:s.x+s.scale*(c*offset[0]-z*offset[1]),y:s.y+s.scale*(z*offset[0]+c*offset[1])};}),unused=new Set(expected.map(s=>s.id)),matched=[];let fp=0;
 for(const h of hits){const found=expected.find(s=>unused.has(s.id)&&Math.hypot(s.x-h.x,s.y-h.y)<.01);if(found){matched.push(found.id);unused.delete(found.id);}else fp++;}
 return {tp:matched.length,fp,fn:unused.size,precision:hits.length?matched.length/hits.length:null,recall:matched.length/expected.length,matched,missed:[...unused]};
}

test('independent scale corpus baseline retains exact-size policy and reports twelve scaled misses',async t=>{
 const q=await input();try{const start=performance.now(),hits=findVectorMatches(q.page,q.template),matchingMs=performance.now()-start,r=adjudicate(hits,q.fixture.manifest.labels);assert.deepEqual([r.tp,r.fp,r.fn],[4,0,12]);assert.equal(r.precision,1);assert.equal(r.recall,.25);assert.equal(new Set(hits.map(h=>`${h.x},${h.y}`)).size,hits.length);t.diagnostic(JSON.stringify({phase:'exact-size baseline',...r,matchingMs,fixtureSha256:q.fixture.manifest.sha256,scope:'Synthetic only;16positives6negatives'}));}finally{await q.task.destroy();}
});

test('independent nonuniform affine stroke fixture remains an explicit extraction fallback',async()=>{
 const q=await input();try{const other=extractVectorPage({operatorList:await(await q.document.getPage(2)).getOperatorList(),OPS});assert.equal(other.supported,false);assert.match(other.reason,/Nonuniform stroke/);}finally{await q.task.destroy();}
});

test('independent optional-scale matcher finds all sixteen uniform-scale targets and rejects six geometric/style distractors',async t=>{
 const q=await input();try{
  const start=performance.now(),hits=findVectorMatches(q.page,q.template,{scaleRange:VECTOR_SCALE_RANGE}),matchingMs=performance.now()-start,r=adjudicate(hits,q.fixture.manifest.labels);
  assert.deepEqual([r.tp,r.fp,r.fn],[16,0,0]);assert.equal(new Set(hits.map(h=>`${h.x},${h.y}`)).size,16);
  for(const s of q.fixture.manifest.labels){const h=hits.find(h=>Math.hypot(h.x-s.x,h.y-s.y)<.01);assert.ok(h,s.id);assert.equal(h.rotation,s.angle);assert.ok(Math.abs(h.scale-s.scale)<1e-5,s.id+' scale');assert.equal(h.elementIds.length,4,'crossing pipes must not become retained symbol paths');}
  for(const n of q.fixture.manifest.negatives)assert.ok(!hits.some(h=>Math.hypot(h.x-n.x,h.y-n.y)<1),n.id);
  t.diagnostic(JSON.stringify({phase:'optional uniform scale',...r,matchingMs,fixtureSha256:q.fixture.manifest.sha256,scope:'Synthetic16positives6negatives;notreal-drawingorcompetitoraccuracy'}));
 }finally{await q.task.destroy();}
});

test('independent uniform-scale thresholds include exact boundaries and report out-of-range positives as deliberate misses',async t=>{
 for(const extraScales of [[.75,1.5],[.74,1.51]]){
  const q=await input({extraScales});try{const hits=findVectorMatches(q.page,q.template,{scaleRange:VECTOR_SCALE_RANGE}),r=adjudicate(hits,q.fixture.manifest.labels),within=extraScales[0]===.75;assert.deepEqual([r.tp,r.fp,r.fn],within?[18,0,0]:[16,0,2]);
   if(!within)assert.deepEqual(r.missed,['boundary-0.74','boundary-1.51']);
   t.diagnostic(JSON.stringify({phase:within?'inclusive scale bounds':'outside configured scale range',...r,scaleRange:VECTOR_SCALE_RANGE}));
  }finally{await q.task.destroy();}
 }
});

test('independent scaled off-centre anchor remains the saved identity through every supported orientation',async()=>{
 const q=await input({},[81,82]);try{const hits=findVectorMatches(q.page,q.template,{scaleRange:VECTOR_SCALE_RANGE}),r=adjudicate(hits,q.fixture.manifest.labels,{offset:[1,2]});assert.deepEqual([r.tp,r.fp,r.fn],[16,0,0]);
  const known=hits.find(h=>Math.abs(h.x-(220-2*.8))<.01&&Math.abs(h.y-(180+.8))<.01);assert.ok(known,'0.8×90° anchor equals [218.4,180.8], not geometric centre');
  assert.throws(()=>findVectorMatches(q.page,q.template,{scaleRange:VECTOR_SCALE_RANGE,maxComparisons:1}),/budget/);
  assert.throws(()=>findVectorMatches(q.page,q.template,{scaleRange:VECTOR_SCALE_RANGE,cancelled:()=>true}),/cancelled/);
  for(const scaleRange of [[],[.75],[NaN,1.5],[.4,1.5],[1.1,1.5],[.75,3]])assert.throws(()=>findVectorMatches(q.page,q.template,{scaleRange}),/Invalid vector scale range/);
 }finally{await q.task.destroy();}
});

test('independent original four-page replay confirms optional scale gain without rewriting raw historical ground truth',async t=>{
 const fixed=await benchmarkVectorPreview(),scaled=await benchmarkVectorPreview({scales:true});
 assert.deepEqual([fixed.candidate.tp,fixed.candidate.fp,fixed.candidate.fn],[11,1,3]);
 assert.deepEqual([scaled.candidate.tp,scaled.candidate.fp,scaled.candidate.fn],[12,1,2]);
 assert.ok(!fixed.candidate.matched.includes('scaled-positive'));assert.ok(scaled.candidate.matched.includes('scaled-positive'));
 assert.deepEqual(scaled.candidate.missed,['oblique-positive','raster-only']);
 assert.deepEqual(scaled.fixture.labels,fixed.fixture.labels,'original recorded labels stay unchanged');
 const labels=[...scaled.fixture.labels,{id:'mirrored-equivalent-270',page:1,x:350,y:250}],adjudicated=scoreInstances(scaled.candidate.hits,labels);
 assert.deepEqual([adjudicated.tp,adjudicated.fp,adjudicated.fn],[13,0,2]);assert.equal(adjudicated.precision,1);assert.equal(adjudicated.recall,13/15);
 const perPage=[1,2,3,4].map(page=>scaled.candidate.hits.filter(h=>h.page===page).length);assert.deepEqual(perPage,[10,2,1,0]);
 t.diagnostic(JSON.stringify({fixture:'qa-vector-elements-v1',rawBefore:[11,1,3],rawAfter:[12,1,2],adjudicatedAfter:{tp:13,fp:0,fn:2,precision:1,recall:13/15},perPage,misses:adjudicated.missed,scope:'Synthetic source-instance oracle; equal aggregate quantities from another product would not prove equivalent detections or superiority'}));
});
