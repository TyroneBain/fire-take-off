export function coverageCircles(state,drawingId,page,viewport,scale=1,isVisible=()=>true){
 if(!Number.isFinite(scale)||scale<=0||typeof viewport?.convertToViewportPoint!=='function')throw new RangeError('Invalid coverage viewport');
 const calibration=state.calibrations?.find(c=>c.drawing_id===drawingId&&c.page===page),ratio=calibration?.metres_per_point;
 if(!Number.isFinite(ratio)||ratio<=0)return [];
 const headings=new Map((state.countItems||[]).map(i=>[i.id,i])),circles=[];
 function add(id,kind,point,radius,color){if(!(radius>0)||!Number.isFinite(radius))return;const centre=viewport.convertToViewportPoint(...point).map(v=>v*scale),edge=viewport.convertToViewportPoint(point[0]+radius/ratio,point[1]).map(v=>v*scale),r=Math.hypot(edge[0]-centre[0],edge[1]-centre[1]);if(Number.isFinite(r))circles.push({id,kind,centre,radius:r,metres:radius,color});}
 for(const m of state.countMarks||[]){if(m.drawing_id!==drawingId||m.page!==page||!m.included||!isVisible(m.item_id))continue;const item=headings.get(m.item_id);if(item)add(m.id,'count',[m.x,m.y],item.coverage_radius,item.color);}
 for(const m of state.measurements||[])if(m.drawing_id===drawingId&&m.page===page&&m.kind==='point')add(m.id,'point',m.points[0],m.coverage_radius,'#c06c23');
 return circles;
}
export function appendCoverage(svg,circles){
 const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.classList.add('coverage-circles');group.style.pointerEvents='none';group.setAttribute('aria-hidden','true');
 for(const c of circles){const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');for(const [key,value]of Object.entries({cx:c.centre[0],cy:c.centre[1],r:c.radius,fill:c.color+'18',stroke:c.color,'stroke-width':1.5,'data-coverage-id':c.id,'data-coverage-kind':c.kind}))circle.setAttribute(key,value);group.append(circle);}
 svg.append(group);
}
