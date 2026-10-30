// Original, bounded contour proposal kernel. Never produces accepted detections.
// A different tessellation can describe the same closed boundary; paint order,
// caps/joins, clipping and visibility still require original-PDF verification.
import {createConstituentTemplate} from './vector-constituents.mjs';
export const CONTOUR_KERNEL_VERSION='vector-contours-candidate-1';
const fail=(message,code='VECTOR_CONTOURS_UNSUPPORTED')=>Object.assign(new Error(message),{code});
const finite=a=>Array.isArray(a)&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000000);
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8;
const bounds=points=>{const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of points){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;};
const centre=c=>[(c.bounds[0]+c.bounds[2])/2,(c.bounds[1]+c.bounds[3])/2];
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const styleKey=s=>JSON.stringify([s.fill,s.stroke,s.width,s.cap,s.join,s.miter,s.rule]);
const rotate=(x,y,a)=>a===0?[x,y]:a===90?[-y,x]:a===180?[-x,-y]:[y,-x];
function lineTouchesBox(s,b){
 let low=0,high=1;for(let axis=0;axis<2;axis++){const start=s[1+axis],delta=s[3+axis]-start;if(!delta){if(start<b[axis]||start>b[axis+2])return false;continue;}let a=(b[axis]-start)/delta,c=(b[axis+2]-start)/delta;if(a>c)[a,c]=[c,a];low=Math.max(low,a);high=Math.min(high,c);if(low>high)return false;}return true;
}
function touches(entry,box,tick){
 const s=entry.element.style;if(s.fill&&overlap(entry.bounds,box))return true;
 if(!s.stroke)return false;const pad=s.width/2*Math.max(s.join===0?s.miter:1,s.cap===2?Math.SQRT2:1),b=[box[0]-pad,box[1]-pad,box[2]+pad,box[3]+pad];
 return entry.element.segments.some(segment=>{tick();return segment[0]===1?lineTouchesBox(segment,b):overlap(bounds(Array.from({length:(segment.length-1)/2},(_,i)=>segment.slice(i*2+1,i*2+3))),b);});
}
function straightExterior(e,box,tick){
 if(e.style.fill||!e.style.stroke||e.segments.some(s=>s[0]!==1))return false;
 const a=e.segments[0].slice(1,3),b=e.segments.at(-1).slice(3,5),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1e-8)return false;
 const inside=p=>p[0]>=box[0]&&p[0]<=box[2]&&p[1]>=box[1]&&p[1]<=box[3];if(inside(a)&&inside(b))return false;
 let previous=a,projection=-1e-8;for(const s of e.segments){tick();if(!near(previous,s.slice(1,3)))return false;for(const p of [s.slice(1,3),s.slice(3,5)]){if(Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length>1e-7)return false;const t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length*length);if(t+1e-8<projection)return false;projection=t;}previous=s.slice(3,5);}return true;
}
function simpleFilledContour(c,tick){
 if(!c.closed)return false;const ps=c.points,n=ps.length-1,cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),on=(a,b,p)=>Math.abs(cross(a,b,p))<=1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8;
 for(let i=0;i<n;i++){
  const a=ps[i],b=ps[i+1],next=ps[(i+2)%n];tick();
  // Adjacent edges may subdivide a straight line, but cannot double back.
  if(Math.abs(cross(a,b,next))<=1e-8&&(b[0]-a[0])*(next[0]-b[0])+(b[1]-a[1])*(next[1]-b[1])<0)return false;
  for(let j=i+2;j<n;j++){tick();if(i===0&&j===n-1)continue;const u=ps[j],v=ps[j+1],abU=cross(a,b,u),abV=cross(a,b,v),uvA=cross(u,v,a),uvB=cross(u,v,b);if((abU>0&&abV<0||abU<0&&abV>0)&&(uvA>0&&uvB<0||uvA<0&&uvB>0)||on(a,b,u)||on(a,b,v)||on(u,v,a)||on(u,v,b))return false;}
 }return true;
}
function inventory(elements,tick){
 if(!Array.isArray(elements)||!elements.length||elements.length>50000)throw fail('Invalid contour element collection');
 const closed=[],byId=new Map();let values=0;
 for(const e of elements){tick();const s=e?.style;
  if(!Number.isSafeInteger(e?.id)||e.id<0||byId.has(e.id)||!Array.isArray(e.segments)||!e.segments.length||e.segments.length>4096||!s||![s.fill,s.stroke].every(c=>c===null||typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c))||!s.fill&&!s.stroke||!Number.isFinite(s.width)||s.width<0||s.width>100000||![0,1,2].includes(s.cap)||![0,1,2].includes(s.join)||!Number.isFinite(s.miter)||s.miter<0||s.miter>1000||!['evenodd','nonzero'].includes(s.rule))throw fail('Invalid contour geometry or paint');
  for(const segment of e.segments){tick();if(!finite(segment)||segment.length!==({1:5,2:9,3:7})[segment[0]])throw fail('Invalid contour segment');values+=segment.length;if(values>2000000)throw fail('Contour storage budget exceeded','VECTOR_CONTOURS_BUDGET');}
  const entry={element:e,bounds:bounds(e.segments.flatMap(s=>Array.from({length:(s.length-1)/2},(_,i)=>s.slice(i*2+1,i*2+3)))),contours:[],unsupported:false};byId.set(e.id,entry);
  if(e.segments.some(s=>s[0]!==1)){entry.unsupported=true;continue;}
  let points=[],indices=[];
  const flush=()=>{if(!indices.length)return;const c={elementId:e.id,indices,points,style:s,key:styleKey(s),bounds:bounds(points),closed:points.length>=4&&near(points[0],points.at(-1))};entry.contours.push(c);points=[];indices=[];};
  for(const [i,line]of e.segments.entries()){tick();const a=line.slice(1,3),b=line.slice(3,5);if(points.length&&!near(points.at(-1),a))flush();if(!points.length)points=[a];indices.push(i);if(!near(points.at(-1),b))points.push(b);if(points.length>=4&&near(points[0],points.at(-1)))flush();}
  flush();
  // Zero-length commands are retained in provenance. Isolated zero-length
  // subpaths remain unsupported: caps can make them visible dots.
  // Equal boundary sets do not establish equal winding of self-intersecting
  // fills. Preserve those operations but never propose them as equivalent.
  if(s.fill&&(entry.contours.length!==1||!simpleFilledContour(entry.contours[0],tick)))entry.unsupported=true;
  if(!entry.unsupported)closed.push(...entry.contours.filter(c=>c.closed));
 }
 return {closed,byId};
}
function moved(c,angle,origin,offset){const points=c.points.map(p=>{const r=rotate(p[0]-origin[0],p[1]-origin[1],angle);return[r[0]+offset[0],r[1]+offset[1]];});return {...c,points,bounds:bounds(points)};}
const pointDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
// Certify the entire segment, not only its vertices. Distance to a closed set
// is 1-Lipschitz, so midpoint distance + half segment length is an upper bound.
// Refine only uncertain intervals; depth exhaustion rejects rather than guesses.
function boundaryWithin(a,b,limit,tick){
 for(const [from,to]of [[a,b],[b,a]]){
  const nearest=p=>{let d=Infinity;for(let i=1;i<to.points.length;i++){tick();d=Math.min(d,pointDistance(p,to.points[i-1],to.points[i]));}return d;};
  const check=(p,q,dp,dq,depth)=>{tick();if(dp>limit||dq>limit)return false;const mid=[(p[0]+q[0])/2,(p[1]+q[1])/2],dm=nearest(mid);if(dm+Math.hypot(p[0]-q[0],p[1]-q[1])/2<=limit)return true;if(depth===14)return false;return check(p,mid,dp,dm,depth+1)&&check(mid,q,dm,dq,depth+1);};
  for(let i=1;i<from.points.length;i++){const p=from.points[i-1],q=from.points[i];if(!check(p,q,nearest(p),nearest(q),0))return false;}
 }return true;
}
// For a declared CAD grid q, each independently rounded coordinate differs
// from its latent value by at most q/2. Two encodings therefore differ by q
// per axis under ONE shared transform. A target line plus an axis-aligned
// square of radius q is a convex hexagon: x/y bounds and two parallel sides.
// Clip the entire source line to each hexagon, then require full interval
// coverage in both directions. This has no vertex-only or sampling shortcut.
function gridBoundaryWithin(a,b,limit,tick){
 for(const [from,to]of [[a,b],[b,a]])for(let i=1;i<from.points.length;i++){
  const p=from.points[i-1],q=from.points[i],dx=q[0]-p[0],dy=q[1]-p[1],intervals=[];
  for(let j=1;j<to.points.length;j++){tick();const u=to.points[j-1],v=to.points[j],vx=v[0]-u[0],vy=v[1]-u[1],cross=-vy*u[0]+vx*u[1],margin=limit*(Math.abs(vx)+Math.abs(vy));let low=0,high=1;
   for(const [nx,ny,c]of [[1,0,Math.max(u[0],v[0])+limit],[-1,0,-Math.min(u[0],v[0])+limit],[0,1,Math.max(u[1],v[1])+limit],[0,-1,-Math.min(u[1],v[1])+limit],[-vy,vx,cross+margin],[vy,-vx,-cross+margin]]){const start=nx*p[0]+ny*p[1],slope=nx*dx+ny*dy;if(Math.abs(slope)<1e-15){if(start>c){low=1;high=0;break;}}else if(slope>0)high=Math.min(high,(c-start)/slope);else low=Math.max(low,(c-start)/slope);if(low>high)break;}
   if(low<=high)intervals.push([Math.max(0,low),Math.min(1,high)]);
  }
  intervals.sort((a,b)=>a[0]-b[0]);let covered=0;for(const [low,high]of intervals){tick();if(low>covered+1e-10)return false;covered=Math.max(covered,high);if(covered>=1-1e-10)break;}if(covered<1-1e-10)return false;
 }return true;
}
export function createContourTemplate(page,selection={}){
 const t=createConstituentTemplate(page,selection);if(!t.supported)return t;
 try{const c=inventory(t.elements,()=>{});if(!c.closed.length||[...c.byId.values()].some(e=>e.unsupported||e.contours.some(c=>!c.closed)))throw fail('Source requires closed line contours and simple fills; open, curved, compound or self-intersecting fills need fallback');return {...t,kernel:CONTOUR_KERNEL_VERSION,requiresRenderVerification:true};}catch(e){return {supported:false,reason:e.message};}
}
export function findContourCandidates(page,template,{tolerance=.25,relativeCentreTolerance=.125,knownGrid=null,excludedContext='exact',rotations=true,maxComparisons=50000000,cancelled=()=>false}={}){
 if(!page?.supported||!template?.supported||template.kernel!==CONTOUR_KERNEL_VERSION)throw fail('Contour matching requires supported source and target');
 if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>.25||!Number.isFinite(relativeCentreTolerance)||relativeCentreTolerance<=0||relativeCentreTolerance>.125||knownGrid!==null&&(!Number.isFinite(knownGrid)||knownGrid<.001||knownGrid>.5)||!['exact','straight-exterior'].includes(excludedContext)||typeof rotations!=='boolean'||!Number.isSafeInteger(maxComparisons)||maxComparisons<1||typeof cancelled!=='function')throw fail('Invalid contour options');
 if(!finite(template.anchor)||template.anchor.length!==2||!Array.isArray(template.elements)||template.elements.length>128||template.elements.reduce((n,e)=>n+(e?.segments?.length??4097),0)>4096||!Array.isArray(template.excludedElements)||template.excludedElements.length>128)throw fail('Invalid contour source selection');
 if(page.textRegions!==undefined&&(!Array.isArray(page.textRegions)||page.textRegions.length>10000||page.textRegions.some(b=>!finite(b)||b.length!==4||b[2]<b[0]||b[3]<b[1])))throw fail('Invalid text visibility regions');
 let comparisons=0;const tick=()=>{if(++comparisons>maxComparisons)throw fail('Contour comparison budget exceeded','VECTOR_CONTOURS_BUDGET');if((comparisons&127)===1&&cancelled())throw fail('Contour matching cancelled','VECTOR_CONTOURS_CANCELLED');};
 const source=inventory(template.elements,tick),target=inventory(page.elements,tick),excluded=template.excludedElements.length?inventory(template.excludedElements,tick):{byId:new Map()};
 if([...source.byId.values()].some(e=>e.unsupported||e.contours.some(c=>!c.closed)))throw fail('Source has unsupported contours');
 const sourceEnvelope=bounds(source.closed.flatMap(c=>c.points)),contextSources=excludedContext==='straight-exterior'?[...excluded.byId.values()].filter(e=>straightExterior(e.element,sourceEnvelope,tick)):[];
 // PDF.js paths can contain Float32 operands. Bound two rounding errors using
 // the native coordinate magnitude; reject if that uncertainty dominates q.
 let numerical=1e-8;if(knownGrid!==null){for(const c of [...source.closed,...target.closed])for(const p of c.points){tick();numerical=Math.max(numerical,Math.abs(p[0])*2**-22,Math.abs(p[1])*2**-22);}if(numerical>knownGrid*.01)throw fail('Coordinates cannot resolve the declared CAD grid');}
 const onGrid=c=>c.points.every(p=>p.every(v=>Math.abs(v-Math.round(v/knownGrid)*knownGrid)<=numerical));
 if(knownGrid!==null&&source.closed.some(c=>!onGrid(c)))throw fail('Source does not lie on the declared CAD grid');
 const positionLimit=knownGrid===null?relativeCentreTolerance:knownGrid+numerical,boundaryLimit=knownGrid===null?tolerance:knownGrid+numerical,sizeLimit=knownGrid===null?tolerance:2*(knownGrid+numerical);
 const byKey=new Map(),spatial=new Map(),cell=16;
 for(const c of target.closed){tick();if(knownGrid!==null&&!onGrid(c))continue;if(!byKey.has(c.key))byKey.set(c.key,[]);byKey.get(c.key).push(c);const p=centre(c),key=Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell);if(!spatial.has(key))spatial.set(key,[]);spatial.get(key).push(c);}
 const nearby=c=>{const p=centre(c),out=[];for(let y=Math.floor((p[1]-positionLimit)/cell);y<=Math.floor((p[1]+positionLimit)/cell);y++)for(let x=Math.floor((p[0]-positionLimit)/cell);x<=Math.floor((p[0]+positionLimit)/cell);x++)out.push(...(spatial.get(x+','+y)||[]));return out;};
 const same=(a,b)=>{tick();if(a.key!==b.key)return false;const ac=centre(a),bc=centre(b),positionError=knownGrid===null?Math.hypot(ac[0]-bc[0],ac[1]-bc[1]):Math.max(Math.abs(ac[0]-bc[0]),Math.abs(ac[1]-bc[1]));if(positionError>positionLimit||Math.abs(a.bounds[2]-a.bounds[0]-b.bounds[2]+b.bounds[0])>sizeLimit||Math.abs(a.bounds[3]-a.bounds[1]-b.bounds[3]+b.bounds[1])>sizeLimit)return false;return knownGrid===null?boundaryWithin(a,b,boundaryLimit,tick):gridBoundaryWithin(a,b,boundaryLimit,tick);};
 const hits=[];
 for(const angle of rotations?[0,90,180,270]:[0]){
  const parts=source.closed.map(c=>moved(c,angle,template.anchor,[0,0]));parts.sort((a,b)=>(byKey.get(a.key)?.length??0)-(byKey.get(b.key)?.length??0)||b.points.length-a.points.length);const pivot=parts[0],pc=centre(pivot);
  for(const candidate of byKey.get(pivot.key)||[]){tick();const cc=centre(candidate),offset=[cc[0]-pc[0],cc[1]-pc[1]],used=new Set(),placed=parts.map(p=>moved(p,0,[0,0],offset)),contextExclusions=[];let valid=true;
   for(const p of placed){const matches=nearby(p).filter(c=>!used.has(c)&&same(p,c));matches.sort((a,b)=>{const c=centre(p),ac=centre(a),bc=centre(b);return Math.hypot(ac[0]-c[0],ac[1]-c[1])-Math.hypot(bc[0]-c[0],bc[1]-c[1])||a.elementId-b.elementId;});if(!matches.length){valid=false;break;}used.add(matches[0]);}if(!valid)continue;
   const ids=new Set([...used].map(c=>c.elementId));if([...ids].some(id=>{const e=target.byId.get(id);return e.unsupported||e.contours.some(c=>!used.has(c));}))continue;
   const box=bounds(placed.flatMap(c=>c.points)),pad=Math.max(...placed.map(c=>c.style.stroke?c.style.width*Math.max(1,c.style.miter)/2:0)),visible=[box[0]-pad,box[1]-pad,box[2]+pad,box[3]+pad];
   if((page.textRegions||[]).some(b=>overlap(b,visible)))continue;
   for(const [id,e]of target.byId){tick();if(ids.has(id)||!touches(e,box,tick))continue;
    // Exact whole-operation exclusion remains the default. The explicit
    // context option additionally permits a whole straight exterior stroke
    // with the SAME paint style as an erased exterior source stroke. It never
    // ignores an interior stroke, closed loop, bent path or unrelated tail.
    const ignored=[...excluded.byId.values()].find(ex=>{tick();const a=ex.element,b=e.element;if(styleKey(a.style)!==styleKey(b.style)||a.segments.length!==b.segments.length)return false;return a.segments.every((s,i)=>{const transformed=[s[0]];for(let j=1;j<s.length;j+=2){const p=rotate(s[j]-template.anchor[0],s[j+1]-template.anchor[1],angle);transformed.push(p[0]+offset[0],p[1]+offset[1]);}return transformed.every((v,j)=>Math.abs(v-b.segments[i][j])<1e-7);});});
    const permission=ignored||contextSources.find(ex=>styleKey(ex.element.style)===styleKey(e.element.style)&&straightExterior(e.element,box,tick));if(!permission){valid=false;break;}contextExclusions.push({elementId:id,sourceExcludedElementId:permission.element.id,segmentIndices:e.element.segments.map((_,i)=>i)});
   }if(!valid)continue;
   if(!hits.some(h=>Math.hypot(h.x-offset[0],h.y-offset[1])<=tolerance)){const elementIds=[...ids].sort((a,b)=>a-b);hits.push({x:offset[0],y:offset[1],rotation:angle,elementIds,wholeOperations:true,provenance:elementIds.map(id=>({elementId:id,segmentIndices:target.byId.get(id).element.segments.map((_,i)=>i)})),contextExclusions,requiresRenderVerification:true,...knownGrid!==null?{geometryPolicy:'declared-cad-grid',gridSpacing:knownGrid,coordinateErrorBound:boundaryLimit}: {},...excludedContext==='straight-exterior'?{exclusionPolicy:excludedContext}: {}});if(hits.length>5000)throw fail('Contour result budget exceeded','VECTOR_CONTOURS_BUDGET');}
  }
 }
 if(cancelled())throw fail('Contour matching cancelled','VECTOR_CONTOURS_CANCELLED');return hits.sort((a,b)=>a.y-b.y||a.x-b.x);
}
