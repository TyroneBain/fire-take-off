import {VECTOR_SELECTED_REVIEW_VERSION,vectorReviewPages} from './vector-review-policy.mjs';

const near=(a,b)=>Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5;
const sameIds=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const sameSelectedDecision=(a,b)=>a.x===b.x&&a.y===b.y&&a.rotation===b.rotation&&sameIds(a.elementIds,b.elementIds)&&sameIds(a.contextIds??[],b.contextIds??[]);
export const selectedEvidencePages=source=>[...vectorReviewPages(source),...(source?.algorithm===VECTOR_SELECTED_REVIEW_VERSION?source.vectorReview.retainedPages??[]:[])];
export function savedSelectedDecision(source,page,decision){
 return selectedEvidencePages(source).filter(p=>p.drawing_id===page.drawing_id&&p.page===page.page&&p.digest===page.digest).flatMap(p=>p.decisions).find(d=>sameSelectedDecision(d,decision));
}

// Carried evidence is separate from this run's audit counts. Only the server
// calls this on persisted source metadata, never on client supplied history.
export function retainSelectedEvidence(source,review){
 if(review.version!==VECTOR_SELECTED_REVIEW_VERSION)return review;
 const result=structuredClone(review),retained=[];
 delete result.retainedPages;
 for(const old of selectedEvidencePages(source)){
  let page=retained.find(p=>p.drawing_id===old.drawing_id&&p.page===old.page&&p.digest===old.digest);
  for(const d of old.decisions){
   const current=result.pages.filter(p=>p.drawing_id===old.drawing_id&&p.page===old.page&&p.digest===old.digest).flatMap(p=>p.decisions);
   if(current.some(n=>near(n,d)||sameIds(n.elementIds,d.elementIds))||page?.decisions.some(n=>near(n,d)||sameIds(n.elementIds,d.elementIds)))continue;
   if(!page){page={drawing_id:old.drawing_id,page:old.page,digest:old.digest,decisions:[]};retained.push(page);}
   page.decisions.push({...structuredClone(d),contextIds:[...(d.contextIds??[])],reviewed:d.reviewed===true});
  }
 }
 if(retained.length)result.retainedPages=retained;
 return result;
}

// A recount can refresh known evidence, never make a new review decision.
export function restrictSelectedRecount(payload,source){
 if(source.algorithm!==VECTOR_SELECTED_REVIEW_VERSION)return payload;
 for(const page of payload.vectorReview.pages){
  page.decisions=page.decisions.flatMap(d=>{const old=savedSelectedDecision(source,page,d);return old?[{...d,included:old.included,reviewed:old.reviewed===true}]:[];});
  page.provenance.pendingCount=page.provenance.verifiedCount-page.decisions.length;
  page.provenance.selectedCount=page.decisions.filter(d=>d.included).length;
 }
 payload.matches=payload.vectorReview.pages.flatMap(p=>p.decisions.filter(d=>d.included).map(d=>({drawing_id:p.drawing_id,page:p.page,digest:p.digest,x:d.x,y:d.y,score:1})));
 return payload;
}
