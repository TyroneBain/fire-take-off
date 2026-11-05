import test from 'node:test';
import assert from 'node:assert/strict';
import {vectorPageSetPayload} from '../apps/local/web/vector-page-set-ui.mjs';
import {runSavedVectorPageSetReview} from '../apps/local/web/vector-page-set-runner.mjs';
import {VECTOR_CONTEXT_REVIEW_VERSION,VECTOR_CONTEXT_MATCH_POLICY,validVectorReview} from '../apps/local/web/vector-review-policy.mjs';
import {ELEMENT_RENDERER} from '../apps/local/web/pdf-elements.mjs';

function reviewFixture(){
 const digest='a'.repeat(64),drawing={id:'source',digest},elements={renderer:ELEMENT_RENDERER,ids:[2,3],excluded:[3]},record={id:'example',version:1,example:{drawing_id:drawing.id,digest,page:1,bounds:[30,30,50,50],elements}},item={version:1};
 const review={completed:true,matchPolicy:VECTOR_CONTEXT_MATCH_POLICY,sourceContextIds:[],source:{drawingId:drawing.id,digest,page:1,anchor:[40,40]},layerPolicy:'all-admitted',pages:[{drawingId:drawing.id,digest,page:1,result:{completed:true,version:'vector-pattern-review-2',binding:{documentSha256:digest,pageNumber:1},sourceBinding:{documentSha256:digest,pageNumber:1},source:{visibility:{verified:true,proof:'contour-paint-visibility-4'}},layerScope:{mode:'all-admitted'},coverage:{requestedPaints:8,admittedPaints:8,unknown:[],excluded:[]},proposals:[{x:40,y:40,rotation:90,elementIds:[2],contextIds:[],visibility:{verified:true}}]}}]};
 return{record,item,drawing,elements,review,marks:[],selected:new Set([0])};
}

test('context Apply retains explicit policy while refusing missing decision permissions',()=>{
 const input=reviewFixture(),payload=vectorPageSetPayload(input);
 assert.equal(payload.vectorReview.version,VECTOR_CONTEXT_REVIEW_VERSION);
 assert.equal(validVectorReview(payload.vectorReview,1),true);
 assert.deepEqual(payload.vectorReview.sourceContextIds,[]);
 assert.deepEqual(payload.vectorReview.pages[0].decisions[0].contextIds,[]);
 for(const mutate of [v=>delete v.review.pages[0].result.proposals[0].contextIds,v=>v.review.sourceContextIds=[2],v=>v.review.matchPolicy='ignore-background']){
  const bad=reviewFixture();mutate(bad);assert.throws(()=>vectorPageSetPayload(bad));
 }
});

test('saved context recount cannot downgrade or invent its policy before opening any PDF',async()=>{
 const f=reviewFixture(),review=vectorPageSetPayload(f).vectorReview;let opened=0;
 const args={pdfjs:{OPS:{},version:'test',getDocument:()=>{opened++;throw Error('PDF access forbidden');}},sourceDrawing:f.drawing,example:{...f.record.example,algorithm:VECTOR_CONTEXT_REVIEW_VERSION,vectorReview:review},targets:[{drawing:f.drawing,page:1}],createCanvas:()=>{throw Error('Canvas access forbidden');}};
 await assert.rejects(runSavedVectorPageSetReview({...args,matchPolicy:'strict'}),/policy cannot change/);
 const bad=structuredClone(args.example);delete bad.vectorReview.sourceContextIds;
 await assert.rejects(runSavedVectorPageSetReview({...args,example:bad}),/policy cannot change/);
 assert.equal(opened,0);
});
