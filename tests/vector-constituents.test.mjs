import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractVectorPage,findVectorMatches,createVectorTemplate} from '../apps/local/web/vector-recognition.mjs';
import {createConstituentTemplate,findConstituentMatches} from '../apps/local/web/vector-constituents.mjs';
// Original literal-PDF fixture. Labels come from construction, not the matcher.
const points=Array.from({length:181},(_,i)=>[12*Math.cos(i*2*Math.PI/180),12*Math.sin(i*2*Math.PI/180)]);
const n=x=>Math.abs(x)<1e-10?'0':x.toFixed(6);
const path=ps=>`${n(ps[0][0])} ${n(ps[0][1])} m ${ps.slice(1).map(p=>`${n(p[0])} ${n(p[1])} l`).join(' ')}`;
const dot='1 0 0 rg 2 -2 m 4 0 l 2 2 l 0 0 l h f';
function symbol(x,y,{split=false,angle=0,reverse=false,extra='',dotShift=0,width=.5,joinedExtra=false}={}){
 const a=angle*Math.PI/180,m=[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),x,y].map(n).join(' '),parts=split?[points.slice(0,171),points.slice(170)]:[points];
 return `q ${m} cm 0 G ${width} w 1 J 1 j ${parts.map(p=>path(reverse?[...p].reverse():p)+(joinedExtra?' 16 0 m 19 0 l':'')+' S').join(' ')} q 1 0 0 1 ${dotShift} 0 cm ${dot} Q ${extra} Q`;
}
function pdf(stream){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 440 180] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let s='%PDF-1.4\n';const offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=Buffer.byteLength(s);s+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(i=>`${String(i).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Uint8Array.from(Buffer.from(s));}
async function opened(stream,fn){const task=getDocument({data:pdf(stream),isEvalSupported:false});try{const page=await(await task.promise).getPage(1),geometry=extractVectorPage({operatorList:await page.getOperatorList(),OPS});return await fn(page,geometry);}finally{await task.destroy();}}
const options={bounds:[26,46,54,74],anchor:[41,59]};
test('actual PDF split/reversed/rotated strokes preserve full provenance and original anchor',async()=>{
 const content=symbol(40,60)+symbol(140,60,{split:true})+symbol(240,60,{split:true,reverse:true})+symbol(340,60,{split:true,angle:90});
 await opened(content,async(page,g)=>{
  assert.equal(g.supported,true);const template=createConstituentTemplate(g,options),old=createVectorTemplate(g,options),before=structuredClone(g);
  assert.equal(findVectorMatches(g,old).length,1,'old whole-operation identity misses split equivalents');
  const hits=findConstituentMatches(g,template);assert.deepEqual(hits.map(h=>[Math.round(h.x),Math.round(h.y)]),[[41,59],[141,59],[241,59],[341,61]]);
  assert.deepEqual(findConstituentMatches(g,template,{tolerance:.25}).map(h=>[Math.round(h.x),Math.round(h.y)]),[[41,59],[141,59],[241,59],[341,61]],'largest allowed tolerance must retain exact equivalent matches');
  assert.deepEqual(g,before);for(const h of hits){assert.equal(h.wholeOperations,true);assert.equal(h.score,undefined);assert.equal(h.geometryScore,1);assert.equal(h.requiresRenderVerification,true);for(const p of h.provenance)assert.deepEqual(p.segmentIndices,g.elements.find(e=>e.id===p.elementId).segments.map((_,i)=>i));}
  // Actual rendered full-op crops independently confirm the split source and
  // target have identical visible ink for this round cap/join fixture at 4x.
  async function crop(x){const v=page.getViewport({scale:4,rotation:0}),p=v.convertToViewportPoint(x-14,74),viewport=v.clone({offsetX:-p[0],offsetY:-p[1]}),canvas=createCanvas(112,112),ctx=canvas.getContext('2d');try{await page.render({canvas,canvasContext:ctx,viewport}).promise;return ctx.getImageData(0,0,112,112).data;}finally{canvas.width=canvas.height=0;}}
  const a=await crop(40),b=await crop(140);let extra=0,missing=0;for(let i=0;i<a.length;i+=4){const ai=a[i]*.2126+a[i+1]*.7152+a[i+2]*.0722<160,bi=b[i]*.2126+b[i+1]*.7152+b[i+2]*.0722<160;extra+=!ai&&bi;missing+=ai&&!bi;}assert.deepEqual({extra,missing},{extra:0,missing:0});
 });
});
test('rejects added or moved internal detail and partial whole-operation reuse',async()=>{
 const cases=[{dotShift:.8},{extra:'0 G .5 w 0 0 m 12 0 l S'},{extra:'0 G .5 w -4 -4 8 8 re S'},{width:1},{joinedExtra:true},{extra:'0 G 6 w 14 -5 m 14 5 l S'}];
 for(const negative of cases)await opened(symbol(40,60)+symbol(140,60,{split:true,...negative}),(_,g)=>{const hits=findConstituentMatches(g,createConstituentTemplate(g,options));assert.equal(hits.length,1,JSON.stringify(negative));assert.equal(hits[0].x,41);});
});
test('only explicit exact source crossing exclusion permits corresponding target line',async()=>{
 const pipe='0 G .5 w -18 0 m 18 0 l S';
 await opened(symbol(40,60,{extra:pipe})+symbol(140,60,{split:true,extra:pipe}),(_,g)=>{
  const ids=g.elements.filter(e=>e.bounds[0]>=20&&e.bounds[2]<=60).map(e=>e.id),excluded=ids.filter(id=>g.elements.find(e=>e.id===id).bounds[2]-g.elements.find(e=>e.id===id).bounds[0]>30);
  const t=createConstituentTemplate(g,{...options,ids,excluded});assert.equal(t.supported,true);assert.equal(findConstituentMatches(g,t).length,2);
  const changed=structuredClone(g),targetPipe=changed.elements.find(e=>e.bounds[0]===122&&e.bounds[2]===158);targetPipe.segments[0][4]+=.5;assert.equal(findConstituentMatches(changed,t).length,1);
 });
});
test('unsupported clips and atomic budgets/cancellation never yield accepted partial results',async()=>{
 await opened('q 0 0 440 180 re W n '+symbol(40,60)+' Q',(_,g)=>{assert.equal(g.supported,false);assert.equal(createConstituentTemplate(g,options).supported,false);assert.throws(()=>findConstituentMatches(g,{}),{code:'VECTOR_CONSTITUENTS_UNSUPPORTED'});});
 await opened(symbol(40,60)+symbol(140,60,{split:true}),(_,g)=>{const t=createConstituentTemplate(g,options);assert.throws(()=>findConstituentMatches(g,t,{maxComparisons:10}),{code:'VECTOR_CONSTITUENTS_BUDGET'});assert.throws(()=>findConstituentMatches(g,t,{cancelled:()=>true}),{code:'VECTOR_CONSTITUENTS_CANCELLED'});assert.throws(()=>findConstituentMatches(g,t,{tolerance:Infinity}),{code:'VECTOR_CONSTITUENTS_UNSUPPORTED'});});
});
test('nearest exact assignment retains reordered close parallel segments at allowed tolerance',async()=>{
 const shape=(x,ys)=>`q 1 0 0 1 ${x} 60 cm 0 G .02 w 1 J 1 j ${ys.map(y=>`0 ${y} m 1 ${y} l S`).join(' ')} 1 0 0 rg 5 0 m 6 0 l 5 1 l h f Q`;
 await opened(shape(40,[0,.2,.4])+shape(140,[.2,.4,0]),(_,g)=>{
  const t=createConstituentTemplate(g,{bounds:[38,58,48,64],anchor:[40,60]});
  assert.deepEqual(findConstituentMatches(g,t,{tolerance:.25,rotations:false}).map(h=>[h.x,h.y]),[[40,60],[140,60]]);
 });
});
