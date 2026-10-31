import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorReviewPayload} from '../apps/local/web/vector-review-ui.mjs';
import {validVectorReview,VECTOR_REVIEW_VERSION} from '../apps/local/web/vector-review-policy.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';
const digest='a'.repeat(64);
function input(){return{record:{id:'example',version:2,item_id:'heading',example:{drawing_id:'drawing',digest,page:1,bounds:[10,10,20,20]}},item:{id:'heading',version:3},drawing:{id:'drawing',digest},marks:[{id:'old',example_id:'example',version:4}],elements:{renderer:'pdfjs-6.4.299-paths-1',ids:[1,2,3],excluded:[3]},review:{drawingId:'drawing',documentSha256:digest,page:1,sourceLayerScope:true,savedNativeAnchor:[15,15],result:{completed:true,version:'vector-candidate-review-1',source:{visibility:{verified:true,proof:'contour-paint-visibility-4'}},coverage:{requestedPaints:12,admittedPaints:10,unknown:[{id:11},{id:12}],excluded:[{id:3}],complete:false},proposals:[{x:15,y:15,rotation:0,elementIds:[1,2],visibility:{verified:true}},{x:45,y:15,rotation:90,elementIds:[6,7],visibility:{verified:true}},{x:75,y:15,rotation:0,elementIds:[8,9],visibility:{verified:false}}]}},selected:new Set([0])};}
test('UI Apply keeps explicit rejected decisions but never saves an unverified proposal or changes its inputs',()=>{
 const value=input(),before=structuredClone(value),payload=vectorReviewPayload(value);assert.equal(validVectorReview(payload.vectorReview,payload.matches.length),true);assert.equal(payload.matches.length,1);assert.deepEqual(payload.vectorReview.decisions.map(d=>d.included),[true,false]);assert.equal(payload.vectorReview.decisions.some(d=>d.x===75),false);assert.deepEqual(payload.expected_marks,[{id:'old',version:4}]);assert.deepEqual(value,before);
 for(const invalid of [{...input(),selected:new Set([2])},{...input(),drawing:{id:'other',digest}},{...input(),review:{...input().review,result:{completed:false}}}])assert.throws(()=>vectorReviewPayload(invalid));
});
test('native drawing recount calls the explicit review route only for the original source drawing and cancels atomically',async()=>{
 const source={id:'drawing',digest,discipline_id:'discipline',pages:[{}]},other={...source,id:'other'},record={id:'example',version:2,item_id:'heading',example:{drawing_id:source.id,digest,page:1,algorithm:VECTOR_REVIEW_VERSION}},state={drawings:[source,other],countItems:[{id:'heading',version:3,discipline_id:'discipline'}],countExamples:[record],countMarks:[{id:'mark',drawing_id:'drawing',version:4}]};
 const unexpected=()=>{throw Error('Legacy raster path must not run');};let calls=0,cancelled=false;
 const reviewVector=async()=>{calls++;return{matches:[],vectorReview:{decision:'apply'}};};
 const result=await recognizeDrawing({state,target:source,render:unexpected,search:unexpected,reviewVector});assert.equal(calls,1);assert.equal(result.selections[0].vectorReview.decision,'apply');assert.deepEqual(result.expected_marks,[{id:'mark',version:4}]);
 const skipped=await recognizeDrawing({state,target:other,render:unexpected,search:unexpected,reviewVector:unexpected});assert.deepEqual(skipped.selections[0].matches,[]);
 await assert.rejects(recognizeDrawing({state,target:source,render:unexpected,search:unexpected,cancelled:()=>cancelled,reviewVector:async()=>{cancelled=true;return{matches:[],vectorReview:{}};}}),/cancelled/);
});
