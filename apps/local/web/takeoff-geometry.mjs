export const unitMetres = { m: 1, mm: .001, ft: .3048, in: .0254 };
export function pathLength(points) { return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0); }
export function polygonArea(points) { return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2; }
function cross(a,b,c) { return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]); }
function on(a,b,p) { return Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]); }
function intersects(a,b,c,d) { return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0 || on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b); }
export function validateGeometry(kind,points,view) {
  const minimum={point:1,length:2,area:3}[kind];
  if(!minimum||!Array.isArray(points)||points.length<minimum||points.length>1000||kind==='point'&&points.length!==1)throw new Error('Invalid geometry');
  if(points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v))||p[0]<view[0]||p[0]>view[2]||p[1]<view[1]||p[1]>view[3]))throw new Error('Points must be inside the drawing');
  if(kind!=='point'&&points.some((p,i)=>i>0&&Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])<1e-8))throw new Error('Repeated adjacent point');
  if(kind==='length'&&pathLength(points)<1e-8)throw new Error('Length must be positive');
  if(kind==='area') {
    if(polygonArea(points)<1e-8)throw new Error('Area must be positive');
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) {
      if(j===i+1||i===0&&j===points.length-1)continue;
      if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))throw new Error('Area boundary must not cross or touch itself');
    }
  }
}
export function quantity(kind,points,metresPerPoint) {
  if(kind==='point')return {value:1,unit:'ea'};
  if(!metresPerPoint)return {value:null,unit:kind==='area'?'m²':'m'};
  return kind==='area'?{value:polygonArea(points)*metresPerPoint**2,unit:'m²'}:{value:pathLength(points)*metresPerPoint,unit:'m'};
}
