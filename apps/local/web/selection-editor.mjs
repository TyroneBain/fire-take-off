import {inspectPdfElements,ELEMENT_RENDERER,elementAt} from './pdf-elements.mjs';
const $=id=>document.getElementById(id);
export function setupSelectionEditor({pdfjs,context,apply,remove,cancelMatching}){
 let model=null,record=null,task=null,epoch=0,excluded=new Set(),mode='erase',shift=false,drag=null,saving=false;
 const dialog=$('selection-dialog'),canvas=$('selection-canvas');
 function close(){if(saving){cancelMatching();return;}epoch++;task?.destroy().catch(()=>{});task=null;model=null;record=null;dialog.close();}
 function paint(){
  if(!model)return;const {width,height,elements}=model;canvas.width=width;canvas.height=height;const fit=Math.min((canvas.parentElement.clientWidth-24)/width,280/height);canvas.style.width=width*fit+'px';canvas.style.height=height*fit+'px';const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(width,height);
  for(const erased of [true,false])for(const element of elements)if(excluded.has(element.id)===erased)for(let i=0;i<element.ink.length;i++)if(element.ink[i]){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=erased?150:20;pixels.data[i*4+3]=erased?85:255;}
  ctx.putImageData(pixels,0,0);$('selection-elements').textContent=String(elements.length-excluded.size);$('selection-erase').classList.toggle('selected',!shift&&mode==='erase');$('selection-restore').classList.toggle('selected',shift||mode==='restore');
  $('selection-done').disabled=saving;$('selection-erase-all').disabled=saving;canvas.classList.toggle('restoring',shift||mode==='restore');
 }
 const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
 function touch(p){if(!model||saving)return;const restore=shift||mode==='restore',candidates=model.elements.filter(e=>excluded.has(e.id)===restore),id=elementAt(candidates,...p,model.width,model.height);if(id===null)return;restore?excluded.delete(id):excluded.add(id);paint();}
 canvas.addEventListener('pointerdown',e=>{if(!model||saving||e.button!==0)return;e.preventDefault();drag=point(e);touch(drag);try{canvas.setPointerCapture(e.pointerId);}catch{}});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e),steps=Math.max(1,Math.ceil(Math.hypot(p[0]-drag[0],p[1]-drag[1])));for(let i=1;i<=steps;i++)touch([drag[0]+(p[0]-drag[0])*i/steps,drag[1]+(p[1]-drag[1])*i/steps]);drag=p;});
 for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{drag=null;});
 $('selection-erase').onclick=()=>{mode='erase';paint();};$('selection-restore').onclick=()=>{mode='restore';paint();};$('selection-erase-all').onclick=()=>{if(!model||saving)return;excluded=new Set(model.elements.map(e=>e.id));paint();};$('selection-cancel').onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select'))return;if(e.key==='Shift'){shift=true;paint();}else if(e.key.toLowerCase()==='d'){e.preventDefault();$('selection-erase-all').click();}else if(e.key.toLowerCase()==='e'){e.preventDefault();$('selection-done').click();}});
 dialog.addEventListener('keyup',e=>{if(e.key==='Shift'){shift=false;paint();}});window.addEventListener('blur',()=>{shift=false;drag=null;if(dialog.open)paint();});
 $('selection-done').onclick=async event=>{if(!model||saving)return;saving=true;paint();const empty=excluded.size===model.elements.length;$('selection-error').textContent=empty?'Delete selection or cancel to keep editing.':'Recounting drawings…';
  try{if(empty){const deleted=await remove(record,{skipConfirmation:!!event?.shiftKey});saving=false;if(deleted)close();return;}await apply(record,{renderer:ELEMENT_RENDERER,ids:model.elements.map(e=>e.id).sort((a,b)=>a-b),excluded:[...excluded].sort((a,b)=>a-b)});saving=false;close();}
  catch(error){$('selection-error').textContent=error.message;}finally{saving=false;if(dialog.open)paint();}
 };
 return {async open(next){
  if(saving)return;close();const generation=++epoch;record=next;excluded=new Set(next.example.elements?.excluded||[]);mode='erase';shift=false;drag=null;$('selection-error').textContent='Loading selection…';$('selection-elements').textContent='…';$('selection-done').disabled=true;$('selection-erase-all').disabled=true;canvas.width=canvas.height=1;dialog.showModal();
  const state=context().state,marks=state.countMarks.filter(m=>m.example_id===next.id&&m.item_id===next.item_id&&m.drawing_id===context().drawing?.id&&m.included);$('selection-matches').textContent=String(marks.length);$('selection-factor').textContent=String(next.multiplier||1);$('selection-total').textContent=String(marks.reduce((sum,m)=>sum+(m.quantity??1),0));
  const loading=pdfjs.getDocument({url:`/api/drawings/${next.example.drawing_id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});task=loading;
  try{const pdf=await loading.promise,page=await pdf.getPage(next.example.page),result=await inspectPdfElements({page,OPS:pdfjs.OPS,bounds:next.example.bounds,createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},cancelled:()=>generation!==epoch});if(generation!==epoch)return;
   if(next.example.elements&&(next.example.elements.renderer!==ELEMENT_RENDERER||JSON.stringify(next.example.elements.ids)!==JSON.stringify(result.elements.map(e=>e.id))))throw new Error('Selection element identity changed; this source needs review');
   model=result;$('selection-error').textContent='';paint();
  }catch(error){if(generation===epoch)$('selection-error').textContent=error.message;}
 },close};
}
