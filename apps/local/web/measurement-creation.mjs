import {pagePoint,viewPoint,clientPoint} from './coordinates.mjs';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
export function nearVertex(viewport,rect,a,b,tolerance=7){
  const p=clientPoint(viewport,rect,...a),q=clientPoint(viewport,rect,...b);
  return Math.hypot(p[0]-q[0],p[1]-q[1])<=tolerance;
}
export function nextMeasureName(kind,records){
  const base={point:'Point',length:'Length',area:'Area'}[kind];
  const names=new Set(records.map(m=>m.name.toLowerCase()));let i=1;
  while(names.has(`${base} ${i}`.toLowerCase()))i++;
  return `${base} ${i}`;
}
export function setupMeasurementCreation({context,api,reload,notice,onChange,clearEditor,isActive}){
  let kind=null,points=[],cursor=null,saving=false,generation=0,error='';
  const surface=$('page-surface');
  const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const minimum=()=>kind==='area'?3:2;
  function pointer(e){const c=context();if(!c.viewport||!c.drawing)return null;const p=pagePoint(c.viewport,$('pdf-canvas').getBoundingClientRect(),e.clientX,e.clientY),v=c.drawing.pages[c.pageNumber-1].view;return p[0]>=v[0]&&p[0]<=v[2]&&p[1]>=v[1]&&p[1]<=v[3]?p:null;}
  function clear(){generation++;kind=null;points=[];cursor=null;error='';$('measurement-draft-overlay')?.remove();}
  function start(type){if(saving)return;clearEditor();clear();kind=type;
    if(type!=='calibration')$('measure-name').value=nextMeasureName(type,context().state.measurements||[]);
    onChange();
  }
  function paint(){
    const active=!!kind;
    $('measure-create').hidden=active||!!document.querySelector('#measurement-editor:not([hidden])');
    $('measure-draft').hidden=!active;
    $('measure-name-field').hidden=kind==='calibration';
    $('measure-name').disabled=saving;
    $('create-measure').disabled=saving;
    $('calibrate').disabled=saving;
    $('create-measure').textContent=`Create ${$('measure-type').value}`;
    $('measure-draft-title').textContent=kind==='calibration'?'Set drawing scale':kind?`Drawing ${kind}`:'';
    $('measure-instruction').textContent=kind==='calibration'?'Click both ends of a known distance.':kind==='point'?'Click to place points. Escape to finish.':'Click corners. Click the last point again or right-click to finish.';
    $('measure-draft-status').textContent=error|| (saving?'Saving…':kind==='point'?'':`${points.length} point${points.length===1?'':'s'} placed`);
    $('measure-draft-status').classList.toggle('error',!!error);
    $('finish-measure').hidden=kind==='point'||kind==='calibration';
    $('finish-measure').disabled=saving||points.length<minimum();
    $('undo-measure-point').hidden=kind==='point';
    $('undo-measure-point').disabled=saving||!points.length;
    $('cancel-measure').disabled=saving;
    $('cancel-measure').textContent=kind==='point'?'Done':'Cancel';
    if(isActive()&&active)$('tool-help').textContent=kind==='calibration'?'Set scale · two endpoints':`${kind[0].toUpperCase()+kind.slice(1)} · ${kind==='point'?'click to place':'Enter to finish · Backspace to undo'} · Escape to cancel`;
    paintOverlay();
  }
  function paintOverlay(){
    $('measurement-draft-overlay')?.remove();const c=context();if(!kind||!c.viewport||!points.length)return;
    const overlay=document.createElement('div');overlay.id='measurement-draft-overlay';overlay.className='takeoff-overlay';
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');overlay.append(svg);
    const path=document.createElementNS(ns,kind==='area'?'polygon':'polyline');path.setAttribute('points',[...points,...(cursor?[cursor]:[])].map(p=>viewPoint(c.viewport,...p).join(',')).join(' '));
    for(const [k,v]of Object.entries({stroke:'#2878d0','stroke-width':2,'stroke-dasharray':'6 4',fill:kind==='area'?'#2878d018':'none'}))path.setAttribute(k,v);svg.append(path);
    for(const p of points){const h=document.createElementNS(ns,'circle'),[cx,cy]=viewPoint(c.viewport,...p);for(const[k,v]of Object.entries({cx,cy,r:4,fill:'white',stroke:'#2878d0','stroke-width':2}))h.setAttribute(k,v);svg.append(h);}
    surface.append(overlay);
  }
  async function save(onePoint=null){
    if(saving||!kind||kind==='calibration'||(!onePoint&&points.length<minimum()))return;
    const c=context(),token=generation,body={page:c.pageNumber,kind,points:onePoint?[onePoint]:points.map(p=>[...p]),name:$('measure-name').value.trim()};
    if(!body.name){error='Enter an item name.';onChange();$('measure-name').focus();return;}
    saving=true;error='';paint();let committed=false;
    try{await api(`/api/drawings/${c.drawing.id}/measurements`,json(body));committed=true;if(token===generation){points=[];cursor=null;}await reload();notice('Measurement saved');}
    catch(e){if(token===generation)error=committed?'Saved, but the list could not refresh. Reopen this drawing.':e.message;notice(committed?'Measurement saved; refresh failed.':e.message,true);}
    finally{saving=false;onChange();}
  }
  $('measure-type').onchange=paint;
  $('create-measure').onclick=()=>start($('measure-type').value);
  $('calibrate').onclick=()=>start('calibration');
  $('cancel-measure').onclick=()=>{if(saving)return;clear();onChange();};
  $('undo-measure-point').onclick=()=>{if(saving)return;points.pop();cursor=null;error='';onChange();};
  $('finish-measure').onclick=()=>save();
  surface.addEventListener('pointermove',e=>{if(!isActive()||!kind||saving||!points.length)return;cursor=pointer(e);paintOverlay();});
  surface.addEventListener('pointerleave',()=>{cursor=null;paintOverlay();});
  surface.addEventListener('click',e=>{
    if(!isActive()||!kind||saving||e.button!==0||e.target.closest('button'))return;const p=pointer(e);if(!p)return;
    if(kind==='point'){save(p);return;}
    if(points.length&&nearVertex(context().viewport,$('pdf-canvas').getBoundingClientRect(),p,points.at(-1))){if(kind!=='calibration'&&points.length>=minimum())save();return;}
    if(kind==='calibration'&&points.length===2)return;
    points.push(p);cursor=null;error='';onChange();
    if(kind==='calibration'&&points.length===2){$('known-distance').value='';$('calibration-error').textContent='';$('calibration-dialog').showModal();}
  });
  surface.addEventListener('contextmenu',e=>{if(!isActive()||!kind)return;e.preventDefault();e.stopImmediatePropagation();if(kind!=='calibration'&&kind!=='point')save();},true);
  document.addEventListener('keydown',e=>{
    if(!isActive()||saving||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
    if(kind){if(e.key==='Escape'){e.preventDefault();clear();onChange();}else if(e.key==='Backspace'&&kind!=='point'){e.preventDefault();$('undo-measure-point').click();}else if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();save();}}
    else if(!document.querySelector('#measurement-editor:not([hidden])')){const type={1:'point',2:'length',3:'area'}[e.key];if(type){e.preventDefault();$('measure-type').value=type;paint();}else if(e.key.toLowerCase()==='c'){e.preventDefault();start($('measure-type').value);}}
  });
  const cancelCalibration=()=>{if(saving)return;clear();onChange();};
  $('cancel-calibration').onclick=()=>{$('calibration-dialog').close();cancelCalibration();};
  $('calibration-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();else cancelCalibration();});
  $('calibration-form').onsubmit=async e=>{
    e.preventDefault();if(saving||kind!=='calibration'||points.length!==2)return;
    const c=context(),token=generation,previous=c.state.calibrations.find(v=>v.drawing_id===c.drawing.id&&v.page===c.pageNumber);
    saving=true;$('save-calibration').disabled=$('cancel-calibration').disabled=true;
    try{await api(`/api/drawings/${c.drawing.id}/calibration`,json({page:c.pageNumber,points,distance:Number($('known-distance').value),unit:$('known-unit').value,version:previous?.version||0}));$('calibration-dialog').close();if(token===generation)clear();await reload();notice('Drawing scale saved');}
    catch(error){$('calibration-error').textContent=error.message;}
    finally{saving=false;$('save-calibration').disabled=$('cancel-calibration').disabled=false;onChange();}
  };
  return {clear,paint,paintOverlay,get active(){return !!kind;}};
}
