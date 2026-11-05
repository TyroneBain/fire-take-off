import {isVectorAlgorithm,includesScales} from './matcher.mjs';
import {isAppearanceAlgorithm} from './appearance-policy.mjs';
import {isVectorReviewAlgorithm} from './vector-review-policy.mjs';
import {inspectPdfElements,ELEMENT_RENDERER,elementAt} from './pdf-elements.mjs';
const $=id=>document.getElementById(id);
// One render at a time per PDF page. Edits replace the queued request; stale
// renders never enable Done or repaint a closed/new selection.
export function createSelectionPreview({render,onPending,onReady,onError,delay=40}){
 let request=null,settled=null,running=false,disposed=false,timer=null,sequence=0;
 const key=ids=>JSON.stringify([...ids].sort((a,b)=>a-b));
 async function drain(){timer=null;if(disposed||running||!request)return;running=true;const current=request;
  try{const image=await render(current.ids);if(!disposed&&request===current){settled=current.key;onReady(image);}}
  catch(error){if(!disposed&&request===current){settled=null;onError(error);}}
  finally{running=false;if(!disposed&&request!==current&&timer===null)timer=setTimeout(drain,0);}
 }
 return {update(ids){if(disposed)return;const value=key(ids);if(request?.key===value)return;request={ids:[...ids].sort((a,b)=>a-b),key:value,sequence:++sequence};settled=null;onPending();clearTimeout(timer);timer=setTimeout(drain,delay);},ready(ids){return !disposed&&settled!==null&&settled===key(ids)&&request?.key===settled;},dispose(){disposed=true;request=null;settled=null;clearTimeout(timer);timer=null;}};
}
export function selectionPreviewPixels(model,excluded,image){
 const pixels=new Uint8ClampedArray(model.width*model.height*4);
 for(const element of model.elements)if(excluded.has(element.id))for(let i=0;i<element.ink.length;i++)if(element.ink[i]){pixels[i*4]=pixels[i*4+1]=pixels[i*4+2]=150;pixels[i*4+3]=85;}
 if(image){if(image.width!==model.width||image.height!==model.height||image.data.length!==pixels.length)throw Error('Selection preview dimensions changed');for(let i=0;i<pixels.length;i+=4)if(image.data[i+3]&&(image.data[i]!==255||image.data[i+1]!==255||image.data[i+2]!==255))pixels.set(image.data.subarray(i,i+4),i);}
 return pixels;
}
export function setupSelectionEditor({pdfjs,context,apply,remove,cancelMatching,reviewVector}){
 let model=null,record=null,task=null,epoch=0,excluded=new Set(),mode='erase',shift=false,drag=null,saving=false,preview=null,previewImage=null,nativeInspection=false,nativeRetry=false;
 const dialog=$('selection-dialog'),canvas=$('selection-canvas');
 function close(){if(saving){cancelMatching();return;}epoch++;preview?.dispose();preview=null;previewImage=null;task?.destroy().catch(()=>{});task=null;model=null;record=null;dialog.close();}
 function paint(){
  if(!model)return;const {width,height,elements}=model;canvas.width=width;canvas.height=height;const fit=Math.min((canvas.parentElement.clientWidth-24)/width,280/height);canvas.style.width=width*fit+'px';canvas.style.height=height*fit+'px';const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(width,height);
  pixels.data.set(selectionPreviewPixels(model,excluded,previewImage));
  ctx.putImageData(pixels,0,0);$('selection-elements').textContent=String(elements.length-excluded.size);$('selection-erase').classList.toggle('selected',!shift&&mode==='erase');$('selection-restore').classList.toggle('selected',shift||mode==='restore');
  const native=nativeInspection||isVectorReviewAlgorithm(record?.example.algorithm);$('selection-vector').disabled=saving||native;$('selection-scales').disabled=saving||native||!$('selection-vector').checked;$('selection-done').disabled=saving||!preview?.ready(excluded);$('selection-erase-all').disabled=saving;canvas.classList.toggle('restoring',shift||mode==='restore');
  $('selection-native-review').disabled=saving||!preview?.ready(excluded)||excluded.size===model.elements.length;$('selection-native-layer').disabled=saving;$('selection-done').textContent=native?'Review matches':'Done';
 }
 const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
 function touch(p){if(!model||saving)return;const restore=shift||mode==='restore',candidates=model.elements.filter(e=>excluded.has(e.id)===restore),id=elementAt(candidates,...p,model.width,model.height);if(id===null)return;restore?excluded.delete(id):excluded.add(id);preview.update(excluded);paint();}
 canvas.addEventListener('pointerdown',e=>{if(!model||saving||e.button!==0)return;e.preventDefault();drag=point(e);touch(drag);try{canvas.setPointerCapture(e.pointerId);}catch{}});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e),steps=Math.max(1,Math.ceil(Math.hypot(p[0]-drag[0],p[1]-drag[1])));for(let i=1;i<=steps;i++)touch([drag[0]+(p[0]-drag[0])*i/steps,drag[1]+(p[1]-drag[1])*i/steps]);drag=p;});
 for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,()=>{drag=null;});
 $('selection-erase').onclick=()=>{mode='erase';paint();};$('selection-restore').onclick=()=>{mode='restore';paint();};$('selection-erase-all').onclick=()=>{if(!model||saving)return;excluded=new Set(model.elements.map(e=>e.id));preview.update(excluded);paint();};$('selection-cancel').onclick=close;
 $('selection-vector').onchange=()=>{if(!$('selection-vector').checked)$('selection-scales').checked=false;$('selection-scales').disabled=saving||!$('selection-vector').checked;};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select'))return;if(e.key==='Shift'){shift=true;paint();}else if(e.key.toLowerCase()==='d'){e.preventDefault();$('selection-erase-all').click();}else if(e.key.toLowerCase()==='e'){e.preventDefault();$('selection-done').click();}});
 dialog.addEventListener('keyup',e=>{if(e.key==='Shift'){shift=false;paint();}});window.addEventListener('blur',()=>{shift=false;drag=null;if(dialog.open)paint();});
 async function nativePreview(){if(!model&&nativeRetry&&!saving)return open(record,{nativeReviewOnly:true});if(!reviewVector||!model||saving||!preview?.ready(excluded)||excluded.size===model.elements.length)return;saving=true;paint();$('selection-error').textContent='Finding matches on the source page…';
  try{await reviewVector(record,{renderer:ELEMENT_RENDERER,ids:model.elements.map(e=>e.id).sort((a,b)=>a-b),excluded:[...excluded].sort((a,b)=>a-b)},$('selection-native-layer').checked);saving=false;close();}
  catch(error){$('selection-error').textContent=error.message;}finally{saving=false;if(dialog.open)paint();}
 }
 $('selection-native-review').onclick=nativePreview;
 $('selection-done').onclick=async event=>{if((nativeInspection||isVectorReviewAlgorithm(record?.example.algorithm))&&excluded.size!==model?.elements.length)return nativePreview();if(!model||saving||!preview?.ready(excluded))return;saving=true;paint();const empty=excluded.size===model.elements.length;$('selection-error').textContent=empty?'Delete selection or cancel to keep editing.':'Recounting drawings…';
  try{if(empty){const deleted=await remove(record,{skipConfirmation:!!event?.shiftKey});saving=false;if(deleted)close();return;}await apply(record,{renderer:ELEMENT_RENDERER,ids:model.elements.map(e=>e.id).sort((a,b)=>a-b),excluded:[...excluded].sort((a,b)=>a-b)},{vector:$('selection-vector').checked,scales:$('selection-vector').checked&&$('selection-scales').checked});saving=false;close();}
  catch(error){$('selection-error').textContent=error.message;}finally{saving=false;if(dialog.open)paint();}
 };
 async function open(next,{nativeReviewOnly=isVectorReviewAlgorithm(next.example.algorithm)}={}){
  if(saving)return;close();const generation=++epoch;record=next;nativeInspection=nativeReviewOnly;nativeRetry=false;$('selection-native-review').textContent='Find on this page';$('selection-vector').checked=isVectorAlgorithm(next.example.algorithm);$('selection-vector').disabled=true;$('selection-scales').checked=includesScales(next.example.algorithm);$('selection-scales').disabled=true;$('selection-native-layer').checked=next.example.vectorReview?.sourceLayerScope??true;$('selection-native-review').disabled=true;excluded=new Set(next.example.elements?.excluded||[]);mode='erase';shift=false;drag=null;$('selection-error').textContent='Loading selection…';$('selection-elements').textContent='…';$('selection-done').disabled=true;$('selection-erase-all').disabled=true;canvas.width=canvas.height=1;dialog.showModal();
  $('selection-scope-hint').textContent=nativeInspection?'Erase unwanted visible lines. Retained symbols require original-PDF verification.':isVectorReviewAlgorithm(next.example.algorithm)?'Click or drag to erase. Hold Shift to restore. Review searches this source page only; corrections are kept.':'Click or drag to erase. Hold Shift to restore. Done recounts all drawings in this discipline; corrections are kept.';
  const state=context().state,marks=state.countMarks.filter(m=>m.example_id===next.id&&m.item_id===next.item_id&&m.drawing_id===context().drawing?.id&&m.included);$('selection-matches').textContent=String(marks.length);$('selection-factor').textContent=String(next.multiplier||1);$('selection-total').textContent=String(marks.reduce((sum,m)=>sum+(m.quantity??1),0));
  const appearance=isAppearanceAlgorithm(next.example.algorithm);$('selection-erase').disabled=appearance;$('selection-restore').disabled=appearance;
  if(appearance){$('selection-elements').textContent='—';$('selection-error').textContent='Colour and fine-detail selections do not support element cleaning. Use Matching options to change quarter-turn rotations, or add a new selection.';return;}
  const loading=pdfjs.getDocument({url:`/api/drawings/${next.example.drawing_id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});task=loading;
  try{const pdf=await loading.promise,page=await pdf.getPage(next.example.page),result=await inspectPdfElements({page,OPS:pdfjs.OPS,bounds:next.example.bounds,createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},nativeReviewOnly:nativeInspection,cancelled:()=>generation!==epoch});if(generation!==epoch)return;
   if(next.example.elements&&(next.example.elements.renderer!==ELEMENT_RENDERER||JSON.stringify(next.example.elements.ids)!==JSON.stringify(result.elements.map(e=>e.id))))throw new Error('Selection element identity changed; this source needs review');
   model=result;preview=createSelectionPreview({render:ids=>result.render(ids),onPending(){previewImage=null;$('selection-error').textContent='Updating preview…';paint();},onReady(image){previewImage=image;$('selection-error').textContent='';paint();},onError(error){previewImage=null;$('selection-error').textContent=error.message;paint();}});preview.update(excluded);paint();
  }catch(error){if(generation===epoch){$('selection-error').textContent=error.message;nativeRetry=!nativeInspection&&typeof reviewVector==='function'&&/obscured|hidden or redundant|text, images|clipped or composited drawings/.test(error.message);$('selection-native-review').disabled=!nativeRetry;if(nativeRetry)$('selection-native-review').textContent='Inspect visible vector elements';}}
 }
 return {open,close};
}
