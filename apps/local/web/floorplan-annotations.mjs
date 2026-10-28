const svgNS='http://www.w3.org/2000/svg';
export function floorplanAnnotationModel(state,drawingId,page,viewport,scale=1,isMarkerVisible=()=>true){
  if(!Number.isFinite(scale)||scale<=0||typeof viewport?.convertToViewportPoint!=='function')throw new RangeError('Invalid annotation viewport');
  const project=point=>viewport.convertToViewportPoint(...point).map(v=>v*scale),scope=row=>row.drawing_id===drawingId&&row.page===page;
  const ref=(kind,row)=>({kind,id:row.id,drawing_id:drawingId,page});
  const marks=(state.countMarks||[]).filter(scope).flatMap(m=>{const item=state.countItems?.find(i=>i.id===m.item_id);if(!item||!isMarkerVisible(item.id))return [];return [{...ref('count',m),point:project([m.x,m.y]),label:`${item.name}: ${m.included?'included':'excluded'}${m.reviewed?' · reviewed':' · needs review'}`,color:m.included?item.color:'#a5adb0',included:!!m.included,reviewed:!!m.reviewed}];});
  const measurements=(state.measurements||[]).filter(scope).map(m=>({...ref('measure',m),type:m.kind,points:m.points.map(project),label:`${m.name} · ${m.quantity?.value==null?'Set scale':`${m.quantity.value.toLocaleString(undefined,{maximumFractionDigits:3})} ${m.quantity.unit}`}`}));
  const zones=(state.zones||[]).filter(scope).map(z=>({...ref('zone',z),points:z.points.map(project),label:state.zoneHeadings?.find(h=>h.id===z.heading_id)?.name||'Zone'}));
  const notes=(state.notes||[]).filter(scope).map((n,index)=>({...ref('note',n),point:project([n.x,n.y]),number:index+1,label:`Note ${index+1}: ${n.text}`}));
  return {marks,measurements,zones,notes};
}
export function renderFloorplanAnnotations(model,{open,disabled=false}){
  const root=document.createElement('div');root.className='floorplan-annotations';const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');root.append(svg);
  function action(element,record){element.dataset.annotationId=record.id;element.dataset.annotationKind=record.kind;element.setAttribute('aria-label',record.label);element.setAttribute('title',record.label);element.setAttribute('aria-disabled',String(disabled));
    if(element.tagName==='BUTTON'){element.disabled=disabled;}else {element.setAttribute('role','button');element.setAttribute('tabindex',disabled?'-1':'0');element.addEventListener('keydown',e=>{if(!disabled&&!e.defaultPrevented&&e.key==='Enter'){e.preventDefault();e.stopPropagation();open(record);}});}
    element.style.pointerEvents=disabled?'none':'auto';element.addEventListener('click',e=>{if(disabled)return;e.preventDefault();e.stopPropagation();open(record);});
  }
  function shape(record,type,color){const element=document.createElementNS(svgNS,type);if(type==='circle'){element.setAttribute('cx',record.points[0][0]);element.setAttribute('cy',record.points[0][1]);element.setAttribute('r',5);}else element.setAttribute('points',record.points.map(p=>p.join(',')).join(' '));element.setAttribute('stroke',color);element.setAttribute('stroke-width',2);element.setAttribute('fill',type==='polygon'?color+'22':type==='circle'?color:'none');action(element,record);svg.append(element);return element;}
  for(const zone of model.zones){shape(zone,'polygon','#3980b5');const label=document.createElementNS(svgNS,'text');label.setAttribute('x',zone.points[0][0]+5);label.setAttribute('y',zone.points[0][1]+18);label.setAttribute('fill','#215f8c');label.textContent=zone.label;svg.append(label);}
  for(const measure of model.measurements)shape(measure,measure.type==='point'?'circle':measure.type==='area'?'polygon':'polyline','#c06c23');
  for(const mark of model.marks){const b=document.createElement('button');b.className='takeoff-marker floorplan-marker';b.classList.toggle('unreviewed',!mark.reviewed);b.style.background=mark.color;b.style.left=mark.point[0]+'px';b.style.top=mark.point[1]+'px';b.textContent=mark.included?'✓':'×';action(b,mark);root.append(b);}
  for(const note of model.notes){const b=document.createElement('button');b.className='note-marker floorplan-note';b.style.left=note.point[0]+'px';b.style.top=note.point[1]+'px';b.textContent=note.number;action(b,note);root.append(b);}
  return root;
}
