import {setupDrawingPicker} from './drawing-picker.mjs';
import {compareRasters,comparisonScale,comparisonKey} from './comparison.mjs';
const $=id=>document.getElementById(id);
export function setupComparison({context,pdfjs,activateBase,notice}){
  let active=false,selection=null,rasters=null,key=null,generation=0,editing=false,offset=[0,0],saved=[0,0],drag=null,frame=null;
  const tasks=new Set(),surface=$('page-surface');
  function clear(){generation++;for(const task of tasks)task.destroy().catch(()=>{});tasks.clear();selection=null;rasters=null;key=null;editing=false;drag=null;offset=[0,0];saved=[0,0];if(frame!==null)cancelAnimationFrame(frame);frame=null;$('comparison-overlay')?.remove();$('comparison-loading').textContent='';controls();}
  function deactivate(){active=false;drag=null;$('layout-panel').hidden=true;$('layout-tool').classList.remove('tool-active');$('layout-tool').setAttribute('aria-pressed','false');$('comparison-overlay')?.remove();}
  function activate(){activateBase();active=true;$('layout-panel').hidden=false;$('layout-tool').classList.add('tool-active');$('layout-tool').setAttribute('aria-pressed','true');$('pan-tool').classList.remove('tool-active');$('pan-tool').setAttribute('aria-pressed','false');paint();}
  function controls(){
    $('comparison-name').textContent=selection?`${selection.name} · page ${selection.page}`:'No comparison selected';
    $('comparison-controls').hidden=!rasters;$('comparison-position').textContent=`Offset: ${offset.map(v=>v.toFixed(2)).join(', ')} page points${editing?' · Editing':''}`;
    $('comparison-save').disabled=!editing;$('comparison-cancel').disabled=!editing;
  }
  async function documentPage(d,page){const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});tasks.add(task);const doc=await task.promise;return {task,page:await doc.getPage(page)};}
  async function choose(d,pageNumber){
    clear();const c=context();if(!c.viewport)return;key=comparisonKey(c);const epoch=generation;selection={id:d.id,name:d.name,page:pageNumber};controls();$('comparison-loading').textContent='Preparing comparison…';
    const userRotation=c.viewport.rotation-c.drawing.pages[c.pageNumber-1].rotation;
    let resources=[];
    try{
      resources=await Promise.all([documentPage(c.drawing,c.pageNumber),documentPage(d,pageNumber)]);
      if(epoch!==generation)return;
      const rotations=resources.map(({page})=>(page.rotate+userRotation+360)%360),views=resources.map(({page},i)=>page.getViewport({scale:1,rotation:rotations[i]})),scale=comparisonScale(views);
      const canvases=await Promise.all(resources.map(async({page},i)=>{const v=page.getViewport({scale,rotation:rotations[i]}),canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);await page.render({canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport:v,background:'white'}).promise;return canvas;}));
      if(epoch!==generation)return;
      const [base,revision]=canvases,buffer=document.createElement('canvas');buffer.width=base.width;buffer.height=base.height;
      rasters={base,revision,buffer,scale,original:base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,base.width,base.height).data};
      $('comparison-loading').textContent='';compose();paint();
    }catch(error){if(epoch===generation){clear();notice(`Unable to compare drawings: ${error.message}`,true);}}
    finally{for(const {task}of resources){tasks.delete(task);await task.destroy().catch(()=>{});}if(epoch===generation){for(const task of [...tasks]){tasks.delete(task);await task.destroy().catch(()=>{});}}}
  }
  function compose(){
    if(!rasters)return;const {base,revision,buffer,scale,original}=rasters,ctx=buffer.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,buffer.width,buffer.height);ctx.drawImage(revision,offset[0]*scale,offset[1]*scale);
    const result=compareRasters(original,ctx.getImageData(0,0,buffer.width,buffer.height).data,base.width,base.height);rasters.result=result;
  }
  function schedule(){if(frame!==null)return;frame=requestAnimationFrame(()=>{frame=null;compose();paint();});controls();}
  function paint(){
    const c=context(),current=comparisonKey(c);if(key&&current&&key!==current)clear();
    $('comparison-overlay')?.remove();controls();if(!active||!rasters?.result||!c.viewport)return;
    const canvas=document.createElement('canvas');canvas.id='comparison-overlay';canvas.width=rasters.base.width;canvas.height=rasters.base.height;canvas.style.width=`${c.viewport.width}px`;canvas.style.height=`${c.viewport.height}px`;canvas.setAttribute('aria-label','Drawing comparison: original red, new blue, shared black');canvas.getContext('2d',{willReadFrequently:true}).putImageData(new ImageData(rasters.result.pixels,canvas.width,canvas.height),0,0);canvas.classList.toggle('editing',editing);surface.append(canvas);
  }
  $('layout-tool').onclick=activate;
  const picker=setupDrawingPicker({prefix:'comparison',context,onChoose:choose});
  $('choose-comparison').onclick=()=>picker.open();
  const edit=()=>{if(rasters){editing=true;paint();}},cancel=()=>{offset=[...saved];editing=false;drag=null;schedule();};
  $('comparison-edit').onclick=edit;$('comparison-cancel').onclick=cancel;
  $('comparison-save').onclick=()=>{saved=[...offset];editing=false;drag=null;paint();};
  $('comparison-reset').onclick=()=>{editing=true;offset=[0,0];schedule();};$('comparison-remove').onclick=clear;
  surface.addEventListener('contextmenu',e=>{if(active&&rasters){e.preventDefault();edit();}});
  surface.addEventListener('pointerdown',e=>{if(!active||!editing||!rasters||e.button!==0)return;e.preventDefault();e.stopPropagation();drag={start:[e.clientX,e.clientY],offset:[...offset]};try{surface.setPointerCapture(e.pointerId);}catch{}});
  surface.addEventListener('pointermove',e=>{if(!drag)return;const scale=context().viewport?.scale;if(!scale)return;offset=[drag.offset[0]+(e.clientX-drag.start[0])/scale,drag.offset[1]+(e.clientY-drag.start[1])/scale];schedule();});
  surface.addEventListener('pointerup',()=>{drag=null;});surface.addEventListener('pointercancel',()=>{if(drag){offset=drag.offset;drag=null;schedule();}});
  document.addEventListener('keydown',e=>{
    if(!active||!rasters||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(e.key==='Delete'){e.preventDefault();clear();return;}if(!editing)return;
    if(e.key==='Escape'){e.preventDefault();cancel();return;}if(e.key==='0'){e.preventDefault();offset=[0,0];schedule();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();const step=(e.shiftKey?10:1)/context().viewport.scale;offset=[offset[0]+delta[0]*step,offset[1]+delta[1]*step];schedule();}
  });
  return {activate,deactivate,paint,clear,get active(){return active;}};
}
