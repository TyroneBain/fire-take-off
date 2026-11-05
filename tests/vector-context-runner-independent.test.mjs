import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';

// Original two-page construction, fixed before evaluating the production
// runner: page1 source; page2 three positives and two wrong-detail negatives.
// Opaque square edges avoid introducing an unrelated cubic-AA source blocker.
const heads=[{x:24,stem:'split',positive:true},{x:64,stem:'overlap',positive:true},{x:104,stem:'whole',positive:true},{x:144,stem:'split',extra:'-3 2 6 1 re f'},{x:184,stem:'split',extra:'-2 -2 4 4 re f'}];
const stems={whole:'-.5 -16 1 16 re f',split:'-.5 -16 1 12 re f -.5 -4 1 4 re f',overlap:'-.5 -16 1 14 re f -.5 -4 1 4 re f'};
const glyph=({x,stem,extra=''})=>`q 1 0 0 1 ${x} 40 cm 0 g 0 G ${stems[stem]} 1 0 0 RG 1 w -6 -6 12 12 re S 0 g ${extra} Q`;
function originalPdf(){
 const contents=[glyph({x:24,stem:'whole'}),heads.map(glyph).join('\n')],objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
 for(const[i,c]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 80] /Resources << >> /Contents ${4+2*i} 0 R >>`,`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
 let out='%PDF-1.4\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}const at=Buffer.byteLength(out);out+=`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`;return new Uint8Array(Buffer.from(out));
}
async function fixture(){
 const bytes=originalPdf(),digest=createHash('sha256').update(bytes).digest('hex'),drawing={id:'independent-context-pages',digest},task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});let ids;
 try{const list=await(await(await task.promise).getPage(1)).getOperatorList();ids=list.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]);}finally{await task.destroy();}assert.equal(ids.length,2);
 const events=[],canvases=[],run={cancelled:false},pdfjs={OPS,version,getDocument(options){const task=getDocument(options);events.push('open');return{promise:task.promise,destroy:async()=>{await task.destroy();events.push('destroy');}};}};
 const args={pdfjs,sourceDrawing:drawing,example:{drawing_id:drawing.id,digest,page:1,bounds:[17,33,31,47],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[ids[0]]}},targets:[{drawing,page:1},{drawing,page:2}],layerPolicy:'all-admitted',sourceData:bytes,run,createCanvas:(w,h)=>{const canvas=createCanvas(w,h);canvases.push(canvas);return canvas;}};
 return{args,events,canvases,run};
}
const released=f=>{assert.equal(f.events.filter(e=>e==='destroy').length,f.events.filter(e=>e==='open').length);assert.ok(f.canvases.every(c=>!c.width&&!c.height));assert.equal(f.run.cancel,undefined);assert.equal(f.run.task,undefined);};
test('independent production context runner recovers split and overlapping connectors without counting extra bar or centre',async()=>{
 const strictFixture=await fixture(),strict=await runSavedVectorPageSetReview(strictFixture.args);assert.equal(strict.completed,true);assert.deepEqual(strict.pages.map(p=>p.result.proposals.length),[1,1]);released(strictFixture);
 const f=await fixture(),before=structuredClone({example:f.args.example,targets:f.args.targets}),report=await runSavedVectorPageSetReview({...f.args,matchPolicy:'local-context-1'});assert.equal(report.completed,true);assert.deepEqual(report.pages.map(p=>p.result.proposals.length),[1,3]);assert.equal(report.totals.proposals,4);assert.deepEqual(report.source.anchor,strict.source.anchor);
 const [anchorX,anchorY]=report.source.anchor,targets=report.pages[1].result.proposals;
 for(const c of heads){const hit=targets.find(h=>Math.hypot(h.x-(anchorX+c.x-24),h.y-anchorY)<.05);assert.equal(Boolean(hit),Boolean(c.positive),`frozen ${c.stem} at ${c.x}`);}
 for(const page of report.pages){assert.equal(page.result.allHandlesPreparedBeforeRendering,true);assert.equal(page.result.coverage.complete,false);assert.equal(page.result.coverage.unknown.length,0);for(const hit of page.result.proposals){assert.equal(hit.visibility.verified,true,hit.visibility.reason);assert.deepEqual(hit.contextIds,[],'fill equivalence is geometric permission; it adds no target repaint context');assert.equal('score' in hit,false);}}
 const oldHit=strict.pages[1].result.proposals[0],kept=targets.find(h=>h.elementIds.join(',')===oldHit.elementIds.join(','));for(const k of ['x','y','rotation','elementIds'])assert.deepEqual(kept[k],oldHit[k],'strict first accepted pose preserved: '+k);
 assert.deepEqual({example:f.args.example,targets:f.args.targets},before);released(f);
});
test('independent production context runner cancellation discards already completed pages and final publication',async()=>{
 for(const boundary of ['second-page','publication']){const f=await fixture();let reached=false;await assert.rejects(runSavedVectorPageSetReview({...f.args,matchPolicy:'local-context-1',progress:p=>{if(boundary==='second-page'?p.stage==='target-open'&&p.pageIndex===2:p.stage==='complete'){reached=true;f.run.cancel();}}}),/cancel/i);assert.equal(reached,true,boundary);released(f);}
});
