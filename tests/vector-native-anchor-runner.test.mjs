import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {validVectorReview,VECTOR_SELECTED_REVIEW_VERSION,VECTOR_SELECTED_MATCH_POLICY} from '../apps/local/web/vector-review-policy.mjs';

function pdf(knockout=false){
 const c=`0 G 1 w 18 18 4 4 re S 78 18 4 4 re S ${knockout?'1 g 17 17 6 6 re f':''}`,objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 60] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`];
 let out='%PDF-1.4\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}const at=Buffer.byteLength(out);out+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`;return new Uint8Array(Buffer.from(out));
}
async function fixture(knockout=false){
 const data=pdf(knockout),digest=createHash('sha256').update(data).digest('hex'),drawing={id:'native-anchor-original',digest},inspect=getDocument({data:new Uint8Array(data),isEvalSupported:false});let id;
 try{const list=await(await(await inspect.promise).getPage(1)).getOperatorList();id=list.fnArray.findIndex(op=>op===OPS.constructPath);}finally{await inspect.destroy();}
 const events=[],canvases=[],renders=[],run={cancelled:false};let stage;
 const pdfjs={OPS,version,getDocument(options){const task=getDocument(options);events.push('open');return{promise:task.promise.then(doc=>{
  const getPage=doc.getPage.bind(doc);doc.getPage=async n=>{const page=await getPage(n),render=page.render.bind(page);page.render=options=>{renders.push(stage);return render(options);};return page;};
  return doc;
 }),destroy:async()=>{await task.destroy();events.push('destroy');}};}};
 const example={drawing_id:drawing.id,digest,page:1,bounds:[14,14,28,26],elements:{renderer:ELEMENT_RENDERER,ids:[id],excluded:[]}};
 const args={pdfjs,sourceDrawing:drawing,example,targets:[{drawing,page:1}],matchPolicy:VECTOR_SELECTED_MATCH_POLICY,sourceData:data,run,createCanvas(w,h){const c=createCanvas(w,h);canvases.push(c);return c;},progress:p=>{stage=p.stage;events.push(p.stage);}};
 return{args,events,canvases,renders,run};
}
function released(f){assert.equal(f.events.filter(e=>e==='open').length,f.events.filter(e=>e==='destroy').length);assert.ok(f.canvases.every(c=>!c.width&&!c.height));assert.equal(f.run.cancel,undefined);assert.equal(f.run.task,undefined);}
function metadata(report){
 const r=report.pages[0].result,verified=r.proposals.filter(p=>p.visibility.verified);
 return{version:VECTOR_SELECTED_REVIEW_VERSION,scope:'explicit-pages',decision:'apply',layerPolicy:'all-admitted',matchPolicy:VECTOR_SELECTED_MATCH_POLICY,sourceContextIds:[],anchor:[...report.source.anchor],pages:[{drawing_id:report.source.drawingId,page:1,digest:report.source.digest,layerScope:r.layerScope,provenance:{engine:'vector-pattern-review-3',visibility:'contour-paint-visibility-4',requestedPaints:r.coverage.requestedPaints,admittedPaints:r.coverage.admittedPaints,unknownCount:r.coverage.unknown.length,excludedCount:r.coverage.excluded.length,proposalCount:r.proposals.length,verifiedCount:verified.length,selectedCount:verified.length,pendingCount:0},decisions:verified.map(p=>({x:p.x,y:p.y,rotation:p.rotation,elementIds:p.elementIds,contextIds:[],included:true,reviewed:false}))}]};
}
const identities=report=>report.pages[0].result.proposals.map(({x,y,rotation,elementIds})=>({x,y,rotation,elementIds}));

test('new native draft uses exact bounds centre without a pixel-anchor document or render, while both paint proofs still run',async()=>{
 const f=await fixture(),sourceAnchor=[21,20],progress=f.args.progress;
 const report=await runSavedVectorPageSetReview({...f.args,example:{...f.args.example,algorithm:'new-vector-selection'},sourceAnchor,progress:p=>{progress(p);if(p.stage==='pattern-open')sourceAnchor[0]=999;}});
 assert.equal(report.completed,true);assert.deepEqual(report.source.anchor,[21,20]);assert.deepEqual(report.selection.anchor,[21,20]);
 assert.equal(f.events.includes('source-open'),false);assert.equal(f.events.includes('source-anchor'),false);assert.equal(f.events.filter(e=>e==='open').length,2);
 assert.ok(f.renders.includes('source-pattern'));assert.ok(f.renders.includes('target-page'));assert.ok(f.renders.every(s=>s!=='source-anchor'));
 assert.equal(report.pages[0].result.proposals.length,2);assert.ok(report.pages[0].result.proposals.every(p=>p.visibility.verified));released(f);
});

test('saved v4 reuses its original pixel-derived anchor exactly and cannot be overridden',async()=>{
 const old=await fixture(),legacy=await runSavedVectorPageSetReview(old.args);released(old);
 assert.ok(old.events.includes('source-anchor'));assert.notDeepEqual(legacy.source.anchor,[21,20]);
 const review=metadata(legacy);assert.equal(validVectorReview(review),true);
 const f=await fixture(),example={...f.args.example,id:'saved-native',algorithm:VECTOR_SELECTED_REVIEW_VERSION,vectorReview:review};
 const result=await runSavedVectorPageSetReview({...f.args,example});assert.deepEqual(result.source.anchor,legacy.source.anchor);assert.deepEqual(identities(result),identities(legacy));
 assert.equal(f.events.includes('source-anchor'),false);assert.equal(f.events.filter(e=>e==='open').length,2);released(f);
 const bad=await fixture();await assert.rejects(runSavedVectorPageSetReview({...bad.args,example,sourceAnchor:[21,20]}),/only valid for a new native draft/);assert.equal(bad.events.length,0);
 for(const change of [r=>{r.anchor=[999,999];},r=>{r.pages[0].digest='0'.repeat(64);},r=>{r.pages[0].page=2;}]){
  const altered=structuredClone(review);change(altered);await assert.rejects(runSavedVectorPageSetReview({...bad.args,example:{...example,vectorReview:altered}}),/anchor or review provenance/);
 }
 assert.equal(bad.events.length,0);
});

test('native draft and saved-anchor provenance reject malformed or changed inputs before opening PDFs',async()=>{
 const f=await fixture(),draft={...f.args.example,algorithm:'new-vector-selection'};
 for(const sourceAnchor of [undefined,[20,20],[21,20,0],[Infinity,20],[1000,20]])await assert.rejects(runSavedVectorPageSetReview({...f.args,example:draft,sourceAnchor}),/bounds-centre/);
 for(const example of [{...draft,id:'saved'},{...draft,vectorReview:{}},f.args.example])await assert.rejects(runSavedVectorPageSetReview({...f.args,example,sourceAnchor:[21,20]}),/anchor/);
 await assert.rejects(runSavedVectorPageSetReview({...f.args,example:draft,sourceAnchor:[21,20],matchPolicy:'strict'}),/bounds-centre/);
 await assert.rejects(runSavedVectorPageSetReview({...f.args,example:{...f.args.example,algorithm:VECTOR_SELECTED_REVIEW_VERSION,vectorReview:{matchPolicy:VECTOR_SELECTED_MATCH_POLICY,sourceContextIds:[],anchor:[21,20]}}}),/anchor or review provenance/);
 assert.equal(f.events.length,0);
});

test('native anchor does not bypass source paint visibility, cancellation, or opening deadline',async()=>{
 const hidden=await fixture(true);await assert.rejects(runSavedVectorPageSetReview({...hidden.args,example:{...hidden.args.example,algorithm:'new-vector-selection'},sourceAnchor:[21,20]}),/Original source paint does not verify/);released(hidden);
 const f=await fixture(),progress=f.args.progress;await assert.rejects(runSavedVectorPageSetReview({...f.args,example:{...f.args.example,algorithm:'new-vector-selection'},sourceAnchor:[21,20],progress:p=>{progress(p);if(p.stage==='complete')f.run.cancel();}}),/cancel/);released(f);
 const stalled=await fixture();let destroyed=0;await assert.rejects(runSavedVectorPageSetReview({...stalled.args,example:{...stalled.args.example,algorithm:'new-vector-selection'},sourceAnchor:[21,20],maxMilliseconds:30,pdfjs:{OPS,version,getDocument(){return{promise:new Promise(()=>{}),destroy:async()=>{destroyed++;}};}}}),/timed out/);assert.equal(destroyed,1);assert.equal(stalled.run.cancel,undefined);
});
