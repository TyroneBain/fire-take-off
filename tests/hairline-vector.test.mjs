import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS,version as pdfjsVersion} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {extractRawPathProvenance} from '../apps/local/web/vector-paint-provenance.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from '../apps/local/web/pdf-contour-verification.mjs';
import {captureContourRaster,verifyContourVisibility,CONTOUR_CONTEXT_OPTIONS} from '../apps/local/web/contour-visibility.mjs';

function pdf(content,width=240,height=80){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << >> /Contents 4 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let s='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(s);s+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array(Buffer.from(s));
}
const glyph=(x,{matrix='1 0 0 1',width=0,extra='',red=false,centre=true}={})=>`q ${matrix} ${x} 20.25 cm 0 G 0 g ${width} w -8 -8 16 16 re S ${centre?`${red?'1 0 0 rg':''} -3 -3 m 3 -3 l -3 3 l b`:''} ${extra} Q`;
async function fixture(t,content,width,height){const task=getDocument({data:pdf(content,width,height),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),operatorList=await page.getOperatorList();return{doc,page,operatorList,ids:operatorList.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[])};}
const native=r=>({kind:'path',id:r.id,bounds:r.bounds,pathCommands:r.pathCommands,paintClosesPath:r.paintClosesPath,style:r.style,rawPath:{sourceCommands:r.sourceCommands,matrix:r.matrix,transformChain:r.transformChain,sourceLineWidth:r.sourceLineWidth},wholeOperation:true,opaque:true,contextComplete:true,clipDepth:0});

test('original hairline identities retain zero width and match translation/quarter-turn/scale without matching positive-width or semantic negatives',async t=>{
 const f=await fixture(t,[glyph(20.25),glyph(60.25,{matrix:'0 1 -1 0'}),glyph(100.25,{matrix:'1.25 0 0 1.25'}),glyph(140.25,{width:.01}),glyph(180.25,{extra:'2 2 1 1 re f'}),glyph(220.25,{centre:false})].join('\n')),vector=extractVectorPage({operatorList:f.operatorList,OPS});
 assert.equal(vector.supported,true,vector.reason);assert.ok(vector.elements.slice(0,6).every(e=>e.style.width===0));
 const template=createVectorTemplate(vector,{bounds:[10,10,31,31],ids:f.ids.slice(0,2),excluded:[],anchor:[20.25,20.25]}),hits=findVectorMatches(vector,template,{scaleRange:[.75,1.5]});
 assert.deepEqual(hits.map(h=>[h.x,h.y,h.rotation,h.scale]),[[20.25,20.25,0,1],[60.25,20.25,90,1],[100.25,20.25,0,1.25]]);
 const config=await f.doc.getOptionalContentConfig(),prepared=[];for(const hit of hits)prepared.push(await preparePdfContourPaints({page:f.page,OPS,elementIds:hit.elementIds,optionalContentConfig:config}));
 for(const handle of prepared){assert.equal(handle.supported,true,handle.reason);const proof=await verifyPdfContourPaints({prepared:handle,createCanvas,pdfjsVersion,includeAlphaMask:true});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.diagnostics.mismatchedPixels,0);assert.ok(proof.alphaMask.alpha.some(v=>v===255));}
});

test('hairline fill/stroke replays original uniform transform chains at multiple viewport scales and rotations',async t=>{
 const f=await fixture(t,'q 1 0 0 1 .125 .375 cm '+glyph(20.25)+' Q',64,64),raw=extractRawPathProvenance({operatorList:f.operatorList,OPS,ids:f.ids});assert.equal(raw.requestedComplete,true);assert.ok(raw.records.every(r=>r.sourceLineWidth===0&&r.style.width===0));
 for(const scale of [1,2,4])for(const rotation of [0,90]){
  const viewport=f.page.getViewport({scale,rotation}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS);let image;
  try{await f.page.render({canvas,canvasContext:ctx,viewport}).promise;image=captureContourRaster({context:ctx,left:0,top:0,width:canvas.width,height:canvas.height,pdfjsVersion});}finally{canvas.width=canvas.height=0;}
  const result=verifyContourVisibility({paints:raw.records.map(native),viewportTransform:Array.from(viewport.transform),image,createCanvas});assert.equal(result.verified,true,`${scale}/${rotation}: ${result.reason}`);assert.equal(result.diagnostics.mismatchedPixels,0);
  const invalid=raw.records.map(native);invalid[0]=structuredClone(invalid[0]);invalid[0].rawPath.sourceLineWidth=.00000001;assert.equal(verifyContourVisibility({paints:invalid,viewportTransform:Array.from(viewport.transform),image,createCanvas}).verified,false,'positive width cannot masquerade as zero through epsilon comparison');
 }
});

test('actual PDF zero-width line covers one device pixel regardless of viewport scale',async t=>{
 const f=await fixture(t,'0 G 0 w 32.25 12 m 32.25 52 l S',64,64);
 for(const scale of [.5,1,2,4]){const viewport=f.page.getViewport({scale}),canvas=createCanvas(viewport.width,viewport.height),ctx=canvas.getContext('2d');try{await f.page.render({canvas,canvasContext:ctx,viewport}).promise;const row=ctx.getImageData(0,Math.floor(canvas.height/2),canvas.width,1).data;let coverage=0;for(let x=0;x<canvas.width;x++)coverage+=(255-row[x*4])/255;assert.ok(Math.abs(coverage-1)<.02,`scale${scale}: ${coverage} device pixels`);}finally{canvas.width=canvas.height=0;}}
});

test('hairlines preserve original white-knockout refusal and malformed or nonuniform stroke guards',async t=>{
 const f=await fixture(t,glyph(20.25)+' 1 g 18.5 18.5 .5 .5 re f'),config=await f.doc.getOptionalContentConfig(),prepared=await preparePdfContourPaints({page:f.page,OPS,elementIds:f.ids.slice(0,2),optionalContentConfig:config});assert.equal(prepared.supported,true);const proof=await verifyPdfContourPaints({prepared,createCanvas,pdfjsVersion,includeAlphaMask:true});assert.equal(proof.verified,false);assert.match(proof.reason,/does not preserve/);assert.equal(proof.diagnostics.mismatchedPixels,1);assert.equal('alphaMask'in proof,false);
 for(const width of [-1,NaN,Infinity]){const operatorList={fnArray:[OPS.setLineWidth,OPS.constructPath],argsArray:[[width],[OPS.stroke,[[0,10,10,1,20,20]]]]};assert.equal(extractVectorPage({operatorList,OPS}).supported,false);assert.equal(extractRawPathProvenance({operatorList,OPS,ids:[1]}).requestedComplete,false);}
 const nonuniform=await fixture(t,'q 2 0 0 1 0 0 cm '+glyph(20.25)+' Q');assert.equal(extractVectorPage({operatorList:nonuniform.operatorList,OPS}).supported,false);assert.equal(extractRawPathProvenance({operatorList:nonuniform.operatorList,OPS,ids:nonuniform.ids}).requestedComplete,false);
});
