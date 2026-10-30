import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractClipFillProposals} from '../apps/local/web/vector-clip-paths.mjs';

// Independent proposal-stage cases, declared before new candidate API exists.
// All geometry is original. Expected values describe admissible proposals,
// never automatic visible matches or estimating quantities.
const triangle='30 30 m 50 30 l 30 50 l h',cover='28 28 24 24 re',red='1 0 0 rg';
const cases=[
 {id:'simple-triangle',content:`q ${triangle} W n ${red} ${cover} f Q`,expectedProposals:1,visible:true,direct:`${red} ${triangle} f`},
 {id:'simple-concave',content:`q 30 30 m 50 30 l 50 36 l 36 36 l 36 50 l 30 50 l h W n ${red} ${cover} f Q`,expectedProposals:1,visible:true,direct:`${red} 30 30 m 50 30 l 50 36 l 36 36 l 36 50 l 30 50 l h f`},
 {id:'partial-cover',content:`q ${triangle} W n ${red} 28 28 12 24 re f Q`,expectedProposals:0,reason:'rectangle does not cover entire native clip bounding box'},
 {id:'nested',content:`q 20 20 40 40 re W n q ${triangle} W n ${red} ${cover} f Q Q`,expectedProposals:0,reason:'two active clips even though outer clip contains inner'},
 {id:'hole',content:`q 30 30 20 20 re 35 35 10 10 re W* n ${red} ${cover} f Q`,expectedProposals:0,reason:'multiple subpaths/even-odd hole'},
 {id:'self-intersection',content:`q 30 30 m 50 50 l 30 50 l 50 30 l h W n ${red} ${cover} f Q`,expectedProposals:0,reason:'bow-tie clip is not simple'},
 {id:'curve',content:`q 30 30 m 50 30 50 50 30 50 c h W n ${red} ${cover} f Q`,expectedProposals:0,reason:'curved clipping path unsupported'},
 {id:'translucent',content:`q ${triangle} W n /Half gs ${red} ${cover} f Q`,expectedProposals:0,reason:'nonopaque fill'},
 {id:'blend',content:`q ${triangle} W n /Blend gs ${red} ${cover} f Q`,expectedProposals:0,reason:'non-normal blend'},
 {id:'ctm-change',content:`q 1 0 0 1 10 0 cm ${triangle} W n 1 0 0 1 -10 0 cm ${red} 38 28 24 24 re f Q`,expectedProposals:1,visible:true,direct:`${red} 40 30 m 60 30 l 40 50 l h f`},
 {id:'restore-clip',content:`q ${triangle} W n Q ${red} ${cover} f`,expectedProposals:0,reason:'saved clip has been restored away'},
 {id:'pending-clip',content:`q ${red} ${triangle} W f ${cover} f Q`,expectedProposals:1,visible:true,direct:`${red} ${triangle} f`,reason:'W applies after first paint; only later covering rectangle is a proposal'},
 {id:'white-overpaint',content:`q ${triangle} W n ${red} ${cover} f Q 1 g 20 20 40 40 re f`,expectedProposals:1,visible:false,reason:'proposal extraction cannot establish final visible ink; downstream verifier must reject'},
];
function pdfBytes(content){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << /ExtGState << /Half << /ca 0.5 >> /Blend << /BM /Multiply >> >> >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let text='%PDF-1.4\n';const offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(text);text+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(text));
}

async function withPage(content,fn){const task=getDocument({data:pdfBytes(content),isEvalSupported:false});try{return await fn(await(await task.promise).getPage(1));}finally{await task.destroy();}}
async function rgba(content){return withPage(content,async page=>{const canvas=createCanvas(400,400),ctx=canvas.getContext('2d');try{await page.render({canvas,canvasContext:ctx,viewport:page.getViewport({scale:4})}).promise;return ctx.getImageData(0,0,400,400).data;}finally{canvas.width=canvas.height=0;}});}

test('independent literal-PDF clip proposals satisfy thirteen predeclared admissibility cases without claiming visibility',async t=>{
 for(const c of cases)await t.test(c.id,()=>withPage(c.content,async page=>{
  const operatorList=await page.getOperatorList(),result=extractClipFillProposals({operatorList,OPS});
  assert.equal(result.proposals.length,c.expectedProposals,c.reason);
  assert.equal(result.complete,false);assert.equal(result.requiresRenderVerification,true);
  for(const proposal of result.proposals){
   assert.equal(proposal.visibility,'unverified');assert.equal(proposal.requiresRenderVerification,true);
   assert.equal(operatorList.fnArray[proposal.paintId],OPS.constructPath);
   assert.equal(operatorList.fnArray[proposal.clipPathId],OPS.constructPath);
   assert.ok([OPS.clip,OPS.eoClip].includes(operatorList.fnArray[proposal.clipOperatorId]));
   assert.ok(proposal.clipPathId<proposal.paintId,'pending clip cannot affect its defining paint');
   assert.equal(proposal.clip.matrix.length,6);assert.equal(proposal.paint.matrix.length,6);
  }
  if(c.id==='ctm-change'){
   assert.deepEqual(result.proposals[0].bounds,[40,30,60,50]);
   assert.deepEqual(result.proposals[0].clip.matrix,[1,0,0,1,10,0]);
   assert.deepEqual(result.proposals[0].paint.matrix,[1,0,0,1,0,0]);
  }
  if(c.id==='pending-clip')assert.ok(result.paintContexts.find(p=>p.paintId===result.proposals[0].clipPathId).definesClip);
 }));
});

test('independent render oracle distinguishes geometrically admissible proposals from visible content',async()=>{
 for(const id of ['simple-triangle','simple-concave','ctm-change']){const c=cases.find(c=>c.id===id);assert.deepEqual(await rgba(c.content),await rgba(c.direct),id);}
 const hidden=await rgba(cases.find(c=>c.id==='white-overpaint').content);
 assert.ok(hidden.every(value=>value===255),'fully covered clip proposal contributes no final visible pixel');
 // Combined W+paint legitimately paints twice at the diagonal edge. Do not
 // replace its raw paths/CTMs with a supposedly equivalent once-filled shape.
 const pending=cases.find(c=>c.id==='pending-clip');assert.notDeepEqual(await rgba(pending.content),await rgba(pending.direct));
});

test('independent proposal cancellation and work limits return no partial candidates',async()=>{
 await withPage(cases[0].content+' '+cases[0].content,async page=>{
  const operatorList=await page.getOperatorList();assert.equal(extractClipFillProposals({operatorList,OPS}).proposals.length,2);
  const limited=extractClipFillProposals({operatorList,OPS,maxProposals:1});assert.deepEqual(limited.proposals,[]);assert.match(limited.reason,/budget/i);
  const cancelled=extractClipFillProposals({operatorList,OPS,cancelled:()=>true});assert.deepEqual(cancelled.proposals,[]);assert.match(cancelled.reason,/cancel/i);
 });
 await withPage(cases.find(c=>c.id==='simple-concave').content,async page=>{
  const r=extractClipFillProposals({operatorList:await page.getOperatorList(),OPS,maxPairComparisons:1});assert.deepEqual(r.proposals,[]);assert.match(r.reason,/intersection budget/i);
 });
});

test('independent deep clip chains and accumulated context IDs fail atomically within bounded metadata',async()=>{
 const clip=`${triangle} W n `;
 for(const [content,reason]of [
  [cases[0].content+' '+clip.repeat(80),/depth budget/i],
  [cases[0].content+' '+clip.repeat(50)+'28 28 24 24 re f '.repeat(6000),/context storage budget/i],
 ])await withPage(content,async page=>{
  const result=extractClipFillProposals({operatorList:await page.getOperatorList(),OPS});
  assert.match(result.reason,reason);assert.deepEqual(result.proposals,[]);
  assert.deepEqual(result.paintContexts,[]);assert.deepEqual(result.clipPaths,[]);
 });
});
