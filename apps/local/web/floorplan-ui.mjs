import {coverageCircles} from './coverage.mjs';
import {floorplanAnnotationModel,renderFloorplanAnnotations} from './floorplan-annotations.mjs';
import {floorplanFor,floorplanLayout,rotateVector,MAX_FLOORPLAN_PAGES} from './floorplan-model.mjs';
import {comparisonScale} from './comparison.mjs';
import {setupDrawingPicker} from './drawing-picker.mjs';
const $=id=>document.getElementById(id);
export function setupFloorplans({context,pdfjs,api,reload,activateBase,notice,openDrawing,suppressed,openAnnotation,isMarkerVisible}){
  let active=false,visible=true,selected=null,draft=null,busy=false,drag=null,contextKey=null,generation=0,viewLayout=null,viewScale=1;
  const world=$('floorplan-world'),surface=$('page-surface'),stage=$('drawing-stage'),cache=new Map(),tasks=new Set();
  const data=()=>{const c=context();return floorplanFor(c.state||{},c.drawing?.id,c.pageNumber);};
  const rotation=()=>{const c=context();return (c.viewport.rotation-c.drawing.pages[c.pageNumber-1].rotation+360)%360;};
  function clear(){generation++;for(const task of tasks)task.destroy().catch(()=>{});tasks.clear();cache.clear();selected=null;draft=null;drag=null;contextKey=null;resetWorld();}
  function resetWorld(){world.querySelectorAll('.floorplan-sheet').forEach(e=>e.remove());world.classList.remove('floorplan-expanded');surface.classList.remove('floorplan-editing');world.style.width='';world.style.height='';surface.style.left='';surface.style.top='';viewLayout=null;}
  function deactivate(){active=false;draft=null;drag=null;$('floorplan-panel').hidden=true;paint();}
  function activate(){activateBase();active=true;$('floorplan-panel').hidden=false;$('layout-tool').classList.add('tool-active');$('layout-tool').setAttribute('aria-pressed','true');$('pan-tool').classList.remove('tool-active');$('pan-tool').setAttribute('aria-pressed','false');paint();}
  function controls(){
    const f=data(),c=context(),list=$('floorplan-list');list.replaceChildren();
    $('floorplan-visible').checked=visible;$('floorplan-visible').disabled=!f;$('add-floorplan').disabled=busy||!c.viewport||(f?.members.length||1)>=MAX_FLOORPLAN_PAGES;
    $('floorplan-intro').hidden=!!f;
    for(const m of f?.members||[]){const d=c.state.drawings.find(d=>d.id===m.drawing_id),row=document.createElement('div');row.className='floorplan-row';const edit=document.createElement('button');edit.textContent=`${d.name} · page ${m.page}${m.id===f.member.id?' · Current':''}`;edit.classList.toggle('selected',m.id===selected);edit.disabled=busy;edit.onclick=()=>beginEdit(m.id);row.append(edit);
      if(m.id!==f.member.id){const open=document.createElement('button');open.textContent='Open';open.disabled=busy;open.onclick=()=>navigate(m);row.append(open);}list.append(row);
    }
    $('floorplan-controls').hidden=!f?.members.some(m=>m.id===selected);$('floorplan-position').textContent=draft?`Position: ${draft.x.toFixed(2)}, ${draft.y.toFixed(2)} page points · Editing`:'Choose a drawing to edit its position.';
    $('floorplan-save').disabled=busy||!draft;$('floorplan-cancel').disabled=busy||!draft;$('floorplan-remove').disabled=busy||!selected;$('floorplan-reset').disabled=busy||!selected;$('floorplan-fit').disabled=!f||busy;
  }
  function selectedMembers(f){return f.members.map(m=>draft?.id===m.id?{...m,x:draft.x,y:draft.y}:m);}
  function paint(){
    const c=context();controls();if(!c.viewport||!c.drawing){resetWorld();return;}
    const next=`${c.drawing.id}:${c.pageNumber}:${rotation()}`;
    if(contextKey!==next){clear();contextKey=next;}
    const f=data();const valid=new Set((f?.members||[]).filter(m=>m.id!==f.member.id).map(m=>`${m.drawing_id}:${m.page}:${rotation()}`));for(const [k,entry]of cache)if(!valid.has(k)){entry.task?.destroy().catch(()=>{});cache.delete(k);}
    if(!f||!visible||suppressed()){resetWorld();return;}
    let layout;try{layout=floorplanLayout(selectedMembers(f),c.state.drawings,rotation());}catch(error){resetWorld();notice(error.message,true);return;}
    viewLayout=layout;const base=layout.rectangles.find(r=>r.id===f.member.id);viewScale=c.viewport.width/base.width;surface.classList.toggle('floorplan-editing',active&&draft?.id===base.id);
    world.classList.add('floorplan-expanded');world.style.width=`${layout.width*viewScale}px`;world.style.height=`${layout.height*viewScale}px`;surface.style.left=`${base.left*viewScale}px`;surface.style.top=`${base.top*viewScale}px`;
    world.querySelectorAll('.floorplan-sheet').forEach(e=>e.remove());
    for(const m of layout.rectangles){if(m.id===f.member.id)continue;const d=c.state.drawings.find(d=>d.id===m.drawing_id),key=`${d.id}:${m.page}:${rotation()}`,sheet=document.createElement('div');sheet.className='floorplan-sheet';sheet.dataset.memberId=m.id;sheet.classList.toggle('editing',active&&draft?.id===m.id);for(const [k,v]of Object.entries({left:m.left,top:m.top,width:m.width,height:m.height}))sheet.style[k]=`${v*viewScale}px`;
      const cached=cache.get(key),label=document.createElement('button');label.className='floorplan-open';label.textContent=`${d.name} · page ${m.page} · Open`;label.onclick=()=>navigate(m);label.disabled=busy;sheet.append(label);
      if(cached?.canvas){sheet.append(cached.canvas);sheet.append(renderFloorplanAnnotations(floorplanAnnotationModel(c.state,d.id,m.page,cached.viewport,viewScale,isMarkerVisible),{open:record=>navigate(m,record),disabled:busy||!!draft,coverage:coverageCircles(c.state,d.id,m.page,cached.viewport,viewScale,isMarkerVisible)}));}else {const status=document.createElement('span');status.className='floorplan-load';status.textContent=cached?.error?'Unable to load page':'Loading page…';sheet.append(status);if(cached?.error){const retry=document.createElement('button');retry.className='floorplan-retry';retry.textContent='Retry';retry.onclick=()=>{cache.delete(key);paint();};sheet.append(retry);}}
      world.append(sheet);if(!cached)load(d,m.page,rotation(),key);
    }
  }
  async function load(d,pageNumber,userRotation,key){
    const epoch=generation,entry={};cache.set(key,entry);const task=pdfjs.getDocument({url:`/api/drawings/${d.id}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});tasks.add(task);entry.task=task;
    try{const pdf=await task.promise,page=await pdf.getPage(pageNumber);if(epoch!==generation||cache.get(key)!==entry)return;const angle=(page.rotate+userRotation+360)%360,v=page.getViewport({scale:1,rotation:angle}),scale=comparisonScale([v]),viewport=page.getViewport({scale,rotation:angle}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;if(epoch!==generation||cache.get(key)!==entry)return;entry.canvas=canvas;entry.viewport=v;paint();}
    catch(error){if(epoch===generation){entry.error=true;paint();}}
    finally{tasks.delete(task);await task.destroy().catch(()=>{});}
  }
  function beginEdit(id){if(!active||busy)return;const f=data(),m=f?.members.find(m=>m.id===id);if(!m)return;selected=id;draft={...m,version:f.group.version};visible=true;drag=null;paint();}
  function cancel(){if(busy)return;draft=null;drag=null;paint();}
  async function save(){if(!draft||busy)return;const value={...draft};busy=true;controls();try{await api(`/api/floorplan-members/${value.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:value.x,y:value.y,version:value.version})});draft=null;drag=null;await reload();notice('Floorplan position saved');}catch(error){draft=null;drag=null;await reload().catch(()=>{});notice(error.message,true);}finally{busy=false;paint();}}
  async function remove(){const f=data();if(!f||!selected||busy)return;const id=selected;busy=true;controls();try{await api(`/api/floorplan-members/${id}?version=${f.group.version}`,{method:'DELETE'});draft=null;selected=null;await reload();notice('Drawing removed from floorplan');}catch(error){await reload().catch(()=>{});notice(error.message,true);}finally{busy=false;paint();}}
  async function navigate(m,annotation=null){if(busy||annotation&&draft)return;cancel();const c=context(),d=c.state.drawings.find(d=>d.id===m.drawing_id);await openDrawing(d,m.page,'count');if(context().drawing?.id!==d.id||context().pageNumber!==m.page)return;if(annotation)openAnnotation(annotation);else activate();}
  const picker=setupDrawingPicker({prefix:'floorplan',context:()=>{const c=context(),discipline=c.state.entities.find(e=>e.id===c.drawing?.discipline_id),takeoff=c.state.entities.find(e=>e.id===discipline?.parent_id),allowed=new Set([discipline?.id,takeoff?.id,takeoff?.parent_id]);return {...c,state:{...c.state,entities:c.state.entities.filter(e=>allowed.has(e.id)),drawings:c.state.drawings.filter(d=>d.discipline_id===discipline?.id)}};},onChoose:async(d,page)=>{
    const c=context(),f=data();if(busy)return;busy=true;controls();try{await api(`/api/drawings/${c.drawing.id}/floorplan-pages`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:c.pageNumber,drawing_id:d.id,target_page:page,version:f?.group.version||0})});draft=null;visible=true;await reload();notice('Drawing added to floorplan');}catch(error){await reload().catch(()=>{});notice(error.message,true);}finally{busy=false;paint();}
  }});
  $('add-floorplan').onclick=()=>picker.open();$('floorplan-save').onclick=save;$('floorplan-cancel').onclick=cancel;$('floorplan-remove').onclick=remove;
  $('floorplan-reset').onclick=()=>{if(!draft)beginEdit(selected);if(draft){draft.x=0;draft.y=0;paint();}};
  $('floorplan-visible').onchange=()=>{visible=$('floorplan-visible').checked;cancel();};
  $('floorplan-fit').onclick=()=>{if(viewLayout)context().fitFloorplan(viewLayout.width,viewLayout.height);};
  world.addEventListener('contextmenu',e=>{if(!active||busy||!data())return;e.preventDefault();beginEdit(e.target.closest('.floorplan-sheet')?.dataset.memberId||data().member.id);});
  world.addEventListener('pointerdown',e=>{if(!active||!draft||busy||e.button!==0||e.target.closest('button'))return;e.preventDefault();e.stopPropagation();drag={start:[e.clientX,e.clientY],position:[draft.x,draft.y],rotation:rotation(),scale:viewScale};try{world.setPointerCapture(e.pointerId);}catch{}});
  world.addEventListener('pointermove',e=>{if(!drag||!draft)return;const [dx,dy]=rotateVector([(e.clientX-drag.start[0])/drag.scale,(e.clientY-drag.start[1])/drag.scale],-drag.rotation);draft.x=drag.position[0]+dx;draft.y=drag.position[1]+dy;paint();});
  world.addEventListener('pointerup',()=>{drag=null;});world.addEventListener('pointercancel',()=>{if(drag&&draft){[draft.x,draft.y]=drag.position;drag=null;paint();}});
  document.addEventListener('keydown',e=>{if(!active||busy||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(e.key==='Delete'&&selected){e.preventDefault();remove();return;}if(!draft)return;
    if(e.key==='Escape'){e.preventDefault();cancel();return;}if(e.key==='Enter'){e.preventDefault();save();return;}if(e.key==='0'){e.preventDefault();draft.x=0;draft.y=0;paint();return;}
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(direction){e.preventDefault();const step=(e.shiftKey?10:1)/viewScale,[dx,dy]=rotateVector(direction.map(v=>v*step),-rotation());draft.x+=dx;draft.y+=dy;paint();}
  });
  return {activate,deactivate,paint,clear};
}
