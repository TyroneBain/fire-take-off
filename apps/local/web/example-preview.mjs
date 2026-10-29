import {selectionFilter} from './pdf-elements.mjs';
import {selectionList} from './selection-list.mjs';
// Normalize native bounds across crop offsets and page rotation.
export function exampleRectangle(viewport,bounds) {
  const [x0,y0,x1,y1]=bounds;
  const points=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>viewport.convertToViewportPoint(...p));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}

export function setupExamplePreviews({pdfjs,context,node,button,openExample,editExample,removeSelection,movement,api,reload,notice}) {
  const cache=new Map();let queue=[],busy=false;
  async function drain(){
    if(busy)return;busy=true;
    try{while(queue.length){
      const {record,drawing,container}=queue.shift();if(!container.isConnected)continue;if(cache.has(record.id+':'+record.version)){show(container,cache.get(record.id+':'+record.version));continue;}
      let task;
      try{
        task=pdfjs.getDocument({url:`/api/drawings/${drawing.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});
        const doc=await task.promise,page=await doc.getPage(record.example.page);
        const initial=exampleRectangle(page.getViewport({scale:1}),record.example.bounds),scale=Math.min(4,128/Math.max(initial.width,initial.height));
        const viewport=page.getViewport({scale}),rect=exampleRectangle(viewport,record.example.bounds);
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(rect.width));canvas.height=Math.max(1,Math.ceil(rect.height));
        await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[1,0,0,1,-rect.left,-rect.top],operationsFilter:selectionFilter(record.example.elements)}).promise;
        const data=canvas.toDataURL('image/png');cache.set(record.id+':'+record.version,data);while(cache.size>100)cache.delete(cache.keys().next().value);
        if(container.isConnected)show(container,data);page.cleanup();
      }catch{if(container.isConnected)container.replaceChildren(node('span','Preview unavailable'));}
      finally{if(task)await task.destroy().catch(()=>{});}
    }}finally{busy=false;}
  }
  function show(container,data){const image=node('img');image.src=data;image.alt='Saved symbol example';container.replaceChildren(image);}
  return {
    cards(itemId,container){
      const state=context().state,model=selectionList(state,itemId,context().drawing?.id);
      for(const {record,quantity} of model.rows){
        const card=button('',()=>editExample(record),'selection-card');card.setAttribute('aria-label',`Edit selection for ${state.countItems.find(i=>i.id===itemId)?.name}`);card.title='Edit selection';
        const preview=node('div',null,'example-preview');card.append(preview,node('span',String(quantity),'selection-card-total'));card.dataset.exampleId=record.id;card.draggable=true;card.addEventListener('dragstart',e=>movement.start(e,record));card.addEventListener('dragend',()=>movement.end());
        const drawing=state.drawings.find(d=>d.id===record.example.drawing_id);if(cache.has(record.id+':'+record.version))show(preview,cache.get(record.id+':'+record.version));else if(drawing){preview.append(node('span','…'));queue.push({record,drawing,container:preview});}
        container.append(card);
      }
    },
    paint(itemId){
      const list=document.getElementById('count-examples');list.replaceChildren();queue=[];
      const state=context().state,model=selectionList(state,itemId,context().drawing?.id);
      const legacy=(state?.countMarks||[]).filter(m=>m.original_item_id===itemId&&m.origin==='automatic'&&!m.example_id).length;
      if(legacy)list.append(node('p',`${legacy} older matches need a selection link. Re-run Add to current across their drawings before changing multipliers.`,'hint'));
      document.getElementById('example-summary').textContent=`Selections (${model.rows.length})`;
      const scope=node('p',`This drawing · all pages: ${model.matches} matches · ${model.quantity} items`,'selection-scope');scope.id='selection-totals';list.append(scope);
      if(!model.rows.length)list.append(node('p','No source examples. Add an example to search for matching symbols.','hint'));
      const table=node('table',null,'selection-table'),caption=node('caption','Saved selections on the current drawing');caption.className='sr-only';table.append(caption);
      const head=node('thead'),header=node('tr');for(const label of ['Selection','Elements','Matches','Multiplier','Total']){const th=node('th',label);th.scope='col';header.append(th);}head.append(header);table.append(head);const body=node('tbody');table.append(body);
      model.rows.forEach(({record,matches,quantity,excluded,moved},index)=>{
        const drawing=state.drawings.find(d=>d.id===record.example.drawing_id),row=node('tr');row.dataset.exampleId=record.id;
        const selection=node('th');selection.scope='row';const preview=node('div',null,'example-preview');preview.dataset.exampleId=record.id;preview.draggable=true;preview.title='Drag selection onto another heading';preview.addEventListener('dragstart',event=>movement.start(event,record));preview.addEventListener('dragend',()=>movement.end());selection.append(preview,node('span',`Selection ${index+1}`));
        const saved=record.example.elements,elements=node('td',saved?String(saved.ids.length-saved.excluded.length):'—');elements.title=saved?'Selected PDF paint operations':'Open Edit to inspect vector elements';elements.setAttribute('aria-label',saved?'Selected PDF paint operations':'Element count not yet inspected');
        const count=node('td',String(matches),'selection-matches'),total=node('td',String(quantity),'selection-quantity');
        const remove=button('×',event=>removeSelection(record,{skipConfirmation:event.shiftKey}).catch(error=>notice(error.message,true)),'selection-delete');remove.title='Delete selection';remove.setAttribute('aria-label',`Delete selection ${index+1}`);total.append(remove);
        const factor=node('td'),input=node('input');input.type='number';input.min='1';input.max='10000';input.step='1';input.required=true;input.value=record.multiplier||1;input.setAttribute('aria-label',`Multiplier for selection ${index+1}`);factor.append(input);
        row.append(selection,elements,count,factor,total);body.append(row);
        const detailRow=node('tr',null,'selection-details'),details=node('td');details.colSpan=5;details.append(button('Move',()=>movement.open(record),'example-open'));
        if(drawing){details.append(node('small',`${drawing.name} · page ${record.example.page}`));const open=button('Go to selection',()=>openExample(record),'example-open');details.append(button('Edit',()=>editExample(record),'example-open'),open);if(cache.has(record.id+':'+record.version))show(preview,cache.get(record.id+':'+record.version));else{preview.append(node('span','Loading preview…'));queue.push({record,drawing,container:preview});}}
        else{preview.append(node('span','Source removed'));details.append(node('small','The saved source drawing is no longer in this takeoff.'));}
        const save=button('Save multiplier',async()=>{if(!input.reportValidity())return;save.disabled=true;input.disabled=true;try{await api(`/api/examples/${record.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({multiplier:Number(input.value),version:record.version})});await reload();notice('Selection multiplier saved');}catch(error){notice(error.message,true);}finally{input.disabled=!!legacy;save.disabled=!!legacy||Number(input.value)===(record.multiplier||1);}},'example-open');save.disabled=true;input.disabled=!!legacy;input.addEventListener('input',()=>{save.disabled=!!legacy||Number(input.value)===(record.multiplier||1);});details.append(save);
        if(excluded||moved)details.append(node('small',`${excluded} excluded · ${moved} assigned to other headings`,'selection-adjustments'));
        detailRow.append(details);body.append(detailRow);
      });
      if(model.other.matches||model.other.excluded){const row=node('tr',null,'selection-other'),label=node('th','Other matches');label.scope='row';label.title='Manual, unlinked and incoming reclassified matches';row.append(label,node('td','—'),node('td',String(model.other.matches)),node('td','Mixed'),node('td',String(model.other.quantity)));body.append(row);}
      if(model.rows.length||model.other.matches||model.other.excluded)list.append(table);
      if(model.other.matches||model.other.excluded)list.append(node('p',`Other matches: ${model.other.manual} manual · ${model.other.unlinked} unlinked · ${model.other.reclassified} reclassified from other selections · ${model.other.excluded} excluded.`,'hint'));
      if(model.rows.length)list.append(node('p','Included matches assigned to this heading, before zone multipliers. Elements count saved PDF path operations; text and bitmap editing remain unsupported.','hint'));
      if(document.getElementById('example-list').open)drain();
    },
    load:drain,
  };
}
