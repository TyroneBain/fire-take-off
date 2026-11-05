import {VECTOR_PAGE_REVIEW_VERSION,validVectorReview,isVectorPageReviewAlgorithm} from './vector-review-policy.mjs';

// Resolve scope from the current snapshot; never silently drop changed or
// unavailable drawings from a saved search.
export function vectorReviewTargets({state,record,scope='saved'}){
 const source=state.drawings.find(d=>d.id===record.example.drawing_id&&d.digest===record.example.digest);
 if(!source)throw Error('Selection source is missing or changed');
 let targets;
 if(scope==='saved'&&isVectorPageReviewAlgorithm(record.example.algorithm))targets=record.example.vectorReview.pages.map(p=>{
  const drawing=state.drawings.find(d=>d.id===p.drawing_id&&d.digest===p.digest);if(!drawing)throw Error('A saved search drawing is missing or changed');return{drawing,page:p.page};
 });
 else if(scope==='source'||scope==='saved')targets=[{drawing:source,page:record.example.page}];
 else if(scope==='drawing'||scope==='discipline')targets=(scope==='drawing'?[source]:state.drawings.filter(d=>d.discipline_id===source.discipline_id)).flatMap(drawing=>drawing.pages.map((_,i)=>({drawing,page:i+1})));
 else throw Error('Choose a supported vector search scope');
 if(!targets.length||targets.length>20)throw Error('Vector review supports at most 20 explicit pages per run; choose a smaller scope');
 const seen=new Set();for(const {drawing,page}of targets){const key=JSON.stringify([drawing.id,page]);if(seen.has(key)||drawing.discipline_id!==source.discipline_id||!Number.isSafeInteger(page)||page<1||page>drawing.pages.length)throw Error('Invalid or duplicate search page');seen.add(key);}
 if(!seen.has(JSON.stringify([source.id,record.example.page])))throw Error('The search must include the source page');return targets;
}

export const vectorReviewCandidates=review=>review.pages?review.pages.flatMap(p=>p.result.proposals.map(candidate=>({...candidate,drawingId:p.drawingId,digest:p.digest,page:p.page}))):review.result.proposals.map(p=>({...p,drawingId:review.drawingId,digest:review.documentSha256,page:review.page}));

export function vectorPageSetPayload({record,item,drawing,marks,elements,review,selected}){
 if(!review?.completed||!Array.isArray(review.pages)||!(selected instanceof Set)||review.source?.drawingId!==drawing.id||review.source.digest!==drawing.digest||review.source.page!==record.example.page)throw Error('Complete vector page review required');
 const candidates=vectorReviewCandidates(review);for(const i of selected)if(!Number.isInteger(i)||candidates[i]?.visibility?.verified!==true)throw Error('Unverified proposals cannot be included');
 let offset=0;const scope=[],pages=review.pages.map(p=>{
  const r=p.result;if(!r?.completed||r.source?.visibility?.verified!==true||r.binding?.documentSha256!==p.digest||r.binding?.pageNumber!==p.page||r.sourceBinding?.documentSha256!==drawing.digest||r.sourceBinding?.pageNumber!==record.example.page)throw Error('Review page identity changed');
  const decisions=r.proposals.flatMap((v,i)=>v.visibility.verified?[{x:v.x,y:v.y,rotation:v.rotation,elementIds:[...v.elementIds].sort((a,b)=>a-b),included:selected.has(offset+i)}]:[]);offset+=r.proposals.length;
  let entry=scope.find(s=>s.id===p.drawingId);if(!entry){entry={id:p.drawingId,digest:p.digest,pages:[]};scope.push(entry);}if(entry.digest!==p.digest)throw Error('Review drawing digest changed');entry.pages.push(p.page);
  return{drawing_id:p.drawingId,page:p.page,digest:p.digest,layerScope:structuredClone(r.layerScope),decisions,provenance:{engine:r.version,visibility:r.source.visibility.proof,requestedPaints:r.coverage.requestedPaints,admittedPaints:r.coverage.admittedPaints,unknownCount:r.coverage.unknown.length,excludedCount:r.coverage.excluded.length,proposalCount:r.proposals.length,verifiedCount:decisions.length,selectedCount:decisions.filter(d=>d.included).length}};
 });
 if(!pages.some(p=>p.drawing_id===drawing.id&&p.page===record.example.page))throw Error('Review must include the source page');
 for(const s of scope)s.pages.sort((a,b)=>a-b);
 const vectorReview={version:VECTOR_PAGE_REVIEW_VERSION,scope:'explicit-pages',anchor:[...review.source.anchor],decision:'apply',layerPolicy:review.layerPolicy,pages};
 const matches=pages.flatMap(p=>p.decisions.filter(d=>d.included).map(d=>({drawing_id:p.drawing_id,page:p.page,digest:p.digest,x:d.x,y:d.y,score:1})));
 if(!validVectorReview(vectorReview,matches.length))throw Error('Invalid or incomplete vector page decisions');
 return{version:record.version,item_version:item.version,elements:structuredClone(elements),matches,scope,expected_marks:marks.filter(m=>m.example_id===record.id).map(m=>({id:m.id,version:m.version})),vectorReview};
}
