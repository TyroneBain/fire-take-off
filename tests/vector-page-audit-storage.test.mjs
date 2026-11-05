import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {auditNativePage,NATIVE_PAGE_STORAGE_LIMITS} from '../apps/local/web/vector-page-audit.mjs';

// Original ordered polygon operations. Repeated geometry deliberately has
// distinct paint identities; compaction must never merge those operations.
function fixture(count=4800,segments=72){
 const path=[0,40,40];for(let i=1;i<=segments;i++){const angle=i*2*Math.PI/segments;path.push(1,40+4*Math.sin(angle),36+4*Math.cos(angle));}
 return {fnArray:Array(count).fill(OPS.constructPath),argsArray:Array.from({length:count},()=>[OPS.stroke,[[...path]]])};
}
function options(list){return {page:{getOperatorList:async()=>list,getViewport:()=>({transform:[2,0,0,-2,0,200]})},OPS,optionalContentVisible:()=>true,check(){},chargeAudit(){},notify(){}};}

test('bounded compaction admits original geometry previously charged twice without merging duplicate paints',async()=>{
 const list=fixture(),rawCommandValues=list.argsArray.reduce((sum,a)=>sum+a[1][0].length,0);
 assert.ok(rawCommandValues*2>2000000,'The former raw-plus-native counter rejects this original fixture');
 const audit=await auditNativePage(options(list));assert.equal(audit.records.length,4800);assert.equal(audit.elements.length,4800);assert.equal(audit.failures.length,0);
 assert.deepEqual(audit.records.map(r=>r.id),Array.from({length:4800},(_,i)=>i));assert.deepEqual(audit.elements[0].pathCommands,audit.elements[4799].pathCommands);assert.deepEqual(audit.elements[0].segments,audit.elements[4799].segments);assert.notEqual(audit.elements[0].id,audit.elements[4799].id);
 assert.equal(audit.storage.nativeCommandValues,rawCommandValues);assert.equal(audit.storage.segmentValues,4800*72*5);assert.equal(audit.storage.retainedGeometryValues,audit.storage.nativeCommandValues+audit.storage.segmentValues);
 assert.ok(audit.storage.retainedGeometryValues<NATIVE_PAGE_STORAGE_LIMITS.retainedGeometryValues);assert.deepEqual(Object.keys(audit.records[0]).sort(),['contextComplete','id','opaque','optionalContentScopes','wholeOperation']);
 assert.equal(list.argsArray[0][1][0].length,219,'Original operator arrays remain intact');
});

test('retained geometry and original command budgets refuse atomically',async()=>{
 const commandHeavy=fixture(800,1);for(const a of commandHeavy.argsArray)a[1][0].push(...Array(2600).fill(4));
 for(const list of [fixture(600,1000),commandHeavy]){let output;await assert.rejects(async()=>{output=await auditNativePage(options(list));},/retained geometry storage budget/);assert.equal(output,undefined);}
});
