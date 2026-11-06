import test from 'node:test';
import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {findCompositeEquivalentMatches,COMPOSITE_EQUIVALENCE_VERSION} from '../apps/local/web/vector-composite-equivalence.mjs';

const polygon=(n,r)=>Array.from({length:n},(_,i)=>[Math.cos(i*2*Math.PI/n)*r,Math.sin(i*2*Math.PI/n)*r]);
const path=(ps,closed=true)=>[0,...ps[0],...ps.slice(1).flatMap(p=>[1,...p]),...(closed?[4,4]:[])];
const style=(fill=null,width=.72)=>({fill,stroke:'#000000',width,cap:1,join:fill?0:1,miter:10,rule:'nonzero'});
const element=(id,paths,paint=style())=>({id,pathCommands:paths.flat(),style:paint});
const transform=(e,angle,x,y)=>{const commands=[];for(let i=0;i<e.pathCommands.length;){const op=e.pathCommands[i++];commands.push(op);const n=op===0||op===1?2:op===2?6:op===3?4:0;for(let j=0;j<n;j+=2){const a=e.pathCommands[i++],b=e.pathCommands[i++];commands.push(...(angle===0?[a+x,b+y]:angle===90?[-b+x,a+y]:angle===180?[-a+x,-b+y]:[b+x,-a+y]));}}return {...e,pathCommands:commands,style:{...e.style}};};
const page=elements=>({supported:true,elements});
const template=(elements,anchor=[0,0])=>({supported:true,elements,anchor,excludedElements:[]});
const find=(elements,source,options={})=>findCompositeEquivalentMatches(page(elements),source,{polygonBoolean:clipping,...options});
function family(base=1,grouped=false){
 const ring=polygon(30,2),triangles=ring.map((p,i)=>path(i%2?[ring[(i+1)%ring.length],p,[0,0]]:[[0,0],p,ring[(i+1)%ring.length]]));
 triangles.push(path([[0,0],[.5,0],[1,0]]));
 const fills=grouped?[element(base,triangles,style('#000000',0))]:Array.from({length:16},(_,i)=>element(base+i,triangles.slice(i*2,i*2+2),style('#000000',0)));
 const outlines=[polygon(32,4),polygon(34,4.08),ring].map((ps,i)=>element(base+20+i,[path([...ps,ps[0]],false)]));
 return [...fills,...outlines];
}

test('31 native hairline triangles and three outlines regroup with all original IDs in four poses',()=>{
 const source=template(family(),[.3,-.2]),targets=[0,90,180,270].flatMap((a,i)=>family(100+i*100,true).map(e=>transform(e,a,20+i*15,20))),before=structuredClone({source,targets});
 const hits=find(targets,source);assert.equal(hits.length,4);
 for(let i=0;i<4;i++){
  const hit=hits.find(h=>h.elementIds.includes(100+i*100));assert.ok(hit);assert.deepEqual(hit.elementIds,[100+i*100,120+i*100,121+i*100,122+i*100]);assert.equal(hit.rotation,i*90);
  const expected=transform(element(0,[[0,.3,-.2,1,1,1]]),i*90,20+i*15,20).pathCommands.slice(1,3);assert.ok(Math.hypot(hit.x-expected[0],hit.y-expected[1])<1e-9);
  assert.equal(hit.geometryPolicy,COMPOSITE_EQUIVALENCE_VERSION);assert.equal(hit.wholeOperations,true);assert.equal(hit.requiresExplicitReview,true);assert.equal(hit.requiresRenderVerification,true);
 }
 assert.deepEqual({source,targets},before);assert.equal(find(targets,source,{rotations:false}).length,1);
 const reverse=find(family(600).map(e=>transform(e,90,100,100)),template(family(1,true)));assert.equal(reverse.length,1);assert.equal(reverse[0].elementIds.length,19);
});

test('collapsed triangles still require their exact hairline stroke and multiplicity',()=>{
 const source=template(family()),target=family(100,true).map(e=>transform(e,0,20,20));
 const withoutCollapsed=structuredClone(target);withoutCollapsed[0].pathCommands.splice(-11);
 assert.equal(find(withoutCollapsed,source).length,0);
 const extraCollapsed=structuredClone(target);extraCollapsed[0].pathCommands.push(...path([[20,20],[20.5,20],[21,20]]));assert.equal(find(extraCollapsed,source).length,0);
 for(const [key,value] of [['width',.001],['stroke','#ff0000'],['cap',0],['join',1],['miter',5]]){
  const altered=structuredClone(target);altered[0].style[key]=value;assert.equal(find(altered,source).length,0,key+' is part of stroke evidence');
 }
});

test('whole operations cannot donate a useful subpath and leave an unmatched tail',()=>{
 const source=template(family()),target=family(100,true).map(e=>transform(e,0,20,20));
 target[1].pathCommands.push(...path([[20,20],[21,21]],false));assert.equal(find(target,source).length,0);
 const missing=family(100,true).map(e=>transform(e,0,20,20));missing.pop();assert.equal(find(missing,source).length,0);
 const closed=family(100,true).map(e=>transform(e,0,20,20));closed[1].pathCommands.push(4);assert.equal(find(closed,source).length,0,'An open returned outline is not silently made closed');
});

test('stroke-only Bezier control points survive compound regrouping without flattening',()=>{
 const square=path([[0,0],[2,0],[2,2],[0,2]]),curve=[0,-1,0,2,0,4,2,4,3,0],source=template([element(1,[square],style('#000000',0)),element(2,[curve]),element(3,[curve])]);
 const target=[transform(element(10,[square],style('#000000',0)),90,20,20),transform(element(11,[curve,curve]),90,20,20)];
 const hits=find(target,source);assert.equal(hits.length,1);assert.deepEqual(hits[0].elementIds,[10,11]);assert.equal(hits[0].rotation,90);
 const changed=structuredClone(target);changed[1].pathCommands[4]+=.2;assert.equal(find(changed,source).length,0);
 const one=structuredClone(target);one[1].pathCommands=one[1].pathCommands.slice(0,10);assert.equal(find(one,source).length,0,'Coincident stroke multiplicity is retained');
});

test('implicit close-and-paint stroke closure is distinguished from an open returned path',()=>{
 const source=template(family()),target=family(100,true).map(e=>transform(e,0,20,20));
 source.elements.at(-1).paintClosesPath=true;
 assert.equal(find(target,source).length,0);
 target.at(-1).paintClosesPath=true;assert.equal(find(target,source).length,1);
 delete target.at(-1).paintClosesPath;target.at(-1).pathCommands.push(4);assert.equal(find(target,source).length,1);
});

test('fill topology, colour and scale remain independent mandatory evidence',()=>{
 const source=template(family()),target=family(100,true).map(e=>transform(e,0,20,20));
 const red=structuredClone(target);red[0].style.fill='#ff0000';assert.equal(find(red,source).length,0);
 const noFill=structuredClone(target);noFill[0].style.fill=null;assert.equal(find(noFill,source).length,0);
 const scale=family(100,true).map(e=>({...e,pathCommands:e.pathCommands.map((v,i)=>v)}));
 // Scale coordinates, not command opcodes.
 for(const e of scale)for(let i=0;i<e.pathCommands.length;){const op=e.pathCommands[i++],n=op===4?0:2;for(let j=0;j<n;j++)e.pathCommands[i++]*=1.05;}
 assert.equal(find(scale,source).length,0);
 const bow=element(1,[path([[0,0],[2,2],[0,2],[2,0]])],style('#000000',0));assert.deepEqual(find(target,template([bow])),[],'Zero signed area does not prove invisibility');
 const opposite=element(1,[path([[0,0],[2,0],[0,2]]),path([[0,1],[2,0],[0,0]])],style('#000000',0));assert.deepEqual(find(target,template([opposite])),[],'Opposite-winding overlap may cancel fill and cannot be unioned');
});

test('excluded source paths are unchanged; unsupported sources refuse before target capacity',()=>{
 const source=template(family()),target=family(100,true).map(e=>transform(e,0,20,20));source.excludedElements=[element(999,[path([[-10,0],[10,0]],false)])];const before=structuredClone(source);
 assert.equal(find(target,source).length,1);assert.deepEqual(source,before);
 const curve=element(1,[[0,0,0,2,1,2,3,2,4,0,4]],style('#000000',0));assert.deepEqual(find(Array(50001).fill(null),template([curve])),[]);
 assert.deepEqual(find(Array(50001).fill(null),source),[]);
 assert.deepEqual(find([],template([element(1,[path([[0,0],[1,0]],false)])])),[]);
});

test('malformed identity, option, cancellation and processing exhaustion fail atomically',()=>{
 const source=template(family()),target=family(100,true).map(e=>transform(e,0,20,20));
 assert.throws(()=>find(target,source,{cancelled:()=>true}),{code:'VECTOR_COMPOSITE_CANCELLED'});
 assert.throws(()=>find(target,source,{maxWork:1}),{code:'VECTOR_COMPOSITE_BUDGET'});
 let calls=0;assert.throws(()=>find(target,source,{cancelled:()=>++calls>1000}),{code:'VECTOR_COMPOSITE_CANCELLED'});
 for(const options of [{tolerance:.2},{maxWork:0},{rotations:1},{scaleRange:[1,1]},{polygonBoolean:null}])assert.throws(()=>find(target,source,options),{code:'VECTOR_COMPOSITE_INVALID'});
 assert.throws(()=>find([...target,target[0]],source),{code:'VECTOR_COMPOSITE_INVALID'});
 const bad=structuredClone(target);bad[0].pathCommands[1]=NaN;assert.throws(()=>find(bad,source),{code:'VECTOR_COMPOSITE_INVALID'});
});
