export const MAX_FLOORPLAN_PAGES=16;
export const MAX_FLOORPLAN_SPAN=100000;
export function pageSize(page){
  const unit=page.userUnit||1,w=(page.view[2]-page.view[0])*unit,h=(page.view[3]-page.view[1])*unit;
  if(![w,h].every(v=>Number.isFinite(v)&&v>0))throw new RangeError('Invalid floorplan page size');
  return page.rotation%180?{width:h,height:w}:{width:w,height:h};
}
export function rotateVector([x,y],rotation=0){
  const r=((rotation%360)+360)%360;
  if(r===0)return [x,y];if(r===90)return [-y,x];if(r===180)return [-x,-y];if(r===270)return [y,-x];throw new RangeError('Floorplan rotation must be a right angle');
}
export function floorplanLayout(members,drawings,rotation=0){
  if(!members.length||members.length>MAX_FLOORPLAN_PAGES)throw new RangeError('Invalid floorplan size');
  const rectangles=members.map(m=>{
    if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||Math.abs(m.x)>MAX_FLOORPLAN_SPAN||Math.abs(m.y)>MAX_FLOORPLAN_SPAN)throw new RangeError('Floorplan position exceeds limit');
    const d=drawings.find(d=>d.id===m.drawing_id),page=d?.pages[m.page-1];if(!page)throw new RangeError('Floorplan source page missing');
    const {width,height}=pageSize(page),corners=[[m.x,m.y],[m.x+width,m.y],[m.x,m.y+height],[m.x+width,m.y+height]].map(p=>rotateVector(p,rotation));
    const left=Math.min(...corners.map(p=>p[0])),top=Math.min(...corners.map(p=>p[1])),right=Math.max(...corners.map(p=>p[0])),bottom=Math.max(...corners.map(p=>p[1]));return {...m,left,top,width:right-left,height:bottom-top};
  });
  const left=Math.min(...rectangles.map(r=>r.left)),top=Math.min(...rectangles.map(r=>r.top)),right=Math.max(...rectangles.map(r=>r.left+r.width)),bottom=Math.max(...rectangles.map(r=>r.top+r.height));
  if(right-left>MAX_FLOORPLAN_SPAN||bottom-top>MAX_FLOORPLAN_SPAN)throw new RangeError('Floorplan extent exceeds limit');
  return {left,top,width:right-left,height:bottom-top,rectangles:rectangles.map(r=>({...r,left:r.left-left,top:r.top-top}))};
}
export function floorplanFor(state,drawingId,page){
  const member=state.floorplanMembers?.find(m=>m.drawing_id===drawingId&&m.page===page);
  if(!member)return null;return {group:state.floorplans.find(p=>p.id===member.floorplan_id),member,members:state.floorplanMembers.filter(m=>m.floorplan_id===member.floorplan_id)};
}
