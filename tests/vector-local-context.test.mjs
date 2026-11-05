import test from 'node:test';
import assert from 'node:assert/strict';
import clipping from 'polygon-clipping';
import {compareLocalContext} from '../apps/local/web/vector-local-context.mjs';

const rectangle = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const paint = (id, loops, rule='nonzero') => ({id,style:{fill:'#aa0000',stroke:null,width:0,cap:0,join:0,miter:0,rule},pathCommands:loops.flatMap(loop=>[0,...loop[0],...loop.slice(1).flatMap(p=>[1,...p]),4])});
const record = e => ({id:e.id,wholeOperation:true,opaque:true,contextComplete:true});
const compare = (sourceElements,targetElements,options={}) => compareLocalContext({sourceElements,targetElements,sourceExcludedIds:sourceElements.map(e=>e.id),sourceRecords:sourceElements.map(record),targetRecords:targetElements.map(record),polygonBoolean:clipping,...options});

test('local nonzero context interprets isolated self-crossing and overlapping simple subpaths without losing original fragments',()=>{
  const bow=[[0,0],[2,2],[0,2],[2,0]];
  const source=[paint(1,[bow,rectangle(5,0,2,2),rectangle(6,0,2,2)])];
  const target=[paint(2,[[[0,0],[2,0],[1,1]]]),paint(3,[[[0,2],[1,1],[2,2]]]),paint(4,[rectangle(5,0,3,2)])];
  const before=structuredClone(source),r=compare(source,target);
  assert.equal(r.supported,true,r.reason);assert.equal(r.equivalent,true);assert.deepEqual(r.explainedTargetIds,[2,3,4]);
  assert.equal(r.sourceFragments.length,3);assert.equal(r.sourceFragments[0].elementId,1);
  for(const f of r.sourceFragments)assert.deepEqual(f.originalCommands,source[0].pathCommands.slice(...f.commandRange));
  assert.equal(r.support[0].completeOperations,true);assert.equal(r.requiresOriginalPaintVerification,true);assert.equal(r.requiresSemanticReview,true);
  assert.deepEqual(source,before);r.sourceFragments[0].originalCommands[1]=999;assert.deepEqual(source,before);
});

test('nonzero winding interactions are refused instead of silently filling opposite-winding overlap',()=>{
  const a=rectangle(0,0,4,4),b=rectangle(1,1,2,2).reverse();
  for(const loops of [[a,b],[[[0,0],[4,4],[0,4],[4,0]],rectangle(1,0,2,4)]]) {
    const r=compare([paint(1,loops)],[paint(2,[a])]);
    assert.equal(r.supported,false);assert.match(r.reason,/winding interaction/);assert.deepEqual(r.explainedTargetIds,[]);
  }
});

test('even-odd holes, off-footprint dot, crossbar and remote merged tail remain discriminators',()=>{
  const a=rectangle(0,0,2,8),source=[paint(1,[a])];
  for(const target of [[paint(2,[a]),paint(3,[rectangle(3,3,.2,.2)])],[paint(2,[a]),paint(3,[rectangle(-2,3,6,.3)])],[paint(2,[a,rectangle(100,0,1,1)])]]) {
    const r=compare(source,target);assert.equal(r.supported,true,r.reason);assert.equal(r.equivalent,false);
  }
  const hollow=paint(1,[rectangle(0,0,4,4),rectangle(1.99,1.99,.02,.02)],'evenodd');
  const r=compare([hollow],[paint(2,[rectangle(0,0,4,4)],'evenodd')]);
  assert.equal(r.supported,true,r.reason);assert.equal(r.equivalent,false,'even a tiny hole cannot disappear through boundary tolerance');
});

test('one rigid pose and full component correspondence, without local fitting or subset containment',()=>{
  const source=[paint(1,[rectangle(0,0,1,4)]),paint(2,[rectangle(8,0,1,4)])];
  const target=[paint(3,[rectangle(16,30,4,1)])];
  const r=compare(source,target,{sourceTransform:[0,1,-1,0,20,30]});
  assert.equal(r.equivalent,true,'entire disconnected source context components can be absent');
  assert.equal(compare(source,[paint(3,[rectangle(0,0,1,2)])]).equivalent,false,'partial component cannot count as equivalent');
  assert.equal(compare(source,target,{sourceTransform:[2,0,0,2,0,0]}).supported,false);
});

test('boundary coverage uses unchanged physical tolerance and returns atomic resource refusals',()=>{
  const source=[paint(1,[rectangle(0,0,2,3)])];
  assert.equal(compare(source,[paint(2,[rectangle(.04,0,2,3)])]).equivalent,true);
  assert.equal(compare(source,[paint(2,[rectangle(.06,0,2,3)])]).equivalent,false);
  for(const options of [{maxWork:1},{cancelled:()=>true},{tolerance:.1}]){
    const r=compare(source,[paint(2,[rectangle(0,0,2,3)])],options);
    assert.equal(r.supported,false);assert.deepEqual(r.explainedTargetIds,[]);assert.deepEqual(r.sourceFragments,[]);
  }
  const ids=Array.from({length:129},(_,i)=>i);
  assert.equal(compare(source,[],{sourceExcludedIds:ids}).supported,false);
  const huge=paint(1,[rectangle(0,0,2,3)]);huge.pathCommands=new Array(32769).fill(0);
  assert.equal(compare([huge],[]).supported,false);
});
