import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches,resolveVectorTextBounds} from '../apps/local/web/vector-recognition.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inkImage,exampleImage,findSymbolMatches} from '../apps/local/web/matcher.mjs';
import {matchRequestResult} from '../apps/local/web/match-worker.mjs';
import {benchmarkVectorPreview} from '../scripts/run-vector-preview-benchmark.mjs';
import {scoreInstances} from '../scripts/vector-qa-benchmark.mjs';

// Independent oracle: reflection maps these exact source coordinates to the
// same undirected line segments and dot centre as a clockwise quarter-turn.
// This does not call the matcher or change the original historical labels.
const originalLines=[[-8,-8,8,-8],[8,-8,8,8],[8,8,-8,8],[-8,8,-8,-8],[-4,-4,4,-4],[4,-4,4,4]];
const normalizedLines=transform=>originalLines.map(s=>[transform(s[0],s[1]),transform(s[2],s[3])].map(p=>p.join(',')).sort().join(':')).sort();
test('independent QA adjudication: original mirrored distractor is rotation-equivalent, not a valid negative',()=>{
 const mirror=(x,y)=>[-x,y],clockwise=(x,y)=>[y,-x];
 assert.deepEqual(normalizedLines(mirror),normalizedLines(clockwise));
 assert.deepEqual(mirror(-3,3),clockwise(-3,3));
 // Both preserve the filled radius-one circle and the stroke width, so the
 // physical marks are equal even though PDF traversal directions differ.
});

test('independent replay preserves raw historical scores and separately reports adjudicated geometry-equivalent labels',async t=>{
 const r=await benchmarkVectorPreview();
 assert.deepEqual([r.baseline.raster_quarter_turns.tp,r.baseline.raster_quarter_turns.fp,r.baseline.raster_quarter_turns.fn],[9,2,5]);
 assert.deepEqual([r.candidate.tp,r.candidate.fp,r.candidate.fn],[11,1,3]);
 const adjudicated=[...r.fixture.labels,{id:'mirrored-equivalent-270',page:1,x:350,y:250}];
 const baseline=scoreInstances(r.baseline.raster_quarter_turns.hits,adjudicated),candidate=scoreInstances(r.candidate.hits,adjudicated);
 assert.deepEqual([baseline.tp,baseline.fp,baseline.fn],[10,1,5]);
 assert.deepEqual([candidate.tp,candidate.fp,candidate.fn],[12,0,3]);
 assert.deepEqual(candidate.missed,['scaled-positive','oblique-positive','raster-only']);
 t.diagnostic(JSON.stringify({raw:{baseline:[9,2,5],candidate:[11,1,3]},adjudicated:{baseline:{tp:baseline.tp,fp:baseline.fp,fn:baseline.fn,precision:baseline.precision,recall:baseline.recall},candidate:{tp:candidate.tp,fp:candidate.fp,fn:candidate.fn,precision:candidate.precision,recall:candidate.recall}},scope:'Independent synthetic fixture only; no real-drawing or competitor accuracy claim'}));
});

function textFixture({overlap=false,clipping=false,mode=clipping?7:0,matrix,sourceOverlap=false,fontSize=10,frame}={}){
 const glyph='1 w 0 G 0 g -8 -8 16 16 re S -4 -4 m 4 -4 l 4 4 l S -4 2 2 2 re f';
 const draw=(x,y)=>`q 1 0 0 1 ${x} ${y} cm ${glyph} Q`;
 const text=`BT /F1 ${fontSize} Tf ${mode} Tr ${matrix||'1 0 0 1'} ${sourceOverlap?45:overlap?145:20} ${sourceOverlap?46:overlap?46:180} Tm (X) Tj ET`;
 const surround=frame?`q 1 w 0 G 0 g ${frame==='crossing'?44:20} 20 ${frame==='crossing'?136:160} 70 re ${frame==='filled'?'f':'S'} Q`:'';
 const content=`${draw(50,50)}\n${draw(150,50)}\n${surround}\n${text}\n`;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let out='%PDF-1.4\n',offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(out);out+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return {bytes:Buffer.from(out),truth:{positive:[{x:50,y:50},{x:150,y:50}],text:sourceOverlap?'over seed symbol':overlap?'over second symbol':'far above symbols',clipping,mode}};
}
export {textFixture};

test('independent text fixtures require rendering evidence before vector matching and still reject clipping',async t=>{
 for(const variant of [{},{overlap:true},{clipping:true}]){
  const f=textFixture(variant),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false,standardFontDataUrl:process.cwd()+'/node_modules/pdfjs-dist/standard_fonts/'});
  try{const page=await(await task.promise).getPage(1),ops=await page.getOperatorList(),vector=extractVectorPage({operatorList:ops,OPS});
   assert.ok(ops.fnArray.includes(OPS.showText),'fixture must contain actual text paint');
   assert.equal(vector.supported,false,'text cannot be trusted before render evidence');
   assert.match(vector.reason,/Text|text|clipp/i);
   t.diagnostic(JSON.stringify({case:f.truth.text,clipping:f.truth.clipping,vectorSupported:vector.supported,reason:vector.reason,expectedSymbols:2,vectorMatches:0}));
  }finally{await task.destroy();}
 }
});

test('independent enclosing-frame regression ignores only disjoint strokes, preserves explicit identities and rejects crossing/fill content',async()=>{
 const r=await renderTextFixture({frame:'enclosing'});try{
  assert.ok(r.vector.supported,r.vector.reason);assert.ok(r.template.vector.supported,r.template.vector.reason);
  assert.equal(r.template.vector.elements.length,3,'the symbol retains its three paths, not the enclosing frame');
  const frame=r.vector.elements.find(e=>e.bounds.join(',')==='20,20,180,90');assert.ok(frame,'actual PDF frame is extracted');
  assert.ok(!r.template.vector.elements.some(e=>e.id===frame.id));
  assert.deepEqual(findVectorMatches(r.vector,r.template.vector).map(h=>[h.x,h.y]),[[50,50],[150,50]]);
  const explicitlySelected=createVectorTemplate(r.vector,{bounds:[38,38,62,62],anchor:[50,50],ids:[...r.template.vector.elements.map(e=>e.id),frame.id]});
  assert.equal(explicitlySelected.supported,false,'explicit saved path identity must not be silently dropped');
  assert.match(explicitlySelected.reason,/cuts a vector path/);
 }finally{await r.task.destroy();}
 for(const frame of ['crossing','filled']){const r=await renderTextFixture({frame});try{assert.equal(r.template.vector.supported,false,frame);assert.match(r.template.vector.reason,/cuts a vector path/);if(frame==='filled')assert.throws(()=>matchRequestResult(r),/Too many ambiguous matches/,'solid black selection must fail without partial output');else assert.equal(matchRequestResult(r).engine,'raster');}finally{await r.task.destroy();}}
});

async function renderTextFixture(variant={},view={scale:2,rotation:0},{disableFontFace=false}={}){
 const f=textFixture(variant),task=getDocument({data:new Uint8Array(f.bytes),isEvalSupported:false,disableFontFace,standardFontDataUrl:process.cwd()+'/node_modules/pdfjs-dist/standard_fonts/'});
 try{const page=await(await task.promise).getPage(1),pending=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),viewport=page.getViewport(view),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');
  const started=performance.now();await page.render({canvas,canvasContext:ctx,viewport,recordOperations:true}).promise;const renderMs=performance.now()-started;
  const vector=resolveVectorTextBounds(pending,{reader:page.recordedBBoxes,viewport,width:canvas.width,height:canvas.height});
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,a=viewport.convertToViewportPoint(38,62),b=viewport.convertToViewportPoint(62,38),source=exampleImage(inkImage(rgba,canvas.width,canvas.height),[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])]);
  const template={...source,matchRotations:true,matchThreshold:.95,vector:createVectorTemplate(vector,{bounds:[38,38,62,62],anchor:[50,50]})};
  return {f,task,page,pending,viewport,width:canvas.width,height:canvas.height,rgba,vector,vectorPage:vector,template,renderMs};
 }catch(e){await task.destroy();throw e;}
}

test('independent actual-render text bounds allow distant labels and preserve native coordinates through rotated views',async t=>{
 for(const rotation of [0,90,180,270]){
  const r=await renderTextFixture({}, {scale:2,rotation});try{
   assert.ok(r.pending.pendingTextBounds);assert.ok(r.vector.supported,r.vector.reason);assert.ok(r.template.vector.supported);
   const hits=findVectorMatches(r.vector,r.template.vector);assert.deepEqual(hits.map(h=>[h.x,h.y]),[[50,50],[150,50]]);
   const started=performance.now(),actual=matchRequestResult(r),matchingMs=performance.now()-started;assert.equal(actual.engine,'vector');assert.equal(actual.matches.length,2);
   t.diagnostic(JSON.stringify({case:'distant text',rotation,tp:2,fp:0,fn:0,engine:actual.engine,renderMs:r.renderMs,matchingMs}));
  }finally{await r.task.destroy();}
 }
});

test('independent overlap cases trigger whole-page raster fallback and never leak partial vector counts',async t=>{
 for(const variant of [{overlap:true},{overlap:true,matrix:'0.70710678 0.70710678 -0.70710678 0.70710678'},{overlap:true,matrix:'1.5 0 0 1.5'},{overlap:true,fontSize:-10}]){
  const r=await renderTextFixture(variant);try{
   assert.ok(r.vector.supported,r.vector.reason);assert.ok(r.template.vector.supported,r.template.vector.reason);
   assert.throws(()=>findVectorMatches(r.vector,r.template.vector),e=>e.code==='VECTOR_TEXT_OVERLAP');
   const expected=findSymbolMatches(inkImage(r.rgba,r.width,r.height),r.template,{rotations:true,threshold:.95}),started=performance.now(),actual=matchRequestResult(r),matchingMs=performance.now()-started;
   assert.equal(actual.engine,'raster');assert.deepEqual(actual.matches,expected);assert.match(actual.fallbackReason,/overlaps text/);
   t.diagnostic(JSON.stringify({case:'overlapping text',variant,engine:actual.engine,found:actual.matches.length,renderMs:r.renderMs,matchingMs}));
  }finally{await r.task.destroy();}
 }
});

test('independent source overlap, invisible text, clipped text and missing bounds retain conservative safety',async()=>{
 const source=await renderTextFixture({sourceOverlap:true});try{assert.equal(source.template.vector.supported,false);assert.match(source.template.vector.reason,/overlaps text/);}finally{await source.task.destroy();}
 const invisible=await renderTextFixture({overlap:true,mode:3});try{assert.ok(invisible.vector.supported);assert.equal(matchRequestResult(invisible).engine,'vector');assert.equal(matchRequestResult(invisible).matches.length,2);}finally{await invisible.task.destroy();}
 for(const mode of [1,2,4,7]){const r=await renderTextFixture({mode});try{assert.equal(r.vector.supported,false);assert.match(r.vector.reason,/Stroked or clipping/);assert.equal(matchRequestResult(r).engine,'raster');}finally{await r.task.destroy();}}
 const r=await renderTextFixture();try{
  assert.equal(resolveVectorTextBounds(r.pending).supported,false);
  const bounds={isEmpty:()=>false,minX:()=>0,minY:()=>0,maxX:()=>1,maxY:()=>1};
  assert.equal(resolveVectorTextBounds(r.pending,{reader:bounds,viewport:r.viewport,width:r.width,height:r.height}).supported,false,'full-page unknown bound must fall back');
  assert.equal(resolveVectorTextBounds(r.pending,{reader:{...bounds,isEmpty:()=>true},viewport:r.viewport,width:r.width,height:r.height}).supported,false);
 }finally{await r.task.destroy();}
 const pathFonts=await renderTextFixture({},undefined,{disableFontFace:true});try{assert.equal(pathFonts.vector.supported,false);assert.match(pathFonts.vector.reason,/uncertain across the whole page/);assert.equal(matchRequestResult(pathFonts).engine,'raster');}finally{await pathFonts.task.destroy();}
});
