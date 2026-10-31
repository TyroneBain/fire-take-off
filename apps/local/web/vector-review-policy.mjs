// Explicit Apply policy, not a confidence score or automatic semantic approval.
// Provenance is a bounded client assertion; the server does not rerender PDFs.
export const VECTOR_REVIEW_VERSION='vector-paint-review-1';
export const isVectorReviewAlgorithm=algorithm=>algorithm===VECTOR_REVIEW_VERSION;
export const vectorReviewAppliesToPage=(example,drawingId,page)=>isVectorReviewAlgorithm(example?.algorithm)&&example.drawing_id===drawingId&&example.page===page;
export function validVectorReview(value,selectedCount){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['version','scope','sourceLayerScope','anchor','decision','provenance','decisions'].includes(k)))return false;
 if(value.version!==VECTOR_REVIEW_VERSION||value.scope!=='source-page'||typeof value.sourceLayerScope!=='boolean'||value.decision!=='apply'||!Array.isArray(value.anchor)||value.anchor.length!==2||value.anchor.some(n=>!Number.isFinite(n)||Math.abs(n)>1e8))return false;
 const p=value.provenance,counts=['requestedPaints','admittedPaints','unknownCount','excludedCount','proposalCount','verifiedCount','selectedCount'];
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['engine','visibility',...counts].includes(k))||p.engine!=='vector-candidate-review-1'||p.visibility!=='contour-paint-visibility-4'||counts.some(k=>!Number.isSafeInteger(p[k])||p[k]<0||p[k]>50000))return false;
 if(p.admittedPaints>p.requestedPaints||p.unknownCount>p.requestedPaints||p.excludedCount>p.admittedPaints||p.proposalCount>128||p.verifiedCount>p.proposalCount||p.selectedCount>p.verifiedCount||!value.sourceLayerScope&&p.excludedCount!==0)return false;
 const decisions=value.decisions;
 if(!Array.isArray(decisions)||decisions.length!==p.verifiedCount||decisions.length>128)return false;
 for(let i=0;i<decisions.length;i++){
  const d=decisions[i];if(!d||Object.keys(d).some(k=>!['x','y','rotation','elementIds','included'].includes(k))||!Number.isFinite(d.x)||!Number.isFinite(d.y)||Math.abs(d.x)>1e8||Math.abs(d.y)>1e8||![0,90,180,270].includes(d.rotation)||typeof d.included!=='boolean'||!Array.isArray(d.elementIds)||!d.elementIds.length||d.elementIds.length>128||d.elementIds.some((n,k)=>!Number.isSafeInteger(n)||n<0||n>1000000||k>0&&n<=d.elementIds[k-1]))return false;
  if(decisions.slice(0,i).some(other=>Math.abs(other.x-d.x)<.5&&Math.abs(other.y-d.y)<.5))return false;
 }
 if(decisions.filter(d=>d.included).length!==p.selectedCount)return false;
 return selectedCount===undefined||p.selectedCount===selectedCount;
}
