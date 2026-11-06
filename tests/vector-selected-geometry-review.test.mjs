import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
import {prepareVectorPattern,reviewVectorPatternPage,releaseVectorPattern} from '../apps/local/web/vector-pattern-review.mjs';
import {auditNativePage} from '../apps/local/web/vector-page-audit.mjs';

// Owned original controls: selected red outline stays identical while black
// discriminators differ. These are deliberately NOT equivalent symbol classes.
const cases=[
 {id:'strict',x:24},
 {id:'local-split',x:64,split:true},
 {id:'extra-dot',x:104,extra:'2 2 1 1 re f'},
 {id:'extra-bar',x:144,extra:'-3 2 6 1 re f'},
 {id:'inner-loop',x:184,extra:'.4 w -2 -2 4 4 re S'},
 {id:'filled-centre',x:224,extra:'-2 -2 4 4 re f'},
 {id:'missing-side',x:264,missing:true},
 {id:'occluded-extra-dot',x:304,extra:'2 2 1 1 re f 1 g 5.5 -1 1 2 re f'},
];
function head({x,split=false,extra='',missing=false}){
 return `q 1 0 0 1 ${x} 40 cm 0 g 0 G ${split?'-.5 -16 1 12 re f -.5 -4 1 4 re f':'-.5 -16 1 16 re f'} 1 0 0 RG 1 w ${missing?'-6 -6 m 6 -6 l 6 6 l -6 6 l S':'-6 -6 12 12 re S'} 0 g 0 G ${extra} Q`;
}
function bytes(){
 const content=[head({x:24}),cases.map(head).join('\n')],objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
 for(const[i,c]of content.entries())objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 330 80] /Resources << >> /Contents ${4+2*i} 0 R >>`,`<< /Length ${Buffer.byteLength(c)} >>\nstream\n${c}\nendstream`);
 let pdf='%PDF-1.4\n',offsets=[0];for(const[i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}
 const at=Buffer.byteLength(pdf);pdf+=`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${at}\n%%EOF`;
 return new Uint8Array(Buffer.from(pdf));
}
async function fixture(t){
 const data=bytes(),documentSha256=createHash('sha256').update(data).digest('hex');
 const tasks=[getDocument({data:new Uint8Array(data),isEvalSupported:false}),getDocument({data:new Uint8Array(data),isEvalSupported:false})];
 t.after(async()=>{for(const task of tasks)await task.destroy();});
 const [sourceDoc,targetDoc]=await Promise.all(tasks.map(t=>t.promise)),source=await sourceDoc.getPage(1),target=await targetDoc.getPage(2);
 const sourceVector=extractVectorPage({operatorList:await source.getOperatorList(),OPS});assert.equal(sourceVector.supported,true);
 const selection={page:1,bounds:[17,33,31,47],anchor:[24.2,40.3],ids:sourceVector.elements.map(e=>e.id),excluded:sourceVector.elements.filter(e=>e.style.fill).map(e=>e.id)};
 return{source,target,selection,sourceVector,documentSha256,sourceConfig:await sourceDoc.getOptionalContentConfig(),targetConfig:await targetDoc.getOptionalContentConfig()};
}
const coordinates=rows=>rows.map(({x,y,rotation,elementIds})=>({x,y,rotation,elementIds}));

test('retained-only matching is explicit, validates options, and marks geometric ambiguities',async t=>{
 const f=await fixture(t),audit=await auditNativePage({page:f.target,OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}}),vector={supported:true,elements:audit.elements},template=createVectorTemplate(f.sourceVector,f.selection);
 const strict=findVectorMatches(vector,template),explicitOff=findVectorMatches(vector,template,{selectedGeometryOnly:false});
 assert.deepEqual(strict,explicitOff);assert.equal(strict.some(h=>h.x>100&&h.x<250),false);
 const review=findVectorMatches(vector,template,{selectedGeometryOnly:true});
 for(const c of cases){const hit=review.find(h=>Math.abs(h.x-(c.x+.2))<.05);assert.equal(Boolean(hit),!c.missing,c.id);if(hit)assert.equal(hit.requiresExplicitReview,true,c.id);}
 for(const selectedGeometryOnly of [null,1,'true',{},[]])assert.throws(()=>findVectorMatches(vector,template,{selectedGeometryOnly}),/selected-geometry/);
 assert.throws(()=>findVectorMatches(vector,template,{selectedGeometryOnly:true,resolveExcludedContext:()=>new Set()}),/selected-geometry/);
 assert.throws(()=>findVectorMatches(vector,template,{selectedGeometryOnly:true,maxComparisons:1}),/budget/);
 assert.throws(()=>findVectorMatches(vector,template,{selectedGeometryOnly:true,cancelled:()=>true}),/cancel/);
});

async function run(t,matchPolicy,progress=()=>{}){
 const f=await fixture(t),canvases=[],allocate=(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;};
 const common={OPS,documentSha256:f.documentSha256,createCanvas:allocate,pdfjsVersion:version};
 const prepared=await prepareVectorPattern({...common,page:f.source,optionalContentConfig:f.sourceConfig,selection:f.selection,matchPolicy});
 assert.equal(prepared.completed,true,prepared.reason);t.after(()=>releaseVectorPattern(prepared.pattern));
 const report=await reviewVectorPatternPage({...common,page:f.target,optionalContentConfig:f.targetConfig,pattern:prepared.pattern,progress});
 assert.ok(canvases.every(c=>c.width===0&&c.height===0));return{report,prepared};
}
test('selected review preserves complete strict/local baselines and explicitly flags wrong-class candidates despite successful paint proof',async t=>{
 const strict=await run(t,'strict'),local=await run(t,'local-context-1'),selected=await run(t,'selected-geometry-1');
 for(const {report}of[strict,local,selected])assert.equal(report.completed,true,report.reason);
 assert.equal(selected.prepared.version,'vector-pattern-review-3');assert.equal(selected.report.version,'vector-pattern-review-3');
 assert.equal(strict.report.proposals.length,1);assert.equal(local.report.proposals.length,2);assert.equal(selected.report.proposals.length,7);
 for(const original of local.report.proposals){const kept=selected.report.proposals.find(h=>h.elementIds.join(',')===original.elementIds.join(','));assert.deepEqual(coordinates([kept]),coordinates([original]));assert.equal(kept.requiresExplicitReview,false);}
 for(const c of cases.filter(c=>c.extra)){
  const hit=selected.report.proposals.find(h=>Math.abs(h.x-(c.x+.2))<.05);assert.equal(hit.requiresExplicitReview,true,c.id);
  assert.equal(hit.visibility.verified,c.id!=='occluded-extra-dot',c.id+': '+hit.visibility.reason);assert.equal('score' in hit,false);
 }
 assert.equal(selected.report.allHandlesPreparedBeforeRendering,true);assert.equal(selected.report.coverage.complete,false);
 assert.ok(local.report.proposals.every(h=>!Object.hasOwn(h,'requiresExplicitReview')),'old policy result shape unchanged');
});

test('selected review rejects unknown policy and publishes no partial candidates on final cancellation',async t=>{
 const f=await fixture(t),common={page:f.source,OPS,optionalContentConfig:f.sourceConfig,documentSha256:f.documentSha256,createCanvas,pdfjsVersion:version,selection:f.selection};
 const unknown=await prepareVectorPattern({...common,matchPolicy:'selected-geometry'});assert.equal(unknown.completed,false);assert.match(unknown.reason,/policy/);
 const source=await prepareVectorPattern({...common,matchPolicy:'selected-geometry-1'});assert.equal(source.completed,true,source.reason);t.after(()=>releaseVectorPattern(source.pattern));
 let cancelled=false,reached=false;
 const result=await reviewVectorPatternPage({...common,page:f.target,optionalContentConfig:f.targetConfig,pattern:source.pattern,cancelled:()=>cancelled,progress(p){if(p.phase==='complete'){reached=true;cancelled=true;}}});
 assert.equal(reached,true);assert.equal(result.completed,false);assert.match(result.reason,/cancel/);assert.deepEqual(result.proposals,[]);
});
