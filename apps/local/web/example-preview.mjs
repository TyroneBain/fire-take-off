// Normalize native bounds across crop offsets and page rotation.
export function exampleRectangle(viewport,bounds) {
  const [x0,y0,x1,y1]=bounds;
  const points=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>viewport.convertToViewportPoint(...p));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}

export function setupExamplePreviews({pdfjs,context,node,button,openExample,api,reload,notice}) {
  const cache=new Map();let queue=[],busy=false;
  async function drain(){
    if(busy)return;busy=true;
    try{while(queue.length){
      const {record,drawing,container}=queue.shift();if(!container.isConnected)continue;if(cache.has(record.id)){show(container,cache.get(record.id));continue;}
      let task;
      try{
        task=pdfjs.getDocument({url:`/api/drawings/${drawing.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});
        const doc=await task.promise,page=await doc.getPage(record.example.page);
        const initial=exampleRectangle(page.getViewport({scale:1}),record.example.bounds),scale=Math.min(4,128/Math.max(initial.width,initial.height));
        const viewport=page.getViewport({scale}),rect=exampleRectangle(viewport,record.example.bounds);
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(rect.width));canvas.height=Math.max(1,Math.ceil(rect.height));
        await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[1,0,0,1,-rect.left,-rect.top]}).promise;
        const data=canvas.toDataURL('image/png');cache.set(record.id,data);while(cache.size>100)cache.delete(cache.keys().next().value);
        if(container.isConnected)show(container,data);page.cleanup();
      }catch{if(container.isConnected)container.replaceChildren(node('span','Preview unavailable'));}
      finally{if(task)await task.destroy().catch(()=>{});}
    }}finally{busy=false;}
  }
  function show(container,data){const image=node('img');image.src=data;image.alt='Saved symbol example';container.replaceChildren(image);}
  return {
    paint(itemId){
      const list=document.getElementById('count-examples');list.replaceChildren();queue=[];
      const state=context().state,records=(state?.countExamples||[]).filter(e=>e.item_id===itemId);
      const legacy=(state?.countMarks||[]).filter(m=>m.original_item_id===itemId&&m.origin==='automatic'&&!m.example_id).length;
      if(legacy)list.append(node('p',`${legacy} older matches need a selection link. Re-run Add to current across their drawings before changing multipliers.`,'hint'));
      document.getElementById('example-summary').textContent=`Selections (${records.length})`;
      if(!records.length){list.append(node('p','No source examples. Add an example to search for matching symbols.','hint'));return;}
      records.forEach((record,index)=>{
        const drawing=state.drawings.find(d=>d.id===record.example.drawing_id),row=node('div',null,'example-row');
        const preview=node('div',null,'example-preview');preview.dataset.exampleId=record.id;
        const details=node('div');details.append(node('strong',`Selection ${index+1}`));
        if(drawing){details.append(node('small',`${drawing.name} · page ${record.example.page}`));const open=button('Go to selection',()=>openExample(record),'example-open');details.append(open);if(cache.has(record.id))show(preview,cache.get(record.id));else{preview.append(node('span','Loading preview…'));queue.push({record,drawing,container:preview});}}
        else{preview.append(node('span','Source removed'));details.append(node('small','The saved source drawing is no longer in this takeoff.'));}
        const input=node('input');input.type='number';input.min='1';input.max='10000';input.step='1';input.required=true;input.value=record.multiplier||1;input.setAttribute('aria-label',`Multiplier for selection ${index+1}`);
        const label=node('label','Multiplier');label.append(input);details.append(label);
        const pageMarks=(state.countMarks||[]).filter(m=>m.example_id===record.id&&m.drawing_id===context().drawing?.id&&m.page===context().pageNumber&&m.included);
        details.append(node('small',`This page: ${pageMarks.length} linked matches · ${pageMarks.reduce((sum,m)=>sum+(m.quantity??1),0)} items`));
        const save=button('Save multiplier',async()=>{if(!input.reportValidity())return;save.disabled=true;try{await api(`/api/examples/${record.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({multiplier:Number(input.value),version:record.version})});await reload();notice('Selection multiplier saved');}catch(error){notice(error.message,true);}finally{save.disabled=!!legacy;}},'example-open');save.disabled=!!legacy;input.disabled=!!legacy;details.append(save);
        row.append(preview,details);list.append(row);
      });
      if(document.getElementById('example-list').open)drain();
    },
    load:drain,
  };
}
