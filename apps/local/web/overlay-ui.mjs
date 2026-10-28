import {comparisonScale,comparisonKey} from './comparison.mjs';
import {MAX_OVERLAYS,overlayInkPixels,overlayPlacement,moveOverlay} from './overlay.mjs';
const $=id=>document.getElementById(id);
export function setupOverlays({context,pdfjs,activateBase,notice,suppressed}){
  let active=false,layers=[],selected=null,key=null,generation=0,drag=null;
  const tasks=new Set(),surface=$('page-surface');
  const current=()=>layers.find(l=>l.id===selected);
  function clear(){generation++;for(const task of tasks)task.destroy().catch(()=>{});tasks.clear();layers=[];selected=null;key=null;drag=null;paint();}
  function deactivate(){active=false;drag=null;for(const l of layers)if(l.editing){l.offset=[...l.saved];l.editing=false;}$('overlay-panel').hidden=true;paint();}
  function activate(){activateBase();active=true;$('overlay-panel').hidden=false;$('layout-tool').classList.add('tool-active');$('layout-tool').setAttribute('aria-pressed','true');$('pan-tool').classList.remove('tool-active');$('pan-tool').setAttribute('aria-pressed','false');paint();}
  function list(){
    const root=$('overlay-list');root.replaceChildren();$('add-overlay').disabled=layers.length>=MAX_OVERLAYS;
    for(const l of layers){
      const row=document.createElement('div');row.className='overlay-row';
      const button=document.createElement('button');button.textContent=`${l.name} · page ${l.page}${l.loading?' · Loading…':''}`;button.classList.toggle('selected',l.id===selected);button.onclick=()=>edit(l.id);row.append(button);
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=l.visible;check.onchange=()=>{l.visible=check.checked;paint();};label.append(check,document.createTextNode('Show'));row.append(label);root.append(row);
    }
    const l=current();$('overlay-controls').hidden=!l?.canvas;
    $('overlay-position').textContent=l?`Offset: ${l.offset.map(v=>v.toFixed(2)).join(', ')} page points${l.editing?' · Editing':''}`:'';
    $('overlay-save').disabled=!l?.editing;$('overlay-cancel').disabled=!l?.editing;
    $('overlay-opacity').value=l?Math.round(l.opacity*100):70;
  }
  function paint(){
    const c=context(),next=comparisonKey(c);if(key&&next&&key!==next){clear();return;}
    $('drawing-overlays')?.remove();list();if(!c.viewport||!layers.length||suppressed())return;
    const group=document.createElement('div');group.id='drawing-overlays';group.setAttribute('aria-label','Temporary drawing overlays');
    for(const l of layers){if(!l.visible||!l.canvas)continue;const wrapper=document.createElement('div');wrapper.className='drawing-overlay-layer';wrapper.dataset.layerId=l.id;wrapper.classList.toggle('editing',active&&l.editing);wrapper.classList.toggle('selected',active&&l.id===selected);
      const placement=overlayPlacement(l.width,l.height,l.offset,c.viewport.scale);for(const [name,value]of Object.entries(placement))wrapper.style[name]=`${value}px`;wrapper.style.opacity=l.opacity;wrapper.append(l.canvas);group.append(wrapper);
    }
    surface.insertBefore(group,$('pdf-canvas').nextSibling);
  }
  function edit(id){if(!active)return;for(const l of layers)if(l.editing){l.offset=[...l.saved];l.editing=false;}selected=id;const l=current();if(l?.canvas){l.editing=true;l.visible=true;}drag=null;paint();}
  function confirm(){const l=current();if(!l)return;l.saved=[...l.offset];l.editing=false;drag=null;paint();}
  function cancel(){const l=current();if(!l)return;l.offset=[...l.saved];l.editing=false;drag=null;paint();}
  function remove(){const l=current();if(!l)return;if(l.task){tasks.delete(l.task);l.task.destroy().catch(()=>{});}layers=layers.filter(x=>x!==l);selected=layers.at(-1)?.id||null;drag=null;paint();}
  async function add(d,pageNumber){
    const c=context();if(!c.viewport||layers.length>=MAX_OVERLAYS)return;
    if(layers.some(l=>l.drawingId===d.id&&l.page===pageNumber)){notice('That drawing page is already overlaid.');return;}
    key=comparisonKey(c);const epoch=generation,userRotation=c.viewport.rotation-c.drawing.pages[c.pageNumber-1].rotation;
    const l={id:crypto.randomUUID(),drawingId:d.id,name:d.name,page:pageNumber,offset:[0,0],saved:[0,0],opacity:.7,visible:true,editing:false,loading:true};layers.push(l);selected=l.id;paint();
    const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});l.task=task;tasks.add(task);
    try{const doc=await task.promise,page=await doc.getPage(pageNumber);if(epoch!==generation||!layers.includes(l))return;
      const rotation=(page.rotate+userRotation+360)%360,view=page.getViewport({scale:1,rotation}),scale=comparisonScale([view]),v=page.getViewport({scale,rotation}),canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport:v,background:'white'}).promise;
      if(epoch!==generation||!layers.includes(l))return;
      const ink=overlayInkPixels(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);ctx.putImageData(new ImageData(ink,canvas.width,canvas.height),0,0);
      canvas.setAttribute('aria-label',`${l.name}, page ${l.page} overlay`);Object.assign(l,{canvas,width:view.width,height:view.height,loading:false,task:null});paint();
    }catch(error){if(epoch===generation&&layers.includes(l)){layers=layers.filter(x=>x!==l);if(selected===l.id)selected=layers.at(-1)?.id||null;paint();notice(`Unable to overlay drawing: ${error.message}`,true);}}
    finally{tasks.delete(task);await task.destroy().catch(()=>{});}
  }
  $('add-overlay').onclick=()=>{const c=context(),select=$('overlay-drawing');select.replaceChildren();for(const d of c.state.drawings){const discipline=c.state.entities.find(e=>e.id===d.discipline_id),takeoff=c.state.entities.find(e=>e.id===discipline?.parent_id),project=c.state.entities.find(e=>e.id===takeoff?.parent_id),o=document.createElement('option');o.value=d.id;o.textContent=`${project?.name||''} / ${takeoff?.name||''} / ${discipline?.name||''} / ${d.name}`;select.append(o);}select.value=c.state.drawings.find(d=>d.id!==c.drawing.id)?.id||c.drawing.id;pageLimit();$('overlay-dialog').showModal();};
  function pageLimit(){const d=context().state.drawings.find(d=>d.id===$('overlay-drawing').value);$('overlay-page').max=d?.pages.length||1;$('overlay-page').value=1;}
  $('overlay-drawing').onchange=pageLimit;$('cancel-overlay-picker').onclick=()=>$('overlay-dialog').close();
  $('overlay-form').onsubmit=e=>{e.preventDefault();const d=context().state.drawings.find(d=>d.id===$('overlay-drawing').value),page=Number($('overlay-page').value);if(!d||!Number.isInteger(page)||page<1||page>d.pages.length)return;$('overlay-dialog').close();add(d,page);};
  $('overlay-edit').onclick=()=>edit(selected);$('overlay-save').onclick=confirm;$('overlay-cancel').onclick=cancel;$('overlay-remove').onclick=remove;
  $('overlay-reset').onclick=()=>{const l=current();if(l){l.offset=[0,0];l.editing=true;paint();}};
  $('overlay-opacity').oninput=()=>{const l=current();if(l){l.opacity=Number($('overlay-opacity').value)/100;paint();}};
  surface.addEventListener('contextmenu',e=>{if(!active||!layers.length)return;e.preventDefault();const r=$('pdf-canvas').getBoundingClientRect(),scale=context().viewport?.scale;if(!scale)return;const x=(e.clientX-r.x)/scale,y=(e.clientY-r.y)/scale,l=[...layers].reverse().find(l=>l.canvas&&l.visible&&x>=l.offset[0]&&x<=l.offset[0]+l.width&&y>=l.offset[1]&&y<=l.offset[1]+l.height);if(l)edit(l.id);});
  surface.addEventListener('pointerdown',e=>{const l=current();if(!active||!l?.editing||e.button!==0)return;e.preventDefault();e.stopPropagation();drag={id:l.id,start:[e.clientX,e.clientY],offset:[...l.offset]};try{surface.setPointerCapture(e.pointerId);}catch{}});
  surface.addEventListener('pointermove',e=>{const l=current();if(!drag||l?.id!==drag.id||!context().viewport)return;l.offset=moveOverlay(drag.offset,e.clientX-drag.start[0],e.clientY-drag.start[1],context().viewport.scale);paint();});
  surface.addEventListener('pointerup',()=>{drag=null;});surface.addEventListener('pointercancel',()=>{const l=current();if(drag&&l?.id===drag.id){l.offset=drag.offset;drag=null;paint();}});
  document.addEventListener('keydown',e=>{const l=current();if(!active||!l?.canvas||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(e.key==='Delete'){e.preventDefault();remove();return;}if(!l.editing)return;
    if(e.key==='Escape'){e.preventDefault();cancel();return;}if(e.key==='Enter'){e.preventDefault();confirm();return;}if(e.key==='0'){e.preventDefault();l.offset=[0,0];paint();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();const step=e.shiftKey?10:1;l.offset=moveOverlay(l.offset,delta[0]*step,delta[1]*step,context().viewport.scale);paint();}
  });
  return {activate,deactivate,paint,clear};
}
