import {VECTOR_REVIEW_VERSION} from './vector-review-policy.mjs';
const $=id=>document.getElementById(id);
const near=(a,b)=>Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5;

// The reviewed instance ledger remains authoritative. A draft never changes
// quantities, and visibility refusals can never enter this save payload.
export function vectorReviewPayload({record,item,drawing,marks,elements,review,selected}){
 const r=review?.result;if(!r?.completed||r.source?.visibility?.verified!==true||!Array.isArray(r.proposals)||r.proposals.length>128||!(selected instanceof Set))throw Error('Complete vector review required');
 if(review.drawingId!==drawing.id||review.documentSha256!==drawing.digest||review.page!==record.example.page)throw Error('Review source changed');
 for(const i of selected)if(!Number.isInteger(i)||r.proposals[i]?.visibility?.verified!==true)throw Error('Unverified proposals cannot be included');
 const decisions=r.proposals.flatMap((p,i)=>p.visibility.verified?[{x:p.x,y:p.y,rotation:p.rotation,elementIds:[...p.elementIds].sort((a,b)=>a-b),included:selected.has(i)}]:[]);
 const matches=decisions.filter(d=>d.included).map(d=>({drawing_id:drawing.id,page:record.example.page,x:d.x,y:d.y,digest:drawing.digest,score:1}));
 return {version:record.version,item_version:item.version,elements:structuredClone(elements),matches,scope:[{id:drawing.id,digest:drawing.digest}],expected_marks:marks.filter(m=>m.example_id===record.id).map(m=>({id:m.id,version:m.version})),vectorReview:{version:VECTOR_REVIEW_VERSION,scope:'source-page',sourceLayerScope:review.sourceLayerScope,anchor:[...review.savedNativeAnchor],decision:'apply',decisions,provenance:{engine:r.version,visibility:r.source.visibility.proof,requestedPaints:r.coverage.requestedPaints,admittedPaints:r.coverage.admittedPaints,unknownCount:r.coverage.unknown.length,excludedCount:r.coverage.excluded.length,proposalCount:r.proposals.length,verifiedCount:decisions.length,selectedCount:matches.length}}};
}

export function setupVectorReview({context,onApply,onEdit,onSource,onChange=()=>{}}){
 let draft=null,busy=false,error='';
 const panel=document.createElement('section');panel.id='vector-review-panel';panel.hidden=true;panel.setAttribute('aria-label','Review vector matches');
 const title=document.createElement('h3');title.textContent='Review matches';
 const summary=document.createElement('p');summary.id='vector-review-summary';summary.setAttribute('role','status');
 const scope=document.createElement('p');scope.className='hint';
 const list=document.createElement('div');list.id='vector-review-list';
 const message=document.createElement('p');message.id='vector-review-error';message.setAttribute('role','alert');
 const actions=document.createElement('div');actions.className='vector-review-actions';
 const button=(id,label,handler)=>{const b=document.createElement('button');b.id=id;b.textContent=label;b.onclick=handler;return b;};
 const cancel=button('vector-review-cancel','Cancel',()=>{if(!busy)clear();});
 const edit=button('vector-review-edit','Edit selection',()=>{if(!draft||busy)return;onEdit(draft.record,draft.elements);});
 const apply=button('vector-review-apply','Apply selection',async()=>{
  if(!draft||busy||stale())return;busy=true;error='';paint();
  try{await onApply(vectorReviewPayload({...draft,selected:draft.selected}),draft.record);draft=null;}
  catch(e){error=e.message;}finally{busy=false;paint();onChange();}
 });apply.className='primary';actions.append(cancel,edit,apply);
 panel.append(title,summary,scope,list,message,actions);$('count-panel').insertBefore(panel,$('count-items'));
 function stale(){if(!draft)return false;const c=context(),record=c.state.countExamples.find(e=>e.id===draft.record.id),item=c.state.countItems.find(i=>i.id===draft.item.id),drawing=c.state.drawings.find(d=>d.id===draft.drawing.id);return record?.version!==draft.record.version||item?.version!==draft.item.version||drawing?.digest!==draft.drawing.digest;}
 function clear(){draft=null;error='';paint();onChange();}
 function locked(index){
  const p=draft.review.result.proposals[index];return draft.marks.some(m=>m.drawing_id===draft.drawing.id&&m.page===draft.record.example.page&&near(m,p)&&(m.item_id===draft.item.id||m.original_item_id===draft.item.id||m.example_id===draft.record.id)&&(m.reviewed||!m.included||m.origin==='manual'||m.item_id!==draft.item.id||m.example_id!==draft.record.id));
 }
 function toggle(index){if(!draft||busy||stale()||locked(index)||!draft.review.result.proposals[index].visibility.verified)return;draft.selected.has(index)?draft.selected.delete(index):draft.selected.add(index);paint();onChange();}
 function focus(index){
  const marker=$('vector-review-overlay')?.querySelector(`[data-candidate-index="${index}"]`);if(marker){marker.scrollIntoView({block:'center',inline:'center'});marker.focus({preventScroll:true});}else if(draft)onSource(draft.record);
 }
 function paint(){
  panel.hidden=!draft;$('vector-review-overlay')?.remove();if(!draft)return;
  const {proposals,coverage}=draft.review.result,verified=proposals.filter(p=>p.visibility.verified).length,kept=proposals.filter((p,i)=>p.visibility.verified&&locked(i)).length;
  summary.textContent=`${verified} ready to review · ${proposals.length-verified} need manual check`;
  scope.textContent=`Current page only · ${draft.review.sourceLayerScope?'Source PDF layer':'All admitted paths'}. ${draft.selected.size} selected${kept?` · ${kept} existing decisions kept`:''}. Quantities change only after Apply.`;
  const invalid=stale();message.textContent=error||(invalid?'This selection or heading changed. Edit and rerun before applying.':'');
  apply.disabled=busy||invalid;cancel.disabled=busy;edit.disabled=busy;apply.textContent=busy?'Saving…':'Apply selection';list.replaceChildren();
  proposals.forEach((p,index)=>{const row=document.createElement('div');row.className='vector-review-row';row.dataset.candidateIndex=index;const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.dataset.candidateIndex=index;check.checked=p.visibility.verified&&draft.selected.has(index);check.disabled=busy||invalid||!p.visibility.verified||locked(index);check.onchange=()=>toggle(index);const text=p.visibility.verified?(locked(index)?'Existing decision kept':check.checked?'Include':'Exclude'):'Needs manual check';label.append(check,document.createTextNode(`${index+1}. ${text}`));const go=button('', 'Show',()=>focus(index));go.removeAttribute('id');go.setAttribute('aria-label',`Show candidate ${index+1}`);row.append(label,go);list.append(row);});
  const details=document.createElement('details'),caption=document.createElement('summary');caption.textContent='Search coverage';const content=document.createElement('p');content.className='hint';const non=coverage.nonPathContent||{};content.textContent=`${coverage.candidateInventoryPaints} paths searched; ${coverage.excluded.length} outside the chosen layer; ${coverage.unknown.length} unsupported paths. ${non.textOperations||0} text and ${non.imageOperations||0} image operations are not classified. Verify symbol type before applying.`;details.append(caption,content);list.append(details);
  paintOverlay();
 }
 function paintOverlay(){
  $('vector-review-overlay')?.remove();const c=context();if(!draft||!c.viewport||c.drawing?.id!==draft.drawing.id||c.pageNumber!==draft.record.example.page)return;
  const layer=document.createElement('div');layer.id='vector-review-overlay';layer.className='takeoff-overlay vector-review-overlay';
  draft.review.result.proposals.forEach((p,index)=>{const b=button('',String(index+1),e=>{e.stopPropagation();toggle(index);});b.removeAttribute('id');b.className='vector-review-marker';b.dataset.candidateIndex=index;b.classList.toggle('uncertain',!p.visibility.verified);b.classList.toggle('rejected',p.visibility.verified&&!draft.selected.has(index));b.style.setProperty('--candidate-colour',draft.item.color);const [x,y]=c.viewport.convertToViewportPoint(p.x,p.y);b.style.left=x+'px';b.style.top=y+'px';b.title=`Candidate ${index+1}: ${p.visibility.verified?(locked(index)?'existing decision kept':draft.selected.has(index)?'include':'exclude'):'needs manual check'}`;b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(p.visibility.verified&&draft.selected.has(index)));b.onpointerdown=e=>e.stopPropagation();layer.append(b);});$('page-surface').append(layer);
 }
 return {show(value){draft={...structuredClone(value),selected:new Set(value.review.result.proposals.flatMap((p,i)=>p.visibility.verified?[i]:[]))};error='';paint();panel.scrollIntoView({block:'nearest'});onChange();},clear,paint,paintOverlay,get active(){return !!draft;},get saving(){return busy;}};
}
