import test from 'node:test';
import assert from 'node:assert/strict';
import {scopeVectorLayerCandidates} from '../apps/local/web/vector-layer-scope.mjs';
const documentSha256='7'.repeat(64);
function original(id,group='sprinklers',stroke='#000000'){
 return {id,wholeOperation:true,opaque:true,contextComplete:true,optionalContentScopes:[{operatorId:0,visible:true,descriptor:{type:'OCG',id:group}}],style:{stroke},pathCommands:[0,id,0,1,id,5]};
}
function input(records=[original(1)]){
 return {enabled:true,source:{documentSha256,pageNumber:1,records,retainedIds:[1]},target:{documentSha256,pageNumber:1,records},optionalContentVisible:()=>true};
}
test('cancellation requested by the final visibility check cannot publish a partial scoped inventory',()=>{
 let cancelled=false,calls=0;
 const result=scopeVectorLayerCandidates({...input(),cancelled:()=>cancelled,optionalContentVisible:()=>{if(++calls===3)cancelled=true;return true;}});
 assert.equal(calls,3);assert.equal(result.supported,false);assert.match(result.reason,/cancelled/);for(const key of ['candidateRecords','excluded','unknown'])assert.deepEqual(result[key],[]);
});
test('layer policy preserves full source exclusions and coloured same-layer details without claiming trusted binding',()=>{
 const records=[original(1),original(2,'pipework','#ff0000'),original(3,'sprinklers','#ff0000'),original(4,'sprinklers','#ffffff')],request=input(records),before=structuredClone(request.source),result=scopeVectorLayerCandidates(request);
 assert.equal(result.supported,true);assert.deepEqual(result.candidateRecords.map(r=>r.id),[1,3,4]);assert.deepEqual(result.excluded.map(r=>r.id),[2]);assert.deepEqual(request.source,before);assert.notEqual(result.candidateRecords,records);assert.equal(result.candidateRecords[0],records[0],'record references remain caller-owned');
 assert.equal(result.scopeOnly,true);assert.equal(result.complete,false);assert.equal(result.requiresRenderVerification,true);assert.equal(result.requiresSemanticVerification,true);for(const field of ['score','accepted','acceptedCount','verified'])assert.equal(field in result,false);
 // Equal SHA/page metadata is a caller assertion, not a proof that inventory
 // came from those bytes. The consumer must bind and revalidate the PDF/config.
 assert.equal(result.binding.documentSha256,documentSha256);assert.equal(result.binding.pageNumber,1);
});
test('late invalid coverage or resolver failure clears every accumulated candidate and exclusion',()=>{
 const base=input([original(1),original(2,'other'),original(3)]);
 for(const target of [{...base.target,failures:[{id:3,reason:'conflicting original identity'}]},{...base.target,failures:[{id:9,reason:''}]},{...base.target,records:[...base.target.records,{id:4,optionalContentScopes:[]}],failures:[{id:9,reason:'unsupported paint'} ,{id:9,reason:'duplicate omission'}]}]){
  const result=scopeVectorLayerCandidates({...base,target});assert.equal(result.supported,false);for(const field of ['candidateRecords','excluded','unknown'])assert.deepEqual(result[field],[]);
 }
 let calls=0;const result=scopeVectorLayerCandidates({...base,optionalContentVisible:()=>{if(++calls===4)throw Error('lost configuration binding');return true;}});assert.equal(result.supported,false);assert.match(result.reason,/lost configuration/);assert.deepEqual(result.candidateRecords,[]);assert.deepEqual(result.excluded,[]);
});
