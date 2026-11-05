import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';
import {prepareNativeCountInk} from '../apps/local/web/native-count-ink.mjs';
import {inkTransform} from '../apps/local/web/count-ink.mjs';
import {prepareVectorPattern,releaseVectorPattern} from '../apps/local/web/vector-pattern-review.mjs';
import {VECTOR_REVIEW_VERSION} from '../apps/local/web/vector-review-policy.mjs';

// Independently authored cubic circle; the optional later white rectangle is
// real PDF content, never a changed verification image or expected-pixel mask.
function original({width=.24,knockout=false,core=false}={}){
 const c=`0 G ${width} w 43.125 40.125 m 43.125 41.781854 41.781854 43.125 40.125 43.125 c 38.468146 43.125 37.125 41.781854 37.125 40.125 c 37.125 38.468146 38.468146 37.125 40.125 37.125 c 41.781854 37.125 43.125 38.468146 43.125 40.125 c S ${core?'0 g 39.625 39.625 1 1 re f':''} ${knockout?'1 g 42.8 39.8 .65 .65 re f':''}`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 1000] /Resources << >> /Contents 4 0 R >>',`<< /Length ${c.length} >>\nstream\n${c}\nendstream`];let pdf='%PDF-1.4\n',offsets=[0];for(const [i,o]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=pdf.length;pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array(Buffer.from(pdf));
}
async function fixture(t,options={}){
 const bytes=original(options),task=getDocument({data:bytes.slice(),isEvalSupported:false}),doc=await task.promise,real=await doc.getPage(1),list=await real.getOperatorList(),ids=list.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]),events=[],canvases=[];let rendered=false;
 const page={pageNumber:1,getOperatorList(){assert.equal(rendered,false,'raw provenance must be prepared before ANY rendering');events.push('operators');return real.getOperatorList();},getViewport:args=>real.getViewport(args),render(args){rendered=true;events.push(args.viewport.scale);assert.equal(args.operationsFilter,undefined,'oracle is the unmodified original PDF');return real.render(args);}};
 const factory=(w,h)=>{assert.ok(w<=256&&h<=256&&w*h<=65536);const c=createCanvas(w,h);canvases.push(c);return c;};
 t.after(async()=>{await task.destroy();assert.ok(canvases.every(c=>c.width===0&&c.height===0),'all adapter/helper canvases released');});
 return{bytes,page,real,doc,ids,events,canvases,factory,operatorCount:list.fnArray.length};
}

test('independent thin cubic ring prepares both scales before render and returns bounded 8x alpha',async t=>{
 const f=await fixture(t),handle=await preparePdfContourPaints({page:f.page,OPS,elementIds:[f.ids[0]]});assert.equal(handle.supported,true);assert.equal(handle.additionalAuditWork,f.operatorCount);
 const proof=await verifyPdfContourPaints({prepared:handle,createCanvas:f.factory,pdfjsVersion:version,includeAlphaMask:true});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.verificationScale,8);assert.equal(proof.baselineRefusal.reason,'Paint has no opaque detail to verify');assert.deepEqual(f.events,['operators','operators',2,8]);assert.equal(proof.alphaMask.alpha.length,proof.alphaMask.width*proof.alphaMask.height);assert.ok(proof.alphaMask.alpha.some(v=>v===255));assert.equal(proof.score,undefined);
});
test('actual white overpaint of a thin ring remains refused',async t=>{
 const f=await fixture(t,{knockout:true}),handle=await preparePdfContourPaints({page:f.page,OPS,elementIds:[f.ids[0]]}),proof=await verifyPdfContourPaints({prepared:handle,createCanvas:f.factory,pdfjsVersion:version,includeAlphaMask:true});assert.equal(proof.verified,false);assert.equal(proof.alphaMask,undefined);assert.ok(proof.diagnostics.mismatchedPixels>0);assert.ok(!f.events.includes(8),'known 2x mismatch must not be retried as a no-core case');
});
test('existing opaque stroke succeeds at 2x and hairline does not reserve an 8x audit',async t=>{
 for(const width of [1,0]){const f=await fixture(t,{width}),handle=await preparePdfContourPaints({page:f.page,OPS,elementIds:[f.ids[0]]});assert.equal(handle.additionalAuditWork,undefined);const proof=await verifyPdfContourPaints({prepared:handle,createCanvas:f.factory,pdfjsVersion:version});if(width===1)assert.equal(proof.verified,true,proof.reason);assert.equal(proof.verificationScale,2);assert.deepEqual(f.events,['operators',2]);}
});
test('cancellation and canvas failure never trigger higher-resolution replay',async t=>{
 for(const mode of ['cancel','canvas']){const f=await fixture(t),handle=await preparePdfContourPaints({page:f.page,OPS,elementIds:[f.ids[0]]});let cancelled=false;const proof=await verifyPdfContourPaints({prepared:handle,createCanvas:mode==='canvas'?()=>{throw Error('owned allocation failure');}:f.factory,pdfjsVersion:version,cancelled:()=>cancelled,onRender:()=>{cancelled=true;}});assert.equal(proof.verified,false);assert.equal(proof.baselineRefusal,undefined);assert.ok(!f.events.includes(8));if(mode==='canvas')assert.equal(proof.executionFailure,'canvas');}
});

test('native glyph uses the verified 8x viewport and cancellation returns no partial batch',async()=>{
 const bytes=original(),digest=createHash('sha256').update(bytes).digest('hex'),initial=getDocument({data:bytes.slice()}),doc=await initial.promise,page=await doc.getPage(1),list=await page.getOperatorList(),id=list.fnArray.indexOf(OPS.constructPath),targetViewport=page.getViewport({scale:3,rotation:90});await initial.destroy();
 const drawing={id:'owned-thin',digest},decision={x:40.125,y:40.125,rotation:0,elementIds:[id],included:true},example={id:'example',version:1,example:{algorithm:VECTOR_REVIEW_VERSION,drawing_id:drawing.id,digest,page:1,vectorReview:{version:VECTOR_REVIEW_VERSION,scope:'source-page',sourceLayerScope:false,anchor:[40.125,40.125],decision:'apply',provenance:{engine:'vector-candidate-review-1',visibility:'contour-paint-visibility-4',requestedPaints:1,admittedPaints:1,unknownCount:0,excludedCount:0,proposalCount:1,verifiedCount:1,selectedCount:1},decisions:[decision]}}},mark={id:'mark',drawing_id:drawing.id,page:1,example_id:example.id,origin:'automatic',included:true,x:decision.x,y:decision.y},canvases=[],state=structuredClone({example,mark});let destroys=0;
 const pdfjs={OPS,version,getDocument(){const task=getDocument({data:bytes.slice(),isEvalSupported:false});return{promise:task.promise,destroy:async()=>{await task.destroy();destroys++;}};}},factory=(w,h)=>{assert.ok(w<=256&&h<=256);const c=createCanvas(w,h);canvases.push(c);return c;},args={pdfjs,drawing,pageNumber:1,marks:[mark],examples:[example],createCanvas:factory};
 const result=await prepareNativeCountInk(args),mask=result.masks.get(mark.id);assert.ok(mask?.url,JSON.stringify(result.refusals));assert.equal(mask.viewport.scale,8);const image=await loadImage(mask.url),canvas=createCanvas(mask.width,mask.height);try{const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const [x,y]=mask.viewport.convertToViewportPoint(43.125,40.125);assert.ok(ctx.getImageData(Math.floor(x-mask.left),Math.floor(y-mask.top),1,1).data[3]>0);const transform=inkTransform(mask.viewport,targetViewport,mask);assert.deepEqual(transform.slice(4),targetViewport.convertToViewportPoint(...mask.viewport.convertToPdfPoint(mask.left,mask.top)));assert.equal(Math.hypot(transform[0],transform[1]),3/8);}finally{canvas.width=canvas.height=0;}
 let cancelled=false;await assert.rejects(prepareNativeCountInk({...args,cancelled:()=>cancelled,createCanvas:(w,h)=>{cancelled=true;return factory(w,h);}}),/cancelled/);assert.equal(destroys,2);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.deepEqual({example,mark},state);
});


test('source-pattern audit budget charges the preprepared 8x audit before any render',async t=>{
 for(const multiplier of [2,3]){const f=await fixture(t),config=await f.doc.getOptionalContentConfig({intent:'display'}),result=await prepareVectorPattern({page:f.page,OPS,optionalContentConfig:config,documentSha256:createHash('sha256').update(f.bytes).digest('hex'),selection:{page:1,bounds:[36,36,44,44],anchor:[40.125,40.125],ids:[f.ids[0]],excluded:[]},layerPolicy:'all-admitted',createCanvas:f.factory,pdfjsVersion:version,maxAuditWork:multiplier*f.operatorCount});
 if(multiplier===2){assert.equal(result.completed,false);assert.match(result.reason,/audit budget/);assert.deepEqual(result.proposals,[]);assert.ok(f.events.every(e=>e==='operators'),'budget refusal must precede original rendering');}
 else{assert.equal(result.completed,true,result.reason);assert.equal(result.auditWork,3*f.operatorCount);assert.equal(result.source.visibility.verificationScale,8);assert.equal(releaseVectorPattern(result.pattern),true);}}
});


test('a thin ring with existing opaque centre preserves successful 2x proof despite preprepared alternative',async t=>{
 const f=await fixture(t,{core:true}),handle=await preparePdfContourPaints({page:f.page,OPS,elementIds:f.ids});assert.equal(handle.additionalAuditWork,f.operatorCount);const proof=await verifyPdfContourPaints({prepared:handle,createCanvas:f.factory,pdfjsVersion:version});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.verificationScale,2);assert.equal(proof.baselineRefusal,undefined);assert.deepEqual(f.events,['operators','operators',2]);
});
