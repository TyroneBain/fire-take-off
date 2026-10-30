// Original candidate kernel: PDF paint grouping is not symbol identity.
// Candidates are NOT accepted detections: split paint operations can change
// cap/join coverage, so original-PDF rendering must verify them before use.
import {createVectorTemplate} from './vector-recognition.mjs';
export const CONSTITUENT_KERNEL_VERSION='vector-constituents-candidate-1';
const fail=(message,code='VECTOR_CONSTITUENTS_UNSUPPORTED')=>Object.assign(new Error(message),{code});
const finite=a=>Array.isArray(a)&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000000);
const colour=v=>v===null||typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const bounds=ss=>{const b=[Infinity,Infinity,-Infinity,-Infinity];for(const s of ss)for(let i=1;i<s.length;i+=2){b[0]=Math.min(b[0],s[i]);b[1]=Math.min(b[1],s[i+1]);b[2]=Math.max(b[2],s[i]);b[3]=Math.max(b[3],s[i+1]);}return b;};
const rotate=(x,y,a)=>a===0?[x,y]:a===90?[-y,x]:a===180?[-x,-y]:[y,-x];
const transform=(s,angle,origin,offset)=>{const out=[s[0]];for(let i=1;i<s.length;i+=2){const p=rotate(s[i]-origin[0],s[i+1]-origin[1],angle);out.push(p[0]+offset[0],p[1]+offset[1]);}return out;};
const reverse=s=>{const p=[];for(let i=s.length-2;i>=1;i-=2)p.push(s[i],s[i+1]);return [s[0],...p];};
const midpoint=a=>[(a.bounds[0]+a.bounds[2])/2,(a.bounds[1]+a.bounds[3])/2];
const styleKey=s=>JSON.stringify([s.fill,s.stroke,s.cap,s.join,s.miter,s.rule]);
function atom(id,indices,segments,style){return {elementId:id,segmentIndices:indices,segments,style,bounds:bounds(segments),key:(style.fill?'paint:':'stroke:')+styleKey(style)+':'+segments.map(s=>s[0]).sort().join(',')};}
function validateElements(elements,tick){
 if(!Array.isArray(elements)||!elements.length||elements.length>50000)throw fail('Invalid constituent element collection');
 const atoms=[],byId=new Map();let values=0;
 for(const e of elements){tick();const s=e?.style;
  if(!Number.isInteger(e?.id)||e.id<0||byId.has(e.id)||!Array.isArray(e.segments)||!e.segments.length||e.segments.length>4096||!s||!colour(s.fill)||!colour(s.stroke)||!s.fill&&!s.stroke||!Number.isFinite(s.width)||s.width<0||s.width>100000||![0,1,2].includes(s.cap)||![0,1,2].includes(s.join)||!Number.isFinite(s.miter)||s.miter<0||s.miter>1000||!['nonzero','evenodd'].includes(s.rule))throw fail('Invalid constituent geometry or style');
  for(const seg of e.segments){tick();if(!finite(seg)||seg.length!==({1:5,2:9,3:7})[seg[0]])throw fail('Invalid constituent segment');values+=seg.length;if(values>2000000)throw fail('Constituent geometry storage budget exceeded','VECTOR_CONSTITUENTS_BUDGET');}
  const list=s.fill?[atom(e.id,e.segments.map((_,i)=>i),e.segments,s)]:e.segments.map((seg,i)=>atom(e.id,[i],[seg],s));
  atoms.push(...list);if(atoms.length>250000)throw fail('Constituent atom budget exceeded','VECTOR_CONSTITUENTS_BUDGET');byId.set(e.id,{element:e,atoms:list});
 }
 return {atoms,byId};
}
function distance(a,b,tolerance,tick){
 tick();if(a.key!==b.key||Math.abs(a.style.width-b.style.width)>tolerance)return Infinity;
 const ac=midpoint(a),bc=midpoint(b);if(Math.abs(ac[0]-bc[0])>tolerance||Math.abs(ac[1]-bc[1])>tolerance)return Infinity;
 let worst=Math.abs(a.style.width-b.style.width);const used=new Set();
 for(const s of a.segments){let best=Infinity,index=-1;for(let i=0;i<b.segments.length;i++){tick();if(used.has(i))continue;const q=b.segments[i];if(s[0]!==q[0])continue;const r=reverse(q),d=Math.min(Math.max(...s.map((v,j)=>Math.abs(v-q[j]))),Math.max(...s.map((v,j)=>Math.abs(v-r[j]))));if(d<best){best=d;index=i;}}
  if(index<0||best>tolerance)return Infinity;used.add(index);worst=Math.max(worst,best);
 }
 return worst;
}
const same=(a,b,tolerance,tick)=>distance(a,b,tolerance,tick)<=tolerance;
function moved(a,angle,origin,offset){return {...a,segments:a.segments.map(s=>transform(s,angle,origin,offset)),bounds:bounds(a.segments.map(s=>transform(s,angle,origin,offset)))};}
export function createConstituentTemplate(page,options={}){
 const selected=createVectorTemplate(page,options);if(!selected.supported)return selected;
 try{validateElements(selected.elements,()=>{});return {...selected,kernel:CONSTITUENT_KERNEL_VERSION,requiresRenderVerification:true};}catch(error){return {supported:false,reason:error.message};}
}
export function findConstituentMatches(page,template,{rotations=true,tolerance=.05,maxComparisons=2000000,cancelled=()=>false}={}){
 if(!page?.supported||!template?.supported||template.kernel!==CONSTITUENT_KERNEL_VERSION)throw fail('Constituent matching needs supported source and target geometry');
 if(typeof rotations!=='boolean'||!Number.isFinite(tolerance)||tolerance<=0||tolerance>.25||!Number.isSafeInteger(maxComparisons)||maxComparisons<1||typeof cancelled!=='function')throw fail('Invalid constituent matching options');
 let comparisons=0;const tick=()=>{if(++comparisons>maxComparisons)throw fail('Constituent matching budget exceeded','VECTOR_CONSTITUENTS_BUDGET');if((comparisons&127)===1&&cancelled())throw fail('Constituent matching cancelled','VECTOR_CONSTITUENTS_CANCELLED');};
 if(!finite(template.anchor)||template.anchor.length!==2)throw fail('Missing original source anchor');
 if(page.textRegions!==undefined&&(!Array.isArray(page.textRegions)||page.textRegions.length>10000||page.textRegions.some(b=>!finite(b)||b.length!==4||b[2]<b[0]||b[3]<b[1])))throw fail('Invalid text visibility regions');
 if(!Array.isArray(template.elements)||template.elements.length>128||template.elements.reduce((n,e)=>n+(Array.isArray(e?.segments)?e.segments.length:4097),0)>4096||template.excludedElements!==undefined&&(!Array.isArray(template.excludedElements)||template.excludedElements.length>128))throw fail('Constituent source exceeds selection budget','VECTOR_CONSTITUENTS_BUDGET');
 const target=validateElements(page.elements,tick),source=validateElements(template.elements,tick),excluded=template.excludedElements?.length?validateElements(template.excludedElements,tick):{atoms:[],byId:new Map()};
 const byKey=new Map(),spatial=new Map(),cell=16,cellKey=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
 for(const a of target.atoms){tick();if(!byKey.has(a.key))byKey.set(a.key,[]);byKey.get(a.key).push(a);const c=midpoint(a),k=cellKey(...c);if(!spatial.has(k))spatial.set(k,[]);spatial.get(k).push(a);}
 const nearby=a=>{const [x,y]=midpoint(a),out=[];for(let cy=Math.floor((y-tolerance)/cell);cy<=Math.floor((y+tolerance)/cell);cy++)for(let cx=Math.floor((x-tolerance)/cell);cx<=Math.floor((x+tolerance)/cell);cx++)for(const p of spatial.get(cx+','+cy)||[]){tick();out.push(p);}return out;};
 const hits=[];
 for(const angle of rotations?[0,90,180,270]:[0]){
  const parts=source.atoms.map(a=>moved(a,angle,template.anchor,[0,0]));
  parts.sort((a,b)=>(byKey.get(a.key)?.length??0)-(byKey.get(b.key)?.length??0)||b.segments.length-a.segments.length||a.elementId-b.elementId||a.segmentIndices[0]-b.segmentIndices[0]);
  const pivot=parts[0],pc=midpoint(pivot);
  for(const candidate of byKey.get(pivot.key)||[]){tick();const cc=midpoint(candidate),offset=[cc[0]-pc[0],cc[1]-pc[1]],used=new Set();let valid=true;
   for(const part of parts){const expected=moved(part,0,[0,0],offset),ranked=nearby(expected).filter(a=>!used.has(a)).map(a=>({a,error:distance(expected,a,tolerance,tick)})).filter(p=>p.error<=tolerance).sort((a,b)=>a.error-b.error||a.a.elementId-b.a.elementId||a.a.segmentIndices[0]-b.a.segmentIndices[0]),found=ranked[0]?.a;if(!found){valid=false;break;}used.add(found);}
   if(!valid)continue;
   const ids=new Set([...used].map(a=>a.elementId));
   // Existing overlays paint whole operations. Never return an ID after using
   // just the convenient portion of its geometry, even outside the envelope.
   for(const id of ids)for(const a of target.byId.get(id).atoms){tick();if(!used.has(a))valid=false;}
   if(!valid)continue;
   const placed=parts.map(a=>moved(a,0,[0,0],offset)),envelope=bounds(placed.flatMap(a=>a.segments)),pad=Math.max(...placed.map(a=>a.style.width*Math.max(1,a.style.miter)/2)),visible=[envelope[0]-pad,envelope[1]-pad,envelope[2]+pad,envelope[3]+pad];
   for(const region of page.textRegions||[]){tick();if(overlap(region,visible))throw fail('Constituent candidate overlaps text; render-aware matching required');}
   const ignored=[...excluded.byId.values()].map(e=>e.atoms.map(a=>moved(a,angle,template.anchor,offset)));
   for(const [id,e] of target.byId){tick();if(ids.has(id))continue;
    let touches=false;for(const a of e.atoms){tick();const p=a.style.stroke?a.style.width*Math.max(1,a.style.miter)/2+.01:0,b=a.bounds;if(overlap([b[0]-p,b[1]-p,b[2]+p,b[3]+p],envelope)){touches=true;break;}}
    if(!touches)continue;
    const explicitlyIgnored=ignored.some(group=>{tick();if(group.length!==e.atoms.length)return false;const seen=new Set();for(const a of group){const i=e.atoms.findIndex((b,i)=>!seen.has(i)&&same(a,b,tolerance,tick));if(i<0)return false;seen.add(i);}return true;});
    if(!explicitlyIgnored){valid=false;break;}
   }
   if(!valid)continue;
   let duplicate=false;for(const h of hits){tick();if(Math.hypot(h.x-offset[0],h.y-offset[1])<=tolerance){duplicate=true;break;}}
   if(!duplicate){const elementIds=[...ids].sort((a,b)=>a-b);hits.push({x:offset[0],y:offset[1],rotation:angle,geometryScore:1,elementIds,wholeOperations:true,provenance:elementIds.map(id=>({elementId:id,segmentIndices:target.byId.get(id).element.segments.map((_,i)=>i)})),requiresRenderVerification:true});if(hits.length>5000)throw fail('Too many constituent candidates','VECTOR_CONSTITUENTS_BUDGET');}
  }
 }
 if(cancelled())throw fail('Constituent matching cancelled','VECTOR_CONSTITUENTS_CANCELLED');return hits.sort((a,b)=>a.y-b.y||a.x-b.x);
}
