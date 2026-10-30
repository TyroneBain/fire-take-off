// Original PDF.js raw-path provenance for selected unclipped paint operations.
// This is NOT page support or visibility approval. Preserve raw coordinates and
// CTMs: baking a CTM into coordinates can change rasterizer antialiasing.
import {extractVectorPage} from './vector-recognition.mjs';
export const RAW_PATH_PROVENANCE_VERSION='pdfjs-raw-path-provenance-1';
export const RAW_PATH_CLIP_REASON='Clipped or clip-defining paint requires original clip-fill provenance';
const identity=()=>[1,0,0,1,0,0];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const finite=a=>Array.isArray(a)&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e8);
const colour=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const copy=s=>({...s,matrix:[...s.matrix],dash:[...s.dash],clips:[...s.clips]});
function optionalDescriptor(value){
 const invalid=()=>{throw new Error('Malformed or unsupported optional-content descriptor');},id=v=>typeof v==='string'&&v.length>0&&v.length<=256;let nodes=0;
 const expression=(a,depth=0)=>{if(++nodes>1024||depth>32||!Array.isArray(a)||a.length>1024||!['And','Or','Not'].includes(a[0])||a[0]==='Not'&&a.length!==2||a[0]!=='Not'&&a.length<3)invalid();return Object.freeze(a.map((v,i)=>{if(i===0)return v;if(Array.isArray(v))return expression(v,depth+1);if(!id(v)||++nodes>1024)invalid();return v;}));};
 if(!value||typeof value!=='object'||Array.isArray(value))invalid();
 if(value.type==='OCG'){if(Object.keys(value).some(k=>!['type','id'].includes(k))||!id(value.id))invalid();return Object.freeze({type:'OCG',id:value.id});}
 if(value.type!=='OCMD'||Object.keys(value).some(k=>!['type','ids','policy','expression'].includes(k)))invalid();
 if(value.expression!==null&&value.expression!==undefined){if(value.ids!==undefined||value.policy!==undefined)invalid();return Object.freeze({type:'OCMD',expression:expression(value.expression)});}
 if(!Array.isArray(value.ids)||!value.ids.length||value.ids.length>1024||!value.ids.every(id)||value.policy!==null&&value.policy!==undefined&&!['AnyOn','AllOn','AnyOff','AllOff'].includes(value.policy))invalid();
 return Object.freeze({type:'OCMD',ids:Object.freeze([...value.ids]),policy:value.policy??null,expression:null});
}
/** Use the SAME unmodified config for extraction and original-PDF rendering.
 * PDF.js returns true for unknown groups; this adapter explicitly refuses them.
 * Callers supplying their own callback must establish equivalent provenance. */
export function createOptionalContentVisibilityResolver(config){
 if(!config||!['getGroup','getHash','isVisible'].every(k=>typeof config[k]==='function'))throw new Error('Actual optional-content configuration required');
 const hash=config.getHash();if(typeof hash!=='string'||!hash.length)throw new Error('Stable optional-content configuration hash required');
 return value=>{
  try{if(config.getHash()!==hash)return undefined;const descriptor=optionalDescriptor(value),ids=[];
   const collect=a=>{for(let i=1;i<a.length;i++)if(Array.isArray(a[i]))collect(a[i]);else ids.push(a[i]);};
   if(descriptor.type==='OCG')ids.push(descriptor.id);else if(descriptor.expression)collect(descriptor.expression);else ids.push(...descriptor.ids);
   if(ids.some(id=>!config.getGroup(id)))return undefined;const visible=config.isVisible(descriptor);return typeof visible==='boolean'&&config.getHash()===hash?visible:undefined;
  }catch{return undefined;}
 };
}
/** ids are ORIGINAL operator-list indices; extract before PDF.js rendering. */
export function extractRawPathProvenance({operatorList:list,OPS,ids,maxValues=2000000,cancelled=()=>false,optionalContentVisible}={}){
 const requested=Array.isArray(ids)?ids:[],empty=reason=>({version:RAW_PATH_PROVENANCE_VERSION,records:[],failures:requested.map(id=>({id,reason})),complete:false,requestedComplete:false,reason,requiresRenderVerification:true});
 if(!list||!Array.isArray(list.fnArray)||!Array.isArray(list.argsArray)||list.fnArray.length!==list.argsArray.length||list.fnArray.length>1000000||list.fnArray.some(op=>!Number.isInteger(op))||!OPS||!Array.isArray(ids)||!ids.length||ids.length>128||ids.some(id=>!Number.isSafeInteger(id)||id<0||id>=list.fnArray.length)||new Set(ids).size!==ids.length)return empty('Invalid original paint request or operator list');
 if(!Number.isSafeInteger(maxValues)||maxValues<1||maxValues>2000000||typeof cancelled!=='function'||optionalContentVisible!==undefined&&typeof optionalContentVisible!=='function')return empty('Invalid raw path budget or context callback');
 const required=['save','restore','transform','constructPath','stroke','fill','eoFill','endPath','setLineWidth','setLineCap','setLineJoin','setMiterLimit','setDash','setStrokeRGBColor','setFillRGBColor','setGState'];if(required.some(k=>!Number.isInteger(OPS[k])))return empty('Incomplete PDF.js operator mapping');
 const wanted=new Set(ids),seen=new Set(),records=[],failures=[],stack=[],marked=[];
 const fills=new Set(['fill','eoFill','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke'].map(k=>OPS[k]).filter(Number.isInteger)),strokes=new Set(['stroke','closeStroke','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke'].map(k=>OPS[k]).filter(Number.isInteger));
 // These known operations do not alter graphics state used by later paths.
 // Their visible pixels remain present in the required unmodified PDF render.
 const neutral=new Set(['dependency','beginText','endText','setCharSpacing','setWordSpacing','setHScale','setLeading','setFont','setTextRise','moveText','setLeadingMoveText','setTextMatrix','nextLine','showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText','paintImageXObject','paintInlineImageXObject','paintImageMaskXObject','paintImageXObjectRepeat','paintImageMaskXObjectRepeat','paintImageMaskXObjectGroup','paintInlineImageXObjectGroup','shadingFill','markPoint','markPointProps','setRenderingIntent','setFlatness'].map(k=>OPS[k]).filter(Number.isInteger));
 const strokeUnsupported=new Set(['setStrokeColorSpace','setStrokeColor','setStrokeColorN','setStrokeGray','setStrokeCMYKColor','setStrokeTransparent'].map(k=>OPS[k]).filter(Number.isInteger)),fillUnsupported=new Set(['setFillColorSpace','setFillColor','setFillColorN','setFillGray','setFillCMYKColor','setFillTransparent'].map(k=>OPS[k]).filter(Number.isInteger));
 let state={matrix:identity(),width:1,cap:0,join:0,miter:10,dash:[],phase:0,stroke:'#000000',fill:'#000000',strokeAlpha:1,fillAlpha:1,normalBlend:true,softMask:false,transfer:false,unsafe:false,clips:[]},pending=null,storedValues=0;
 const abort=reason=>{throw new Error(reason);},check=()=>{if(cancelled())abort('Raw paint extraction cancelled');};
 const snapshot=(id,a)=>{
  const paint=a[0],fill=fills.has(paint),stroke=strokes.has(paint),reject=(reason,extra={})=>failures.push({id,reason,clipPathIds:state.clips.map(c=>c.pathId),...extra});seen.add(id);
  if(!fill&&!stroke)return reject('Requested id is not a painting path');
  if(marked.some(m=>!m.visible))return reject('Selected paint is hidden by optional content');
  if(state.unsafe||!state.normalBlend||state.softMask||state.transfer||fill&&state.fillAlpha!==1||stroke&&state.strokeAlpha!==1)return reject('Opaque normal graphics-state context is not established');
  if(fill&&!colour(state.fill)||stroke&&!colour(state.stroke))return reject('Flat paint colour is not established');
  if(!Number.isFinite(state.width)||state.width<0||state.width>100000||stroke&&(state.width===0||![0,1,2].includes(state.cap)||![0,1,2].includes(state.join)||!Number.isFinite(state.miter)||state.miter<1||state.miter>1000))return reject('Invalid original stroke state');
  // Hidden/unsafe clipped paths must NOT reach the clip-fill adapter through
  // this specific refusal. Rendering visibility and paint state come first.
  if(pending||state.clips.length)return reject(RAW_PATH_CLIP_REASON,{contextComplete:true,opaque:true,optionalContentVisible:true});
  const raw=a[1]?.[0];if((!Array.isArray(raw)&&!ArrayBuffer.isView(raw))||raw instanceof DataView||!raw.length||raw.length>16384)return reject('Original raw path unavailable; extract before rendering');
  if(Array.from(raw).some(v=>!Number.isFinite(v)||Math.abs(v)>1e8))return reject('Invalid original raw path values');
  storedValues+=raw.length;if(storedValues>maxValues)abort('Raw path storage budget exceeded');
  // Existing strict extraction validates the complete selected path, similarity
  // CTM, native style, curves, widths and subpath closure. This isolated check
  // does not declare the original page supported; the state audit above does
  // not filter unsupported state setters out of the original operator stream.
  const fnArray=[OPS.transform,OPS.setLineWidth,OPS.setLineCap,OPS.setLineJoin,OPS.setMiterLimit,OPS.setDash,OPS.setStrokeRGBColor,OPS.setFillRGBColor,OPS.constructPath],argsArray=[[...state.matrix],[state.width],[state.cap],[state.join],[state.miter],[[...state.dash],state.phase],[state.stroke??'#000000'],[state.fill??'#000000'],a];
  check();const validated=extractVectorPage({operatorList:{fnArray,argsArray},OPS});if(!validated.supported||validated.elements.length!==1)return reject(validated.reason||'Selected path validation failed');
  const e=validated.elements[0];storedValues+=e.pathCommands.length;if(storedValues>maxValues)abort('Raw path storage budget exceeded');
  records.push({id,paintOperator:paint,sourceCommands:Array.from(raw),matrix:[...state.matrix],sourceLineWidth:state.width,pathCommands:[...e.pathCommands],bounds:[...e.bounds],paintClosesPath:e.paintClosesPath,style:{...e.style},clipDepth:0,clipPathIds:[],optionalContentScopes:marked.filter(m=>m.descriptor).map(m=>({operatorId:m.id,descriptor:m.descriptor,visible:m.visible})),wholeOperation:true,opaque:true,contextComplete:true,requiresRenderVerification:true});
 };
 try{
  check();for(let id=0;id<list.fnArray.length;id++){if((id&255)===0)check();const op=list.fnArray[id],a=list.argsArray[id]??[];
   // Marked-content nesting is separate from q/Q. Hidden layers suppress
   // painting, not state setters, transforms or path clipping in PDF.js.
   if(op===OPS.beginMarkedContent||op===OPS.beginMarkedContentProps){
    if(marked.length>=256)abort('Marked-content nesting budget exceeded');if(!Array.isArray(a))abort('Invalid marked-content arguments');
    const props=op===OPS.beginMarkedContentProps,tag=typeof a[0]==='string'?a[0]:!props&&a[0]&&typeof a[0]==='object'&&Object.keys(a[0]).length===1?a[0].name:null;
    if(typeof tag!=='string'||!tag.length||tag.length>256||a.length!==(props?2:1))abort('Malformed marked-content tag');
    if(tag==='OC'){
     if(!props||!optionalContentVisible)abort('Optional-content visibility is unresolved');const descriptor=optionalDescriptor(a[1]),visible=optionalContentVisible(descriptor);if(typeof visible!=='boolean')abort('Optional-content visibility is unresolved');marked.push({id,tag,descriptor,visible});
    }else{if(props&&a[1]!==null&&a[1]!==undefined&&(!Number.isSafeInteger(a[1])||a[1]<0))abort('Unsupported non-optional marked-content properties');marked.push({id,tag,visible:true});}
    continue;
   }
   if(op===OPS.endMarkedContent){if(!Array.isArray(a)||a.length||!marked.length)abort('Unbalanced marked-content nesting');marked.pop();continue;}
   if(op===OPS.save){if(stack.length>=256)abort('Raw paint graphics stack budget exceeded');stack.push(copy(state));continue;}
   if(op===OPS.restore){if(!stack.length)abort('Unbalanced raw paint graphics stack');state=stack.pop();continue;}
   if(op===OPS.transform){if(!finite(a)||a.length!==6)abort('Invalid original CTM');state.matrix=multiply(state.matrix,a);if(!finite(state.matrix))abort('Invalid accumulated CTM');continue;}
   if(op===OPS.setLineWidth){state.width=a[0];continue;}if(op===OPS.setLineCap){state.cap=a[0];continue;}if(op===OPS.setLineJoin){state.join=a[0];continue;}if(op===OPS.setMiterLimit){state.miter=a[0];continue;}
   if(op===OPS.setDash){if(!finite(a[0])||!Number.isFinite(a[1]))abort('Invalid original stroke dash');state.dash=[...a[0]];state.phase=a[1];continue;}
   if(op===OPS.setStrokeRGBColor){state.stroke=colour(a[0])?a[0]:null;continue;}if(op===OPS.setFillRGBColor){state.fill=colour(a[0])?a[0]:null;continue;}
   if(strokeUnsupported.has(op)){state.stroke=null;continue;}if(fillUnsupported.has(op)){state.fill=null;continue;}
   if(op===OPS.setGState){if(!Array.isArray(a[0]))abort('Invalid original graphics state');for(const entry of a[0]){if(!Array.isArray(entry)||entry.length!==2)abort('Invalid original graphics-state entry');const [key,value]=entry;
    if(key==='LW')state.width=value;else if(key==='LC')state.cap=value;else if(key==='LJ')state.join=value;else if(key==='ML')state.miter=value;else if(key==='D'){if(!Array.isArray(value)||!finite(value[0])||!Number.isFinite(value[1]))abort('Invalid graphics-state dash');state.dash=[...value[0]];state.phase=value[1];}
    else if(key==='CA')state.strokeAlpha=value;else if(key==='ca')state.fillAlpha=value;else if(key==='BM')state.normalBlend=value==='source-over';else if(key==='SMask')state.softMask=!!value;else if(key==='TR')state.transfer=!!value;else if(!['RI','FL','Font'].includes(key))state.unsafe=true;
   }continue;}
   if(op===OPS.setTextRenderingMode){if(![0,3].includes(a[0]))abort('Stroked or clipping text requires explicit graphics-state fallback');continue;}
   if(op===OPS.clip||op===OPS.eoClip){if(pending)abort('Multiple pending clips are unsupported');pending={operatorId:id,rule:op===OPS.clip?'nonzero':'evenodd'};continue;}
   if(op===OPS.constructPath){if(!Array.isArray(a)||!fills.has(a[0])&&!strokes.has(a[0])&&a[0]!==OPS.endPath)abort('Unknown original path painting operation');if(wanted.has(id))snapshot(id,a);if(pending){if(state.clips.length>=64)abort('Raw paint clip stack budget exceeded');state.clips.push({...pending,pathId:id});pending=null;}continue;}
   if(neutral.has(op))continue;
   // Forms, groups, annotations, optional-content and unknown operators can
   // alter transforms/visibility; never blanket-skip them to recover records.
   abort('Unsupported original operator '+op+' prevents complete paint context');
  }
  if(stack.length||pending||marked.length)abort('Unbalanced original paint, clip or marked-content context');check();for(const id of ids)if(!seen.has(id))failures.push({id,reason:'Requested id is not a constructPath paint'});
  return {version:RAW_PATH_PROVENANCE_VERSION,records,failures,complete:false,requestedComplete:failures.length===0,storedValues,requiresRenderVerification:true};
 }catch(error){return empty(error instanceof Error?error.message:'Raw paint provenance failed');}
}
