import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionList} from '../apps/local/web/selection-list.mjs';
const mark=(id,example_id,item_id,page,included=true,quantity=3)=>({id,example_id,item_id,page,included,quantity,origin:'automatic',drawing_id:'drawing'});

test('selection rows reconcile every page, factors, exclusions and reclassification without inflating heading totals',()=>{
 const state={countExamples:[{id:'a',item_id:'heads',multiplier:3},{id:'b',item_id:'heads',multiplier:2},{id:'unused',item_id:'heads',multiplier:1},{id:'foreign',item_id:'special',multiplier:7}],countMarks:[mark('one','a','heads',1),mark('two','a','heads',2),mark('out','a','heads',2,false,0),mark('moved','a','special',1),mark('three','b','heads',5,true,2),mark('incoming','foreign','heads',3,true,7),mark('legacy',null,'heads',3,true,1),{...mark('manual',null,'heads',1,true,1),origin:'manual'},{...mark('other-drawing','a','heads',1),drawing_id:'elsewhere'},mark('excluded-manual',null,'heads',1,false,0)]};
 const original=structuredClone(state),list=selectionList(state,'heads','drawing');
 assert.deepEqual(list.rows.map(({record,...r})=>[record.id,r]),[['a',{matches:2,quantity:6,excluded:1,moved:1}],['b',{matches:1,quantity:2,excluded:0,moved:0}],['unused',{matches:0,quantity:0,excluded:0,moved:0}]]);
 assert.deepEqual(list.other,{matches:3,quantity:9,excluded:1,manual:1,unlinked:1,reclassified:1});assert.equal(list.matches,6);assert.equal(list.quantity,17);assert.equal(list.excluded,2);assert.deepEqual(state,original);
 const special=selectionList(state,'special','drawing');assert.equal(special.quantity,3);assert.equal(special.rows[0].moved,1);assert.equal(special.other.reclassified,1);
 const empty=selectionList(state,'heads','missing');assert.equal(empty.matches,0);assert.equal(empty.quantity,0);assert.equal(empty.rows.length,3);
});

test('selection list supports a manual-only heading, missing legacy derived quantities and empty state',()=>{
 const state={countMarks:[{...mark('manual',null,'manual',1,true,undefined),quantity:undefined,origin:'manual'},{...mark('linked','foreign','manual',2),quantity:undefined,multiplier:4}]};
 const result=selectionList(state,'manual','drawing');assert.equal(result.rows.length,0);assert.equal(result.matches,2);assert.equal(result.quantity,5);assert.equal(result.other.manual,1);assert.equal(result.other.reclassified,1);
 assert.deepEqual(selectionList(null,'missing','missing'),{rows:[],other:{matches:0,quantity:0,excluded:0,manual:0,unlinked:0,reclassified:0},matches:0,quantity:0,excluded:0});
});
