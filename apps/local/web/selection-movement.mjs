const $=id=>document.getElementById(id);
export function setupSelectionMovement({context,api,reload,notice,onMoved}){
 const dialog=$('selection-move-dialog'),choice=$('selection-move-target');let pending=null,dragged=null,busy=false;
 function capture(record){const state=context().state,source=state.countItems.find(i=>i.id===record.item_id);if(!source)throw new Error('Heading changed. Reload before moving.');return {record,source,headings:state.countItems.filter(i=>i.discipline_id===source.discipline_id),expected:state.countMarks.filter(m=>m.example_id===record.id).map(m=>({id:m.id,version:m.version}))};}
 async function transfer(saved,destination){
  if(busy)return;busy=true;
  try{const result=await api(`/api/examples/${saved.record.id}/move`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:saved.record.version,item_version:saved.source.version,destination_id:destination.id,destination_version:destination.version,expected_marks:saved.expected})});await reload();onMoved(destination.id);notice(`Selection moved to ${destination.name} · ${result.moved} matches moved${result.retained?` · ${result.retained} individually reclassified matches kept`:''}`);return true;}
  finally{busy=false;}
 }
 function close(){if(busy)return;pending=null;dialog.close();}
 $('selection-move-cancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 $('selection-move-save').onclick=async()=>{if(!pending||busy)return;const destination=pending.headings.find(i=>i.id===choice.value);if(!destination)return;$('selection-move-save').disabled=choice.disabled=true;
  try{await transfer(pending,destination);close();}catch(error){$('selection-move-error').textContent=error.message;}finally{$('selection-move-save').disabled=choice.disabled=false;}
 };
 return {
  open(record){if(busy)return;pending=capture(record);choice.replaceChildren();for(const item of pending.headings.filter(i=>i.id!==record.item_id)){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;choice.append(option);}$('selection-move-summary').textContent=`Move this selection from ${pending.source.name}. Its matches follow it across drawings; individual reclassifications, review decisions and multiplier are kept.`;$('selection-move-error').textContent=choice.options.length?'':'Create another heading in this discipline first.';$('selection-move-save').disabled=!choice.options.length;choice.disabled=false;dialog.showModal();},
  start(event,record){if(busy){event.preventDefault();return;}dragged=capture(record);event.dataTransfer.setData('application/x-fire-selection',record.id);event.dataTransfer.effectAllowed='move';},
  end(){dragged=null;document.querySelectorAll('.selection-drop-target').forEach(e=>e.classList.remove('selection-drop-target'));},
  attach(element,item){
   element.addEventListener('dragover',event=>{if(!dragged||busy||dragged.source.id===item.id||dragged.source.discipline_id!==item.discipline_id)return;event.preventDefault();event.dataTransfer.dropEffect='move';element.classList.add('selection-drop-target');});
   element.addEventListener('dragleave',()=>element.classList.remove('selection-drop-target'));
   element.addEventListener('drop',event=>{element.classList.remove('selection-drop-target');if(!dragged||busy||dragged.source.id===item.id||event.dataTransfer.getData('application/x-fire-selection')!==dragged.record.id)return;event.preventDefault();const saved=dragged;dragged=null;transfer(saved,item).catch(error=>notice(error.message,true));});
  }
 };
}
