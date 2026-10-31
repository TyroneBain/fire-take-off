import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {vectorPoseQaFixture} from '../scripts/vector-pose-qa-fixture.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {reviewVectorFile} from '../scripts/review-vector-candidates.mjs';
const exec=promisify(execFile);
function solidFixture(){
 const content=[40,100,160].map(x=>`q 1 0 0 1 ${x} 40 cm 0 G 0 g 1 w -4 -4 8 8 re S -1 -1 2 2 re f Q`).join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];let out='%PDF-1.4\n';const offsets=[0];
 for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const xref=Buffer.byteLength(out);out+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(v=>`${String(v).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 const bytes=Buffer.from(out);return{bytes,manifest:{sha256:createHash('sha256').update(bytes).digest('hex'),selection:[34,34,46,46]}};
}
async function fixture(t,thin=false){
 const directory=await mkdtemp(join(tmpdir(),'vector-review-cli-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const {bytes,manifest}=thin?vectorPoseQaFixture():solidFixture(),task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});let ids;
 try{const page=await(await task.promise).getPage(1),ops=await page.getOperatorList();ids=ops.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]).slice(0,2);}finally{await task.destroy();}
 const pdfPath=join(directory,'original.pdf'),selectionPath=join(directory,'selection.json'),outputPath=join(directory,'report.json');
 const example={digest:manifest.sha256,page:1,bounds:manifest.selection,anchor:[9999,9999],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[]}};
 await writeFile(pdfPath,bytes);await writeFile(selectionPath,JSON.stringify({example}));return{directory,pdfPath,selectionPath,outputPath,bytes,example};
}
test('actual review CLI derives the original raster anchor and writes a scoreless report without changing inputs',async t=>{
 const f=await fixture(t),selectionBefore=await readFile(f.selectionPath);
 const {stdout}=await exec(process.execPath,['scripts/review-vector-candidates.mjs','--pdf',f.pdfPath,'--selection',f.selectionPath,'--out',f.outputPath],{timeout:30000});
 assert.deepEqual(JSON.parse(stdout.trim()),{completed:true,proposals:3,verifiedPaint:3,quantitiesSaved:0});
 const report=JSON.parse(await readFile(f.outputPath,'utf8'));assert.equal(report.result.completed,true);assert.equal(report.result.requiresSemanticReview,true);assert.equal(report.result.proposals.length,3);
 assert.deepEqual(report.result.source.anchor,[40,40],'derive the saved workflow anchor; ignore arbitrary JSON anchor');
 assert.deepEqual(report.result.proposals.map(p=>p.x),[40,100,160]);for(const p of report.result.proposals){assert.equal(p.visibility.verified,true);assert.equal('score'in p,false);}
 assert.deepEqual(await readFile(f.pdfPath),f.bytes);assert.deepEqual(await readFile(f.selectionPath),selectionBefore);
 await assert.rejects(reviewVectorFile(f),/Output already exists/);assert.deepEqual(JSON.parse(await readFile(f.outputPath,'utf8')),report);
});
test('review CLI refuses wrong document or element identity and cancellation without publishing a report',async t=>{
 const f=await fixture(t);
 await writeFile(f.selectionPath,JSON.stringify({...f.example,digest:'0'.repeat(64)}));await assert.rejects(reviewVectorFile(f),/digest/);await assert.rejects(access(f.outputPath));
 await writeFile(f.selectionPath,JSON.stringify({...f.example,elements:{...f.example.elements,renderer:'unknown'}}));await assert.rejects(reviewVectorFile(f),/compatible original/);await assert.rejects(access(f.outputPath));
 await writeFile(f.selectionPath,JSON.stringify(f.example));let cancelled=false;
 await assert.rejects(reviewVectorFile({...f,cancelled:()=>cancelled,progress:({phase})=>{if(phase==='complete')cancelled=true;}}),/cancel/i);await assert.rejects(access(f.outputPath));
});
test('thin source with no opaque detail remains unverified and does not publish a report',async t=>{
 const f=await fixture(t,true);await assert.rejects(reviewVectorFile(f),/no opaque detail/);await assert.rejects(access(f.outputPath));
});
