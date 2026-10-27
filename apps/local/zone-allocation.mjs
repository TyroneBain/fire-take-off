import clipping from 'polygon-clipping';
import {polygonArea,pathLength} from './web/takeoff-geometry.mjs';
const EPS=1e-9;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
function ringContains(ring,p){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],v=sub(b,a),w=sub(p,a);
    if(Math.abs(cross(v,w))<EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS)return true;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }return inside;
}
function contains(multi,p){return multi.some(poly=>ringContains(poly[0],p)&&!poly.slice(1).some(r=>ringContains(r,p)));}
function area(multi){return multi.reduce((sum,poly)=>sum+polygonArea(poly[0])-poly.slice(1).reduce((s,r)=>s+polygonArea(r),0),0);}
export function effectiveZones(headings,zones){
  let occupied=[];
  return [...headings].sort((a,b)=>a.position-b.position||a.id.localeCompare(b.id)).map(h=>{
    const outlines=zones.filter(z=>z.heading_id===h.id).map(z=>[z.points]);
    const union=outlines.length?clipping.union(...outlines):[];
    const region=occupied.length&&union.length?clipping.difference(union,occupied):union;
    if(union.length)occupied=occupied.length?clipping.union(occupied,union):union;
    return {...h,region,union};
  });
}
export function allocateGeometry(kind,points,groups){
  if(!groups.length)return [{heading_id:null,fraction:1}];
  if(kind==='point'){const g=groups.find(g=>contains(g.union,points[0]));return g?[{heading_id:g.id,fraction:1}]:[];}
  const amounts=new Map(groups.map(g=>[g.id,0]));
  if(kind==='area'){
    const total=polygonArea(points);
    for(const g of groups)if(g.region.length)amounts.set(g.id,area(clipping.intersection([points],g.region))/total);
  }else{
    const total=pathLength(points);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],v=sub(b,a),length=Math.hypot(...v),ts=[0,1],norm=v[0]**2+v[1]**2;
      for(const g of groups)for(const polygon of g.union)for(const ring of polygon)for(let j=0;j<ring.length;j++){
        const c=ring[j],d=ring[(j+1)%ring.length],w=sub(d,c),delta=sub(c,a),den=cross(v,w);
        if(Math.abs(den)>EPS){const t=cross(delta,w)/den,u=cross(delta,v)/den;if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)ts.push(t);}
        else if(Math.abs(cross(delta,v))<EPS)for(const p of [c,d]){const q=sub(p,a),t=(q[0]*v[0]+q[1]*v[1])/norm;if(t>EPS&&t<1-EPS)ts.push(t);}
      }
      ts.sort((a,b)=>a-b);
      for(let j=1;j<ts.length;j++){const lo=ts[j-1],hi=ts[j];if(hi-lo<EPS)continue;const mid=(lo+hi)/2,g=groups.find(g=>contains(g.union,[a[0]+v[0]*mid,a[1]+v[1]*mid]));if(g)amounts.set(g.id,amounts.get(g.id)+(hi-lo)*length/total);}
    }
  }
  return [...amounts].filter(([,v])=>v>EPS).map(([heading_id,fraction])=>({heading_id,fraction}));
}
export function quantitySchedule(state){
  const rows=[],cache=new Map();
  function groups(drawing,page){const key=drawing.id+':'+page;if(!cache.has(key)){const z=state.zones.filter(z=>z.drawing_id===drawing.id&&z.page===page);cache.set(key,z.length?effectiveZones(state.zoneHeadings.filter(h=>h.discipline_id===drawing.discipline_id),z):[]);}return cache.get(key);}
  function add(d,page,kind,points,value,unit,source_id,item_id,name,section){for(const a of allocateGeometry(kind,points,groups(d,page)))rows.push({discipline_id:d.discipline_id,drawing_id:d.id,page,heading_id:a.heading_id,zone:a.heading_id?state.zoneHeadings.find(h=>h.id===a.heading_id).name:'Whole drawing',section,item_id,source_id,name,kind,unit,value:value===null?null:value*a.fraction,fraction:a.fraction});}
  for(const m of state.countMarks)if(m.included){const d=state.drawings.find(d=>d.id===m.drawing_id),item=state.countItems.find(i=>i.id===m.item_id);add(d,m.page,'point',[[m.x,m.y]],m.quantity??1,'ea',m.id,item.id,item.name,'Count');}
  for(const m of state.measurements){const d=state.drawings.find(d=>d.id===m.drawing_id);add(d,m.page,m.kind,m.points,m.quantity.value,m.quantity.unit,m.id,null,m.name,'Measure');}
  return rows;
}
