const $=id=>document.getElementById(id);
export function setupSelectionDeletion({context,api,reload,notice}){
 const dialog=$('selection-delete-dialog');let pending=null,busy=false;
 function finish(value){if(busy)return;const previous=pending;pending=null;dialog.close();previous?.resolve(value);}
 async function execute(record,body){
  const result=await api(`/api/examples/${record.id}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  await reload();notice(`Selection deleted · ${result.removed} linked matches removed${result.pruned_heading?' · empty heading removed':''}`);return true;
 }
 $('selection-delete-cancel').onclick=()=>finish(false);
 dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
 $('selection-delete-confirm').onclick=async()=>{
  if(!pending||busy)return;busy=true;$('selection-delete-confirm').disabled=$('selection-delete-cancel').disabled=true;$('selection-delete-error').textContent='Deleting selection…';
  try{await execute(pending.record,pending.body);busy=false;finish(true);}
  catch(error){$('selection-delete-error').textContent=error.message;}
  finally{busy=false;$('selection-delete-confirm').disabled=$('selection-delete-cancel').disabled=false;}
 };
 return {async request(record,{skipConfirmation=false}={}){
  if(pending||busy)throw new Error('Finish the current selection deletion first');
  const state=context().state,heading=state.countItems.find(i=>i.id===record.item_id),marks=state.countMarks.filter(m=>m.example_id===record.id);
  if(!heading)throw new Error('Heading changed. Reload before deleting.');
  const body={version:record.version,item_version:heading.version,expected_marks:marks.map(m=>({id:m.id,version:m.version}))};
  if(skipConfirmation){busy=true;try{return await execute(record,body);}finally{busy=false;}}
  const drawings=new Set(marks.map(m=>m.drawing_id));
  $('selection-delete-summary').textContent=`Delete this selection and ${marks.length} linked matches across ${drawings.size} drawing${drawings.size===1?'':'s'}? This includes reviewed, excluded and reclassified matches. Manual matches and other selections are kept. An unused heading is removed.`;
  $('selection-delete-error').textContent='';$('selection-delete-confirm').disabled=$('selection-delete-cancel').disabled=false;
  return new Promise(resolve=>{pending={record,body,resolve};dialog.showModal();});
 }};
}
