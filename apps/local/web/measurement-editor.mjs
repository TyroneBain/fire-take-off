import {pagePoint,viewPoint} from './coordinates.mjs';
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';

export function nearestEdge(points,closed,point) {
  let best=null;
  for(let i=0;i<points.length-(closed?0:1);i++){
    const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;if(!length)continue;
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/length)),p=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(point[0]-p[0],point[1]-p[1]);
    if(t>0.001&&t<0.999&&(!best||distance<best.distance))best={index:i,point:p,distance};
  }
  return best;
}

export function setupMeasurementEditor({context,api,reload,activate,onChange,notice}) {
  let original=null,points=[],drag=null,saving=false;
  const surface=$('page-surface');
  const pointer=e=>pagePoint(context().viewport,$('pdf-canvas').getBoundingClientRect(),e.clientX,e.clientY);
  function clear(){original=null;points=[];drag=null;$('measurement-editor').hidden=true;$('measurement-edit-overlay')?.remove();}
  function open(m){if(saving)return;activate();original=m;points=m.points.map(p=>[...p]);$('edit-measure-name').value=m.name;$('edit-measure-factor-field').hidden=m.kind!=='length';$('edit-measure-factor').value=m.multiplier??1;$('edit-measure-error').textContent='';$('measurement-editor').hidden=false;onChange();}
  function beginDrag(event,index){if(saving||event.button!==0)return;event.preventDefault();event.stopPropagation();drag={index,start:pointer(event),points:points.map(p=>[...p])};try{surface.setPointerCapture(event.pointerId);}catch{}}
  function paint(){
    $('measurement-edit-overlay')?.remove();const c=context();if(!original)return;
    if(original.drawing_id!==c.drawing?.id||original.page!==c.pageNumber){clear();return;}if(!c.viewport)return;
    const overlay=document.createElement('div');overlay.id='measurement-edit-overlay';overlay.className='takeoff-overlay';
    const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');overlay.append(svg);
    const shape=document.createElementNS(svgNS,original.kind==='area'?'polygon':'polyline');shape.setAttribute('points',points.map(p=>viewPoint(c.viewport,...p).join(',')).join(' '));shape.setAttribute('stroke','#c06c23');shape.setAttribute('stroke-width','4');shape.setAttribute('fill',original.kind==='area'?'#c06c2322':'none');shape.style.pointerEvents='auto';shape.style.cursor='move';shape.addEventListener('pointerdown',e=>beginDrag(e,null));
    shape.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();if(saving||points.length>=1000)return;const nearest=nearestEdge(points,original.kind==='area',pointer(e));if(nearest&&nearest.distance*c.viewport.scale<=12){points.splice(nearest.index+1,0,nearest.point);paint();}});svg.append(shape);
    points.forEach((p,index)=>{
      const handle=document.createElementNS(svgNS,'circle'),[x,y]=viewPoint(c.viewport,...p);
      for(const [key,value]of Object.entries({cx:x,cy:y,r:7,fill:'white',stroke:'#c06c23','stroke-width':2,'data-measure-vertex':index}))handle.setAttribute(key,value);
      handle.style.pointerEvents='auto';handle.style.cursor='grab';handle.setAttribute('aria-label',`Measurement point ${index+1}`);handle.addEventListener('pointerdown',e=>beginDrag(e,index));
      handle.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();const minimum={point:1,length:2,area:3}[original.kind];if(!saving&&points.length>minimum){points.splice(index,1);paint();}});svg.append(handle);
    });surface.append(overlay);
  }
  surface.addEventListener('pointermove',e=>{if(!drag||!context().viewport)return;const p=pointer(e);points=drag.points.map((q,i)=>drag.index===null?[q[0]+p[0]-drag.start[0],q[1]+p[1]-drag.start[1]]:i===drag.index?p:[...q]);paint();});
  surface.addEventListener('pointerup',()=>{drag=null;});
  surface.addEventListener('pointercancel',()=>{if(drag){points=drag.points;drag=null;paint();}});
  $('cancel-measure-edit').onclick=()=>{if(saving)return;clear();onChange();};
  $('save-measure-edit').onclick=async()=>{
    if(!original||saving)return;saving=true;$('save-measure-edit').disabled=true;$('cancel-measure-edit').disabled=true;
    try{await api(`/api/measurements/${original.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('edit-measure-name').value,points,version:original.version,multiplier:original.kind==='length'?Number($('edit-measure-factor').value):1})});clear();await reload();notice('Measurement updated');}
    catch(error){$('edit-measure-error').textContent=error.message;}
    finally{saving=false;$('save-measure-edit').disabled=false;$('cancel-measure-edit').disabled=false;onChange();}
  };
  return {open,clear,paint,get id(){return original?.id;}};
}
