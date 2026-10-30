// Original geometry matcher for the pinned PDF.js 6.4.299 DrawOPS representation.
// Extract BEFORE rendering: PDF.js replaces these numeric arrays with Path2D.
export const VECTOR_MATCHER_VERSION='vector-elements-1';
export const VECTOR_FIXED_VERSION='vector-elements-fixed-1';
export const VECTOR_SCALE_VERSION='vector-elements-scale-1';
export const VECTOR_SCALE_FIXED_VERSION='vector-elements-scale-fixed-1';
export const VECTOR_SCALE_RANGE=Object.freeze([.75,1.5]);
const unsupported=reason=>({supported:false,reason,elements:[]});
const identity=()=>[1,0,0,1,0,0];
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const finite=a=>Array.isArray(a)&&a.every(Number.isFinite);
const boundsOf=segments=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const s of segments)for(let i=1;i<s.length;i+=2){x0=Math.min(x0,s[i]);x1=Math.max(x1,s[i]);y0=Math.min(y0,s[i+1]);y1=Math.max(y1,s[i+1]);}return [x0,y0,x1,y1];};
const inside=(a,b,t=0)=>a[0]>=b[0]-t&&a[1]>=b[1]-t&&a[2]<=b[2]+t&&a[3]<=b[3]+t;
const intersects=(a,b)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
function segmentsFrom(data,m,close){
 if(!Array.isArray(data)&&!ArrayBuffer.isView(data))throw new Error('PDF paths were already rendered; extract vectors before rendering');
 if(data.length>16384)throw new Error('PDF path exceeds vector command budget');
 const segments=[],pathCommands=[];let current=null,start=null,subpaths=0,commandCount=0;
 const finish=()=>{if(close&&current&&start&&(current[0]!==start[0]||current[1]!==start[1]))segments.push([1,...current,...start]);};
 for(let i=0;i<data.length;){if(++commandCount>4096)throw new Error('PDF path exceeds vector command budget');const op=data[i++],n=({0:2,1:2,2:6,3:4,4:0})[op];if(n===undefined||i+n>data.length)throw new Error('Unsupported PDF path command');
  const coords=Array.from(data.slice(i,i+n));i+=n;if(!finite(coords))throw new Error('Invalid PDF path coordinates');
  const p=[];for(let j=0;j<n;j+=2)p.push(...point(m,coords[j],coords[j+1]));pathCommands.push(op,...p);
  if(op===0){finish();current=p;start=p;subpaths++;}else if(op===4){if(!current||!start)throw new Error('Invalid closed PDF path');if(current[0]!==start[0]||current[1]!==start[1])segments.push([1,...current,...start]);current=start;}else{if(!current)throw new Error('PDF path has no start');segments.push([op,...current,...p]);current=p.slice(-2);}
  if(segments.length>2048)throw new Error('PDF path exceeds vector segment budget');
 }
 finish();return {segments,subpaths,pathCommands};
}
export function extractVectorPage({operatorList,OPS,maxElements=50000}){
 const list=operatorList;if(!list||!Array.isArray(list.fnArray)||!Array.isArray(list.argsArray)||list.fnArray.length!==list.argsArray.length)return unsupported('Invalid PDF operator list');
 if(list.fnArray.length>1000000)return unsupported('PDF exceeds vector operator budget');
 let state={matrix:identity(),width:1,cap:0,join:0,miter:10,dash:[],phase:0,stroke:'#000000',fill:'#000000',textMode:0};const stack=[],elements=[],textOperationIds=[];let totalSegments=0,totalPathValues=0;
 const fills=new Set([OPS.fill,OPS.eoFill,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]),strokes=new Set([OPS.stroke,OPS.closeStroke,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke]);
 const unsafe=new Set(['clip','eoClip','beginGroup','beginSMaskGroup','paintFormXObjectBegin','shadingFill','rawFillPath','setFillColorN','setStrokeColorN','setFillTransparent','setStrokeTransparent','beginMarkedContentProps','paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat','paintImageMaskXObjectGroup','paintInlineImageXObjectGroup'].map(n=>OPS[n]).filter(Number.isInteger));
 try{for(let id=0;id<list.fnArray.length;id++){
  const op=list.fnArray[id],a=list.argsArray[id]||[];
  if(unsafe.has(op))return unsupported('Text, images, clipping, forms, patterns or compositing require raster fallback');
  if(op===OPS.setTextRenderingMode){if(![0,3].includes(a[0]))return unsupported('Stroked or clipping text requires raster fallback');state.textMode=a[0];continue;}
  if([OPS.showText,OPS.showSpacedText,OPS.nextLineShowText,OPS.nextLineSetSpacingShowText].includes(op)){if(state.textMode!==3)textOperationIds.push(id);if(textOperationIds.length>10000)return unsupported('PDF exceeds text visibility region budget');continue;}
  if(op===OPS.save){stack.push(structuredClone(state));continue;}
  if(op===OPS.restore){if(!stack.length)return unsupported('Unbalanced PDF graphics state');state=stack.pop();continue;}
  if(op===OPS.transform){if(!finite(a)||a.length!==6)return unsupported('Invalid PDF transform');state.matrix=multiply(state.matrix,a);continue;}
  if(op===OPS.setLineWidth){state.width=a[0];continue;}if(op===OPS.setLineCap){state.cap=a[0];continue;}if(op===OPS.setLineJoin){state.join=a[0];continue;}if(op===OPS.setMiterLimit){state.miter=a[0];continue;}
  if(op===OPS.setDash){state.dash=Array.from(a[0]);state.phase=a[1];continue;}
  if(op===OPS.setStrokeRGBColor){state.stroke=a[0];continue;}if(op===OPS.setFillRGBColor){state.fill=a[0];continue;}
  if(op===OPS.setGState){for(const [key,v]of a[0]||[]){if(key==='LW')state.width=v;else if(key==='LC')state.cap=v;else if(key==='LJ')state.join=v;else if(key==='ML')state.miter=v;else if(key==='D'){state.dash=Array.from(v[0]);state.phase=v[1];}else if(['RI','FL','Font'].includes(key)||['CA','ca'].includes(key)&&v===1||key==='BM'&&v==='source-over'||['SMask','TR'].includes(key)&&!v)continue;else return unsupported('Graphics-state effects require raster fallback');}continue;}
  if(op!==OPS.constructPath)continue;
  const [paint,wrapped]=a,fill=fills.has(paint),stroke=strokes.has(paint);if(!fill&&!stroke)continue;
  const m=state.matrix,sx=Math.hypot(m[0],m[1]),sy=Math.hypot(m[2],m[3]);
  if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<1e-9||sy<1e-9)return unsupported('Degenerate PDF transform');
  if(stroke&&(Math.abs(sx-sy)>1e-6*Math.max(sx,sy)||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-6*sx*sy))return unsupported('Nonuniform stroke transforms require raster fallback');
  if(stroke&&(state.dash.length||state.width<=0))return unsupported('Dashed or hairline paths require raster fallback');
  const paintClosesPath=[OPS.closeStroke,OPS.closeFillStroke,OPS.closeEOFillStroke].includes(paint);
  const {segments,subpaths,pathCommands}=segmentsFrom(wrapped?.[0],m,fill||paintClosesPath);
  totalPathValues+=pathCommands.length;if(totalPathValues>2000000)return unsupported('PDF exceeds vector path storage budget');
  if(paintClosesPath&&subpaths>1)return unsupported('Compound close-and-stroke paths require raster fallback');
  totalSegments+=segments.length;if(totalSegments>250000)return unsupported('PDF exceeds vector segment budget');
  if(!segments.length)continue;if(fill&&subpaths>1)return unsupported('Compound filled paths require raster fallback');
  if(fill&&state.fill==='#ffffff'||stroke&&state.stroke==='#ffffff')return unsupported('White overpainting requires raster fallback');
  const bounds=boundsOf(segments);if(!finite(bounds))return unsupported('Invalid PDF geometry');
  const style={fill:fill?state.fill:null,stroke:stroke?state.stroke:null,width:stroke?state.width*sx:0,cap:stroke?state.cap:0,join:stroke?state.join:0,miter:stroke?state.miter:0,rule:[OPS.eoFill,OPS.eoFillStroke,OPS.closeEOFillStroke].includes(paint)?'evenodd':'nonzero'};
  elements.push({id,segments,bounds,style,pathCommands,paintClosesPath});if(elements.length>maxElements)return unsupported('PDF exceeds vector element budget');
 }}catch(error){return unsupported(error.message);}
 if(stack.length)return unsupported('Unbalanced PDF graphics state');
 if(elements.length&&textOperationIds.length)return {supported:false,pendingTextBounds:true,reason:'Text visibility needs recorded rendering bounds',elements,textOperationIds};
 return elements.length?{supported:true,elements,limitations:['Whole paint-operation identity must be retained','Text/image appearance and arbitrary rotations/scales are not matched']} : unsupported('No supported vector paths; use raster matching');
}
// Resolve only after a successful FULL, unfiltered render of the same operator list.
// PDF.js records glyph outlines or conservative font bounds; uncertain fonts may
// deliberately yield a full-page box, which remains an explicit raster fallback.
export function resolveVectorTextBounds(page,{reader,viewport,width,height}={}){
 if(!page?.pendingTextBounds)return page;
 if(!reader||!viewport||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return unsupported('Text rendering bounds unavailable; use raster matching');
 const textRegions=[];
 try{for(const id of page.textOperationIds){
  if(reader.isEmpty(id))return unsupported('Text rendering bounds are empty or unavailable; use raster matching');
  const box=[reader.minX(id),reader.minY(id),reader.maxX(id),reader.maxY(id)];
  if(!finite(box)||box[0]<0||box[1]<0||box[2]>1||box[3]>1||box[2]<=box[0]||box[3]<=box[1])return unsupported('Invalid text rendering bounds; use raster matching');
  if(box[0]===0&&box[1]===0&&box[2]===1&&box[3]===1)return unsupported('Font bounds are uncertain across the whole page; use raster matching');
  // Two device pixels conservatively include antialiasing and bbox quantization.
  const x0=box[0]*width-2,y0=box[1]*height-2,x1=box[2]*width+2,y1=box[3]*height+2;
  const corners=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(p=>viewport.convertToPdfPoint(...p));
  if(corners.some(p=>!finite(p)))return unsupported('Invalid text coordinate mapping; use raster matching');
  textRegions.push([Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))]);
 }}catch{return unsupported('Text rendering bounds unavailable; use raster matching');}
 if(!textRegions.length)return unsupported('Text rendering bounds unavailable; use raster matching');
 return {supported:true,elements:page.elements,textRegions,limitations:['Text regions are excluded from vector recognition; overlapping candidates use raster fallback','Whole paint-operation identity must be retained','Arbitrary rotations/scales are not matched']};
}
// An enclosing stroked rectangle has a large overall box but no ink in its
// interior. Exclude it from automatic selection only when EVERY segment hull
// is disjoint, including conservative cap/join extent. Cubic control hulls can
// overestimate visible ink; that uncertainty deliberately remains selectable.
function strokeMayTouchSelection(element,selection){
 if(element.style.fill||!element.style.stroke)return intersects(element.bounds,selection);
 const {width,miter}=element.style;
 if(!Number.isFinite(width)||width<=0||!Number.isFinite(miter)||miter<0)return true;
 const padding=width/2*Math.max(Math.SQRT2,miter)+.01;
 return element.segments.some(segment=>{
  const b=boundsOf([segment]);if(!finite(b))return true;
  return intersects([b[0]-padding,b[1]-padding,b[2]+padding,b[3]+padding],selection);
 });
}
export function createVectorTemplate(page,{bounds,ids,excluded=[],anchor}={}){
 if(!page?.supported)return unsupported(page?.reason||'Vector source unavailable');
 if(!finite(bounds)||bounds.length!==4||bounds[2]<=bounds[0]||bounds[3]<=bounds[1]||!finite(anchor)||anchor.length!==2)return unsupported('Invalid vector selection bounds or anchor');
 if(ids!==undefined&&(!Array.isArray(ids)||ids.length>128||ids.some(id=>!Number.isInteger(id))||new Set(ids).size!==ids.length))return unsupported('Invalid vector selection identities');
 if(!Array.isArray(excluded)||excluded.some(id=>!Number.isInteger(id)||ids&&!ids.includes(id)))return unsupported('Invalid excluded vector identities');
 if(page.textRegions?.some(region=>intersects(region,bounds)))return unsupported('Selected symbol overlaps text; use raster matching');
 const selected=ids?new Set(ids):null,erased=new Set(excluded),elements=page.elements.filter(e=>(selected?selected.has(e.id):strokeMayTouchSelection(e,bounds))&&!erased.has(e.id));
 if(selected&&ids.some(id=>!page.elements.some(e=>e.id===id)))return unsupported('Saved selection contains unavailable vector paths');
 if(!elements.length||elements.length>128)return unsupported('Select between 1 and 128 vector paths');
 if(elements.some(e=>!inside(e.bounds,bounds,.01)))return unsupported('Selection cuts a vector path; remove crossing linework or enlarge selection');
 const total=elements.reduce((n,e)=>n+e.segments.length,0);if(total<2||total>4096)return unsupported('Vector selection needs more detail or exceeds the segment budget');
 return {supported:true,elements:structuredClone(elements),bounds:[...bounds],anchor:[...anchor],excludedElements:page.elements.filter(e=>erased.has(e.id)).map(e=>structuredClone(e))};
}
const rotate=(x,y,angle)=>angle===0?[x,y]:angle===90?[-y,x]:angle===180?[-x,-y]:[y,-x];
function transformElement(e,angle,origin=[0,0],offset=[0,0],scale=1){const segments=e.segments.map(s=>{const r=[s[0]];for(let i=1;i<s.length;i+=2){const p=rotate(s[i]-origin[0],s[i+1]-origin[1],angle);r.push(p[0]*scale+offset[0],p[1]*scale+offset[1]);}return r;});return {...e,style:{...e.style,width:e.style.width*scale},segments,bounds:boundsOf(segments)};}
const styleKey=e=>JSON.stringify({...e.style,width:undefined});
const shapeKey=e=>styleKey(e)+'|'+e.segments.map(s=>s[0]).sort().join(',');
const centre=e=>[(e.bounds[0]+e.bounds[2])/2,(e.bounds[1]+e.bounds[3])/2];
function reversed(s){const pairs=[];for(let i=1;i<s.length;i+=2)pairs.push([s[i],s[i+1]]);return [s[0],...pairs.reverse().flat()];}
function equalElements(a,b,tolerance,budget){
 if(shapeKey(a)!==shapeKey(b)||Math.abs(a.style.width-b.style.width)>tolerance)return false;
 const ac=centre(a),bc=centre(b);if(Math.abs(ac[0]-bc[0])>tolerance||Math.abs(ac[1]-bc[1])>tolerance)return false;
 const used=new Set();for(const s of a.segments){let found=false;for(let i=0;i<b.segments.length;i++){if(used.has(i))continue;if(++budget.comparisons>budget.max)throw new Error('Vector matching budget exceeded');const q=b.segments[i];if(q[0]!==s[0])continue;const r=reversed(q);if(s.every((v,j)=>Math.abs(v-q[j])<=tolerance)||s.every((v,j)=>Math.abs(v-r[j])<=tolerance)){used.add(i);found=true;break;}}if(!found)return false;}return true;
}
export function findVectorMatches(page,template,{rotations=true,scaleRange=null,tolerance=.05,maxComparisons=2000000,cancelled=()=>false}={}){
 if(!page?.supported||!template?.supported)throw new Error('Vector matching requires supported source and target');
 if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>.25||!Number.isSafeInteger(maxComparisons)||maxComparisons<1)throw new Error('Invalid vector matching tolerance or budget');
 if(scaleRange!==null&&(!finite(scaleRange)||scaleRange.length!==2||scaleRange[0]<.5||scaleRange[0]>1||scaleRange[1]<1||scaleRange[1]>2))throw new Error('Invalid vector scale range');
 const budget={comparisons:0,max:maxComparisons},byShape=new Map(),spatial=new Map(),cell=16;
 const key=(x,y)=>Math.floor(x/cell)+','+Math.floor(y/cell);
 const check=()=>{if(cancelled())throw new Error('Vector matching cancelled');};
 for(const e of page.elements){check();const k=shapeKey(e);if(!byShape.has(k))byShape.set(k,[]);byShape.get(k).push(e);const c=centre(e),sk=key(...c);if(!spatial.has(sk))spatial.set(sk,[]);spatial.get(sk).push(e);}
 const nearby=e=>{const [x,y]=centre(e),found=[];for(let cy=Math.floor((y-tolerance)/cell);cy<=Math.floor((y+tolerance)/cell);cy++)for(let cx=Math.floor((x-tolerance)/cell);cx<=Math.floor((x+tolerance)/cell);cx++)found.push(...(spatial.get(cx+','+cy)||[]));return found;};
 const hits=[];
 for(const angle of rotations?[0,90,180,270]:[0]){
  const parts=template.elements.map(e=>transformElement(e,angle,template.anchor));
  parts.sort((a,b)=>(byShape.get(shapeKey(a))?.length??0)-(byShape.get(shapeKey(b))?.length??0)||b.segments.length-a.segments.length||a.id-b.id);
  const extent=e=>Math.max(e.bounds[2]-e.bounds[0],e.bounds[3]-e.bounds[1]);
  const pivot=scaleRange?parts.find(e=>extent(e)>tolerance*2):parts[0];
  if(!pivot)throw new Error('Vector selection is too small to infer a reliable scale');
  const pc=centre(pivot),axis=pivot.bounds[2]-pivot.bounds[0]>=pivot.bounds[3]-pivot.bounds[1]?0:1,sourceExtent=pivot.bounds[axis+2]-pivot.bounds[axis];
  for(const candidate of byShape.get(shapeKey(pivot))||[]){check();if(++budget.comparisons>budget.max)throw new Error('Vector matching budget exceeded');
   let scale=1;
   if(scaleRange){
    scale=(candidate.bounds[axis+2]-candidate.bounds[axis])/sourceExtent;
    // Float32 PDF coordinates can perturb a boundary by a few ulps; keep the
    // range inclusive without admitting meaningful out-of-policy sizes.
    if(!Number.isFinite(scale)||scale<scaleRange[0]-1e-6||scale>scaleRange[1]+1e-6)continue;
    scale=Math.max(scaleRange[0],Math.min(scaleRange[1],scale));
   }
   const cc=centre(candidate),offset=[cc[0]-pc[0]*scale,cc[1]-pc[1]*scale],used=new Set(),placed=[];let valid=true;
   for(const p of parts){const expected=transformElement(p,0,[0,0],offset,scale),match=nearby(expected).find(e=>!used.has(e.id)&&equalElements(expected,e,tolerance,budget));if(!match){valid=false;break;}used.add(match.id);placed.push(expected);}
   if(!valid)continue;
   // Reject additional whole paths within the symbol envelope. Long crossing pipes
   // remain allowed; explicitly erased source paths are ignored at equivalent sites.
   const envelope=boundsOf(placed.flatMap(p=>p.segments));
   const strokePad=Math.max(0,...placed.map(p=>p.style.width*Math.max(1,p.style.miter)/2));
   const visibleEnvelope=[envelope[0]-strokePad,envelope[1]-strokePad,envelope[2]+strokePad,envelope[3]+strokePad];
   if(page.textRegions?.some(region=>{if(++budget.comparisons>budget.max)throw new Error('Vector matching budget exceeded');return intersects(region,visibleEnvelope);})){const error=new Error('A geometric candidate overlaps text; use raster matching for this page');error.code='VECTOR_TEXT_OVERLAP';throw error;}
   const ignored=template.excludedElements.map(e=>transformElement(e,angle,template.anchor,offset,scale));
   const x0=Math.floor(envelope[0]/cell),x1=Math.floor(envelope[2]/cell),y0=Math.floor(envelope[1]/cell),y1=Math.floor(envelope[3]/cell);
   for(let y=y0;y<=y1&&valid;y++)for(let x=x0;x<=x1&&valid;x++)for(const e of spatial.get(x+','+y)||[]){if(++budget.comparisons>budget.max)throw new Error('Vector matching budget exceeded');if(used.has(e.id)||!inside(e.bounds,envelope,-tolerance))continue;if(!ignored.some(q=>equalElements(q,e,tolerance,budget))){valid=false;break;}}
   if(valid&&!hits.some(h=>Math.hypot(h.x-offset[0],h.y-offset[1])<=tolerance)){hits.push({x:offset[0],y:offset[1],rotation:angle,...(scaleRange?{scale}:{}),score:1,elementIds:[...used].sort((a,b)=>a-b)});if(hits.length>5000)throw new Error('Too many vector matches');}
  }
 }
 check();return hits.sort((a,b)=>a.y-b.y||a.x-b.x);
}
