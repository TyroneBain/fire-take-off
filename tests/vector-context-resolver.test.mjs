import test from 'node:test';
import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {createLocalContextResolver} from '../apps/local/web/vector-context-match.mjs';
const paint=(id,x,y,w,h,colour='#000000')=>({id,bounds:[x,y,x+w,y+h],style:{fill:colour,stroke:null,width:0,cap:0,join:0,miter:0,rule:'nonzero'},pathCommands:[0,x,y,1,x+w,y,1,x+w,y+h,1,x,y+h,4]});
const record=e=>({id:e.id,wholeOperation:true,opaque:true,contextComplete:true});
function setup(source,targets,{check=()=>{},chargeWork=()=>{}}={}){
 const resolver=createLocalContextResolver({sourceRecords:source.map(record),targetRecords:targets.map(record),polygonBoolean:clipping,check,chargeWork});
 const args={template:{excludedElements:source,anchor:[0,0]},ignored:source,envelope:[-6,-6,6,6],used:new Set([999]),angle:0,offset:[0,0],scale:1,tolerance:.05,page:{elements:targets}};
 return {resolver,args};
}
test('connected resolver compares full exterior stem and split/overlapping target operations',()=>{
 for(const targets of [[paint(2,-.5,-16,1,12),paint(3,-.5,-4,1,4)],[paint(2,-.5,-16,1,14),paint(3,-.5,-4,1,4)]]){
  const {resolver,args}=setup([paint(1,-.5,-16,1,16)],targets);
  assert.deepEqual([...resolver.resolve(args)],[2,3]);
  const evidence=resolver.evidence({x:0,y:0,rotation:0,elementIds:[999]});
  assert.deepEqual(evidence.sourceElementIds,[1]);assert.deepEqual(evidence.targetElementIds,[2,3]);
  assert.deepEqual(evidence.sourceSubpaths,[{elementId:1,subpathIndex:0,commandRange:[0,13]}]);
  assert.equal(evidence.sourceSubpaths[0].originalCommands,undefined);assert.equal(evidence.requiresOriginalPaintVerification,true);
  evidence.sourceSubpaths[0].commandRange[0]=100;assert.equal(resolver.evidence({x:0,y:0,rotation:0,elementIds:[999]}).sourceSubpaths[0].commandRange[0],0);
 }
});
test('whole outside continuations, wrong styles and added connected detail cannot be cropped away',()=>{
 const source=[paint(1,-.5,-16,1,16)];
 for(const targets of [[paint(2,-.5,-4,1,4)],[paint(2,-.5,-30,1,26),paint(3,-.5,-4,1,4)],[paint(2,-.5,-16,1,12,'#ff0000'),paint(3,-.5,-4,1,4)],[paint(2,-.5,-16,1,12),paint(3,-.5,-4,1,4),paint(4,.5,-2,3,.5)]]){
  const {resolver,args}=setup(source,targets);assert.equal(resolver.resolve(args).size,0);assert.equal(resolver.evidence({x:0,y:0,rotation:0,elementIds:[999]}),null);
 }
});
test('resolver caches are page/template bound and caller mutation cannot add explained IDs',()=>{
 const {resolver,args}=setup([paint(1,0,0,1,2)],[paint(2,0,0,1,2)]);
 const ids=resolver.resolve(args);ids.add(123);assert.equal(resolver.resolve(args).has(123),false);
 assert.throws(()=>resolver.resolve({...args,page:{elements:args.page.elements}}),/one page/);
 assert.throws(()=>resolver.resolve({...args,template:{...args.template}}),/one source/);
});
test('connected expansion and cancellation refuse atomically within declared budgets',()=>{
 const targets=Array.from({length:130},(_,i)=>paint(i+2,0,i,1,1));
 const {resolver,args}=setup([paint(1,0,0,1,130)],targets);
 assert.throws(()=>resolver.resolve(args),/budget/);assert.equal(resolver.evidence({x:0,y:0,rotation:0,elementIds:[999]}),null);
 let cancelled=false;const c=setup([paint(1,0,0,1,2)],[paint(2,0,0,1,2)],{check(){if(cancelled)throw Error('cancelled');},chargeWork(){cancelled=true;}});
 assert.throws(()=>c.resolver.resolve(c.args),/cancelled/);
});
