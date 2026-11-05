import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCircleElement} from '../apps/local/web/vector-circle-equivalence.mjs';
import {createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';

const style={fill:null,stroke:'#000000',width:.24,cap:1,join:0,miter:10,rule:'nonzero'},k=4*(Math.sqrt(2)-1)/3;
function ring(id,x,y,{r=4,n=32,cubic=false,phase=.031,quantum=0,ellipse=1,open=false}={}){
 const point=(a)=>[x+r*Math.cos(a),y+r*Math.sin(a)*ellipse].map(v=>quantum?Math.round(v/quantum)*quantum:v),commands=[],segments=[];
 if(cubic){const p=[[r,0],[0,r],[-r,0],[0,-r],[r,0]];commands.push(0,x+r,y);for(let i=0;i<4;i++){const a=p[i],b=p[i+1],c=[a[0]-a[1]*k,a[1]+a[0]*k],d=[b[0]+b[1]*k,b[1]-b[0]*k];segments.push([2,x+a[0],y+a[1],x+c[0],y+c[1],x+d[0],y+d[1],x+b[0],y+b[1]]);commands.push(2,x+c[0],y+c[1],x+d[0],y+d[1],x+b[0],y+b[1]);}}
 else{const p=Array.from({length:n},(_,i)=>point(phase+i*2*Math.PI/n));commands.push(0,...p[0]);for(let i=1;i<n;i++){segments.push([1,...p[i-1],...p[i]]);commands.push(1,...p[i]);}if(!open)segments.push([1,...p.at(-1),...p[0]]);}
 if(!open)commands.push(4);const xs=segments.flatMap(s=>s.filter((_,i)=>i%2===1)),ys=segments.flatMap(s=>s.filter((_,i)=>i>0&&i%2===0));return{id,style:{...style},segments,pathCommands:commands,paintClosesPath:false,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
}

test('bounded circle classification reports approximation separately from matched physical radius',()=>{
 const a=classifyCircleElement(ring(1,30,30,{cubic:true})),b=classifyCircleElement(ring(2,70.03,30.02,{n:33,quantum:.12}));assert.equal(a.kind,'cubic');assert.equal(b.kind,'polygon');assert.ok(Math.abs(b.radius-a.radius)<.05);assert.ok(b.maxRadialResidual<=.1);assert.ok(b.rmsRadialResidual<=.05);assert.ok(b.maxAngleGap<=Math.PI/12);assert.ok(b.chordSagitta<=.05);
 for(const opts of[{n:23},{open:true},{ellipse:1.15}])assert.equal(classifyCircleElement(ring(3,0,0,opts)),null);
});

test('circle classifier refuses malformed controls, duplicate loops and unsupported paint classes',()=>{
 const curve=ring(1,0,0,{cubic:true});curve.segments[0][3]+=.2;assert.equal(classifyCircleElement(curve),null);
 for(const mutate of[e=>e.style.fill='#000000',e=>e.segments[1][1]=NaN,e=>e.pathCommands.push(...e.pathCommands),e=>e.segments.push(...e.segments)]){const e=ring(1,0,0);mutate(e);assert.equal(classifyCircleElement(e),null);}
 let work=0;assert.throws(()=>classifyCircleElement(ring(1,0,0),{consume(){if(++work>8)throw Error('budget');}}),/budget/);
});

test('final mixed-representation pass preserves source anchor and rejects radius, style and interior-detail changes',()=>{
 const source=ring(1,30,30,{cubic:true}),elements=[source,ring(2,70,30),ring(3,110,30,{r:4.15}),ring(4,150,30),ring(5,190,30),ring(6,190,30,{r:1})];elements[3].style.width=.25;
 const page={supported:true,elements},template=createVectorTemplate(page,{ids:[1],bounds:[24,24,36,36],anchor:[30.7,30.4]}),before=structuredClone({page,template}),hits=findVectorMatches(page,template).sort((a,b)=>a.x-b.x);
 assert.deepEqual(hits.map(h=>h.elementIds),[[1],[2]]);assert.ok(Math.abs(hits[0].x-30.7)<1e-9);assert.ok(Math.abs(hits[1].x-70.7)<1e-9);assert.ok(hits.every(h=>h.rotation===0));assert.deepEqual({page,template},before);
 const reverse=createVectorTemplate(page,{ids:[2],bounds:[64,24,76,36],anchor:[70.7,30.4]});assert.ok(findVectorMatches(page,reverse).some(h=>h.elementIds[0]===1));
});

test('all existing strict quarter-turn poses win before mixed circle approximation',()=>{
 const elements=[ring(1,25,30,{r:2,cubic:true}),ring(2,35,30,{r:2}),ring(3,75,30,{r:2}),ring(4,85,30,{r:2,cubic:true})];
 // Rotate the target polygon by exactly180 degrees to preserve its old ordered
 // native geometry, rather than constructing a different polygon phase.
 const original=elements[1];elements[2]={...structuredClone(original),id:3,segments:original.segments.map(s=>s.map((v,i)=>i===0?v:i%2?110-v:60-v)),bounds:[73,28,77,32]};
 const page={supported:true,elements},template=createVectorTemplate(page,{ids:[1,2],bounds:[22,27,38,33],anchor:[30.8,30.4]}),hits=findVectorMatches(page,template),target=hits.find(h=>h.elementIds.includes(3));
 assert.equal(hits.length,2);assert.equal(target.rotation,180);assert.ok(Math.abs(target.x-79.2)<1e-9);assert.ok(Math.abs(target.y-29.6)<1e-9);
});

test('original cubic and polygon PDF paints retain their original commands and verify against full original pixels',async t=>{
 const {getDocument,OPS,version}=await import('pdfjs-dist/legacy/build/pdf.mjs'),{createCanvas}=await import('@napi-rs/canvas'),{extractVectorPage}=await import('../apps/local/web/vector-recognition.mjs'),{preparePdfContourPaints,verifyPdfContourPaints}=await import('../apps/local/web/pdf-contour-verification.mjs');
 const paths=[ring(1,30,30,{cubic:true}),ring(2,70,30,{n:40})];let content='.24 w 1 J 0 j 10 M 0 G ';
 for(const e of paths){for(let i=0;i<e.pathCommands.length;){const op=e.pathCommands[i++],n=op===2?6:op===4?0:2;content+=e.pathCommands.slice(i,i+n).join(' ')+' '+({0:'m',1:'l',2:'c',4:'h'})[op]+' ';i+=n;}content+='S ';}
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 60] /Resources << >> /Contents 4 0 R >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];let pdf='%PDF-1.4\n',offsets=[];for(const[i,o]of objects.entries()){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const start=pdf.length;pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 const task=getDocument({data:new Uint8Array(Buffer.from(pdf)),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=await doc.getPage(1),vector=extractVectorPage({operatorList:await page.getOperatorList(),OPS}),config=await doc.getOptionalContentConfig(),template=createVectorTemplate(vector,{ids:[vector.elements[0].id],bounds:[24,24,36,36],anchor:[30.7,30.4]}),original=structuredClone(vector),hits=findVectorMatches(vector,template),handles=[];
 assert.equal(hits.length,2);for(const hit of hits)handles.push(await preparePdfContourPaints({page,OPS,elementIds:hit.elementIds,optionalContentConfig:config}));
 for(const prepared of handles){assert.equal(prepared.supported,true,prepared.reason);const proof=await verifyPdfContourPaints({prepared,createCanvas,pdfjsVersion:version});assert.equal(proof.verified,true,proof.reason);assert.equal(proof.diagnostics.mismatchedPixels,0);}assert.deepEqual(vector,original);
});

test('mixed representation preserves explicit-close versus return-to-start stroke seam semantics',()=>{
 const source=ring(1,30,30,{cubic:true}),returned=ring(2,70,30);returned.pathCommands.pop();returned.pathCommands.push(1,...returned.segments[0].slice(1,3));
 const page={supported:true,elements:[source,returned]},template=createVectorTemplate(page,{ids:[1],bounds:[24,24,36,36],anchor:[30,30]});assert.equal(findVectorMatches(page,template).length,1);
 source.pathCommands.pop();const sameClosure=createVectorTemplate(page,{ids:[1],bounds:[24,24,36,36],anchor:[30,30]});assert.equal(findVectorMatches(page,sameClosure).length,2);
});

test('coarsened candidate indexing cannot resolve an all-same-kind assignment rejected by the strict ambiguity guard',()=>{
 const line=(id,x0,x1)=>({id,style:{...style},segments:[[1,x0,30,x1,30],[1,x1,30,x1,31]],pathCommands:[0,x0,30,1,x1,30,1,x1,31],paintClosesPath:false,bounds:[x0,30,x1,31]});
 const source={supported:true,elements:[ring(1,30,30,{cubic:true}),line(2,35,37)]},template=createVectorTemplate(source,{ids:[1,2],bounds:[24,24,38,36],anchor:[30,30]}),target={supported:true,elements:[ring(11,80,30,{cubic:true}),line(12,85.02,87.08),line(13,85,87.06),ring(14,130,30),ring(15,170,30),ring(16,210,30)]};
 assert.deepEqual(findVectorMatches(target,template,{rotations:false}),[]);
});
