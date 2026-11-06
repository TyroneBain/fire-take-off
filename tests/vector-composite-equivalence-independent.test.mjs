import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import polygonBoolean from 'polygon-clipping';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';
import {createVectorTemplate} from '../apps/local/web/vector-recognition.mjs';
import {auditNativePage} from '../apps/local/web/vector-page-audit.mjs';
import {findCompositeEquivalentMatches} from '../apps/local/web/vector-composite-equivalence.mjs';
import {vectorReviewPayload} from '../apps/local/web/vector-review-ui.mjs';
import {validVectorReview} from '../apps/local/web/vector-review-policy.mjs';

// Original synthetic controls. Equivalent paint is regrouped into different
// complete PDF operations. Duplicate and collapsed triangles are intentionally
// retained because their zero-width strokes are real PDF hairlines.
const first='-2 -2 m 2 -2 l -2 2 l h',second='2 -2 m 2 2 l -2 2 l h',collapsed='0 0 m 1 0 l 2 0 l h';
const cases=[
 ...[0,90,180,270].map((rotation,i)=>({id:`separate-${rotation}`,page:1,x:30+i*50,y:40,rotation,kind:'separate',positive:true,pipe:i===0})),
 ...[0,90,180,270].map((rotation,i)=>({id:`grouped-${rotation}`,page:2,x:30+i*50,y:40,rotation,kind:'grouped',positive:true,pipe:i===3})),
 ...['missing-collapsed','missing-duplicate','changed-curve','changed-hairline','red','filled-only','missing-fill','extra-subpath'].map((kind,i)=>({id:kind,page:2,x:30+i*50,y:110,rotation:0,kind,positive:false})),
];
function glyph(c){
 const matrix={0:'1 0 0 1',90:'0 1 -1 0',180:'-1 0 0 -1',270:'0 -1 1 0'}[c.rotation],triangles=(c.triangles||[first,second,first,collapsed]).filter((_,i)=>!(c.kind==='missing-collapsed'&&i===3||c.kind==='missing-duplicate'&&i===2||c.kind==='missing-fill'&&i===1)),ring=`5 0 m 5 ${c.kind==='changed-curve'?3.16:2.76} 2.76 5 0 5 c -2.76 5 -5 2.76 -5 0 c -5 -2.76 -2.76 -5 0 -5 c 2.76 -5 5 -2.76 5 0 c h`,outlines=[ring,'-4 -4 m 4 -4 l 4 4 l -4 4 l h','-3 -4 m -2 -4 l'],op=c.kind==='filled-only'?'f':'B';
 const paints=(c.kind==='separate'||c.separate)?triangles.map(p=>p+' '+op).join(' '):triangles.join(' ')+' '+op,strokes=(c.kind==='separate'||c.separate)?outlines.map(p=>p+' S').join(' '):outlines.join(' ')+(c.kind==='extra-subpath'?' 8 0 m 9 0 l':'')+' S';
 return `q ${matrix} ${c.x} ${c.y} cm 0 g ${c.kind==='red'?'1 0 0 RG':'0 G'} ${c.kind==='changed-hairline'?'.1':'0'} w ${paints} .4 w ${strokes} ${c.pipe?'.7 w -9 0 m 9 0 l S':''} Q`;
}
function original(overrideContents){
 const contents=overrideContents??[1,2].map(page=>cases.filter(c=>c.page===page).map(glyph).join('\n')),objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];for(const[i,c]of contents.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 440 160] /Resources << >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
 let data='%PDF-1.4\n';const offsets=[0];for(const[i,obj]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const at=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`;return new Uint8Array(Buffer.from(data));
}
async function geometry(t){const bytes=original(),task=getDocument({data:bytes.slice(),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,pages=[];for(const number of [1,2]){const page=await doc.getPage(number),audit=await auditNativePage({page,OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}});assert.deepEqual(audit.failures,[]);pages.push({supported:true,elements:audit.elements});}const selection={page:1,bounds:[24,34,36,46],anchor:[30,40],ids:pages[0].elements.slice(0,8).map(e=>e.id),excluded:[pages[0].elements[7].id]},template=createVectorTemplate(pages[0],selection);assert.equal(template.supported,true,template.reason);return{bytes,pages,selection,template};}
function score(hits){const used=new Set(),fp=[];for(const h of hits){const label=cases.find(c=>c.page===h.page&&Math.hypot(c.x-h.x,c.y-h.y)<.1);if(!label?.positive||used.has(label.id))fp.push(label?.id??h);else used.add(label.id);}return{tp:used.size,fp:fp.length,fn:8-used.size,falsePositives:fp};}
async function run(t,matchPolicy,{progress=()=>{},control={cancelled:false}}={}){
 const f=await geometry(t),digest=createHash('sha256').update(f.bytes).digest('hex'),drawing={id:'owned-composite',digest},elements={renderer:ELEMENT_RENDERER,ids:f.selection.ids,excluded:f.selection.excluded},example={drawing_id:drawing.id,digest,page:1,bounds:f.selection.bounds,elements},before=structuredClone(example),events=[],canvases=[],started=performance.now();
 const pdfjs={OPS,version,getDocument(options){const task=getDocument(options);events.push('open');return{promise:task.promise,destroy:async()=>{await task.destroy();events.push('destroy');}};}};
 try{const report=await runSavedVectorPageSetReview({pdfjs,sourceDrawing:drawing,sourceData:f.bytes,example,targets:[1,2].map(page=>({drawing,page})),layerPolicy:'all-admitted',matchPolicy,createCanvas:(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;},run:control,progress});return{...f,report,example,drawing,elapsedMs:performance.now()-started};}
 finally{assert.deepEqual(example,before);assert.equal(events.filter(e=>e==='open').length,events.filter(e=>e==='destroy').length);assert.ok(canvases.every(c=>c.width===0&&c.height===0));assert.equal(control.task,undefined);assert.equal(control.cancel,undefined);}
}

test('composite helper preserves regrouped hairlines, duplicate paths and Bezier controls while rejecting missing or changed constituents',async t=>{
 const f=await geometry(t),before=structuredClone({pages:f.pages,template:f.template}),hits=findCompositeEquivalentMatches(f.pages[1],f.template,{polygonBoolean});assert.equal(hits.length,4);assert.deepEqual(hits.map(h=>[h.x,h.y,h.rotation]),[0,90,180,270].map((r,i)=>[30+i*50,40,r]));
 for(const[i,h]of hits.entries()){assert.deepEqual(h.elementIds,f.pages[1].elements.slice(i*2,i*2+2).map(e=>e.id));assert.equal(h.requiresExplicitReview,true);assert.equal(h.requiresRenderVerification,true);assert.equal(h.wholeOperations,true);}assert.deepEqual({pages:f.pages,template:f.template},before);
});

test('original two-page composite fixture records strict baseline and integrated paint-verified recall without automatic broader acceptance',async t=>{
 const baseline=await run(t,'strict'),b=score(baseline.report.pages.flatMap(p=>p.result.proposals.filter(h=>h.visibility.verified).map(h=>({...h,page:p.page}))));assert.deepEqual([b.tp,b.fp,b.fn],[4,0,4]);
 const f=await run(t,'selected-geometry-1'),hits=f.report.pages.flatMap(p=>p.result.proposals.filter(h=>h.visibility.verified).map(h=>({...h,page:p.page}))),measured=score(hits);t.diagnostic(JSON.stringify({baseline:b,composite:measured,elapsedMs:f.elapsedMs}));assert.deepEqual([measured.tp,measured.fp,measured.fn],[8,0,0]);assert.equal(f.report.totals.proposals,8);assert.deepEqual(f.report.selection.ids,f.selection.ids);assert.deepEqual(f.report.selection.excluded,f.selection.excluded);
 const proposals=f.report.pages.flatMap(p=>p.result.proposals),selected=new Set(proposals.flatMap((p,i)=>p.requiresExplicitReview?[]:[i])),decided=new Set(),input={record:{id:'example',version:1,item_id:'heading',example:f.example},item:{id:'heading',version:1,color:'#285c91'},drawing:f.drawing,marks:[],elements:f.example.elements,review:f.report,selected,decided},payload=vectorReviewPayload(input);assert.equal(validVectorReview(payload.vectorReview,payload.matches.length),true);assert.equal(payload.matches.length,4);assert.equal(payload.vectorReview.pages[1].provenance.pendingCount,4);assert.deepEqual(payload.vectorReview.pages[1].decisions,[]);const index=proposals.findIndex(p=>p.requiresExplicitReview);selected.add(index);assert.throws(()=>vectorReviewPayload(input));decided.add(index);const explicit=vectorReviewPayload(input);assert.equal(explicit.matches.length,5);assert.equal(explicit.vectorReview.pages[1].decisions[0].elementIds.length,2);assert.equal(explicit.vectorReview.pages[1].decisions[0].reviewed,true);
});

test('composite cancellation and work limits publish no partial results or mutations',async t=>{
 const f=await geometry(t),before=structuredClone({pages:f.pages,template:f.template});assert.throws(()=>findCompositeEquivalentMatches(f.pages[1],f.template,{polygonBoolean,cancelled:()=>true}),{code:'VECTOR_COMPOSITE_CANCELLED'});assert.throws(()=>findCompositeEquivalentMatches(f.pages[1],f.template,{polygonBoolean,maxWork:1}),{code:'VECTOR_COMPOSITE_BUDGET'});assert.throws(()=>findCompositeEquivalentMatches(f.pages[1],f.template,{polygonBoolean,scaleRange:[.9,1.1]}),{code:'VECTOR_COMPOSITE_INVALID'});assert.deepEqual({pages:f.pages,template:f.template},before);
 const control={cancelled:false};let reached=false;await assert.rejects(run(t,'selected-geometry-1',{control,progress:p=>{if(p.stage==='complete'){reached=true;control.cancel();}}}),/cancel/i);assert.equal(reached,true);
});

test('touching opposite-winding triangles may regroup, but overlapping cancellation cannot erase real filled area',async t=>{
 const reverseSecond='2 -2 m -2 2 l 2 2 l h',reverseFirst='-2 -2 m -2 2 l 2 -2 l h';
 for(const [name,triangles,expected]of [['touching',[first,reverseSecond,first,collapsed],1],['positive-area-overlap',[first,reverseFirst,second,collapsed],0]])await t.test(name,async child=>{
  const data=original([glyph({x:30,y:40,rotation:0,kind:'separate',triangles}),glyph({x:100,y:40,rotation:0,kind:'grouped',triangles})]),task=getDocument({data,isEvalSupported:false});child.after(()=>task.destroy());const doc=await task.promise,pages=[];
  for(const number of [1,2]){const audit=await auditNativePage({page:await doc.getPage(number),OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}});assert.deepEqual(audit.failures,[]);pages.push({supported:true,elements:audit.elements});}
  const selection={page:1,bounds:[24,34,36,46],anchor:[30,40],ids:pages[0].elements.map(e=>e.id),excluded:[]},template=createVectorTemplate(pages[0],selection);assert.equal(template.supported,true);const before=structuredClone({pages,template}),hits=findCompositeEquivalentMatches(pages[1],template,{polygonBoolean});assert.equal(hits.length,expected);if(expected)assert.deepEqual(hits[0].elementIds,pages[1].elements.map(e=>e.id));assert.deepEqual({pages,template},before);
 });
});

test('PDF close-and-paint retains the last stroke closure and cannot admit an open-stroke lookalike',async t=>{
 const open='-2 -2 m 2 -2 l -2 2 l',source=`0 g 0 G 0 w ${open} b .4 w -5 -5 10 10 re S`,closed=`0 g 0 G 0 w ${open} h B .4 w -5 -5 10 10 re S`,notClosed=`0 g 0 G 0 w ${open} B .4 w -5 -5 10 10 re S`,data=original([`q 1 0 0 1 30 40 cm ${source} Q`,`q 1 0 0 1 100 40 cm ${closed} Q q 1 0 0 1 150 40 cm ${notClosed} Q`]),task=getDocument({data,isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,pages=[];
 for(const number of [1,2]){const audit=await auditNativePage({page:await doc.getPage(number),OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}});assert.deepEqual(audit.failures,[]);pages.push({supported:true,elements:audit.elements});}
 const template=createVectorTemplate(pages[0],{bounds:[24,34,36,46],anchor:[30,40],ids:pages[0].elements.map(e=>e.id),excluded:[]});assert.equal(template.supported,true);const hits=findCompositeEquivalentMatches(pages[1],template,{polygonBoolean});assert.equal(hits.length,1);assert.equal(hits[0].x,100);assert.equal(hits[0].y,40);assert.deepEqual(hits[0].elementIds,pages[1].elements.slice(0,2).map(e=>e.id));
});
