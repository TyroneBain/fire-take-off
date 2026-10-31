import {extractVectorPage,resolveVectorTextBounds,createVectorTemplate,VECTOR_MATCHER_VERSION,VECTOR_FIXED_VERSION,VECTOR_SCALE_VERSION,VECTOR_SCALE_FIXED_VERSION} from './vector-recognition.mjs';
import {MATCH_IMAGE_PIXELS,createTileBudget,renderMatchSelection,tiledMatchPage,searchMatchTiles} from './pdf-match-tiles.mjs';
import {setupCountInk,inkTransform} from './count-ink.mjs';
import {colourControl} from './count-colour.mjs';
import {setupMeasurementCreation} from './measurement-creation.mjs';
import {nextSymbolName} from './count-entry.mjs';
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
import { inkImage,exampleImage,EXACT_MATCHER_VERSION,ROTATION_MATCHER_VERSION,isVectorAlgorithm,includesRotations,includesScales } from './matcher.mjs';
import {APPEARANCE_MATCHER_VERSION,APPEARANCE_FIXED_VERSION,isAppearanceAlgorithm} from './appearance-policy.mjs';
import {appearanceTemplate} from './appearance-template.mjs';
import {runSavedVectorReview} from './vector-review-runner.mjs';
import {setupVectorReview} from './vector-review-ui.mjs';
import {isVectorReviewAlgorithm} from './vector-review-policy.mjs';
const $=id=>document.getElementById(id);
const svgNS='http://www.w3.org/2000/svg';
export function setupTakeoff({context,api,reload,node,button,notice,pdfjs,setBaseMode,onVisibilityChange=()=>{}}) {
  let mode=null,action=null,selectedItem=null,drag=null,job=null,reviewing=null,editingItem=null,selectionTarget=null,reclassification=null,reclassifying=false,highlightedExample=null;
  const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const items=()=>visibleCountHeadings(context().state||{},context().drawing?.discipline_id);
  const marks=()=>context().state?.countMarks||[];
  const hiddenMarkers=new Set(),collapsedItems=new Set();
  const countInk=setupCountInk({context,pdfjs,onReady:()=>paintOverlay()});
  $('count-vector').addEventListener('change',()=>{if(!$('count-vector').checked)$('count-scales').checked=false;$('count-scales').disabled=!!job||!$('count-vector').checked;});
  $('count-appearance').addEventListener('change',()=>{if($('count-appearance').checked){$('count-vector').checked=false;$('count-scales').checked=false;}paint();});
  const grouping=setupCountGroups({context,api,reload,node,button,notice,paint,hiddenMarkers,onVisibilityChange});
  const measurementEditor=setupMeasurementEditor({context,api,reload,activate:()=>activate('measure'),onChange:()=>paint(),notice});
  const measurementCreation=setupMeasurementCreation({context,api,reload,notice,onChange:()=>paint(),clearEditor:()=>measurementEditor.clear(),isActive:()=>mode==='measure'});
  const movement=setupSelectionMovement({context,api,reload,notice,onMoved:id=>{selectedItem=id;highlightedExample=null;paint();}});
  const deletion=setupSelectionDeletion({context,api,reload,notice});
  const removeSelection=async(record,options)=>{const result=await deletion.request(record,options);if(result){highlightedExample=null;paint();}return result;};
  const selectionEditor=setupSelectionEditor({pdfjs,context,remove:removeSelection,apply:(record,elements,options)=>runMatching(record.example.bounds,items().find(i=>i.id===record.item_id),{record,elements,...options}),cancelMatching:()=>cancelJob(),reviewVector:beginVectorReview});
  const nativeReview=setupVectorReview({context,onSource:openExample,onChange:()=>paintOverlay(),onEdit:(record,elements)=>{const current=context().state.countExamples.find(e=>e.id===record.id);if(current)selectionEditor.open({...current,example:{...current.example,elements}});},onApply:async(payload,record)=>{
    if(job)throw Error('Wait for the current count to finish');const run={committing:true};job=run;paint();
    try{const result=await api(`/api/examples/${record.id}/selection`,json('PATCH',payload));await reload();selectedItem=record.item_id;action=null;$('count-progress').textContent='Selection applied. Review unchecked matches.';notice(`${result.added} new matches saved. Existing corrections kept. Review unchecked symbols before export.`);}
    finally{if(job===run)job=null;paint();}
  }});
  const previews=setupExamplePreviews({pdfjs,context,node,button,openExample,updateMatching:(record,rotations)=>isVectorReviewAlgorithm(record.example.algorithm)?beginVectorReview(record,record.example.elements,record.example.vectorReview.sourceLayerScope):runMatching(record.example.bounds,items().find(i=>i.id===record.item_id),{record,elements:record.example.elements,rotations}),editExample:record=>selectionEditor.open(record),removeSelection,movement,api,reload,notice});
  $('example-list').addEventListener('toggle',()=>{if($('example-list').open)previews.load();});
  function deactivate(){$('page-surface').classList.remove('count-selecting');$('count-drawing-actions').hidden=true;measurementEditor.clear();reclassification=null;mode=null;action=null;measurementCreation.clear();drag=null;cancelJob();$('count-panel').hidden=true;$('measure-panel').hidden=true;$('reclassify-panel').hidden=true;for(const id of ['count-tool','measure-tool']){$(id).classList.remove('tool-active');$(id).setAttribute('aria-pressed','false');}paintOverlay();}
  function activate(next){setBaseMode();mode=next;if(next==='count'){action='select';selectionTarget=items().find(i=>i.id===selectedItem)||null;}$(next+'-panel').hidden=false;$(next+'-tool').classList.add('tool-active');$(next+'-tool').setAttribute('aria-pressed','true');$('pan-tool').classList.remove('tool-active');$('pan-tool').setAttribute('aria-pressed','false');$('tool-help').textContent=next==='count'?'Select, count and review symbols':'Calibrate, then draw your measurements';paint();}
  function point(event){const c=context();if(!c.viewport)return null;const p=pagePoint(c.viewport,$('pdf-canvas').getBoundingClientRect(),event.clientX,event.clientY),v=c.drawing.pages[c.pageNumber-1].view;return p[0]>=v[0]&&p[0]<=v[2]&&p[1]>=v[1]&&p[1]<=v[3]?p:null;}
  function paint(){
    const c=context();if(!c.state)return;
    const available=items();if(selectionTarget)selectionTarget=available.find(i=>i.id===selectionTarget.id)||null;if(!available.some(i=>i.id===selectedItem))selectedItem=null;
    const list=$('count-items');$('count-panel').append($('active-count'));list.replaceChildren();previews.paint(selectedItem);const filter=$('count-filter').value.toLowerCase();
    grouping.render(list,available,filter,item=>{const all=marks().filter(m=>m.item_id===item.id),included=all.filter(m=>m.included),pending=included.filter(m=>!m.reviewed);const b=button('',()=>{if(job)return;selectedItem=item.id;selectionTarget=item;action='select';reclassification=null;paint();},'count-item');b.disabled=!!job;b.classList.toggle('selected',item.id===selectedItem);const color=node('span',null,'item-colour');color.style.background=item.color;b.append(color,node('span',item.name),node('strong',String(included.reduce((sum,m)=>sum+(m.quantity??1),0))));b.title=`${included.length} included matches across the discipline; ${pending.length} unchecked`;const row=node('div',null,'count-item-row'),visibility=button(hiddenMarkers.has(item.id)?'○':'◉',()=>{if(hiddenMarkers.has(item.id))hiddenMarkers.delete(item.id);else hiddenMarkers.add(item.id);paint();onVisibilityChange();},'marker-visibility');visibility.setAttribute('aria-label',`${hiddenMarkers.has(item.id)?'Show':'Hide'} ${item.name} markers`);visibility.setAttribute('aria-pressed',String(hiddenMarkers.has(item.id)));const fold=button(collapsedItems.has(item.id)?'›':'⌄',()=>{collapsedItems.has(item.id)?collapsedItems.delete(item.id):collapsedItems.add(item.id);paint();},'item-fold');fold.setAttribute('aria-label',`${collapsedItems.has(item.id)?'Expand':'Collapse'} ${item.name}`);fold.setAttribute('aria-expanded',String(!collapsedItems.has(item.id)));row.style.setProperty('--item-color',item.color);row.dataset.itemId=item.id;row.append(fold,colourControl(item,{node,button,api,reload,notice}),b,visibility);movement.attach(row,item);grouping.attach(row,item);const actions=row.querySelector('.heading-group-action');if(actions){const menu=node('details',null,'item-menu'),summary=node('summary','⋯');summary.setAttribute('aria-label',`Options for ${item.name}`);menu.append(summary,actions,button('Rename / colour',()=>{selectedItem=item.id;paint();$('edit-count-item').click();}));row.append(menu);}if(!collapsedItems.has(item.id)){const cards=node('div',null,'item-selections');previews.cards(item.id,cards);row.append(cards);}return row;});
    const allHidden=available.length>0&&available.every(i=>hiddenMarkers.has(i.id));$('toggle-count-markers').textContent=allHidden?'Show markers':'Hide markers';$('toggle-count-markers').setAttribute('aria-pressed',String(allHidden));previews.load();
    const coverage=$('count-coverage');coverage.replaceChildren();const selected=available.find(i=>i.id===selectedItem),scaled=!!c.state.calibrations?.find(v=>v.drawing_id===c.drawing?.id&&v.page===c.pageNumber);if(selected)coverage.append(coverageInput({record:selected,kind:'items',api,reload,notice,node,scaled}));
    $('recount-drawing').disabled=!!job||!available.some(i=>(c.state.countExamples||[]).some(e=>e.item_id===i.id));
    for(const id of ['add-manual-match','add-current-example','edit-count-item'])$(id).disabled=!selectedItem||!!job;
    const current=marks().filter(m=>m.item_id===selectedItem&&m.drawing_id===c.drawing?.id&&m.page===c.pageNumber);

    const selectedRow=[...list.querySelectorAll('[data-item-id]')].find(e=>e.dataset.itemId===selectedItem);if(selectedRow)selectedRow.append($('active-count'));$('active-count').hidden=!selected||!selectedRow||collapsedItems.has(selectedItem);
    $('count-empty').hidden=available.length>0;
    $('count-list-tools').hidden=available.length===0;
    $('count-drawing-actions').hidden=mode!=='count';
    $('count-options').hidden=available.length===0;
    $('collapse-count-items').textContent=available.every(i=>collapsedItems.has(i.id))?'Expand items':'Collapse items';
    const included=current.filter(m=>m.included),pending=included.filter(m=>!m.reviewed);

    $('count-instruction').textContent=job?'Counting…':action==='manual'?`Click missing ${selected?.name||'symbols'}. Escape to finish.`:action==='select'?(selectionTarget?`Drag another example for ${selectionTarget.name}.`:'Drag around a symbol to count it.'):'Choose a symbol or start a new one.';
    $('select-example').setAttribute('aria-pressed',String(action==='select'&&!selectionTarget));
    $('select-example').classList.toggle('primary',!selectionTarget&&action!=='manual');
    $('add-current-example').classList.toggle('primary',!!selectionTarget&&action==='select');
    $('add-current-example').setAttribute('aria-pressed',String(action==='select'&&!!selectionTarget));
    $('add-manual-match').setAttribute('aria-pressed',String(action==='manual'));
    $('count-scope').disabled=!!job;
    $('count-appearance').disabled=!!job;$('count-vector').disabled=!!job||$('count-appearance').checked;$('count-rotations').disabled=!!job;$('count-scales').disabled=!!job||!$('count-vector').checked;
    $('select-example').disabled=!!job;$('manual-item').disabled=!!job;
    if(mode==='count')$('page-surface').classList.toggle('count-selecting',action==='select'&&!job);

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
    $('measure-intro').hidden=measurements.length>0;
    for(const m of measurements){
      const row=node('div',null,'measure-row compact-measure'),open=button(`${m.name}${m.multiplier>1?` ×${m.multiplier}`:''}`,()=>measurementEditor.open(m),'measure-open');open.title=`Edit ${m.name}`;
      const total=node('strong',m.quantity.value===null?'Set scale':`${m.quantity.value.toLocaleString(undefined,{maximumFractionDigits:3})} ${m.quantity.unit}`,'measure-quantity');total.title='This measurement on this drawing';
      const options=node('details',null,'measure-options'),summary=node('summary','⋯');summary.setAttribute('aria-label',`Options for ${m.name}`);
      options.append(summary,button('Remove measurement',async()=>{if(!confirm(`Remove ${m.name}?`))return;try{await api(`/api/measurements/${m.id}?version=${m.version}`,{method:'DELETE'});await reload();paint();}catch(e){notice(e.message,true);}},'remove'));
      if(m.kind==='point')options.append(coverageInput({record:m,kind:'measurements',api,reload,notice,node,scaled}));
      row.append(open,total,options);measured.append(row);
    }
    measurementCreation.paint();
    nativeReview.paint();paintOverlay();
  }
  function paintOverlay(){
    $('takeoff-overlay')?.remove();$('vector-review-overlay')?.remove();const c=context();if(!c.viewport||!c.drawing)return;
    const overlay=node('div',null,'takeoff-overlay');overlay.id='takeoff-overlay';const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');overlay.append(svg);appendCoverage(svg,coverageCircles(c.state,c.drawing.id,c.pageNumber,c.viewport,1,id=>!hiddenMarkers.has(id)));
    function shape(points,area,color,dashed=false){const p=document.createElementNS(svgNS,area?'polygon':'polyline');p.setAttribute('points',points.map(p=>viewPoint(c.viewport,...p).join(',')).join(' '));p.setAttribute('stroke',color);p.setAttribute('stroke-width','2');p.setAttribute('fill',area?color+'22':'none');if(dashed)p.setAttribute('stroke-dasharray','6 4');svg.append(p);return p;}
    for(const m of c.state.measurements||[])if(m.drawing_id===c.drawing.id&&m.page===c.pageNumber&&m.id!==measurementEditor.id){
      let element;if(m.kind==='point'){const [x,y]=viewPoint(c.viewport,...m.points[0]);element=document.createElementNS(svgNS,'circle');for(const [k,v]of Object.entries({cx:x,cy:y,r:5,fill:'#c06c23'}))element.setAttribute(k,v);svg.append(element);}else element=shape(m.points,m.kind==='area','#c06c23');
      element.dataset.measureId=m.id;element.style.pointerEvents=mode==='measure'?'auto':'none';element.addEventListener('contextmenu',e=>{if(mode==='measure'&&!measurementCreation.active){e.preventDefault();e.stopPropagation();measurementEditor.open(m);}});
    }
    for(const m of marks())if(m.drawing_id===c.drawing.id&&m.page===c.pageNumber){
      const item=c.state.countItems.find(i=>i.id===m.item_id);if(!item||hiddenMarkers.has(item.id))continue;
      const mask=m.included&&m.origin==='automatic'?countInk.get(m):null;
      const b=button(m.included?(m.origin==='manual'?'+':''):'×',e=>{e.stopPropagation();openReview(m);},'takeoff-marker');
      b.style.setProperty('--mark-colour',item.color);b.style.pointerEvents=mode==='count'?'auto':'none';b.classList.toggle('symbol-hit',!!mask);b.classList.toggle('manual-count',m.origin==='manual');b.classList.toggle('unreviewed',!m.reviewed);b.classList.toggle('excluded',!m.included);b.classList.toggle('reclassification-focus',m.id===reclassification?.ids[reclassification.index]);
      b.setAttribute('aria-label',`${item.name}: ${m.included?'included':'excluded'} match, ${m.reviewed?'reviewed':'needs review'}${!mask&&m.origin==='automatic'&&m.included?', symbol colour unavailable':''}`);b.title=b.getAttribute('aria-label');b.dataset.markId=m.id;
      const [x,y]=viewPoint(c.viewport,m.x,m.y);b.style.left=x+'px';b.style.top=y+'px';
      if(mask){const ink=node('div',null,'count-symbol-ink'),transform=inkTransform(mask.viewport,c.viewport,mask);ink.dataset.inkMarkId=m.id;ink.setAttribute('aria-hidden','true');Object.assign(ink.style,{width:mask.width+'px',height:mask.height+'px',backgroundColor:item.color,maskImage:`url("${mask.url}")`,transform:`matrix(${transform.join(',')})`});overlay.append(ink);
        const width=Math.abs(transform[0])*mask.width+Math.abs(transform[2])*mask.height,height=Math.abs(transform[1])*mask.width+Math.abs(transform[3])*mask.height;b.style.width=Math.max(14,width)+'px';b.style.height=Math.max(14,height)+'px';
      }overlay.append(b);
    }
    if(highlightedExample?.drawing_id===c.drawing.id&&highlightedExample.page===c.pageNumber){const r=exampleRectangle(c.viewport,highlightedExample.bounds),highlight=document.createElementNS(svgNS,'rect');for(const [key,value]of Object.entries({id:'example-highlight',x:r.left,y:r.top,width:r.width,height:r.height,fill:'none',stroke:'#243c90','stroke-width':3,'stroke-dasharray':'6 3'}))highlight.setAttribute(key,value);svg.append(highlight);}
    if(drag){const [a,b]=drag;shape([a,[b[0],a[1]],b,[a[0],b[1]]],true,'#168a90',true);}
    $('page-surface').append(overlay);measurementEditor.paint();measurementCreation.paintOverlay();if(mode==='count')nativeReview.paintOverlay();
    // Cached/native-only preparation can notify synchronously. Publish this
    // overlay first so a nested repaint replaces it instead of duplicating it.
    countInk.prepare();
  }
  async function beginVectorReview(record,elements,sourceLayerScope){
    if(job)throw Error('Wait for the current count to finish');const c=context(),drawing=c.state.drawings.find(d=>d.id===record.example.drawing_id),item=c.state.countItems.find(i=>i.id===record.item_id);
    if(!drawing||drawing.digest!==record.example.digest||!item)throw Error('Selection source is missing or changed');
    if(c.state.countMarks.some(m=>m.example_id===record.id&&(m.drawing_id!==drawing.id||m.page!==record.example.page)))throw Error('This selection already counts other pages. Use a separate source-page selection for this preview. Existing counts are unchanged.');
    if(c.drawing?.id!==drawing.id||c.pageNumber!==record.example.page)await c.openDrawing(drawing,record.example.page,'count');
    if(mode!=='count')activate('count');selectedItem=item.id;action=null;
    const snapshot=structuredClone({record,item,drawing,marks:c.state.countMarks,elements}),run={cancelled:false};job=run;$('cancel-match').hidden=false;paint();
    try{const review=await runSavedVectorReview({pdfjs,drawing,example:record.example,elements,sourceLayerScope,run,createCanvas:(w,h)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;},progress:({phase,completed,total})=>{$('count-progress').textContent=`Finding vector matches · ${phase}${total?` ${completed}/${total}`:''}`;}});
      if(run.cancelled)throw Error('Matching cancelled; no results saved');nativeReview.show({...snapshot,review});$('count-progress').textContent='Review the drawing, then Apply selection.';
    }finally{if(job===run)job=null;$('cancel-match').hidden=true;paint();}
  }
  async function openExample(record){
    const c=context(),d=c.state.drawings.find(d=>d.id===record.example.drawing_id);if(!d)return notice('Source drawing is no longer available',true);
    try{if(c.drawing.id!==d.id||c.pageNumber!==record.example.page)await c.openDrawing(d,record.example.page,'count');highlightedExample=record.example;paintOverlay();$('example-highlight')?.scrollIntoView({block:'center',inline:'center'});}catch(error){notice(error.message,true);}
  }
  $('count-filter').oninput=paint;
  $('toggle-count-markers').onclick=()=>{const all=items(),hide=all.some(i=>!hiddenMarkers.has(i.id));for(const i of all)hide?hiddenMarkers.add(i.id):hiddenMarkers.delete(i.id);paint();onVisibilityChange();};
  function openReview(mark){if(hiddenMarkers.delete(mark.item_id))onVisibilityChange();paintOverlay();reviewing=mark;const item=context().state.countItems.find(i=>i.id===mark.item_id),source=context().state.countExamples.find(e=>e.id===mark.example_id),native=isVectorReviewAlgorithm(source?.example.algorithm);$('match-description').textContent=`${item?.name||'Item'} · page ${mark.page} · ${mark.origin} · quantity ${mark.quantity??(mark.included?1:0)}${mark.multiplier>1?` (×${mark.multiplier})`:''}${mark.origin==='automatic'?(native?' · Vector selection; check symbol type':` (${Math.round(mark.score*100)}% image overlap)`):''}`;const original=context().state.countItems.find(i=>i.id===mark.original_item_id);$('match-original').textContent=`Original heading: ${original?.name||item?.name||'Unknown'}`;const select=$('match-heading');select.replaceChildren();for(const i of items()){const option=node('option',i.name);option.value=i.id;select.append(option);}select.value=mark.item_id;$('match-included').checked=!!mark.included;$('match-error').textContent='';$('match-dialog').showModal();}
  $('cancel-review').onclick=()=>$('match-dialog').close();
  $('match-form').onsubmit=async e=>{e.preventDefault();$('save-review').disabled=true;try{await api(`/api/marks/${reviewing.id}`,json('PATCH',{included:$('match-included').checked,reviewed:true,version:reviewing.version,item_id:$('match-heading').value}));await reload();paint();$('match-dialog').close();}catch(error){$('match-error').textContent=error.message;}finally{$('save-review').disabled=false;}};
  $('collapse-count-items').onclick=()=>{const all=items(),fold=all.some(i=>!collapsedItems.has(i.id));for(const i of all)fold?collapsedItems.add(i.id):collapsedItems.delete(i.id);paint();};
  $('count-tool').onclick=()=>activate('count');$('measure-tool').onclick=()=>activate('measure');
  $('select-example').onclick=()=>{if(job)return;reclassification=null;paintReclassification();selectedItem=null;selectionTarget=null;action='select';$('tool-help').textContent='Drag a box around one complete symbol';paint();};
  $('add-current-example').onclick=()=>{if(job||!selectedItem)return;reclassification=null;paintReclassification();selectionTarget=items().find(i=>i.id===selectedItem);action='select';$('tool-help').textContent=`Drag another example for ${selectionTarget.name}`;paint();};
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
    if(e.key.toLowerCase()==='c'){e.preventDefault();$('manual-item').click();}
    else if(e.key.toLowerCase()==='g'){e.preventDefault();grouping.create();}
    else if(e.key.toLowerCase()==='r'){e.preventDefault();toggleReclassification();}
    else if(reclassification){
      if(e.key==='Escape'){e.preventDefault();if(!reclassifying){reclassification=null;paint();}}
      else if(e.key==='Tab'){e.preventDefault();moveReclassification(e.shiftKey?-1:1);}
      else if(/^[1-9]$/.test(e.key)&&items().length<=9){e.preventDefault();const i=items()[Number(e.key)-1];if(i)reclassifyTo(i.id);}
      else if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const choices=[...$('reclassify-headings').querySelectorAll('button:not(:disabled)')],at=choices.indexOf(document.activeElement),next=(at+(e.key==='ArrowUp'?-1:1)+choices.length)%choices.length;choices[next]?.focus();}
    }else if(e.key==='Escape'){e.preventDefault();drag=null;action=null;paint();}
    else if(e.key==='2'){e.preventDefault();$('add-current-example').click();}
  });
  $('manual-item').onclick=async()=>{try{const c=context(),i=await api(`/api/disciplines/${c.drawing.discipline_id}/counts`,json('POST',{name:$('count-name').value.trim()||nextSymbolName(items()),matches:[]}));selectedItem=i.id;action='select';selectionTarget=i;await reload();paint();$('edit-count-item').click();}catch(e){notice(e.message,true);}};
  $('add-manual-match').onclick=()=>{if(job||!selectedItem)return;action='manual';drag=null;$('tool-help').textContent='Click each missing item to include it in the count';paint();};
  $('review-page').onclick=async()=>{const c=context(),decisions=marks().filter(m=>m.item_id===selectedItem&&m.drawing_id===c.drawing.id&&m.page===c.pageNumber).map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true}));try{await api(`/api/items/${selectedItem}/review`,json('POST',{decisions}));await reload();paint();notice('Page matches reviewed');}catch(e){notice(e.message,true);}};
  $('review-all').onclick=async()=>{const all=marks().filter(m=>m.item_id===selectedItem);if(!confirm(`Mark all ${all.length} item matches as reviewed? Included and excluded decisions will be kept.`))return;try{await api(`/api/items/${selectedItem}/review`,json('POST',{decisions:all.map(m=>({id:m.id,version:m.version,included:!!m.included,reviewed:true}))}));await reload();paint();notice('Item matches reviewed');}catch(e){notice(e.message,true);}};
  $('next-unreviewed').onclick=async()=>{const c=context(),m=marks().find(m=>m.item_id===selectedItem&&m.included&&!m.reviewed);if(!m)return;try{if(m.drawing_id!==c.drawing.id||m.page!==c.pageNumber)await c.openDrawing(c.state.drawings.find(d=>d.id===m.drawing_id),m.page,'count');openReview(m);}catch(e){notice(e.message,true);}};
  const surface=$('page-surface');
  surface.addEventListener('pointerdown',e=>{if(mode!=='count'||action!=='select'||job||e.button!==0||e.target.closest('button'))return;const p=point(e);if(!p)return;e.preventDefault();drag=[p,p];try{surface.setPointerCapture(e.pointerId);}catch{}paintOverlay();});
  surface.addEventListener('pointercancel',()=>{drag=null;paintOverlay();});
  surface.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);if(p){drag[1]=p;paintOverlay();}});
  surface.addEventListener('pointerup',e=>{if(!drag)return;const p=point(e)||drag[1],a=drag[0];drag=null;paintOverlay();const bounds=[Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.max(a[0],p[0]),Math.max(a[1],p[1])];if(bounds[2]-bounds[0]<3||bounds[3]-bounds[1]<3)return notice('Drag around the complete symbol.',true);runMatching(bounds,selectionTarget,null,!e.shiftKey&&$('count-rotations').checked).catch(e=>notice(e.message,true));});
  surface.addEventListener('click',async e=>{
    if(e.target.closest('button'))return;const p=point(e);if(!p)return;const c=context();
    if(mode==='count'&&action==='manual'&&selectedItem){try{await api(`/api/items/${selectedItem}/marks`,json('POST',{drawing_id:c.drawing.id,page:c.pageNumber,x:p[0],y:p[1]}));await reload();paint();}catch(error){notice(error.message,true);}return;}
  });
  function cancelJob(){if(job&&!job.committing){job.cancelled=true;job.cancel?.();job.task?.destroy();job.worker?.terminate();}}
  $('cancel-match').onclick=cancelJob;
  $('recount-drawing').onclick=async()=>{
    if(job)return;const c=context();if(!c.drawing)return;
    if(!confirm(`Recount ${c.drawing.name} using saved selections? Reviewed corrections and manual matches on this drawing are kept. Other drawings stay unchanged.`))return;
    const run={cancelled:false};job=run;$('cancel-match').hidden=false;$('select-example').disabled=$('manual-item').disabled=true;paint();
    try{const body=await runDrawingRecount({state:c.state,target:c.drawing,pdfjs,run,progress:text=>$('count-progress').textContent=text});if(run.cancelled)throw new Error('Recount cancelled; no results saved');$('cancel-match').hidden=true;const result=await api(`/api/drawings/${c.drawing.id}/recount`,json('POST',body));await reload();const message=`${result.added} new matches; ${result.removed} obsolete unchecked matches removed. Review new results.${run.fallbacks?.size?` Raster fallback: ${[...run.fallbacks].join("; ")}.`:""}`;$('count-progress').textContent=message;notice(message);}
    catch(e){const message=run.cancelled?'Recount cancelled; no results saved':e.message;$('count-progress').textContent=message;notice(message,!run.cancelled);}
    finally{if(job===run)job=null;$('cancel-match').hidden=true;$('select-example').disabled=$('manual-item').disabled=false;paint();}
  };
  async function runMatching(bounds,targetItem,edit=null,rotations=true){
    if(job)throw new Error('Wait for the current count to finish');
    if(edit&&isVectorReviewAlgorithm(edit.record.example.algorithm))return beginVectorReview(edit.record,edit.elements??edit.record.example.elements,edit.record.example.vectorReview.sourceLayerScope);
    if(edit)rotations=edit.rotations??includesRotations(edit.record.example.algorithm);
    const c=context(),source=edit?c.state.drawings.find(d=>d.id===edit.record.example.drawing_id):c.drawing,sourcePage=edit?edit.record.example.page:c.pageNumber,label=targetItem?.name||$('count-name').value.trim()||nextSymbolName(items());
    const targets=edit||$('count-scope').value==='discipline'?c.state.drawings.filter(d=>d.discipline_id===source.discipline_id):[source];
    const total=targets.reduce((sum,d)=>sum+d.pages.length,0);if(total>20)throw new Error('Select a scope of at most 20 pages per matching run');
    const run={cancelled:false};job=run;$('cancel-match').hidden=false;$('select-example').disabled=true;$('manual-item').disabled=true;paint();
    const appearance=edit?isAppearanceAlgorithm(edit.record.example.algorithm):$('count-appearance').checked,vector=edit?(edit.vector??isVectorAlgorithm(edit.record.example.algorithm)):$('count-vector').checked,scales=vector&&(edit?(edit.scales??includesScales(edit.record.example.algorithm)):$('count-scales').checked),fallbacks=new Set();
    const opened=new Map(),vectors=new Map(),tileBudget=createTileBudget();
    async function renderPage(d,number,elements=null,sourceBounds=null){
      if(run.cancelled)throw new Error('Matching cancelled; no count saved');
      let doc=opened.get(d.id);if(!doc){run.task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});doc=await run.task.promise;opened.set(d.id,{doc,task:run.task});}else doc=doc.doc;
      const page=await doc.getPage(number),viewport=page.getViewport({scale:2,rotation:0});
      const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height);
      if(width*height>MATCH_IMAGE_PIXELS){const options={page,viewport,createCanvas:(w,h)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;},operationsFilter:elements?selectionFilter(elements):undefined,cancelled:()=>run.cancelled,onRender:task=>{run.cancel=()=>task.cancel();}};return sourceBounds?renderMatchSelection({...options,bounds:sourceBounds}):tiledMatchPage(options);}
      const vectorKey=d.id+':'+number;if(vector&&!vectors.has(vectorKey))vectors.set(vectorKey,extractVectorPage({operatorList:await page.getOperatorList(),OPS:pdfjs.OPS}));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true}),recordText=!elements&&vectors.get(vectorKey)?.pendingTextBounds===true;
      await page.render({canvas,canvasContext:ctx,viewport,recordOperations:recordText,operationsFilter:elements?selectionFilter(elements):undefined}).promise;
      if(recordText)vectors.set(vectorKey,resolveVectorTextBounds(vectors.get(vectorKey),{reader:page.recordedBBoxes,viewport,width,height}));
      const image=ctx.getImageData(0,0,width,height);page.cleanup();return {image,viewport,width,height,vectorPage:vectors.get(vectorKey)};
    }
    try{
      if(appearance&&(vector||scales||edit?.elements!==undefined))throw Error('Colour and fine-detail matching requires an uncleaned selection at its original size');
      const original=await renderPage(source,sourcePage,null,bounds),a=original.viewport.convertToViewportPoint(bounds[0],bounds[3]),b=original.viewport.convertToViewportPoint(bounds[2],bounds[1]);
      const baseTemplate=exampleImage(inkImage(original.image.data,original.width,original.height),[a[0],a[1],b[0],b[1]]);
      let template=baseTemplate;if(edit?.elements){const filtered=await renderPage(source,sourcePage,edit.elements,bounds);template=editedTemplate(inkImage(original.image.data,original.width,original.height),inkImage(filtered.image.data,filtered.width,filtered.height),[a[0],a[1],b[0],b[1]]);}
      if(appearance)template=appearanceTemplate({data:original.image.data,width:original.width,height:original.height},baseTemplate);
      template.matchAppearance=appearance;template.matchRotations=rotations;template.matchScales=scales;template.matchThreshold=.95;
      if(vector){const anchor=original.viewport.convertToPdfPoint(baseTemplate.left+baseTemplate.width/2,baseTemplate.top+baseTemplate.height/2);template.vector=createVectorTemplate(original.vectorPage,{bounds,ids:edit?.elements?.ids,excluded:edit?.elements?.excluded,anchor});if(!template.vector.supported)fallbacks.add(template.vector.reason||'unsupported source');}
      const searchRaster=rendered=>new Promise((resolve,reject)=>{
        const worker=new Worker('/match-worker.mjs',{type:'module'});run.worker=worker;
        const timer=setTimeout(()=>{worker.terminate();reject(new Error('Page matching timed out'));},20000);
        run.cancel=()=>{clearTimeout(timer);worker.terminate();reject(new Error('Matching cancelled; no count saved'));};
        worker.onmessage=event=>{clearTimeout(timer);worker.terminate();run.worker=null;if(event.data.fallbackReason)fallbacks.add(event.data.fallbackReason);event.data.error?reject(new Error(event.data.error)):resolve(event.data.matches);};
        worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(new Error(event.message||'Matching failed'));};
        worker.postMessage({rgba:rendered.image.data.buffer,width:rendered.width,height:rendered.height,template,vectorPage:rendered.vectorPage},[rendered.image.data.buffer]);
      });
      const matches=[];let completed=0;
      for(const d of targets)for(let number=1;number<=d.pages.length;number++){
        if(run.cancelled)throw new Error('Matching cancelled; no count saved');
        $('count-progress').textContent=`Searching page ${++completed} of ${total}…`;
        const rendered=d.id===source.id&&number===sourcePage&&!original.cropped?original:await renderPage(d,number);
        if(run.cancelled)throw new Error('Matching cancelled; no count saved');
        if(vector&&!rendered.vectorPage?.supported)fallbacks.add(rendered.vectorPage?.reason||'unsupported page');
        const found=rendered.tiled?await searchMatchTiles({raster:rendered,template,search:searchRaster,cancelled:()=>run.cancelled,budget:tileBudget,progress:(tile,count)=>{$('count-progress').textContent=`Searching page ${completed} of ${total} · tile ${tile}/${count}…`;}}):await searchRaster(rendered);
        if(matches.length+found.length>5000)throw new Error('Counting exceeds 5000 results; choose a smaller scope');
        for(const hit of found){const [x,y]=Number.isFinite(hit.x)&&Number.isFinite(hit.y)?[hit.x,hit.y]:rendered.viewport.convertToPdfPoint(hit.left+(hit.anchorX??template.anchorX??hit.width/2),hit.top+(hit.anchorY??template.anchorY??hit.height/2));matches.push({drawing_id:d.id,page:number,x,y,score:hit.score,digest:d.digest});}
      }
      if(run.cancelled)throw new Error('Matching cancelled; no count saved');
      const example={drawing_id:source.id,page:sourcePage,bounds,digest:source.digest,algorithm:appearance?(rotations?APPEARANCE_MATCHER_VERSION:APPEARANCE_FIXED_VERSION):vector?(scales?(rotations?VECTOR_SCALE_VERSION:VECTOR_SCALE_FIXED_VERSION):(rotations?VECTOR_MATCHER_VERSION:VECTOR_FIXED_VERSION)):(rotations?ROTATION_MATCHER_VERSION:EXACT_MATCHER_VERSION)};
      run.committing=true;$('cancel-match').hidden=true;$('count-progress').textContent='Saving count…';
      const result=edit?await api(`/api/examples/${edit.record.id}/selection`,json('PATCH',{version:edit.record.version,elements:edit.elements,rotations:edit.rotations,vector,scales,appearance,matches,scope:targets.map(d=>({id:d.id,digest:d.digest})),expected_marks:c.state.countMarks.filter(m=>m.example_id===edit.record.id).map(m=>({id:m.id,version:m.version}))})):targetItem?await api(`/api/items/${targetItem.id}/examples`,json('POST',{version:targetItem.version,example,matches})):await api(`/api/disciplines/${source.discipline_id}/counts`,json('POST',{name:label,color:'#168a90',example,matches}));
      selectedItem=targetItem?.id||result.id;
      await reload();if(mode==='count'){selectionTarget=items().find(i=>i.id===selectedItem)||null;action='select';}if(!targetItem&&!edit){$('count-name').value='';$('example-list').open=false;}const message=edit?`${result.added} new matches; ${result.removed} obsolete unchecked matches removed. Reviewed corrections kept.`:targetItem?`${result.added} new matches; ${result.skipped} already saved.${result.linked?` ${result.linked} legacy matches linked to this selection.`:''} Previous decisions kept.`:`${matches.length} matches found. Review the marked instances.`;$('count-progress').textContent='';notice(`${label}: ${message}${fallbacks.size?` Same-size pixel fallback: ${[...fallbacks].join("; ")}.`:appearance?" Colour and fine-detail preview; some matches may use outline markers.":vector?" Vector geometry preview.":""}`);
    } catch(error){const message=run.cancelled?'Matching cancelled; no count saved':error.message;$('count-progress').textContent=message;throw new Error(message);}
    finally {for(const entry of opened.values())await entry.task.destroy().catch(()=>{});run.worker?.terminate();if(job===run)job=null;$('cancel-match').hidden=true;$('select-example').disabled=false;$('manual-item').disabled=false;paint();}
  }
  return {deactivate,paint,activate,isMarkerVisible:id=>!hiddenMarkers.has(id),reviewMark(id){const c=context(),m=marks().find(m=>m.id===id&&m.drawing_id===c.drawing?.id&&m.page===c.pageNumber);if(m){activate('count');selectedItem=m.item_id;openReview(m);paint();}},editMeasure(id){const c=context(),m=c.state.measurements.find(m=>m.id===id&&m.drawing_id===c.drawing?.id&&m.page===c.pageNumber);if(m)measurementEditor.open(m);},get mode(){return mode;},clearDraft(){measurementEditor.clear();measurementCreation.clear();drag=null;action=null;reclassification=null;highlightedExample=null;}};
}
