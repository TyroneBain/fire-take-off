import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';

// Independent original geometry: two square/triangle symbols, one explicit
// source pipe exclusion. The asymmetrical anchor is intentionally user-owned.
function originalPdf({sourceKnockout=false,targetKnockout=false}={}){
 const glyph=x=>`/OC /Symbols BDC q 1 0 0 1 ${x} 30 cm 0 G .75 w -4 -4 8 8 re S 0 g -1 -1 m 1 -1 l 0 1 l h f Q EMC`;
 const content=[glyph(30),'/OC /Pipes BDC 0 G .75 w 30 34 m 30 40 l S EMC',glyph(75),sourceKnockout?'1 g 29.5 29.5 .5 .5 re f':'',targetKnockout?'1 g 74.5 29.5 .5 .5 re f':''].join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [5 0 R 6 0 R] /D << /ON [5 0 R 6 0 R] >> >> >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 80] /Resources << /Properties << /Symbols 5 0 R /Pipes 6 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,'<< /Type /OCG /Name (Independent symbols) >>','<< /Type /OCG /Name (Independent pipes) >>'];
 let data='%PDF-1.5\n';const offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const xref=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Uint8Array(Buffer.from(data));
}
async function fixture(t,options){
 const bytes=originalPdf(options),documentSha256=createHash('sha256').update(bytes).digest('hex'),task=getDocument({data:bytes.slice(),isEvalSupported:false});t.after(()=>task.destroy());const pdf=await task.promise,page=await pdf.getPage(1),operatorList=await page.getOperatorList(),optionalContentConfig=await pdf.getOptionalContentConfig({intent:'display'}),ids=operatorList.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]);
 return {bytes,documentSha256,page,optionalContentConfig,operatorList,ids,anchor:[31.25,29.75]};
}

async function review(f,options={}){
 const {runVectorCandidateReview}=await import('../apps/local/web/vector-candidate-search.mjs');
 return runVectorCandidateReview({page:f.page,OPS,optionalContentConfig:f.optionalContentConfig,documentSha256:f.documentSha256,selection:{page:1,bounds:[25,25,35,35],anchor:f.anchor,ids:f.ids.slice(0,3),excluded:[f.ids[2]]},createCanvas,pdfjsVersion,...options});
}
test('all original handles precede first rendering, config identity is preserved and native anchor/exclusions remain caller-owned',async t=>{
 const f=await fixture(t),get=f.page.getOperatorList.bind(f.page),render=f.page.render.bind(f.page),canvases=[],configs=[];let renderCount=0,preparations=0;
 f.page.getOperatorList=(...a)=>{assert.equal(renderCount,0,'every raw handle must be prepared before any render mutates paths');preparations++;return get(...a);};
 f.page.render=options=>{renderCount++;configs.push(options.optionalContentConfigPromise);assert.equal(options.operationsFilter,undefined,'original raster must stay unfiltered');return render(options);};
 const before=structuredClone({ids:f.ids,anchor:f.anchor}),result=await review(f,{createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});
 assert.equal(result.completed,true,result.reason);assert.ok(result.proposals.length>=2);assert.ok(preparations>result.proposals.length,'source and every target prepared before rendering');assert.ok(renderCount>=result.proposals.length);
 for(const p of configs)assert.equal(await p,f.optionalContentConfig);assert.deepEqual({ids:f.ids,anchor:f.anchor},before);assert.deepEqual(result.proposals.map(p=>[p.x,p.y]).sort((a,b)=>a[0]-b[0]),[[31.25,29.75],[76.25,29.75]]);
 assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal('matches'in result,false);assert.equal('supported'in result,false);for(const p of result.proposals){assert.equal('score'in p,false);assert.equal('accepted'in p,false);}
 assert.equal(createHash('sha256').update(f.bytes).digest('hex'),f.documentSha256);
});

test('a stalled original render obeys the coordinator deadline and releases its canvas',async t=>{
 const f=await fixture(t),canvases=[];let renderStarted=false,cancelCalls=0,releaseTimer;
 f.page.render=()=>{renderStarted=true;let reject;const promise=new Promise((_,r)=>{reject=r;});const task={promise,cancel(){cancelCalls++;reject(Error('Independent stalled render cancelled'));}};releaseTimer=setTimeout(()=>task.cancel(),500);return task;};
 t.after(()=>clearTimeout(releaseTimer));const start=performance.now(),result=await review(f,{maxMilliseconds:100,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}}),elapsed=performance.now()-start;
 assert.equal(renderStarted,true,'fixture must reach the stalled render');assert.equal(result.completed,false);assert.deepEqual(result.proposals,[]);assert.match(result.reason,/timed out/);assert.ok(cancelCalls>0);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.ok(elapsed<400,`100ms review deadline must cancel the render before the 500ms test watchdog; observed ${elapsed.toFixed(1)}ms`);
});

test('white-overpaint source refuses all output; target occlusion stays a scoreless rejected visibility proposal',async t=>{
 const hiddenSource=await fixture(t,{sourceKnockout:true}),refused=await review(hiddenSource);assert.equal(refused.completed,false);assert.deepEqual(refused.proposals,[]);assert.match(refused.reason,/source paint does not verify/i);
 const target=await fixture(t,{targetKnockout:true}),result=await review(target);assert.equal(result.completed,true,result.reason);assert.equal(result.source.visibility.verified,true);assert.deepEqual(result.source.elementIds,target.ids.slice(0,2));assert.deepEqual(result.source.excludedIds,[target.ids[2]]);assert.deepEqual(result.source.anchor,target.anchor);
 assert.equal(result.coverage.complete,false);assert.ok(result.coverage.unknown.length>0,'unsupported white overpaint stays explicit partial extraction');assert.equal(result.requiresSemanticReview,true);assert.equal(result.requiresSemanticVerification,true);
 const rejection=result.proposals.find(p=>p.x===76.25);assert.ok(rejection);assert.equal(rejection.visibility.verified,false);assert.ok(rejection.visibility.diagnostics.mismatchedPixels>0);assert.equal('score'in rejection,false);
});
test('cancellation after the last visibility result and final progress callback publishes nothing and frees canvases',async t=>{
 for(const phase of ['verify','complete']){
  const f=await fixture(t),canvases=[];let cancelled=false,sawBoundary=false;
  const result=await review(f,{cancelled:()=>cancelled,progress:event=>{if(event.phase===phase&&event.completed===event.total){sawBoundary=true;cancelled=true;}},createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});
  assert.equal(sawBoundary,true);assert.equal(result.completed,false);assert.match(result.reason,/cancelled/);assert.deepEqual(result.proposals,[]);assert.ok(canvases.length>0);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal('source'in result,false,'no partial proof result escapes cancellation');
 }
});
test('a final configuration change invalidates every accumulated proposal without altering saved selection',async t=>{
 const f=await fixture(t),layer=[...f.optionalContentConfig][0][0],before=structuredClone(f.anchor);let sawComplete=false;
 const result=await review(f,{sourceLayerScope:true,progress:event=>{if(event.phase==='complete'){sawComplete=true;f.optionalContentConfig.setVisibility(layer,false);}}});
 assert.equal(sawComplete,true);assert.equal(result.completed,false);assert.match(result.reason,/configuration changed/);assert.deepEqual(result.proposals,[]);assert.deepEqual(f.anchor,before);
});

test('user cancellation and layer changes interrupt stalled renders that never call onContinue',async t=>{
 for(const change of ['cancel','layer']){
  const f=await fixture(t),layer=[...f.optionalContentConfig][0][0],canvases=[];let cancelled=false,changedAt=0,watchdog,changeTimer;
  f.page.render=()=>{let reject;const promise=new Promise((_,r)=>{reject=r;});const task={promise,cancel(){reject(Error('Independent interrupted render'));}};changeTimer=setTimeout(()=>{changedAt=performance.now();if(change==='cancel')cancelled=true;else f.optionalContentConfig.setVisibility(layer,false);},20);watchdog=setTimeout(()=>task.cancel(),500);return task;};
  const result=await review(f,{cancelled:()=>cancelled,maxMilliseconds:1000,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});clearTimeout(watchdog);clearTimeout(changeTimer);
  assert.ok(changedAt>0);assert.ok(performance.now()-changedAt<300,'polling must interrupt before test watchdog');assert.equal(result.completed,false);assert.deepEqual(result.proposals,[]);assert.match(result.reason,change==='cancel'?/cancelled/:/configuration changed/);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
 }
});

for(const failure of ['promise','synchronous'])test(`a later candidate ${failure} render failure discards all review results`,async t=>{
  const f=await fixture(t),render=f.page.render.bind(f.page),canvases=[];let renders=0;
  f.page.render=options=>{if(++renders===2){if(failure==='synchronous')throw Error('Independent target renderer exception');return {promise:Promise.reject(Error('Independent target render task rejection')),cancel(){}};}return render(options);};
  const result=await review(f,{createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});
  assert.equal(renders,2,'failure must occur after a successfully verified source and stop later renders');assert.equal(result.completed,false,`${failure} failure cannot become a normal visibility refusal`);assert.deepEqual(result.proposals,[]);assert.equal('source'in result,false);assert.ok(canvases.length>0);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});

for(const failure of ['canvas','readback','helper-readback'])test(`a later candidate ${failure} failure aborts rather than returning partial proposals`,async t=>{
 const f=await fixture(t),canvases=[];let allocations=0,triggered=false;
 const result=await review(f,{createCanvas:(w,h)=>{
  const index=++allocations;if(index===3&&failure==='canvas'){triggered=true;throw Error('Independent target canvas failure');}
  const c=createCanvas(w,h);canvases.push(c);
  if(index===(failure==='helper-readback'?4:3)&&failure!=='canvas'){const getContext=c.getContext.bind(c);let wrapped=false;c.getContext=(...args)=>{const ctx=getContext(...args);if(!wrapped){wrapped=true;const read=ctx.getImageData.bind(ctx);let captures=0;ctx.getImageData=(...a)=>{if(++captures===(failure==='helper-readback'?1:2)){triggered=true;throw Error('Independent target readback failure');}return read(...a);};}return ctx;};}
  return c;
 }});
 assert.equal(triggered,true,'must reach later candidate after a visible source');assert.equal(result.completed,false);assert.deepEqual(result.proposals,[]);assert.equal('source'in result,false);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
});
