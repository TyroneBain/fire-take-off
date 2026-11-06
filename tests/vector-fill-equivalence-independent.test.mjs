import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';
import {vectorReviewPayload} from '../apps/local/web/vector-review-ui.mjs';
import {validVectorReview} from '../apps/local/web/vector-review-policy.mjs';
import {createVectorTemplate} from '../apps/local/web/vector-recognition.mjs';
import {auditNativePage} from '../apps/local/web/vector-page-audit.mjs';
import polygonBoolean from 'polygon-clipping';
import {prepareVectorPattern,reviewVectorPatternPage,releaseVectorPattern} from '../apps/local/web/vector-pattern-review.mjs';

// Independently authored geometry and labels: an asymmetric 48-square-point L.
// The same filled region is encoded as one contour or16 adjacent half-point
// strips. These are original synthetic controls, not a customer accuracy set.
const contour='-4 -4 m 4 -4 l 4 0 l 0 0 l 0 4 l -4 4 l h';
const cases=[
 ...[0,90,180,270].map((rotation,i)=>({name:`single-${rotation}`,page:1,x:40+i*60,y:40,rotation,kind:'single',positive:true,pipe:i===0})),
 ...[0,90,180,270].map((rotation,i)=>({name:`strips-${rotation}`,page:2,x:40+i*60,y:40,rotation,kind:'strips',positive:true,pipe:i===3})),
 ...['hole','slit','missing-centre','red','hairline','scaled'].map((kind,i)=>({name:kind,page:2,x:40+i*60,y:110,rotation:0,kind,positive:false})),
];
function glyph(c){
 const matrix={0:'1 0 0 1',90:'0 1 -1 0',180:'-1 0 0 -1',270:'0 -1 1 0'}[c.rotation];
 let body;
 if(['strips','slit','missing-centre'].includes(c.kind))body=Array.from({length:16},(_,i)=>{
  if(c.kind==='missing-centre'&&i===5||c.kind==='slit'&&i===7)return'';
  return `-4 ${-4+i*.5} ${i<8?8:4} .5 re f`;
 }).join('\n');
 else if(c.kind==='hole')body=`${contour} -3 -2 1.5 1.5 re f*`;
 else if(c.kind==='hairline')body=`0 w ${contour} S`;
 else body=`${c.kind==='red'?'1 0 0 rg ':''}${c.kind==='scaled'?'1.2 0 0 1.2 0 0 cm ':''}${contour} f`;
 return `q ${matrix} ${c.x} ${c.y} cm 0 g 0 G ${body} ${c.pipe?'.5 w -10 0 m 10 0 l S':''} Q`;
}
function original(overrideContents){
 const contents=overrideContents??[1,2].map(page=>cases.filter(c=>c.page===page).map(glyph).join('\n')),objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
 for(const [i,content]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 160] /Resources << >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
 let data='%PDF-1.4\n';const offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const at=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;return new Uint8Array(Buffer.from(data));
}
async function run(t,matchPolicy,{progress=()=>{},run:control={cancelled:false},sourcePage=1}={}){
 const bytes=original(),digest=createHash('sha256').update(bytes).digest('hex'),drawing={id:'owned-fill-equivalence',digest},read=getDocument({data:bytes.slice(),isEvalSupported:false});let sourceIds,pageIds;
 try{const doc=await read.promise;pageIds=await Promise.all([1,2].map(async p=>{const ops=await(await doc.getPage(p)).getOperatorList();return ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]);}));sourceIds=pageIds[sourcePage-1].slice(0,sourcePage===1?2:16);}finally{await read.destroy();}
 const selection={renderer:ELEMENT_RENDERER,ids:[...sourceIds],excluded:sourcePage===1?[sourceIds[1]]:[]},example={drawing_id:drawing.id,digest,page:sourcePage,bounds:[35,35,45,45],elements:selection},before=structuredClone(example),events=[],canvases=[],started=performance.now(),memoryBefore=process.memoryUsage().rss;
 const pdfjs={OPS,version,getDocument(options){const task=getDocument(options);events.push('open');return{promise:task.promise,destroy:async()=>{await task.destroy();events.push('destroy');}};}};
 try{const report=await runSavedVectorPageSetReview({pdfjs,sourceDrawing:drawing,sourceData:bytes,example,targets:[1,2].map(page=>({drawing,page})),layerPolicy:'all-admitted',matchPolicy,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;},progress,run:control});return{report,example,drawing,pageIds,elapsedMs:performance.now()-started,rssBefore:memoryBefore,rssAfter:process.memoryUsage().rss};}
 finally{assert.deepEqual(example,before);assert.equal(events.filter(v=>v==='open').length,events.filter(v=>v==='destroy').length);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal(control.task,undefined);assert.equal(control.cancel,undefined);}
}
function measure(report){
 const hits=report.pages.flatMap(p=>p.result.proposals.filter(h=>h.visibility.verified).map(h=>({...h,page:p.page}))),matched=new Set(),falsePositives=[];
 for(const hit of hits){const label=cases.find(c=>c.page===hit.page&&Math.hypot(c.x-hit.x,c.y-hit.y)<.1);if(!label?.positive||matched.has(label.name))falsePositives.push(label?.name??`${hit.page}:${hit.x},${hit.y}`);else matched.add(label.name);}
 const tp=matched.size,fp=falsePositives.length,fn=cases.filter(c=>c.positive).length-tp;return{tp,fp,fn,precision:hits.length?tp/hits.length:0,recall:tp/8,matched:[...matched],falsePositives,hits};
}

test('original filled-region fixture records strict whole-operation baseline against independent positions',async t=>{
 const f=await run(t,'strict'),result=measure(f.report);assert.equal(f.report.completed,true);assert.deepEqual([result.tp,result.fp,result.fn],[4,0,4]);assert.deepEqual(result.matched,cases.filter(c=>c.page===1).map(c=>c.name));
 t.diagnostic(JSON.stringify({policy:'strict',tp:result.tp,fp:result.fp,fn:result.fn,precision:result.precision,recall:result.recall,elapsedMs:f.elapsedMs,rssBefore:f.rssBefore,rssAfter:f.rssAfter}));
});

test('filled-region review finds quarter-turned strips without accepting holes, missing paint, colour, strokes or scale changes',async t=>{
 const f=await run(t,'selected-geometry-1'),result=measure(f.report);assert.equal(f.report.completed,true);t.diagnostic(JSON.stringify({policy:'selected-geometry-1',tp:result.tp,fp:result.fp,fn:result.fn,precision:result.precision,recall:result.recall,elapsedMs:f.elapsedMs,rssBefore:f.rssBefore,rssAfter:f.rssAfter,falsePositives:result.falsePositives}));
 assert.deepEqual([result.tp,result.fp,result.fn],[8,0,0]);assert.equal(result.hits.length,8,'Strict and equivalent geometry must not duplicate a physical instance');
 for(const hit of result.hits){const label=cases.find(c=>c.page===hit.page&&Math.hypot(c.x-hit.x,c.y-hit.y)<.1),ordinal=(label.x-40)/60,expectedIds=hit.page===1?[f.pageIds[0][ordinal===0?0:ordinal+1]]:f.pageIds[1].slice(ordinal*16,ordinal*16+16);assert.equal(hit.rotation,label.rotation,label.name);assert.equal(new Set(hit.elementIds).size,hit.elementIds.length);assert.deepEqual([...hit.elementIds].sort((a,b)=>a-b),expectedIds,'Every painted constituent must belong to this independently authored symbol');assert.equal(hit.elementIds.length,hit.page===1?1:16);if(hit.page===2)assert.equal(hit.requiresExplicitReview,true);}
 assert.deepEqual(f.report.selection.ids,f.example.elements.ids);assert.deepEqual(f.report.selection.excluded,f.example.elements.excluded);
 const proposals=f.report.pages.flatMap(p=>p.result.proposals),selected=new Set(proposals.flatMap((p,i)=>p.requiresExplicitReview?[]:[i])),decided=new Set(),input={record:{id:'owned-example',version:1,item_id:'owned-heading',example:f.example},item:{id:'owned-heading',version:1,color:'#237fab'},drawing:f.drawing,elements:f.example.elements,review:f.report,marks:[],selected,decided},before=structuredClone(input),pending=vectorReviewPayload(input);
 assert.deepEqual(input,before);assert.equal(validVectorReview(pending.vectorReview,pending.matches.length),true);assert.equal(pending.matches.length,4,'Broader candidates are not included without explicit decisions');assert.equal(pending.vectorReview.pages.reduce((n,p)=>n+p.provenance.pendingCount,0),4);assert.equal(pending.vectorReview.pages[1].decisions.length,0,'Pending is neither acceptance nor rejection');
 const broad=proposals.findIndex(p=>p.requiresExplicitReview);selected.add(broad);assert.throws(()=>vectorReviewPayload(input),'Implicit broad acceptance must be refused');decided.add(broad);const accepted=vectorReviewPayload(input);assert.equal(accepted.matches.length,5);assert.equal(accepted.vectorReview.pages.reduce((n,p)=>n+p.provenance.pendingCount,0),3);assert.equal(accepted.vectorReview.pages[1].decisions[0].reviewed,true);assert.equal(accepted.vectorReview.pages[1].decisions[0].elementIds.length,16);
});

async function geometryFixture(t){
 const task=getDocument({data:original(),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,pages=[];
 for(const number of [1,2]){const page=await doc.getPage(number),audit=await auditNativePage({page,OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}});assert.equal(audit.failures.length,0);pages.push({supported:true,elements:audit.elements});}
 const [source,target]=pages,template=createVectorTemplate(source,{bounds:[35,35,45,45],anchor:[40,40],ids:source.elements.slice(0,2).map(e=>e.id),excluded:[source.elements[1].id]});assert.equal(template.supported,true);return{source,target,template};
}

test('filled-area helper preserves complete original IDs, distinguishes holes and refuses unsupported stroke sources',async t=>{
 const {findFillEquivalentMatches}=await import('../apps/local/web/vector-fill-equivalence.mjs'),f=await geometryFixture(t),before=structuredClone(f),hits=findFillEquivalentMatches(f.target,f.template,{polygonBoolean});
 assert.equal(hits.length,4);assert.deepEqual(hits.map(h=>[h.x,h.y,h.rotation]).sort((a,b)=>a[0]-b[0]),[0,90,180,270].map((r,i)=>[40+i*60,40,r]));assert.ok(hits.every(h=>h.elementIds.length===16&&new Set(h.elementIds).size===16&&h.requiresExplicitReview&&h.requiresRenderVerification&&h.wholeOperations));
 const hole=f.target.elements.find(e=>e.bounds[0]===36&&e.bounds[1]===106),holeTemplate=createVectorTemplate(f.target,{bounds:[35,105,45,115],anchor:[40,110],ids:[hole.id],excluded:[]});assert.equal(holeTemplate.supported,true);const holes=findFillEquivalentMatches(f.target,holeTemplate,{polygonBoolean});assert.deepEqual(holes.map(h=>[h.x,h.y]),[[40,110]],'A hole is part of the shape, not removable decoration');
 const hairline=f.target.elements.find(e=>e.style.stroke&&e.style.width===0),strokeTemplate=createVectorTemplate(f.target,{bounds:[275,105,285,115],anchor:[280,110],ids:[hairline.id],excluded:[]});assert.equal(strokeTemplate.supported,true);assert.deepEqual(findFillEquivalentMatches(f.target,strokeTemplate,{polygonBoolean}),[]);
 const mixed=createVectorTemplate(f.source,{bounds:[25,25,55,55],anchor:[40,40],ids:f.source.elements.slice(0,2).map(e=>e.id),excluded:[]});assert.equal(mixed.supported,true);assert.deepEqual(findFillEquivalentMatches(f.target,mixed,{polygonBoolean}),[],'Unsupported retained stroke must not be silently dropped');assert.deepEqual(f,before);
});

test('filled-area helper cancellation, work limits and unsupported scaling are atomic and leave geometry unchanged',async t=>{
 const {findFillEquivalentMatches}=await import('../apps/local/web/vector-fill-equivalence.mjs'),f=await geometryFixture(t),before=structuredClone(f);
 assert.throws(()=>findFillEquivalentMatches(f.target,f.template,{polygonBoolean,cancelled:()=>true}),/cancel/i);assert.throws(()=>findFillEquivalentMatches(f.target,f.template,{polygonBoolean,maxWork:1}),/budget|work/i);assert.throws(()=>findFillEquivalentMatches(f.target,f.template,{polygonBoolean,scaleRange:[.9,1.1]}),{code:'VECTOR_FILL_INVALID'});assert.deepEqual(f,before);
});

test('filled-region page-set cancellation at final publication publishes nothing and releases every owned resource',async t=>{
 const control={cancelled:false};let reached=false;
 await assert.rejects(run(t,'selected-geometry-1',{run:control,progress:p=>{if(p.stage==='complete'){reached=true;control.cancel();}}}),/cancel/i);assert.equal(reached,true);
});

test('a sixteen-paint source also finds single-fill equivalents without discarding any selected constituent',async t=>{
 const f=await run(t,'selected-geometry-1',{sourcePage:2}),result=measure(f.report);t.diagnostic(JSON.stringify({source:'16-strips',tp:result.tp,fp:result.fp,fn:result.fn,elapsedMs:f.elapsedMs}));assert.deepEqual([result.tp,result.fp,result.fn],[8,0,0]);assert.equal(f.report.selection.ids.length,16);assert.deepEqual(f.report.selection.ids,f.example.elements.ids);assert.deepEqual(f.report.selection.excluded,[]);assert.ok(result.hits.filter(h=>h.page===1).every(h=>h.elementIds.length===1&&h.requiresExplicitReview));
});

test('filled-area source with a genuine PDF Bezier curve stays unsupported instead of flattening it implicitly',async t=>{
 const {findFillEquivalentMatches}=await import('../apps/local/web/vector-fill-equivalence.mjs'),data=original(['0 g 44 40 m 44 42 42 44 40 44 c 38 44 36 42 36 40 c 36 38 38 36 40 36 c 42 36 44 38 44 40 c h f','']),task=getDocument({data,isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),audit=await auditNativePage({page,OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}});assert.equal(audit.failures.length,0);assert.equal(audit.elements.length,1);const geometry={supported:true,elements:audit.elements},template=createVectorTemplate(geometry,{bounds:[35,35,45,45],anchor:[40,40],ids:[audit.elements[0].id],excluded:[]});assert.equal(template.supported,true);const before=structuredClone({geometry,template});assert.deepEqual(findFillEquivalentMatches(geometry,template,{polygonBoolean}),[]);assert.deepEqual({geometry,template},before);
});

test('nearby additive fill candidates follow persistence separation while preserving an established exact hit',async t=>{
 const {findFillEquivalentMatches}=await import('../apps/local/web/vector-fill-equivalence.mjs');
 // Crowded, pixel-aligned narrow geometry exercises the .5pt per-axis storage
 // boundary. The remote control is exactly .5pt wide; all published candidates
 // must still pass the unchanged original-paint proof, including opaque detail.
 const narrow=(x,y,kind,widthScale=.06245)=>`q 1 0 0 1 ${x} ${y} cm ${widthScale} 0 0 1 0 0 cm ${glyph({x:0,y:0,rotation:0,kind})} Q`,data=original([narrow(40.25,40,'single'),[narrow(100.25,40,'single'),narrow(100.7499,40.25,'strips'),narrow(160.25,40,'strips',.0625)].join('\n')]),digest=createHash('sha256').update(data).digest('hex');
 async function compare(policy){const task=getDocument({data:data.slice(),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,source=await doc.getPage(1),target=await doc.getPage(2),config=await doc.getOptionalContentConfig(),ops=await source.getOperatorList(),id=ops.fnArray.findIndex(op=>op===OPS.constructPath),selection={page:1,bounds:[35.25,35,45.25,45],anchor:[40.25,40],ids:[id],excluded:[]},common={OPS,pdfjsVersion:version,documentSha256:digest,optionalContentConfig:config,createCanvas};
  const prepared=await prepareVectorPattern({...common,page:source,selection,matchPolicy:policy});assert.equal(prepared.completed,true,prepared.reason);t.after(()=>releaseVectorPattern(prepared.pattern));
  const audit=await auditNativePage({page:target,OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}}),sourceAudit=await auditNativePage({page:source,OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}}),template=createVectorTemplate({supported:true,elements:sourceAudit.elements},selection),raw=findFillEquivalentMatches({supported:true,elements:audit.elements},template,{polygonBoolean});
  assert.equal(raw.length,3,'All three original geometric instances exist before persistence-aware deduplication');assert.ok(raw.some(h=>Math.abs(h.x-100.7499)<1e-6&&Math.abs(h.y-40.25)<1e-6));
  const report=await reviewVectorPatternPage({...common,page:target,pattern:prepared.pattern});assert.equal(report.completed,true,report.reason);return report;
 }
 const strict=await compare('strict'),selected=await compare('selected-geometry-1');assert.equal(strict.proposals.length,1);assert.equal(selected.proposals.length,2,'Nearby broader candidate must not produce an invalid duplicate decision');const kept=selected.proposals.find(p=>!p.requiresExplicitReview);assert.ok(kept);for(const key of ['x','y','rotation','elementIds'])assert.deepEqual(kept[key],strict.proposals[0][key]);assert.ok(selected.proposals.every(p=>p.visibility.verified),JSON.stringify(selected.proposals.map(p=>({x:p.x,visibility:p.visibility}))));const extra=selected.proposals.find(p=>p.requiresExplicitReview);assert.equal(extra.x,160.25);assert.equal(extra.y,40);assert.equal(extra.elementIds.length,16);
});
