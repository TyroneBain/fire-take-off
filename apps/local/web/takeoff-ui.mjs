import {runDrawingRecount} from './drawing-recount.mjs';
import {setupCountGroups} from './count-group-ui.mjs';
import {visibleCountHeadings} from './count-headings.mjs';
import {setupSelectionMovement} from './selection-movement.mjs';
import {setupSelectionDeletion} from './selection-deletion.mjs';
import {setupSelectionEditor} from './selection-editor.mjs';
import {selectionFilter,editedTemplate} from './pdf-elements.mjs';
import {coverageCircles,appendCoverage} from './coverage.mjs';
import {coverageInput} from './coverage-input.mjs';
import {setupMeasurementEditor} from './measurement-editor.mjs';
import {exampleRectangle,setupExamplePreviews} from './example-preview.mjs';
import { pagePoint,viewPoint } from './coordinates.mjs';
import { inkImage,exampleImage,MATCHER_VERSION } from './matcher.mjs';
const $=id=>document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
export function setupTakeoff({context,api,reload,node,button,notice,pdfjs,setBaseMode,onVisibilityChange=()=>{}}) {
  let mode=null,action=null,selectedItem=null,drag=null,draft=[],job=null,reviewing=null,editingItem=null,selectionTarget=null,reclassification=null,reclassifying=false,highlightedExample=null;
  const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const items=()=>visibleCountHeadings(context().state||{},context().drawing?.discipline_id);
  const marks=()=>context().state?.countMarks||[];
  const hiddenMarkers=new Set();
  const grouping=setupCountGroups({context,api,reload,node,button,notice,paint,hiddenMarkers,onVisibilityChange});
  const measurementEditor=setupMeasurementEditor({context,api,reload,activate:()=>activate('measure'),onChange:()=>paint(),notice});
  const movement=setupSelectionMovement({context,api,reload,notice,onMoved:id=>{selectedItem=id;highlightedExample=null;paint();}});
  const deletion=setupSelectionDeletion({context,api,reload,notice});
  const removeSelection=async(record,options)=>{const result=await deletion.request(record,options);if(result){highlightedExample=null;paint();}return result;};
  const selectionEditor=setupSelectionEditor({pdfjs,context,remove:removeSelection,apply:(record,elements)=>runMatching(record.example.bounds,items().find(i=>i.id===record.item_id),{record,elements}),cancelMatching:()=>cancelJob()});
  const previews=setupExamplePreviews({pdfjs,context,node,button,openExample,editExample:record=>selectionEditor.open(record),removeSelection,movement,api,reload,notice});
  $('example-list').addEventListener('toggle',()=>{if($('example-list').open)previews.load();});
  function deactivate(){measurementEditor.clear();reclassification=null;mode=null;action=null;draft=[];drag=null;cancelJob();$('count-panel').hidden=true;$('measure-panel').hidden=true;$('reclassify-panel').hidden=true;for(const id of ['count-tool','measure-tool']){$(id).classList.remove('tool-active');$(id).setAttribute('aria-pressed','false');}paintOverlay();}
  function activate(next){setBaseMode();mode=next;$(next+'-panel').hidden=false;$(next+'-tool').classList.add('tool-active');$(next+'-tool').setAttribute('aria-pressed','true');$('pan-tool').classList.remove('tool-active');$('pan-tool').setAttribute('aria-pressed','false');$('tool-help').textContent=next==='count'?'Select, count and review symbols':'Calibrate, then draw your measurements';paint();}
  function point(event){const c=context();if(!c.viewport)return null;const p=pagePoint(c.viewport,$('pdf-canvas').getBoundingClientRect(),event.clientX,event.clientY),v=c.drawing.pages[c.pageNumber-1].view;return p[0]>=v[0]&&p[0]<=v[2]&&p[1]>=v[1]&&p[1]<=v[3]?p:null;}
  function paint(){
    const c=context();if(!c.state)return;
    const available=items();if(!available.some(i=>i.id===selectedItem))selectedItem=available[0]?.id||null;
    const list=$('count-items');list.replaceChildren();const filter=$('count-filter').value.toLowerCase();
    grouping.render(list,available,filter,item=>{const all=marks().filter(m=>m.item_id===item.id),included=all.filter(m=>m.included),pending=included.filter(m=>!m.reviewed);const b=button('',()=>{selectedItem=item.id;action=null;reclassification=null;paint();},'count-item');b.classList.toggle('selected',item.id===selectedItem);const color=node('span',null,'item-colour');color.style.background=item.color;b.append(color,node('span',item.name),node('strong',String(included.reduce((sum,m)=>sum+(m.quantity??1),0))));const examples=(c.state.countExamples||[]).filter(e=>e.item_id===item.id).length;if(examples)b.append(node('small',`${examples} example${examples===1?'':'s'}`));if(pending.length)b.append(node('small',`${pending.length} to review`));const row=node('div',null,'count-item-row'),visibility=button(hiddenMarkers.has(item.id)?'○':'◉',()=>{if(hiddenMarkers.has(item.id))hiddenMarkers.delete(item.id);else hiddenMarkers.add(item.id);paint();onVisibilityChange();},'marker-visibility');visibility.setAttribute('aria-label',`${hiddenMarkers.has(item.id)?'Show':'Hide'} ${item.name} markers`);visibility.setAttribute('aria-pressed',String(hiddenMarkers.has(item.id)));row.append(b,visibility);movement.attach(row,item);grouping.attach(row,item);return row;});
    const allHidden=available.length>0&&available.every(i=>hiddenMarkers.has(i.id));$('toggle-count-markers').textContent=allHidden?'Show markers':'Hide markers';$('toggle-count-markers').setAttribute('aria-pressed',String(allHidden));previews.paint(selectedItem);
    const coverage=$('count-coverage');coverage.replaceChildren();const selected=available.find(i=>i.id===selectedItem),scaled=!!c.state.calibrations?.find(v=>v.drawing_id===c.drawing?.id&&v.page===c.pageNumber);if(selected)coverage.append(coverageInput({record:selected,kind:'items',api,reload,notice,node,scaled}));
    $('recount-drawing').disabled=!!job||!available.some(i=>(c.state.countExamples||[]).some(e=>e.item_id===i.id));
    for(const id of ['add-manual-match','add-current-example','edit-count-item'])$(id).disabled=!selectedItem||!!job;
    const current=marks().filter(m=>m.item_id===selectedItem&&m.drawing_id===c.drawing?.id&&m.page===c.pageNumber);
    $('review-page').disabled=!current.length||!!job;
    $('review-all').disabled=!selectedItem||!!job;
    $('next-unreviewed').disabled=!marks().some(m=>m.item_id===selectedItem&&m.included&&!m.reviewed)||!!job;
    $('reclassify-matches').disabled=!current.length||!!job;paintReclassification();
    const review=$('count-review-list');review.replaceChildren();
    current.forEach((m,index)=>{const b=button(`${index+1}. ${m.included?'Included':'Excluded'}${m.reviewed?' · reviewed':' · needs review'}${m.multiplier>1?` · ×${m.multiplier}`:''}`,()=>openReview(m),'match-row');b.classList.toggle('excluded',!m.included);if(m.original_item_id!==m.item_id)b.append(node('small',` · originally ${c.state.countItems.find(i=>i.id===m.original_item_id)?.name||'Unknown'}`));review.append(b);});
    const calibration=c.state.calibrations?.find(v=>v.drawing_id===c.drawing?.id&&v.page===c.pageNumber);
    $('calibration-status').textContent=calibration?`Scale set · ${calibration.distance} ${calibration.unit} reference`:'No scale set for this page';
    const measurements=c.state.measurements?.filter(m=>m.drawing_id===c.drawing?.id&&m.page===c.pageNumber)||[];
    const measured=$('measure-list');measured.replaceChildren();
    for(const m of measurements){const row=node('div',null,'measure-row');row.append(node('strong',`${m.name}${m.multiplier>1?` ×${m.multiplier}`:''}`),node('span',m.quantity.value===null?'Set scale to calculate':`${m.quantity.value.toLocaleString(undefined,{maximumFractionDigits:3})} ${m.quantity.unit}`));row.append(button('Edit',()=>measurementEditor.open(m)),button('Remove',async()=>{if(!confirm(`Remove ${m.name}?`))return;try{await api(`/api/measurements/${m.id}?version=${m.version}`,{method:'DELETE'});await reload();paint();}catch(e){notice(e.message,true);}},'remove'));if(m.kind==='point')row.append(coverageInput({record:m,kind:'measurements',api,reload,notice,node,scaled}));measured.append(row);}
    $('finish-measure').disabled=!['length','area'].includes(action)||draft.length<(action==='area'?3:2);
    $('cancel-measure').disabled=!action;
    paintOverlay();
  }
  function paintOverlay(){
    $('takeoff-overlay')?.remove();const c=context();if(!c.viewport||!c.drawing)return;
    const overlay=node('div',null,'takeoff-overlay');overlay.id='takeoff-overlay';const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');overlay.append(svg);appendCoverage(svg,coverageCircles(c.state,c.drawing.id,c.pageNumber,c.viewport,1,id=>!hiddenMarkers.has(id)));
    function shape(points,area,color,dashed=false){const p=document.createElementNS(svgNS,area?'polygon':'polyline');p.setAttribute('points',points.map(p=>viewPoint(c.viewport,...p).join(',')).join(' '));p.setAttribute('stroke',color);p.setAttribute('stroke-width','2');p.setAttribute('fill',area?color+'22':'none');if(dashed)p.setAttribute('stroke-dasharray','6 4');svg.append(p);return p;}
    for(const m of c.state.measurements||[])if(m.drawing_id===c.drawing.id&&m.page===c.pageNumber&&m.id!==measurementEditor.id){
      let element;if(m.kind==='point'){const [x,y]=viewPoint(c.viewport,...m.points[0]);element=document.createElementNS(svgNS,'circle');for(const [k,v]of Object.entries({cx:x,cy:y,r:5,fill:'#c06c23'}))element.setAttribute(k,v);svg.append(element);}else element=shape(m.points,m.kind==='area','#c06c23');
      element.dataset.measureId=m.id;element.style.pointerEvents=mode==='measure'?'auto':'none';element.addEventListener('contextmenu',e=>{if(mode==='measure'){e.preventDefault();e.stopPropagation();measurementEditor.open(m);}});
    }
    for(const m of marks())if(m.drawing_id===c.drawing.id&&m.page===c.pageNumber){const item=c.state.countItems.find(i=>i.id===m.item_id);if(!item||hiddenMarkers.has(item.id))continue;const b=button(m.included?'✓':'×',e=>{e.stopPropagation();openReview(m);},'takeoff-marker');b.style.background=m.included?item.color:'#a5adb0';b.style.pointerEvents=mode==='count'?'auto':'none';b.classList.toggle('unreviewed',!m.reviewed);b.classList.toggle('reclassification-focus',m.id===reclassification?.ids[reclassification.index]);b.setAttribute('aria-label',`${item.name}: ${m.included?'included':'excluded'} match`);b.dataset.markId=m.id;const [x,y]=viewPoint(c.viewport,m.x,m.y);b.style.left=x+'px';b.style.top=y+'px';overlay.append(b);}
    if(highlightedExample?.drawing_id===c.drawing.id&&highlightedExample.page===c.pageNumber){const r=exampleRectangle(c.viewport,highlightedExample.bounds),highlight=document.createElementNS(svgNS,'rect');for(const [key,value]of Object.entries({id:'example-highlight',x:r.left,y:r.top,width:r.width,height:r.height,fill:'none',stroke:'#243c90','stroke-width':3,'stroke-dasharray':'6 3'}))highlight.setAttribute(key,value);svg.append(highlight);}
    if(drag){const [a,b]=drag;shape([a,[b[0],a[1]],b,[a[0],b[1]]],true,'#168a90',true);}
    if(draft.length)shape(draft,action==='area','#168a90',true);
    $('page-surface').append(overlay);measurementEditor.paint();
  }
  async function openExample(record){
    const c=context(),d=c.state.drawings.find(d=>d.id===record.example.drawing_id);if(!d)return notice('Source drawing is no longer available',true);
    try{if(c.drawing.id!==d.id||c.pageNumber!==record.example.page)await c.openDrawing(d,record.example.page,'count');highlightedExample=record.example;paintOverlay();$('example-highlight')?.scrollIntoView({block:'center',inline:'center'});}catch(error){notice(error.message,true);}
  }
  $('count-filter').oninput=paint;
  $('toggle-count-markers').onclick=()=>{const all=items(),hide=all.some(i=>!hiddenMarkers.has(i.id));for(const i of all)hide?hiddenMarkers.add(i.id):hiddenMarkers.delete(i.id);paint();onVisibilityChange();};
  function openReview(mark){if(hiddenMarkers.delete(mark.item_id))onVisibilityChange();paintOverlay();reviewing=mark;const item=context().state.countItems.find(i=>i.id===mark.item_id);$('match-description').textContent=`${item?.name||'Item'} · page ${mark.page} · ${mark.origin} · quantity ${mark.quantity??(mark.included?1:0)}${mark.multiplier>1?` (×${mark.multiplier})`:''}${mark.origin==='automatic'?` (${Math.round(mark.score*100)}% image overlap)`:''}`;const original=context().state.countItems.find(i=>i.id===mark.original_item_id);$('match-original').textContent=`Original heading: ${original?.name||item?.name||'Unknown'}`;const select=$('match-heading');select.replaceChildren();for(const i of items()){const option=node('option',i.name);option.value=i.id;select.append(option);}select.value=mark.item_id;$('match-included').checked=!!mark.included;$('match-error').textContent='';$('match-dialog').showModal();}
  $('cancel-review').onclick=()=>$('match-dialog').close();
  $('match-form').onsubmit=async e=>{e.preventDefault();$('save-review').disabled=true;try{await api(`/api/marks/${reviewing.id}`,json('PATCH',{included:$('match-included').checked,reviewed:true,version:reviewing.version,item_id:$('match-heading').value}));$('match-dialog').close();await reload();paint();}catch(error){$('match-error').textContent=error.message;}finally{$('save-review').disabled=false;}};
  $('count-tool').onclick=()=>activate('count');$('measure-tool').onclick=()=>activate('measure');
  $('select-example').onclick=()=>{if(job)return;reclassification=null;paintReclassification();if(!$('count-name').value.trim())return notice('Enter the item name first.',true);selectionTarget=null;action='select';$('tool-help').textContent='Drag a box around one complete symbol';};
  $('add-current-example').onclick=()=>{if(job||!selectedItem)return;reclassification=null;paintReclassification();selectionTarget=items().find(i=>i.id===selectedItem);action='select';$('tool-help').textContent=`Drag another example for ${selectionTarget.name}`;};
  $('edit-count-item').onclick=()=>{editingItem=items().find(i=>i.id===selectedItem);if(!editingItem)return;$('item-name').value=editingItem.name;$('item-color').value=editingItem.color;$('item-error').textContent='';$('item-dialog').showModal();};
  $('cancel-item').onclick=()=>$('item-dialog').close();
  $('item-form').onsubmit=async e=>{e.preventDefault();$('save-item').disabled=true;try{await api(`/api/items/${editingItem.id}`,json('PATCH',{name:$('item-name').value,color:$('item-color').value,version:editingItem.version}));$('item-dialog').close();await reload();paint();}catch(error){$('item-error').textContent=error.message;}finally{$('save-item').disabled=false;}};
  function paintReclassification(){
    const c=context();if(reclassification&&(reclassification.drawingId!==c.drawing?.id||reclassification.page!==c.pageNumber))reclassification=null;
    $('reclassify-panel').hidden=!reclassification;
    if(!reclassification)return;
    const m=marks().find(m=>m.id===reclassification.ids[reclassification.index]);if(!m){reclassification=null;$('reclassify-panel').hidden=true;return;}
    const original=items().find(i=>i.id===m.original_item_id),current=items().find(i=>i.id===m.item_id);
    $('reclassify-current').textContent=`Match ${reclassification.index+1} of ${reclassification.ids.length} · ${current?.name} · originally ${original?.name}${m.included?'':' · excluded'}`;
    $('reclassify-previous').disabled=reclassifying||reclassification.index===0;
    $('reclassify-next').disabled=reclassifying||reclassification.index===reclassification.ids.length-1;
    const list=$('reclassify-headings');list.replaceChildren();
    const all=items(),filter=$('reclassify-filter').value.toLowerCase();
    all.forEach((i,index)=>{if(!i.name.toLowerCase().includes(filter))return;const b=button(`${all.length<=9?`${index+1}. `:''}${i.name}`,()=>reclassifyTo(i.id),'match-row');b.disabled=reclassifying||m.item_id===i.id;b.style.borderLeft=`5px solid ${i.color}`;list.append(b);});
  }
  function focusReclassification(){paint();const id=reclassification?.ids[reclassification.index];if(id)document.querySelector(`[data-mark-id="${id}"]`)?.scrollIntoView({block:'center',inline:'center'});}
  function toggleReclassification(){
    if(reclassifying)return;if(reclassification){reclassification=null;paint();return;}
    const c=context();if(!c.viewport||!c.drawing)return;const rect=$('drawing-stage').getBoundingClientRect(),centre=pagePoint(c.viewport,$('pdf-canvas').getBoundingClientRect(),rect.left+rect.width/2,rect.top+rect.height/2);
    const queue=marks().filter(m=>m.item_id===selectedItem&&m.drawing_id===c.drawing.id&&m.page===c.pageNumber).sort((a,b)=>Math.hypot(a.x-centre[0],a.y-centre[1])-Math.hypot(b.x-centre[0],b.y-centre[1])||a.id.localeCompare(b.id));
    if(!queue.length)return;if(hiddenMarkers.delete(selectedItem))onVisibilityChange();action=null;drag=null;reclassification={ids:queue.map(m=>m.id),index:0,drawingId:c.drawing.id,page:c.pageNumber};$('reclassify-filter').value='';focusReclassification();
  }
  function moveReclassification(direction){if(!reclassification||reclassifying)return;reclassification.index=Math.max(0,Math.min(reclassification.ids.length-1,reclassification.index+direction));focusReclassification();}
  async function reclassifyTo(itemId){
    if(!reclassification||reclassifying)return;const m=marks().find(m=>m.id===reclassification.ids[reclassification.index]);if(!m||m.item_id===itemId)return;
    reclassifying=true;paintReclassification();
    try{await api(`/api/marks/${m.id}`,json('PATCH',{item_id:itemId,included:!!m.included,reviewed:true,version:m.version}));hiddenMarkers.delete(itemId);await reload();notice('Classification saved');}catch(error){notice(error.message,true);}finally{reclassifying=false;paint();}
  }
  $('reclassify-matches').onclick=toggleReclassification;$('reclassify-exit').onclick=toggleReclassification;
  $('reclassify-previous').onclick=()=>moveReclassification(-1);$('reclassify-next').onclick=()=>moveReclassification(1);$('reclassify-filter').oninput=paintReclassification;
  document.addEventListener('keydown',e=>{
    if(mode!=='count'||job||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(e.key.toLowerCase()==='g'){e.preventDefault();grouping.create();}
    else if(e.key.toLowerCase()==='r'){e.preventDefault();toggleReclassification();}
    else if(reclassification){
      if(e.key==='Escape'){e.preventDefault();if(!reclassifying){reclassification=null;paint();}}
      else if(e.key==='Tab'){e.preventDefault();moveReclassification(e.shiftKey?-1:1);}
      else if(/^[1-9]$/.test(e.key)&&items().length<=9){e.preventDefault();const i=items()[Number(e.key)-1];if(i)reclassifyTo(i.id);}
      else if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const choices=[...$('reclassify-headings').querySelectorAll('button:not(:disabled)')],at=choices.indexOf(document.activeElement),next=(at+(e.key==='ArrowUp'?-1:1)+choices.length)%choices.length;choices[next]?.focus();}
    }else if(e.key==='2'){e.preventDefault();$('add-current-example').click();}
  });
  $('manual-item').onclick=async()=>{try{const c=context(),i=await api(`/api/disciplines/${c.drawing.discipline_id}/counts`,json('POST',{name:$('count-name').value,matches:[]}));selectedItem=i.id;await reload();paint();notice('Manual count created. Choose Add missing match.');}catch(e){notice(e.message,true);}};
  $('add-manual-match').onclick=()=>{action='manual';$('tool-help').textContent='Click each missing item to include it in the count';};
  $('review-page').onclick=async()=>{const c=context(),decisions=marks().filter(m=>m.item_id===selectedItem&&m.drawing_id===c.drawing.id&&m.page===c.pageNumber).map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true}));try{await api(`/api/items/${selectedItem}/review`,json('POST',{decisions}));await reload();paint();notice('Page matches reviewed');}catch(e){notice(e.message,true);}};
  $('review-all').onclick=async()=>{const all=marks().filter(m=>m.item_id===selectedItem);if(!confirm(`Mark all ${all.length} item matches as reviewed? Included and excluded decisions will be kept.`))return;try{await api(`/api/items/${selectedItem}/review`,json('POST',{decisions:all.map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true}))}));await reload();paint();notice('Item matches reviewed');}catch(e){notice(e.message,true);}};
  $('next-unreviewed').onclick=async()=>{const c=context(),m=marks().find(m=>m.item_id===selectedItem&&m.included&&!m.reviewed);if(!m)return;try{if(m.drawing_id!==c.drawing.id||m.page!==c.pageNumber)await c.openDrawing(c.state.drawings.find(d=>d.id===m.drawing_id),m.page,'count');openReview(m);}catch(e){notice(e.message,true);}};
  const surface=$('page-surface');
  surface.addEventListener('pointerdown',e=>{if(mode!=='count'||action!=='select'||job||e.target.closest('button'))return;const p=point(e);if(!p)return;e.preventDefault();drag=[p,p];try{surface.setPointerCapture(e.pointerId);}catch{}paintOverlay();});
  surface.addEventListener('pointercancel',()=>{drag=null;paintOverlay();});
  surface.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);if(p){drag[1]=p;paintOverlay();}});
  surface.addEventListener('pointerup',e=>{if(!drag)return;const p=point(e)||drag[1],a=drag[0];drag=null;action=null;paintOverlay();const bounds=[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[0],p[0]),Math.max(a[1],p[1])];if(bounds[2]-bounds[0]<3||bounds[3]-bounds[1]<3)return notice('Drag around the complete symbol.',true);runMatching(bounds,selectionTarget).catch(e=>notice(e.message,true));});
  surface.addEventListener('click',async e=>{
    if(e.target.closest('button'))return;const p=point(e);if(!p)return;const c=context();
    if(mode==='count'&&action==='manual'&&selectedItem){try{await api(`/api/items/${selectedItem}/marks`,json('POST',{drawing_id:c.drawing.id,page:c.pageNumber,x:p[0],y:p[1]}));await reload();paint();}catch(error){notice(error.message,true);}return;}
    if(measurementEditor.id)return;
    if(mode!=='measure'||!['calibration','point','length','area'].includes(action))return;
    if(action==='point'){try{await api(`/api/drawings/${c.drawing.id}/measurements`,json('POST',{page:c.pageNumber,kind:'point',points:[p],name:$('measure-name').value}));await reload();paint();}catch(error){notice(error.message,true);}return;}
    if(draft.length&&Math.hypot(p[0]-draft.at(-1)[0],p[1]-draft.at(-1)[1])<.01)return;
    draft.push(p);paint();
    if(action==='calibration'&&draft.length===2){$('known-distance').value='';$('calibration-error').textContent='';$('calibration-dialog').showModal();}
  });
  $('calibrate').onclick=()=>{measurementEditor.clear();action='calibration';draft=[];$('tool-help').textContent='Click both ends of a known distance';$('measure-instruction').textContent='Select two endpoints on the drawing, then enter their known length.';paint();};
  for(const kind of ['point','length','area'])$('measure-'+kind).onclick=()=>{measurementEditor.clear();if(!$('measure-name').value.trim())return notice('Enter a measurement name first.',true);action=kind;draft=[];$('tool-help').textContent=kind==='point'?'Click each item to count it':'Click each corner, then Finish measurement';$('measure-instruction').textContent=kind==='area'?'Click at least three corners. Finish closes the polygon.':kind==='length'?'Click at least two endpoints. Add corners for a connected run.':'Each click adds one saved manual point.';paint();};
  $('cancel-measure').onclick=()=>{action=null;draft=[];paint();};
  $('finish-measure').onclick=async()=>{const c=context();try{await api(`/api/drawings/${c.drawing.id}/measurements`,json('POST',{page:c.pageNumber,kind:action,points:draft,name:$('measure-name').value}));draft=[];action=null;await reload();paint();notice('Measurement saved');}catch(e){notice(e.message,true);}};
  $('cancel-calibration').onclick=()=>{$('calibration-dialog').close();draft=[];action=null;paint();};
  $('calibration-form').onsubmit=async e=>{e.preventDefault();const c=context(),previous=c.state.calibrations.find(v=>v.drawing_id===c.drawing.id&&v.page===c.pageNumber);$('save-calibration').disabled=true;try{await api(`/api/drawings/${c.drawing.id}/calibration`,json('POST',{page:c.pageNumber,points:draft,distance:Number($('known-distance').value),unit:$('known-unit').value,version:previous?.version||0}));$('calibration-dialog').close();draft=[];action=null;await reload();paint();notice('Drawing scale saved');}catch(error){$('calibration-error').textContent=error.message;}finally{$('save-calibration').disabled=false;}};
  function cancelJob(){if(job){job.cancelled=true;job.cancel?.();job.task?.destroy();job.worker?.terminate();}}
  $('cancel-match').onclick=cancelJob;
  $('recount-drawing').onclick=async()=>{
    if(job)return;const c=context();if(!c.drawing)return;
    if(!confirm(`Recount ${c.drawing.name} using saved selections? Reviewed corrections and manual matches on this drawing are kept. Other drawings stay unchanged.`))return;
    const run={cancelled:false};job=run;$('cancel-match').hidden=false;$('select-example').disabled=$('manual-item').disabled=true;paint();
    try{const body=await runDrawingRecount({state:c.state,target:c.drawing,pdfjs,run,progress:text=>$('count-progress').textContent=text});if(run.cancelled)throw new Error('Recount cancelled; no results saved');$('cancel-match').hidden=true;const result=await api(`/api/drawings/${c.drawing.id}/recount`,json('POST',body));await reload();const message=`${result.added} new matches; ${result.removed} obsolete unchecked matches removed. Review new results.`;$('count-progress').textContent=message;notice(message);}
    catch(e){const message=run.cancelled?'Recount cancelled; no results saved':e.message;$('count-progress').textContent=message;notice(message,!run.cancelled);}
    finally{if(job===run)job=null;$('cancel-match').hidden=true;$('select-example').disabled=$('manual-item').disabled=false;paint();}
  };
  async function runMatching(bounds,targetItem,edit=null){
    const c=context(),source=edit?c.state.drawings.find(d=>d.id===edit.record.example.drawing_id):c.drawing,sourcePage=edit?edit.record.example.page:c.pageNumber,label=targetItem?.name||$('count-name').value.trim();
    const targets=edit||$('count-scope').value==='discipline'?c.state.drawings.filter(d=>d.discipline_id===source.discipline_id):[source];
    const total=targets.reduce((sum,d)=>sum+d.pages.length,0);if(total>20)throw new Error('Select a scope of at most 20 pages per matching run');
    const run={cancelled:false};job=run;$('cancel-match').hidden=false;$('select-example').disabled=true;$('manual-item').disabled=true;paint();
    const opened=new Map();
    async function renderPage(d,number,elements=null){
      if(run.cancelled)throw new Error('Matching cancelled; no count saved');
      let doc=opened.get(d.id);if(!doc){run.task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});doc=await run.task.promise;opened.set(d.id,{doc,task:run.task});}else doc=doc.doc;
      const page=await doc.getPage(number),viewport=page.getViewport({scale:2,rotation:0});
      const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);if(width*height>4000000)throw new Error('Drawing exceeds the current matching resolution budget');
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport,operationsFilter:elements?selectionFilter(elements):undefined}).promise;const image=ctx.getImageData(0,0,width,height);page.cleanup();return {image,viewport,width,height};
    }
    try{
      const original=await renderPage(source,sourcePage),a=original.viewport.convertToViewportPoint(bounds[0],bounds[3]),b=original.viewport.convertToViewportPoint(bounds[2],bounds[1]);
      const baseTemplate=exampleImage(inkImage(original.image.data,original.width,original.height),[a[0],a[1],b[0],b[1]]);
      let template=baseTemplate;if(edit){const filtered=await renderPage(source,sourcePage,edit.elements);template=editedTemplate(inkImage(original.image.data,original.width,original.height),inkImage(filtered.image.data,filtered.width,filtered.height),[a[0],a[1],b[0],b[1]]);}
      const matches=[];let completed=0;
      for(const d of targets)for(let number=1;number<=d.pages.length;number++){
        if(run.cancelled)throw new Error('Matching cancelled; no count saved');
        $('count-progress').textContent=`Searching page ${++completed} of ${total}…`;
        const rendered=d.id===source.id&&number===sourcePage?original:await renderPage(d,number);
        if(run.cancelled)throw new Error('Matching cancelled; no count saved');
        const found=await new Promise((resolve,reject)=>{
          const worker=new Worker('/match-worker.mjs',{type:'module'});run.worker=worker;
          const timer=setTimeout(()=>{worker.terminate();reject(new Error('Page matching timed out'));},20000);
          run.cancel=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Matching cancelled; no count saved'));};
          worker.onmessage=event=>{clearTimeout(timer);worker.terminate();run.worker=null;event.data.error?reject(new Error(event.data.error)):resolve(event.data.matches);};
          worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message||'Matching failed'));};
          worker.postMessage({rgba:rendered.image.data.buffer,width:rendered.width,height:rendered.height,template},[rendered.image.data.buffer]);
        });
        for(const hit of found){const [x,y]=rendered.viewport.convertToPdfPoint(hit.left+(template.anchorX??hit.width/2),hit.top+(template.anchorY??hit.height/2));matches.push({drawing_id:d.id,page:number,x,y,score:hit.score,digest:d.digest});}
      }
      if(run.cancelled)throw new Error('Matching cancelled; no count saved');
      const example={drawing_id:source.id,page:sourcePage,bounds,digest:source.digest,algorithm:MATCHER_VERSION};
      const result=edit?await api(`/api/examples/${edit.record.id}/selection`,json('PATCH',{version:edit.record.version,elements:edit.elements,matches,scope:targets.map(d=>({id:d.id,digest:d.digest})),expected_marks:c.state.countMarks.filter(m=>m.example_id===edit.record.id).map(m=>({id:m.id,version:m.version}))})):targetItem?await api(`/api/items/${targetItem.id}/examples`,json('POST',{version:targetItem.version,example,matches})):await api(`/api/disciplines/${source.discipline_id}/counts`,json('POST',{name:label,color:'#168a90',example,matches}));
      selectedItem=targetItem?.id||result.id;
      await reload();const message=edit?`${result.added} new matches; ${result.removed} obsolete unchecked matches removed. Reviewed corrections kept.`:targetItem?`${result.added} new matches; ${result.skipped} already saved.${result.linked?` ${result.linked} legacy matches linked to this selection.`:''} Previous decisions kept.`:`${matches.length} matches found. Review the marked instances.`;$('count-progress').textContent=message;notice(`${label}: ${message}`);
    } catch(error){const message=run.cancelled?'Matching cancelled; no count saved':error.message;$('count-progress').textContent=message;throw new Error(message);}
    finally {for(const entry of opened.values())await entry.task.destroy().catch(()=>{});run.worker?.terminate();if(job===run)job=null;$('cancel-match').hidden=true;$('select-example').disabled=false;$('manual-item').disabled=false;paint();}
  }
  return {deactivate,paint,activate,isMarkerVisible:id=>!hiddenMarkers.has(id),reviewMark(id){const c=context(),m=marks().find(m=>m.id===id&&m.drawing_id===c.drawing?.id&&m.page===c.pageNumber);if(m){activate('count');selectedItem=m.item_id;openReview(m);paint();}},editMeasure(id){const c=context(),m=c.state.measurements.find(m=>m.id===id&&m.drawing_id===c.drawing?.id&&m.page===c.pageNumber);if(m)measurementEditor.open(m);},get mode(){return mode;},clearDraft(){measurementEditor.clear();draft=[];drag=null;action=null;reclassification=null;highlightedExample=null;}};
}
