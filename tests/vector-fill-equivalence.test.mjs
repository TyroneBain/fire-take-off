import test from 'node:test';
import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {findFillEquivalentMatches,FILL_EQUIVALENCE_VERSION} from '../apps/local/web/vector-fill-equivalence.mjs';

const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function fill(id,loops,{colour='#000000',rule='nonzero',stroke=null,width=0}={}){
 const points=loops.flat(),segments=loops.flatMap(ps=>ps.map((p,i)=>[1,...p,...ps[(i+1)%ps.length]]));
 return{id,style:{fill:colour,stroke,width,cap:0,join:0,miter:0,rule},segments,pathCommands:loops.flatMap(ps=>[0,...ps[0],...ps.slice(1).flatMap(p=>[1,...p]),4]),bounds:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};
}
const page=elements=>({supported:true,elements});
const template=(elements,anchor=[2,2])=>({supported:true,elements,anchor,excludedElements:[]});
const find=(elements,source,options={})=>findFillEquivalentMatches(page(elements),source,{polygonBoolean:clipping,...options});
const transform=(ps,rotation,x,y)=>ps.map(([a,b])=>rotation===0?[a+x,b+y]:rotation===90?[-b+x,a+y]:rotation===180?[-a+x,-b+y]:[b+x,-a+y]);

test('one native fill and sixteen adjacent strips share one candidate with complete original IDs',()=>{
 const source=template([fill(1,[rect(0,0,8,4)])],[3,1]),target=Array.from({length:16},(_,i)=>fill(20+i,[rect(20+i*.5,30,.5,4)])),before=structuredClone({source,target});
 const hits=find(target,source);assert.equal(hits.length,1);assert.deepEqual(hits[0].elementIds,target.map(e=>e.id));assert.deepEqual([hits[0].x,hits[0].y],[23,31]);assert.equal(hits[0].geometryPolicy,FILL_EQUIVALENCE_VERSION);assert.equal(hits[0].requiresExplicitReview,true);assert.equal(hits[0].requiresRenderVerification,true);assert.equal(hits[0].wholeOperations,true);assert.ok(!('score'in hits[0]));assert.deepEqual({source,target},before);
});

test('overlapping native fills normalize in either direction without losing whole-operation provenance',()=>{
 const parts=[fill(1,[rect(0,0,5,4)]),fill(2,[rect(3,0,5,4)])],whole=fill(3,[rect(20,0,8,4)]);
 assert.deepEqual(find([whole],template(parts,[0,0])).map(h=>h.elementIds),[[3]]);
 assert.deepEqual(find(parts,template([whole],[20,0])).map(h=>h.elementIds),[[1,2]]);
});

test('right-angle poses preserve off-centre anchors, and fixed orientation does not expand them',()=>{
 const l=[[0,0],[8,0],[8,2],[3,2],[3,7],[0,7]],source=template([fill(1,[l])],[1,3]),target=[0,90,180,270].map((a,i)=>fill(10+i,[transform(l,a,30+i*30,40)]));
 const hits=find(target,source);assert.equal(hits.length,4);for(let i=0;i<4;i++){const hit=hits.find(h=>h.elementIds[0]===10+i),expected=transform([[1,3]],i*90,30+i*30,40)[0];assert.equal(hit.rotation,i*90);assert.deepEqual([hit.x,hit.y],expected);}
 assert.deepEqual(find(target,source,{rotations:false}).map(h=>h.elementIds),[[10]]);
});

test('even-odd holes and nonzero opposite-winding nested holes remain holes',()=>{
 for(const rule of ['evenodd','nonzero']){
  const outside=rect(0,0,8,8),hole=rect(2,2,4,4),source=template([fill(1,[outside,rule==='nonzero'?[...hole].reverse():hole],{rule})]);
  const frame=[rect(20,0,8,2),rect(20,6,8,2),rect(20,2,2,4),rect(26,2,2,4)].map((p,i)=>fill(10+i,[p],{rule}));
  assert.equal(find(frame,source).length,1);assert.equal(find([fill(20,[rect(40,0,8,8)],{rule})],source).length,0);
 }
});

test('missing holes, disconnected gaps, changed colour, scale and remote compound tails are rejected',()=>{
 const source=template([fill(1,[rect(0,0,8,4)])]);
 for(const target of [
  [fill(2,[rect(20,0,3.99,4)]),fill(3,[rect(24.01,0,3.99,4)])],
  [fill(2,[rect(20,0,8,4)],{colour:'#ff0000'})],
  [fill(2,[rect(20,0,8.2,4)])],
  [fill(2,[rect(20,0,8,4),rect(100,100,1,1)])],
  [fill(2,[rect(20,0,8,4),rect(22,1,1,1).reverse()])]
 ])assert.equal(find(target,source).length,0);
});

test('whole same-colour connected background prevents a manufactured subset candidate',()=>{
 const source=template([fill(1,[rect(0,0,8,4)])]),target=[fill(2,[rect(20,0,8,4)]),fill(3,[rect(27,3,1,4)])];
 assert.equal(find(target,source).length,0);
});

test('stroke, PDF hairline, curved, self-crossing, disconnected and multi-colour sources stay unsupported',()=>{
 const target=[fill(10,[rect(20,0,8,4)])],base=fill(1,[rect(0,0,8,4)]),curve=structuredClone(base);curve.pathCommands=[0,0,0,2,1,1,2,2,8,4,4];
 for(const elements of [
  [fill(1,[rect(0,0,8,4)],{stroke:'#000000',width:0})],
  [fill(1,[rect(0,0,8,4)],{stroke:'#000000',width:1})],
  [curve],[fill(1,[[[0,0],[8,4],[0,4],[8,0]]])],
  [base,fill(2,[rect(10,0,1,1)])],
  [base,fill(2,[rect(0,0,1,1)],{colour:'#ff0000'})]
 ])assert.deepEqual(find(target,template(elements)),[]);
});

test('explicit exclusions remain untouched and are not silently added to the retained shape',()=>{
 const source=template([fill(1,[rect(0,0,8,4)])]);source.excludedElements=[{id:9,style:{stroke:'#000000',fill:null,width:.2},segments:[[1,4,-5,4,10]]}];const before=structuredClone(source);
 assert.equal(find([fill(2,[rect(20,0,8,4)])],source).length,1);assert.deepEqual(source,before);
});

test('optional source/target capacity refusal does not interrupt an existing baseline search',()=>{
 const source=template([fill(1,[rect(0,0,8,4)])]),large=Array(50001).fill(null);
 const stroked=template([fill(1,[rect(0,0,8,4)],{stroke:'#000000',width:0})]);
 assert.deepEqual(find(large,stroked),[],'Unsupported hairline source is refused before scanning a large target');
 assert.deepEqual(find(large,source),[],'Target count outside the optional family is a capacity refusal, not a malformed baseline');
 assert.deepEqual(find([],template(Array.from({length:129},(_,i)=>fill(i,[rect(0,0,8,4)])))),[]);
 assert.throws(()=>find(large,stroked,{cancelled:()=>true}),{code:'VECTOR_FILL_CANCELLED'});
});

test('budgets and cancellation fail atomically; malformed identities or options do not produce candidates',()=>{
 const source=template([fill(1,[rect(0,0,8,4)])]),target=[fill(2,[rect(20,0,8,4)]),fill(3,[rect(40,0,8,4)])];
 assert.throws(()=>find(target,source,{maxWork:1}),{code:'VECTOR_FILL_BUDGET'});assert.throws(()=>find(target,source,{cancelled:()=>true}),{code:'VECTOR_FILL_CANCELLED'});
 let calls=0;assert.throws(()=>find(target,source,{cancelled:()=>++calls>150}),{code:'VECTOR_FILL_CANCELLED'});
 for(const options of [{maxWork:0},{tolerance:.1},{rotations:1},{scaleRange:[1,1]},{polygonBoolean:null}])assert.throws(()=>find(target,source,options),{code:'VECTOR_FILL_INVALID'});
 assert.throws(()=>find([target[0],target[0]],source),{code:'VECTOR_FILL_INVALID'});
 const bad=structuredClone(target);bad[0].pathCommands[1]=NaN;assert.throws(()=>find(bad,source),{code:'VECTOR_FILL_INVALID'});
});
