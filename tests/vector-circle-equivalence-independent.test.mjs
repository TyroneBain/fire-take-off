import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {classifyCircleElement,CIRCLE_APPROXIMATION_POLICY} from '../apps/local/web/vector-circle-equivalence.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';

// Independently generated PDF paths. No private drawing coordinates or matcher
// results define these positive and negative examples.
const radius=3.7,k=4*(Math.sqrt(2)-1)/3;
function cubic(r=radius){const a=k*r;return `${r} 0 m ${r} ${a} ${a} ${r} 0 ${r} c ${-a} ${r} ${-r} ${a} ${-r} 0 c ${-r} ${-a} ${-a} ${-r} 0 ${-r} c ${a} ${-r} ${r} ${-a} ${r} 0 c h S`;}
function polygon({n=32,r=radius,phase=.071,ellipse=1,open=false,spike=false,turns=1,returned=false}={}){const points=Array.from({length:n},(_,i)=>{const angle=phase+turns*2*Math.PI*i/n,q=spike&&i===5?r+.3:r;return [q*Math.cos(angle),q*Math.sin(angle)*ellipse];});return points.map((p,i)=>p.map(v=>v.toFixed(6)).join(' ')+(i?' l':' m')).join(' ')+(open?' S':returned?' '+points[0].map(v=>v.toFixed(6)).join(' ')+' l S':' h S');}
function pdf(content){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 300] /Resources << >> /Contents 4 0 R >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];let text='%PDF-1.4\n',offsets=[0];for(const [i,o]of objects.entries()){offsets.push(text.length);text+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=text.length;text+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array(Buffer.from(text));}
function placed(x,body,{y=40,angle=0,style='.24 w 0 G 0 g'}={}){const rad=angle*Math.PI/180,c=Math.cos(rad).toFixed(12),s=Math.sin(rad).toFixed(12);return `q ${c} ${s} ${(-Number(s)).toFixed(12)} ${c} ${x} ${y} cm ${style} ${body} Q`;}
async function scene(t,contents,{bounds=[15,35,25,45],anchor=[20.8,40.6]}={}){const bytes=pdf(contents.join('\n')),task=getDocument({data:bytes.slice(),isEvalSupported:false});t.after(()=>task.destroy());const doc=await task.promise,page=extractVectorPage({operatorList:await(await doc.getPage(1)).getOperatorList(),OPS});assert.equal(page.supported,true,page.reason);const ids=page.elements.filter(e=>e.bounds[0]>=bounds[0]&&e.bounds[1]>=bounds[1]&&e.bounds[2]<=bounds[2]&&e.bounds[3]<=bounds[3]).map(e=>e.id),template=createVectorTemplate(page,{bounds,anchor,ids});assert.equal(template.supported,true,template.reason);return{page,template};}

test('original dense polygon equivalents preserve one native identity per circle while rejecting semantic and geometric distractors',async t=>{
 const bodies=[cubic(),polygon(),polygon({n:40,phase:.131}),polygon({ellipse:1.2}),polygon({open:true}),polygon({n:23}),polygon({spike:true}),polygon({r:radius+.15}),polygon()+' '+cubic(1.2),polygon()+' -.3 -.3 .6 .6 re f'];
 const contents=bodies.map((body,i)=>placed(20+45*i,body));contents.push(placed(500,polygon(),{style:'.24 w 1 0 0 RG'}));contents.push(placed(550,polygon(),{style:'.34 w 0 G'}));contents.push(placed(20,polygon({turns:3}),{y:100}));contents.push(placed(65,polygon({n:64,turns:2}),{y:100}));contents.push(placed(110,polygon(),{y:100,style:'.25 w 0 G'}));contents.push(placed(155,polygon(),{y:100,style:'.24 w 0 G 1 j'}));
 const {page,template}=await scene(t,contents),before=structuredClone({page,template}),hits=findVectorMatches(page,template);assert.deepEqual(hits.map(h=>Math.round(h.x-.8)),[20,65,110]);assert.equal(new Set(hits.map(h=>h.elementIds.join(','))).size,hits.length);assert.ok(hits.every(h=>h.rotation===0));assert.deepEqual({page,template},before);
});

test('circle normalization cannot rotate a separate asymmetric defining component arbitrarily',async t=>{
 const component='5 0 m 7 0 l 7 1 l S',source=cubic()+' '+component,target=polygon()+' '+component,{page,template}=await scene(t,[placed(20,source),placed(70,target,{angle:90}),placed(120,target,{angle:45})],{bounds:[15,35,28,45],anchor:[20,40]});const hits=findVectorMatches(page,template);assert.deepEqual(hits.map(h=>[Math.round(h.x),Math.round(h.y),h.rotation]),[[20,40,0],[70,40,90]]);assert.equal(findVectorMatches(page,template,{rotations:false}).length,1);
});

test('dense-ring matching cancels and enforces a shared comparison budget without mutating the original geometry',async t=>{
 const {page,template}=await scene(t,[placed(20,cubic()),placed(65,polygon()),placed(110,polygon({n:40}))]),before=structuredClone({page,template});assert.throws(()=>findVectorMatches(page,template,{maxComparisons:1}),/budget/);let checks=0;assert.throws(()=>findVectorMatches(page,template,{cancelled:()=>++checks>3}),/cancelled/);assert.deepEqual({page,template},before);assert.equal(findVectorMatches(page,template).length,3);
});

test('the documented approximation band cannot distinguish a slightly elliptical near-circle',async t=>{
 const {page,template}=await scene(t,[placed(20,cubic()),placed(65,polygon({ellipse:1.02}))]);const hits=findVectorMatches(page,template);assert.deepEqual(hits.map(h=>Math.round(h.x-.8)),[20,65],'this is an explicit approximation ambiguity, not evidence of semantic circle classification');
});


test('classifier rejects malformed provenance, extreme values and distorted cubics and keeps absolute caps at tolerance .25',async t=>{
 const {page}=await scene(t,[placed(20,cubic()),placed(65,polygon()),placed(110,polygon({ellipse:1.08})),placed(155,polygon({n:257}))]);const [curve,dense,ellipse,large]=page.elements;assert.equal(classifyCircleElement(curve)?.kind,'cubic');assert.equal(classifyCircleElement(dense)?.kind,'polygon');assert.equal(classifyCircleElement(ellipse,{tolerance:.25}),null,'absolute .10/.05 radial caps cannot balloon to .50/.25');assert.equal(classifyCircleElement(large),null);assert.equal(CIRCLE_APPROXIMATION_POLICY.maxVertices,256);assert.ok(Object.isFrozen(CIRCLE_APPROXIMATION_POLICY));
 const invalid=[];let v=structuredClone(curve);v.segments[0][3]+=.2;invalid.push(v);v=structuredClone(curve);v.segments[0][1]=Infinity;invalid.push(v);v=structuredClone(dense);v.segments[0][1]=10000001;invalid.push(v);v=structuredClone(dense);v.pathCommands.push(0,65,40,1,66,40);invalid.push(v);v=structuredClone(dense);v.pathCommands[1]=NaN;invalid.push(v);v=structuredClone(dense);v.style.fill='#000000';invalid.push(v);for(const element of invalid)assert.equal(classifyCircleElement(element),null);
 let consumed=0;assert.throws(()=>classifyCircleElement(dense,{consume(){if(++consumed===10)throw Error('independent comparison budget');}}),/independent comparison budget/);assert.equal(consumed,10);assert.equal(classifyCircleElement(dense)?.kind,'polygon');
});

test('approximation does not broaden same-kind polygon matching or scale-range mode',async t=>{
 const {page,template}=await scene(t,[placed(20,polygon()),placed(65,polygon({n:40})),placed(110,cubic())]);assert.deepEqual(findVectorMatches(page,template).map(h=>Math.round(h.x-.8)),[20,110]);assert.deepEqual(findVectorMatches(page,template,{scaleRange:[1,1]}).map(h=>Math.round(h.x-.8)),[20]);
});


test('explicit-close and returned-to-start seams remain separate while both original families work',async t=>{
 for(const returned of [false,true]){const source=returned?cubic().replace(' h S',' S'):cubic(),{page,template}=await scene(t,[placed(20,source),placed(65,polygon({returned:!returned})),placed(110,polygon({returned}))]);assert.deepEqual(findVectorMatches(page,template).map(h=>Math.round(h.x-.8)),[20,110],'geometric closure does not erase the original cap/join seam class');}
});
