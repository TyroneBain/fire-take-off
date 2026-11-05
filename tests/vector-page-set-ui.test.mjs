import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorReviewTargets,vectorReviewCandidates} from '../apps/local/web/vector-page-set-ui.mjs';
import {vectorReviewPayload} from '../apps/local/web/vector-review-ui.mjs';
import {VECTOR_PAGE_REVIEW_VERSION,validVectorReview} from '../apps/local/web/vector-review-policy.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';
const digest='a'.repeat(64),otherDigest='b'.repeat(64);
function fixture(){
 const drawing={id:'source',digest,discipline_id:'fire',pages:[{},{}]},other={id:'target',digest:otherDigest,discipline_id:'fire',pages:[{}]},item={id:'heading',version:1,discipline_id:'fire'},record={id:'example',version:1,item_id:item.id,created:'2026-11-05',example:{drawing_id:drawing.id,digest,page:1,bounds:[34,34,46,46]}};
 const page=(d,number,ids)=>({drawingId:d.id,digest:d.digest,page:number,result:{completed:true,version:'vector-pattern-review-1',binding:{documentSha256:d.digest,pageNumber:number},sourceBinding:{documentSha256:digest,pageNumber:1},source:{visibility:{verified:true,proof:'contour-paint-visibility-4'}},layerScope:{mode:'all-admitted'},coverage:{requestedPaints:20,admittedPaints:20,unknown:[],excluded:[]},proposals:[{x:40,y:40,rotation:90,elementIds:ids,visibility:{verified:true}},{x:90,y:40,rotation:0,elementIds:[15,16],visibility:{verified:false}}]}});
 const review={completed:true,source:{drawingId:drawing.id,digest,page:1,anchor:[40,40]},layerPolicy:'all-admitted',pages:[page(drawing,1,[2,3]),page(drawing,2,[8,9]),page(other,1,[5,6])]};
 return{drawing,other,item,record,marks:[{id:'outside',example_id:record.id,version:4,drawing_id:'outside',page:1}],elements:{renderer:'pdfjs-6.4.299-paths-1',ids:[2,3,4],excluded:[4]},review,selected:new Set([0,4])};
}
test('page-set Apply keeps page-local IDs and rejected decisions at identical coordinates without saving unverified marks',()=>{
 const value=fixture(),before=structuredClone(value),p=vectorReviewPayload(value);
 assert.equal(validVectorReview(p.vectorReview,2),true);assert.deepEqual(p.scope,[{id:'source',digest,pages:[1,2]},{id:'target',digest:otherDigest,pages:[1]}]);
 assert.deepEqual(p.vectorReview.pages.map(v=>v.decisions[0].included),[true,false,true]);assert.deepEqual(p.vectorReview.pages.map(v=>v.decisions[0].elementIds),[[2,3],[8,9],[5,6]]);
 assert.deepEqual(p.matches.map(m=>[m.drawing_id,m.page]),[['source',1],['target',1]]);assert.deepEqual(p.expected_marks,[{id:'outside',version:4}]);assert.deepEqual(value,before);assert.equal(vectorReviewCandidates(value.review).length,6);
 for(const mutate of [v=>v.selected.add(1),v=>v.review.pages[1].result.binding.pageNumber=1,v=>v.review.pages[1].result.sourceBinding.documentSha256=otherDigest,v=>v.review.pages.push(structuredClone(v.review.pages[0])),v=>v.review.pages.shift()]){const bad=fixture();mutate(bad);assert.throws(()=>vectorReviewPayload(bad));}
});
test('scope resolution never silently drops missing saved pages or searches another discipline',()=>{
 const f=fixture(),state={drawings:[f.drawing,f.other,{id:'foreign',digest,discipline_id:'other',pages:[{}]}]},args={state,record:f.record};
 assert.equal(vectorReviewTargets({...args,scope:'drawing'}).length,2);assert.equal(vectorReviewTargets({...args,scope:'discipline'}).length,3);assert.equal(vectorReviewTargets({...args,scope:'source'}).length,1);
 f.record.example.algorithm=VECTOR_PAGE_REVIEW_VERSION;f.record.example.vectorReview=vectorReviewPayload(f).vectorReview;
 assert.equal(vectorReviewTargets(args).length,3);f.other.digest=digest;assert.throws(()=>vectorReviewTargets(args),/missing or changed/);f.other.digest=otherDigest;
 f.record.example.vectorReview.pages[1].page=99;assert.throws(()=>vectorReviewTargets(args),/Invalid/);
 assert.throws(()=>vectorReviewTargets({...args,scope:'unknown'}),/supported/);f.drawing.pages=Array.from({length:21},()=>({}));assert.throws(()=>vectorReviewTargets({...args,scope:'drawing'}),/20/);
});
test('drawing recount visits a declared target of a page-set selection and skips undeclared drawings',async()=>{
 const f=fixture(),p=vectorReviewPayload(f);f.record.example.algorithm=VECTOR_PAGE_REVIEW_VERSION;f.record.example.vectorReview=p.vectorReview;
 const unrelated={...f.other,id:'unsearched'},state={drawings:[f.drawing,f.other,unrelated],countItems:[f.item],countExamples:[f.record],countMarks:[]};let calls=0;
 const reviewVector=async(record,source,target)=>{calls++;assert.equal(source.id,f.drawing.id);assert.equal(target.id,f.other.id);return{matches:p.matches.filter(m=>m.drawing_id===target.id),vectorReview:{...p.vectorReview,pages:p.vectorReview.pages.filter(v=>v.drawing_id===target.id)}};};
 const forbidden=()=>{throw Error('Legacy raster path must not execute');};
 const result=await recognizeDrawing({state,target:f.other,reviewVector,render:forbidden,search:forbidden});assert.equal(calls,1);assert.equal(result.selections[0].matches.length,1);assert.equal(result.selections[0].vectorReview.pages.length,1);
 const skipped=await recognizeDrawing({state,target:unrelated,reviewVector:forbidden,render:forbidden,search:forbidden});assert.deepEqual(skipped.selections[0].matches,[]);
});
