import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';

// Original asymmetric outline and erased connector, authored independently of
// any customer plan. Splitting the connector must not change quarter-turns.
function originalPdf(){
 const matrices=['1 0 0 1','0 1 -1 0','-1 0 0 -1','0 -1 1 0'];
 const content=matrices.map((matrix,i)=>`q ${matrix} ${24+40*i} 50 cm 0 g ${i?'-.5 -16 1 12 re f -.5 -4 1 4 re f':'-.5 -16 1 16 re f'} 1 0 0 RG 1 w -6 -6 m 6 -6 l 6 6 l -3 6 l -6 3 l h S Q`).join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents 4 0 R >>',`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const at=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`;return new Uint8Array(Buffer.from(pdf));
}

test('local whole-fill context retains asymmetric symbol poses at all four quarter-turns',async()=>{
 const bytes=originalPdf(),digest=createHash('sha256').update(bytes).digest('hex'),drawing={id:'original-quarter-turns',digest},task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false});let ids;
 try{const list=await(await(await task.promise).getPage(1)).getOperatorList();ids=list.fnArray.flatMap((op,id)=>op===OPS.constructPath?[id]:[]).slice(0,2);}finally{await task.destroy();}
 const canvases=[],report=await runSavedVectorPageSetReview({pdfjs:{getDocument,OPS,version},sourceDrawing:drawing,example:{drawing_id:drawing.id,digest,page:1,bounds:[17,43,31,57],elements:{renderer:ELEMENT_RENDERER,ids,excluded:[ids[0]]}},targets:[{drawing,page:1}],matchPolicy:'local-context-1',sourceData:bytes,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;}});
 const proposals=report.pages[0].result.proposals;assert.equal(proposals.length,4);assert.deepEqual(proposals.map(h=>h.rotation).sort((a,b)=>a-b),[0,90,180,270]);
 const [dx,dy]=[report.source.anchor[0]-24,report.source.anchor[1]-50],offsets=[[dx,dy],[-dy,dx],[-dx,-dy],[dy,-dx]];
 for(let i=0;i<4;i++){const hit=proposals.find(h=>h.rotation===i*90);assert.ok(Math.hypot(hit.x-24-40*i-offsets[i][0],hit.y-50-offsets[i][1])<.05);assert.equal(hit.visibility.verified,true,hit.visibility.reason);assert.deepEqual(hit.contextIds,[]);if(i)assert.ok(hit.geometryContext?.targetElementIds.length>0);}
 assert.ok(canvases.every(c=>!c.width&&!c.height));
});
