import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument,OPS,version as PDFJS_VERSION} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractVectorPage} from '../apps/local/web/vector-recognition.mjs';
import {extractClipFillProposals} from '../apps/local/web/vector-clip-paths.mjs';
import {extractRawPathProvenance} from '../apps/local/web/vector-paint-provenance.mjs';
import {verifyContourVisibility,captureContourRaster,CONTOUR_VISIBILITY_VERSION,CONTOUR_CONTEXT_OPTIONS,CONTOUR_RASTER_CONTRACT} from '../apps/local/web/contour-visibility.mjs';

function pdf(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 128 128] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let data='%PDF-1.4\n';const offsets=[0];for(const [i,object] of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(data);data+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new Uint8Array(Buffer.from(data));
}
const native=e=>({kind:'path',id:e.id,bounds:e.bounds,pathCommands:e.pathCommands,paintClosesPath:e.paintClosesPath,style:e.style,wholeOperation:true,opaque:true,contextComplete:true,clipDepth:0});
const clipped=p=>({kind:'clip-fill',id:p.paintId,clipPathId:p.clipPathId,clipOperatorId:p.clipOperatorId,bounds:p.bounds,fill:p.fill,clipRule:p.clipRule,clip:p.clip,paint:p.paint,wholeOperation:true,opaque:true,contextComplete:true,clipDepth:1});
async function oracle(t,content,{scale=2,left=0,top=0,width=256,height=256,rotation=0}={}){
 const task=getDocument({data:pdf(content),isEvalSupported:false});t.after(()=>task.destroy());
 const page=await(await task.promise).getPage(1),viewport=page.getViewport({scale,rotation}),canvas=createCanvas(width,height),ctx=canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS);
 await page.render({canvas,canvasContext:ctx,viewport,transform:[1,0,0,1,-left,-top]}).promise;
 const image=captureContourRaster({context:ctx,width,height,left,top,pdfjsVersion:PDFJS_VERSION}),ops=await page.getOperatorList();canvas.width=canvas.height=0;
 return {image,viewportTransform:Array.from(viewport.transform),ops};
}
const verify=(f,paints,extra={})=>verifyContourVisibility({paints,viewportTransform:f.viewportTransform,image:f.image,createCanvas,...extra});
const rectangle='0 g 20 20 20 20 re f';

test('actual PDF whole paths, closures, cap/join styles and crop pixel phase verify without a count score',async t=>{
 const content='0.8 0.1 0.2 rg 20.25 20.5 20 20 re f 0 G 2 w 2 J 0 j 55 23 m 65 30 50 45 64 48 c 65 55 l s';
 for(const rotation of [0,90]){
  const f=await oracle(t,content,{rotation,left:15,top:15,width:226,height:226}),v=extractVectorPage({operatorList:f.ops,OPS});assert.equal(v.supported,true,v.reason);
  const result=verify(f,v.elements.map(native));assert.equal(result.verified,true,result.reason);assert.equal(result.proof,CONTOUR_VISIBILITY_VERSION);assert.ok(result.diagnostics.opaquePixels>0);assert.ok(result.diagnostics.antialiasPixels>0);assert.equal(Object.hasOwn(result,'score'),false);
 }
});

test('one white interior pixel rejects even though more than 99 percent of paint remains',async t=>{
 const clean=await oracle(t,rectangle),paints=extractVectorPage({operatorList:clean.ops,OPS}).elements.map(native);
 const covered=await oracle(t,`${rectangle} 1 g 29.5 29.5 .5 .5 re f`),result=verify(covered,paints);
 assert.equal(result.verified,false);assert.equal(result.reason,'Original raster does not preserve retained paint');assert.equal(result.diagnostics.mismatchedPixels,1);assert.equal(result.diagnostics.opaquePixels,1600);
});

test('actual PDF tiny black centre cannot be hidden by white overpainting',async t=>{
 const shape='0.8 0.1 0.2 rg 20 20 20 20 re f 0 g 29.5 29.5 1 1 re f';
 const clean=await oracle(t,shape),paints=extractVectorPage({operatorList:clean.ops,OPS}).elements.map(native);
 const covered=await oracle(t,`${shape} 1 g 29.5 29.5 1 1 re f`);assert.equal(verify(clean,paints).verified,true);assert.equal(verify(covered,paints).verified,false);
});

test('raw clip and covering fill retain their different CTMs and antialias over coloured background',async t=>{
 const content='0.2 0.35 0.55 rg 0 0 128 128 re f q 1 0 0 1 30.25 35.125 cm 0 0 m 15.3 1.2 l 12 18.7 l 1.1 14.2 l h W n .5 0 0 .5 -10 -10 cm 0.85 0.15 0.3 rg -20 -20 100 100 re f Q';
 const f=await oracle(t,content),p=extractClipFillProposals({operatorList:f.ops,OPS}).proposals;assert.equal(p.length,1);assert.notDeepEqual(p[0].clip.matrix,p[0].paint.matrix);
 const result=verify(f,p.map(clipped));assert.equal(result.verified,true,result.reason);assert.ok(result.diagnostics.antialiasPixels>0);
 const wrong=structuredClone(p.map(clipped));wrong[0].clip.matrix[4]+=1;assert.equal(verify(f,wrong).verified,false,'wrong clip transform cannot borrow the original bounds');
 wrong[0].bounds[0]+=1;wrong[0].bounds[2]+=1;assert.equal(verify(f,wrong).verified,false,'even consistent shifted bounds must pass the unmodified raster');
 const paintWrong=structuredClone(p.map(clipped));paintWrong[0].paint.matrix[4]+=100;assert.equal(verify(f,paintWrong).verified,false,'rectangle must actually cover the clip');
});

test('physical antialias mixtures work on white, black and coloured backgrounds',async t=>{
 const shape='q 1 0 0 1 30.25 35.125 cm 0 0 m 15.3 1.2 l 12 18.7 l 1.1 14.2 l h W n 0.7 0.2 0.1 rg -20 -20 100 100 re f Q';
 for(const bg of ['1 1 1','0 0 0','0.2 0.6 0.4']){
  const f=await oracle(t,`${bg} rg 0 0 128 128 re f ${shape}`),paints=extractClipFillProposals({operatorList:f.ops,OPS}).proposals.map(clipped),result=verify(f,paints);assert.equal(result.verified,true,result.reason);assert.ok(result.diagnostics.antialiasPixels>0);
 }
});

test('opaque comparison permits one roundoff level but not two or an absent pixel',async t=>{
 const f=await oracle(t,'0.4 0.4 0.4 rg 20 20 20 20 re f'),paints=extractVectorPage({operatorList:f.ops,OPS}).elements.map(native),index=(200*256+50)*4;
 const original=f.image.data[index];assert.equal(original,102);f.image.data[index]=original+1;assert.equal(verify(f,paints).verified,true);
 f.image.data[index]=original+2;assert.equal(verify(f,paints).verified,false);f.image.data[index]=original;f.image.data[index+3]=0;assert.equal(verify(f,paints).verified,false);
});

test('whole operation footprint rejects a convenient crop that omits remote tails',async t=>{
 const content='0 G 2 w 20 20 m 30 20 l 90 20 m 100 20 l S',full=await oracle(t,content),paints=extractVectorPage({operatorList:full.ops,OPS}).elements.map(native),crop=await oracle(t,content,{left:30,top:200,width:50,height:30});
 assert.equal(verify(full,paints).verified,true);const result=verify(crop,paints);assert.equal(result.verified,false);assert.match(result.reason,/Complete painted footprint/);
 const forged=structuredClone(paints);forged[0].bounds[2]=30;assert.match(verify(crop,forged).reason,/bounds/);
});

test('nested, partial, nonopaque and reordered provenance fails before rendering',async t=>{
 const f=await oracle(t,'0 g 20 20 20 20 re f 50 20 10 10 re f'),paints=extractVectorPage({operatorList:f.ops,OPS}).elements.map(native);let allocations=0;
 const factory=(w,h)=>{allocations++;return createCanvas(w,h);};
 for(const change of [p=>{p[0].clipDepth=1;},p=>{p[0].contextComplete=false;},p=>{delete p[0].wholeOperation;},p=>{p[0].opaque=false;},p=>{p[0].style.alpha=.5;},p=>{p[0].unsupportedContext=true;},p=>p.reverse(),p=>{p[1].id=p[0].id;}]){const input=structuredClone(paints);change(input);assert.equal(verify(f,input,{createCanvas:factory}).verified,false);}
 assert.equal(allocations,0);
 const clipData=await oracle(t,'q 20 20 m 40 20 l 40 40 l 20 40 l h W n 0 g 0 0 80 80 re f Q'),clipPaint=extractClipFillProposals({operatorList:clipData.ops,OPS}).proposals.map(clipped);
 clipPaint[0].clipDepth=2;assert.equal(verify(clipData,clipPaint,{createCanvas:factory}).verified,false);assert.equal(allocations,0);
});

test('malformed commands, self crossing clips, oversized images, transforms and cancellation fail closed',async t=>{
 const f=await oracle(t,rectangle),paints=extractVectorPage({operatorList:f.ops,OPS}).elements.map(native);
 for(const m of [[1,0,0,0,0,0],[1,0,0,1,NaN,0]])assert.equal(verify(f,paints,{viewportTransform:m}).verified,false);
 assert.equal(verify(f,paints,{image:{...f.image,width:257}}).verified,false);assert.equal(verify(f,paints,{image:{...f.image,left:.5}}).verified,false);
 const malformed=structuredClone(paints);malformed[0].pathCommands=[0,1,NaN];assert.equal(verify(f,malformed).verified,false);
 const huge=structuredClone(paints);huge[0].pathCommands=Array.from({length:12000},()=>[0,20,20]).flat();assert.match(verify(f,huge).reason,/budget/);
 let checks=0,released;const cancelled=verify(f,paints,{cancelled:()=>++checks>10,createCanvas:(w,h)=>{released=createCanvas(w,h);return released;}});assert.equal(cancelled.verified,false);assert.match(cancelled.reason,/cancelled/);assert.equal(released.width,0);assert.equal(released.height,0);
 const clippedPaint={kind:'clip-fill',id:3,clipOperatorId:0,clipPathId:1,bounds:[20,20,40,40],fill:'#000000',clipRule:'nonzero',wholeOperation:true,opaque:true,contextComplete:true,clipDepth:1,clip:{sourceCommands:[0,20,20,1,40,40,1,20,40,1,40,20,4],matrix:[1,0,0,1,0,0]},paint:{sourceCommands:[0,0,0,1,80,0,1,80,80,1,0,80,4],matrix:[1,0,0,1,0,0]}};
 assert.match(verify(f,[clippedPaint]).reason,/Self-intersecting/);
});

test('reused canvas clipping cannot hide missing paint during verification',async t=>{
 const clean=await oracle(t,rectangle),paints=extractVectorPage({operatorList:clean.ops,OPS}).elements.map(native),covered=await oracle(t,`${rectangle} 1 g 30 20 10 20 re f`);
 const result=verify(covered,paints,{createCanvas:(w,h)=>{const canvas=createCanvas(w,h),ctx=canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS);ctx.beginPath();ctx.rect(0,0,60,h);ctx.clip();return canvas;}});
 assert.equal(result.verified,false);assert.equal(result.diagnostics.mismatchedPixels,800);
});

test('visibility deliberately does not certify semantic equivalence or reject unselected extra target detail',async t=>{
 const clean=await oracle(t,rectangle),paints=extractVectorPage({operatorList:clean.ops,OPS}).elements.map(native),extra=await oracle(t,`${rectangle} 0 g 45 25 2 2 re f`),result=verify(extra,paints);
 assert.equal(result.verified,true);assert.equal(Object.hasOwn(result,'score'),false,'caller must still verify complete symbol topology and source equivalence');
});

test('actual PDF subpixel-width strokes use original raw transforms and PDF.js one-device-pixel floor',async t=>{
 const content='0.8 0.1 0.2 rg 35 35 25 25 re f q .24 0 0 .24 40.2 40.1 cm 0 G 2 w 1 J 1 j 0 0 m 60 0 l 60 60 l 0 60 l h S 0 0 m 60 60 l S Q';
 const f=await oracle(t,content),v=extractVectorPage({operatorList:f.ops,OPS});assert.equal(v.supported,true,v.reason);
 const paints=v.elements.map(e=>({...native(e),...(e.style.stroke?{rawPath:{sourceCommands:Array.from(f.ops.argsArray[e.id][1][0]),matrix:[.24,0,0,.24,40.2,40.1],sourceLineWidth:2}}:{})}));
 assert.ok(paints.filter(p=>p.style.stroke).every(p=>p.style.width===.48));
 const result=verify(f,paints);assert.equal(result.verified,true,result.reason);assert.ok(result.diagnostics.opaquePixels>0);assert.equal(result.requiresSemanticVerification,true);
 for(const change of [p=>{p.rawPath.matrix[4]+=.001;},p=>{p.rawPath.sourceLineWidth=1.9;},p=>{p.rawPath.sourceCommands[0]=1;},p=>{p.rawPath.matrix[2]=.1;}]){const bad=structuredClone(paints);change(bad[1]);assert.equal(verify(f,bad).verified,false);}
 assert.equal(verify(f,paints,{viewportTransform:[2,0,0,-3,0,256]}).verified,false,'nonuniform stroke viewports fail closed');
});

test('explicit context is replayed in original order but cannot supply retained opaque quantity or semantic proof',async t=>{
 const content='0.8 0.1 0.2 rg 20 20 20 20 re f 0 G 2 w 1 J 30 12 m 30 20 l S 0 g 29 29 2 2 re f',f=await oracle(t,content),all=extractVectorPage({operatorList:f.ops,OPS}).elements.map(native),contextPaints=[all[1]],paints=[all[0],all[2]],authorizedContextIds=[all[1].id];
 const result=verify(f,paints,{contextPaints,authorizedContextIds});assert.equal(result.verified,true,result.reason);assert.equal(result.diagnostics.paintCount,2);assert.equal(result.diagnostics.contextPaintCount,1);assert.equal(result.diagnostics.foregroundPixels,1600,'pipe pixels outside symbol are not required foreground');assert.equal(result.requiresContextVerification,true);
 assert.equal(verify(f,paints,{contextPaints}).verified,false,'context needs explicit caller authorization');assert.equal(verify(f,paints,{contextPaints,authorizedContextIds:[99999]}).verified,false);
 assert.equal(verify(f,paints,{contextPaints:[all[0]],authorizedContextIds:[all[0].id]}).verified,false,'retained IDs cannot double as context');
});

test('even explicitly authorized opaque context cannot conceal a complete retained centre',async t=>{
 const content='0.8 0.1 0.2 rg 20 20 20 20 re f 0 g 29 29 2 2 re f',clean=await oracle(t,content),paints=extractVectorPage({operatorList:clean.ops,OPS}).elements.map(native),covered=await oracle(t,`${content} 1 g 28 28 4 4 re f`),id=covered.ops.fnArray.findLastIndex(op=>op===OPS.constructPath);
 const context={kind:'path',id,bounds:[28,28,32,32],pathCommands:[0,28,28,1,32,28,1,32,32,1,28,32,4],paintClosesPath:false,style:{fill:'#ffffff',stroke:null,rule:'nonzero'},wholeOperation:true,opaque:true,contextComplete:true,clipDepth:0};
 const result=verify(covered,paints,{contextPaints:[context],authorizedContextIds:[id]});assert.equal(result.verified,false);assert.match(result.reason,/Context obscures an entire retained component/);
});

test('capture requires the actual readback context and pinned renderer, not a default display canvas',()=>{
 const canvas=createCanvas(32,32),defaultContext=canvas.getContext('2d');
 assert.equal(defaultContext.getContextAttributes().willReadFrequently,false);
 const capture=context=>captureContourRaster({context,width:32,height:32,left:0,top:0,pdfjsVersion:PDFJS_VERSION});
 assert.throws(()=>capture(defaultContext),/readback rendering contract/);
 // Asking again with readback options cannot retrofit an existing context.
 assert.throws(()=>capture(canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS)),/readback rendering contract/);
 const readback=createCanvas(32,32),ctx=readback.getContext('2d',CONTOUR_CONTEXT_OPTIONS),image=capture(ctx);assert.equal(image.rendering.contract,CONTOUR_RASTER_CONTRACT);assert.equal(image.rendering.context.willReadFrequently,true);
 assert.throws(()=>captureContourRaster({context:ctx,width:32,height:32,left:0,top:0,pdfjsVersion:'6.4.298'}),/pinned PDF.js/);
 assert.throws(()=>captureContourRaster({context:ctx,width:31,height:32,left:0,top:0,pdfjsVersion:PDFJS_VERSION}),/crop/);
 assert.throws(()=>captureContourRaster({context:{canvas:{width:32,height:32}},width:32,height:32,left:0,top:0,pdfjsVersion:PDFJS_VERSION}),/cannot establish/);
 canvas.width=canvas.height=readback.width=readback.height=0;
});

test('missing or incompatible raster contracts reject before pixel verification; reused display factories reject explicitly',async t=>{
 const f=await oracle(t,rectangle),paints=extractVectorPage({operatorList:f.ops,OPS}).elements.map(native);let allocations=0;
 for(const mutate of [image=>{delete image.rendering;},image=>{image.rendering.contract='display-canvas';},image=>{image.rendering.pdfjsVersion='next';},image=>{image.rendering.context.willReadFrequently=false;},image=>{image.rendering.context.colorSpace='display-p3';},image=>{image.rendering.context.colorType='float16';},image=>{image.rendering.context.alpha=false;},image=>{image.rendering.context.desynchronized=true;}]){const image=structuredClone(f.image);mutate(image);const result=verify(f,paints,{image,createCanvas:(w,h)=>{allocations++;return createCanvas(w,h);}});assert.equal(result.verified,false);assert.match(result.reason,/readback rendering contract/);}
 assert.equal(allocations,0);
 let reused;const result=verify(f,paints,{createCanvas:(w,h)=>{reused=createCanvas(w,h);reused.getContext('2d');return reused;}});assert.equal(result.verified,false);assert.match(result.reason,/Canvas does not use/);assert.equal(reused.width,0);assert.equal(reused.height,0);
});

test('original browser-backend regression fixture retains one-pixel knockout rejection under the readback contract',async t=>{
 // This original fixture reproduced default/readback raster divergence in
 // Chrome. Backend-dependent difference counts are deliberately not asserted
 // in Node; the explicit contract and exact opaque-detail guard are portable.
 const content='q .24 0 0 .24 20.1 20.2 cm 0 15 m 10 0 l 50 0 l 60 15 l 60 45 l 50 60 l 10 60 l 0 45 l h W n .9 .2 .1 rg -10 -10 80 80 re f Q q .24 0 0 .24 20.1 20.2 cm 0 G 2 w 1 J 1 j 0 15 m 10 0 l 50 0 l 60 15 l 60 45 l 50 60 l 10 60 l 0 45 l h S 0 g 25 25 m 35 25 l 30 35 l h f Q';
 const task=getDocument({data:pdf(content),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),ops=await page.getOperatorList(),clips=extractClipFillProposals({operatorList:ops,OPS}).proposals,clipIds=new Set(clips.map(p=>p.paintId)),ids=ops.fnArray.flatMap((op,id)=>op===OPS.constructPath&&ops.argsArray[id][0]!==OPS.endPath&&!clipIds.has(id)?[id]:[]),raw=extractRawPathProvenance({operatorList:ops,OPS,ids});assert.equal(raw.requestedComplete,true);
 const paints=[...clips.map(clipped),...raw.records.map(r=>({...native(r),rawPath:{sourceCommands:r.sourceCommands,matrix:r.matrix,sourceLineWidth:r.sourceLineWidth}}))].sort((a,b)=>a.id-b.id),viewport=page.getViewport({scale:2,rotation:0}),canvas=createCanvas(256,256),ctx=canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS);
 await page.render({canvas,canvasContext:ctx,viewport}).promise;const image=captureContourRaster({context:ctx,width:256,height:256,left:0,top:0,pdfjsVersion:PDFJS_VERSION});canvas.width=canvas.height=0;
 const f={image,viewportTransform:Array.from(viewport.transform)},result=verify(f,paints);assert.equal(result.verified,true,result.reason);
 const pixel=(201*256+54)*4;assert.deepEqual(Array.from(image.data.slice(pixel,pixel+4)),[0,0,0,255]);image.data[pixel]=image.data[pixel+1]=image.data[pixel+2]=255;
 const knockedOut=verify(f,paints);assert.equal(knockedOut.verified,false);assert.equal(knockedOut.diagnostics.mismatchedPixels,1);
});
