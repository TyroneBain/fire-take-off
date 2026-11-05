// Explicit Apply policies, not confidence scores or automatic semantic approval.
// Provenance is a bounded client assertion; the server does not rerender PDFs.
export const VECTOR_REVIEW_VERSION='vector-paint-review-1';
export const VECTOR_PAGE_REVIEW_VERSION='vector-paint-review-2';
export const isVectorPageReviewAlgorithm=algorithm=>algorithm===VECTOR_PAGE_REVIEW_VERSION;
export const isVectorReviewAlgorithm=algorithm=>algorithm===VECTOR_REVIEW_VERSION||isVectorPageReviewAlgorithm(algorithm);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,allowed)=>object(value)&&Object.keys(value).every(k=>allowed.includes(k));
const counts=['requestedPaints','admittedPaints','unknownCount','excludedCount','proposalCount','verifiedCount','selectedCount'];
function validProvenance(p,engine,limit,layered){
 return keys(p,['engine','visibility',...counts])&&p.engine===engine&&p.visibility==='contour-paint-visibility-4'&&counts.every(k=>Number.isSafeInteger(p[k])&&p[k]>=0&&p[k]<=50000)&&p.admittedPaints<=p.requestedPaints&&p.unknownCount<=p.requestedPaints&&p.excludedCount<=p.admittedPaints&&p.proposalCount<=limit&&p.verifiedCount<=p.proposalCount&&p.selectedCount<=p.verifiedCount&&(layered||p.excludedCount===0);
}
function validDecisions(decisions,p,limit,budget){
 if(!Array.isArray(decisions)||decisions.length!==p.verifiedCount||decisions.length>limit)return false;
 budget.decisions+=decisions.length;if(budget.decisions>2048)return false;
 for(let i=0;i<decisions.length;i++){
  const d=decisions[i];if(!keys(d,['x','y','rotation','elementIds','included'])||!Number.isFinite(d.x)||!Number.isFinite(d.y)||Math.abs(d.x)>1e8||Math.abs(d.y)>1e8||![0,90,180,270].includes(d.rotation)||typeof d.included!=='boolean'||!Array.isArray(d.elementIds)||!d.elementIds.length||d.elementIds.length>128||d.elementIds.some((n,k)=>!Number.isSafeInteger(n)||n<0||n>1000000||k>0&&n<=d.elementIds[k-1]))return false;
  budget.elementIds+=d.elementIds.length;if(budget.elementIds>50000)return false;
  if(decisions.slice(0,i).some(other=>Math.abs(other.x-d.x)<.5&&Math.abs(other.y-d.y)<.5))return false;
 }
 return decisions.filter(d=>d.included).length===p.selectedCount;
}
function validLayerScope(scope,policy){
 if(policy==='all-admitted')return keys(scope,['mode'])&&scope.mode==='all-admitted';
 return keys(scope,['mode','name','ocgId','configurationHash'])&&scope.mode==='unique-visible-ocg-name'&&typeof scope.name==='string'&&scope.name.length>0&&scope.name.length<=512&&typeof scope.ocgId==='string'&&scope.ocgId.length>0&&scope.ocgId.length<=256&&typeof scope.configurationHash==='string'&&scope.configurationHash.length>0&&scope.configurationHash.length<=256;
}
export function validVectorReview(value,selectedCount){
 if(!object(value)||value.decision!=='apply'||!Array.isArray(value.anchor)||value.anchor.length!==2||value.anchor.some(n=>!Number.isFinite(n)||Math.abs(n)>1e8))return false;
 const budget={decisions:0,elementIds:0};
 if(value.version===VECTOR_REVIEW_VERSION){
  if(!keys(value,['version','scope','sourceLayerScope','anchor','decision','provenance','decisions'])||value.scope!=='source-page'||typeof value.sourceLayerScope!=='boolean'||!validProvenance(value.provenance,'vector-candidate-review-1',128,value.sourceLayerScope)||!validDecisions(value.decisions,value.provenance,128,budget))return false;
  return selectedCount===undefined||value.provenance.selectedCount===selectedCount;
 }
 if(value.version!==VECTOR_PAGE_REVIEW_VERSION||!keys(value,['version','scope','layerPolicy','anchor','decision','pages'])||value.scope!=='explicit-pages'||!['all-admitted','same-layer-name'].includes(value.layerPolicy)||!Array.isArray(value.pages)||!value.pages.length||value.pages.length>20)return false;
 const seen=new Set();let selected=0,layerName;
 for(const p of value.pages){
  if(!keys(p,['drawing_id','page','digest','layerScope','provenance','decisions'])||typeof p.drawing_id!=='string'||!p.drawing_id.length||p.drawing_id.length>256||!Number.isSafeInteger(p.page)||p.page<1||p.page>100000||typeof p.digest!=='string'||!/^[a-f0-9]{64}$/.test(p.digest)||!validLayerScope(p.layerScope,value.layerPolicy)||!validProvenance(p.provenance,'vector-pattern-review-1',512,value.layerPolicy==='same-layer-name')||!validDecisions(p.decisions,p.provenance,512,budget))return false;
  const key=JSON.stringify([p.drawing_id,p.page]);if(seen.has(key))return false;seen.add(key);
  // Original IDs are page-local. One complete paint set cannot represent two
  // distinct marks on the same page; reuse on another page is valid.
  if(new Set(p.decisions.map(d=>JSON.stringify(d.elementIds))).size!==p.decisions.length)return false;
  if(value.layerPolicy==='same-layer-name'){if(layerName!==undefined&&layerName!==p.layerScope.name)return false;layerName=p.layerScope.name;}
  selected+=p.provenance.selectedCount;
 }
 return selectedCount===undefined||selected===selectedCount;
}
/** Normalize existing v1 metadata without changing its serialized format.
 * Returned bundles and decision arrays are caller-owned references, not attestations. */
export function vectorReviewPages(example){
 if(!isVectorReviewAlgorithm(example?.algorithm))return [];
 if(isVectorPageReviewAlgorithm(example.algorithm))return Array.isArray(example.vectorReview?.pages)?example.vectorReview.pages:[];
 return [{drawing_id:example.drawing_id,page:example.page,digest:example.digest,provenance:example.vectorReview?.provenance,decisions:example.vectorReview?.decisions??[]}];
}
export const vectorReviewPage=(example,drawingId,page)=>vectorReviewPages(example).find(p=>p.drawing_id===drawingId&&p.page===page)??null;
export const vectorReviewAppliesToPage=(example,drawingId,page)=>!!vectorReviewPage(example,drawingId,page);
