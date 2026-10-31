// Bounded pixel-presence proof, NOT recognition or source/target equivalence.
// The caller supplies a complete original-paint inventory and an UNMODIFIED PDF
// raster crop. Flags attest extraction provenance; this module cannot establish
// the origin of caller-supplied pixels. Unselected extra detail is not examined.
export const CONTOUR_VISIBILITY_VERSION='contour-paint-visibility-4';
export const CONTOUR_PDFJS_VERSION='6.4.299';
export const CONTOUR_RASTER_CONTRACT='pdfjs-6.4.299-readback-srgb-unorm8-1';
export const CONTOUR_CONTEXT_OPTIONS=Object.freeze({alpha:true,colorSpace:'srgb',colorType:'unorm8',desynchronized:false,willReadFrequently:true});
const LIMIT=256,MAX_VALUES=32768,EPS=1e-7;
const finite=a=>Array.isArray(a)&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e8);
const colour=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
const point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
class ContourRefusal extends Error {}
const fail=reason=>{throw new ContourRefusal(reason);};
function validCrop(image){
 return !!image&&Number.isInteger(image.width)&&Number.isInteger(image.height)&&image.width>=1&&image.height>=1&&image.width<=LIMIT&&image.height<=LIMIT&&Number.isSafeInteger(image.left)&&Number.isSafeInteger(image.top)&&Math.abs(image.left)<=1e8&&Math.abs(image.top)<=1e8;
}
function readbackAttributes(context){
 if(typeof context?.getContextAttributes!=='function')fail('Canvas cannot establish the readback rendering contract');
 const actual=context.getContextAttributes();
 if(!actual||Object.entries(CONTOUR_CONTEXT_OPTIONS).some(([key,value])=>actual[key]!==value))fail('Canvas does not use the required readback rendering contract');
 return {...CONTOUR_CONTEXT_OPTIONS};
}
function checkRasterContract(rendering){
 if(rendering?.contract!==CONTOUR_RASTER_CONTRACT||rendering.pdfjsVersion!==CONTOUR_PDFJS_VERSION||!rendering.context||Object.entries(CONTOUR_CONTEXT_OPTIONS).some(([key,value])=>rendering.context[key]!==value))fail('Original raster has no compatible readback rendering contract');
}
/**
 * Capture immediately after a successful unmodified PDF.js crop render. The
 * caller remains responsible for original-PDF provenance and renderer version.
 * Default display canvases are NOT interchangeable with recognition readback
 * canvases: Chrome can rasterize their antialiased geometry differently.
 */
export function captureContourRaster({context,left,top,width,height,pdfjsVersion}={}){
 if(pdfjsVersion!==CONTOUR_PDFJS_VERSION)fail('Contour raster requires the pinned PDF.js renderer version');
 if(!validCrop({left,top,width,height})||context?.canvas?.width!==width||context?.canvas?.height!==height)fail('Invalid or oversized original RGBA crop');
 const attributes=readbackAttributes(context),image=context.getImageData(0,0,width,height);
 if(!(image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray)||image.data.length!==width*height*4)fail('Invalid original RGBA pixels');
 return {data:image.data,width,height,left,top,rendering:{contract:CONTOUR_RASTER_CONTRACT,pdfjsVersion,context:attributes}};
}
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function uniformScale(m){
 const x=Math.hypot(m[0],m[1]),y=Math.hypot(m[2],m[3]);
 if(!Number.isFinite(x)||x<=0||Math.abs(x-y)>1e-8*Math.max(x,y)||Math.abs(m[0]*m[2]+m[1]*m[3])>1e-8*x*y)fail('Nonuniform stroke transforms require another renderer');
 return x;
}
function matrix(m){
 if(!finite(m)||m.length!==6||Math.abs(m[0]*m[3]-m[1]*m[2])<1e-12)fail('Invalid or singular paint transform');
 return m;
}
function extent(points){
 const b=[Infinity,Infinity,-Infinity,-Infinity];
 for(const [x,y] of points){if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e8||Math.abs(y)>1e8)fail('Invalid transformed paint coordinates');b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
 return b;
}
function checkBounds(actual,supplied){
 if(!finite(supplied)||supplied.length!==4||actual.some((v,i)=>Math.abs(v-supplied[i])>EPS))fail('Paint bounds do not cover the complete original path');
}
function commands(raw,budget,{polygon=false}={}){
 if(!Array.isArray(raw)&&!ArrayBuffer.isView(raw)||raw instanceof DataView||!raw.length)fail('Missing original path commands');
 budget.values+=raw.length;if(budget.values>MAX_VALUES)fail('Paint command budget exceeded');
 const points=[],vertices=[];let begun=false,closed=false,moves=0;
 for(let i=0;i<raw.length;){
  budget.check();const op=raw[i++],n=({0:2,1:2,2:6,3:4,4:0})[op];
  if(n===undefined||i+n>raw.length||op!==0&&!begun||polygon&&(op!==0&&op!==1&&op!==4||closed))fail('Unsupported original path command');
  if(op===0){begun=true;moves++;}
  if(op===4)closed=true;
  for(let j=0;j<n;j+=2){const x=raw[i+j],y=raw[i+j+1];if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1e8||Math.abs(y)>1e8)fail('Invalid original path coordinates');points.push([x,y]);if(polygon)vertices.push([x,y]);}
  i+=n;
 }
 if(!begun||!points.length)fail('Empty original path');
 if(polygon){
  if(moves!==1||!closed||vertices.length<3||vertices.length>1024)fail('Only a bounded single closed clip polygon is supported');
  if(vertices.length>1&&vertices[0].every((v,i)=>v===vertices.at(-1)[i]))vertices.pop();
  if(vertices.length<3)fail('Empty clip polygon');
 }
 return {raw,points,vertices};
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,p)=>Math.abs(cross(a,b,p))<=EPS&&p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
function simplePolygon(vertices,budget){
 let area=0;
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length];
  if(a.every((v,k)=>v===b[k]))fail('Repeated clip vertex');
  area+=a[0]*b[1]-b[0]*a[1];
  for(let j=i+1;j<vertices.length;j++){
   if(j===i+1||i===0&&j===vertices.length-1)continue;
   if(++budget.pairs>100000)fail('Clip intersection budget exceeded');budget.check();
   const c=vertices[j],d=vertices[(j+1)%vertices.length];
   if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))fail('Self-intersecting or touching clip polygon');
  }
 }
 if(Math.abs(area)<=EPS)fail('Empty clip polygon');
}
function trace(ctx,raw){
 ctx.beginPath?.();for(let i=0;i<raw.length;){switch(raw[i++]){
  case 0:ctx.moveTo(raw[i++],raw[i++]);break;
  case 1:ctx.lineTo(raw[i++],raw[i++]);break;
  case 2:ctx.bezierCurveTo(raw[i++],raw[i++],raw[i++],raw[i++],raw[i++],raw[i++]);break;
  case 3:ctx.quadraticCurveTo(raw[i++],raw[i++],raw[i++],raw[i++]);break;
  case 4:ctx.closePath();break;
 }}
}
function prepare(p,budget,viewport){
 if(!p||!Number.isInteger(p.id)||p.id<0||p.id>1000000||p.wholeOperation!==true||p.opaque!==true||p.contextComplete!==true)fail('Incomplete whole-operation paint provenance');
 const allowed=p.kind==='path'?['kind','id','bounds','pathCommands','paintClosesPath','style','rawPath','wholeOperation','opaque','contextComplete','clipDepth']:['kind','id','bounds','fill','clipRule','clip','paint','clipPathId','clipOperatorId','wholeOperation','opaque','contextComplete','clipDepth'];
 if(Object.keys(p).some(k=>!allowed.includes(k)))fail('Unverified paint context fields');
 if(p.kind==='path'){
  if(p.clipDepth!==0||p.clip!==undefined||p.clips!==undefined)fail('Unverified clipping on native path');
  const c=commands(p.pathCommands,budget),s=p.style;
  if(typeof p.paintClosesPath!=='boolean'||!s||!['nonzero','evenodd'].includes(s.rule)||s.fill!==null&&!colour(s.fill)||s.stroke!==null&&!colour(s.stroke)||!s.fill&&!s.stroke)fail('Invalid native paint style');
  if(s.stroke&&(!Number.isFinite(s.width)||s.width<=0||s.width>100000||![0,1,2].includes(s.cap)||![0,1,2].includes(s.join)||!Number.isFinite(s.miter)||s.miter<1||s.miter>1000))fail('Unsupported stroke style');
  // Only opaque flat colours, no dash/alpha/blend/transform overrides.
  if(Object.keys(s).some(k=>!['fill','stroke','width','cap','join','miter','rule'].includes(k)))fail('Unverified native paint style effects');
  const b=extent(c.points);checkBounds(b,p.bounds);
  let raw=c.raw,renderPoints=c.points,rawMatrix=null,transformChain=null,sourceWidth=s.width;
  if(p.rawPath!==undefined){
   const r=p.rawPath;if(!r||Object.keys(r).some(k=>!['sourceCommands','matrix','sourceLineWidth','transformChain'].includes(k)))fail('Unverified raw path effects');
   rawMatrix=matrix(r.matrix);const source=commands(r.sourceCommands,budget);raw=source.raw;renderPoints=source.points;
   if(r.transformChain!==undefined){
    if(!Array.isArray(r.transformChain)||r.transformChain.length>256)fail('Invalid or oversized original transform chain');
    budget.transformValues+=r.transformChain.length*6;if(budget.transformValues>4096)fail('Original transform-chain budget exceeded');
    let composed=[1,0,0,1,0,0];transformChain=r.transformChain.map(value=>{budget.check();const step=[...matrix(value)];composed=multiply(composed,step);matrix(composed);return step;});
    if(composed.some((value,i)=>Math.abs(value-rawMatrix[i])>EPS))fail('Original transform chain does not reproduce raw matrix');
   }
   if(raw.length!==c.raw.length)fail('Raw and native path identities differ');
   for(let i=0;i<raw.length;){const op=raw[i],n=({0:2,1:2,2:6,3:4,4:0})[op];if(c.raw[i]!==op)fail('Raw and native path commands differ');i++;for(let j=0;j<n;j+=2){const v=point(rawMatrix,raw[i+j],raw[i+j+1]);if(v.some((value,k)=>Math.abs(value-c.raw[i+j+k])>EPS))fail('Raw transform does not reproduce native path');}i+=n;}
   if(s.stroke){sourceWidth=r.sourceLineWidth;if(!Number.isFinite(sourceWidth)||sourceWidth<=0||Math.abs(sourceWidth*uniformScale(rawMatrix)-s.width)>EPS)fail('Raw and native stroke widths differ');}
  }
  // PDF.js 6.4.299 getScaleForStroking/rescaleAndStroke uses at least one
  // device pixel for uniform transforms. Preserve the raw CTM's raster phase.
  const nativeWidth=s.stroke?Math.max(s.width,1/uniformScale(viewport)):0;
  const pad=s.stroke?nativeWidth/2*Math.max(Math.SQRT2,s.miter):0;
  if(typeof globalThis.Path2D!=='function')fail('Native Path2D rendering unavailable');
  const path=new globalThis.Path2D();trace(path,raw);if(p.paintClosesPath)path.closePath();
  return {bounds:[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad],draw(ctx){
   // Canvas rounds sequential transforms. The algebraic aggregate establishes
   // geometry identity but cannot reproduce original raster phase by itself.
   if(transformChain){for(const step of transformChain)ctx.transform(...step);}else if(rawMatrix)ctx.transform(...rawMatrix);
   const dm=ctx.getTransform(),deviceMatrix=[dm.a,dm.b,dm.c,dm.d,dm.e,dm.f],deviceScale=s.stroke?uniformScale(deviceMatrix):1;
   const renderWidth=s.stroke?sourceWidth*Math.max(1,1/(sourceWidth*deviceScale)):0;
   // Sequential Canvas rounding must not move a remote part outside the crop.
   const actual=extent(renderPoints.map(v=>point(deviceMatrix,...v))),margin=renderWidth*deviceScale/2*Math.max(Math.SQRT2,s.miter??1);
   if(actual[0]-margin<1-EPS||actual[1]-margin<1-EPS||actual[2]+margin>ctx.canvas.width-1+EPS||actual[3]+margin>ctx.canvas.height-1+EPS)fail('Actual complete painted footprint does not fit the verification crop');
   if(s.fill){ctx.fillStyle=s.fill;ctx.fill(path,s.rule);}
   if(s.stroke){ctx.strokeStyle=s.stroke;ctx.lineWidth=renderWidth;ctx.lineCap=['butt','round','square'][s.cap];ctx.lineJoin=['miter','round','bevel'][s.join];ctx.miterLimit=s.miter;ctx.stroke(path);}
  }};
 }
 if(p.kind!=='clip-fill'||p.clipDepth!==1||p.clips!==undefined||!colour(p.fill)||!['nonzero','evenodd'].includes(p.clipRule))fail('Unsupported paint or clip context');
 if(!p.clip||!p.paint)fail('Missing raw clip and covering paint');
 if(!Number.isInteger(p.clipOperatorId)||p.clipOperatorId<0||!Number.isInteger(p.clipPathId)||p.clipPathId<=p.clipOperatorId||p.clipPathId>=p.id)fail('Missing or unordered original clip identities');
 if([p.clip,p.paint].some(part=>Object.keys(part).some(k=>!['sourceCommands','matrix','commands'].includes(k))))fail('Unverified nested clip or paint effects');
 const cm=matrix(p.clip.matrix),pm=matrix(p.paint.matrix),clip=commands(p.clip.sourceCommands,budget,{polygon:true}),paint=commands(p.paint.sourceCommands,budget,{polygon:true});
 const cv=clip.vertices.map(v=>point(cm,...v)),pv=paint.vertices.map(v=>point(pm,...v));simplePolygon(cv,budget);simplePolygon(pv,budget);
 const cb=extent(cv),pb=extent(pv);checkBounds(cb,p.bounds);
 if(pv.length!==4||pv.some(([x,y])=>![pb[0],pb[2]].includes(x)||![pb[1],pb[3]].includes(y))||pv.some((a,i)=>{const b=pv[(i+1)%4];return a[0]!==b[0]&&a[1]!==b[1];})||pb[0]>cb[0]||pb[1]>cb[1]||pb[2]<cb[2]||pb[3]<cb[3])fail('Clip paint is not a complete covering rectangle');
 return {bounds:cb,draw(ctx){
  // Restore the viewport transform after establishing the clip, while retaining
  // that clip. Never flatten paths: separate raw CTMs preserve PDF pixel phase.
  const base=ctx.getTransform();ctx.transform(...cm);trace(ctx,clip.raw);ctx.clip(p.clipRule);ctx.setTransform(base);ctx.transform(...pm);trace(ctx,paint.raw);ctx.fillStyle=p.fill;ctx.fill('nonzero');
 }};
}
/**
 * image.left/top are integer GLOBAL device-pixel origins, not PDF coordinates.
 * Original raster must be opaque at every retained foreground pixel. AA bounds
 * are rendered on black/white backgrounds, preserving integer compositing
 * roundoff; they are NOT inferred from rounded transparent RGB values. Opaque
 * pixels still require a per-channel difference <=1, with no aggregate budget.
 * Context IDs must already be validated against explicit source exclusions by
 * the caller. Context cannot supply required symbol pixels or entirely cover a
 * retained component. Partial contextual occlusion still needs semantic review.
 * This does not detect extra target details or establish source/target class
 * equivalence. Retained operations may overlap one another.
 * Rendering metadata is an explicit caller contract, not cryptographic proof
 * that supplied pixels came from the stated PDF. Use captureContourRaster.
 */
export function verifyContourVisibility({paints,contextPaints=[],authorizedContextIds=[],viewportTransform,image,createCanvas,cancelled=()=>false,includeAlphaMask=false}={}){
 const diagnostics={paintCount:0,contextPaintCount:0,foregroundPixels:0,opaquePixels:0,antialiasPixels:0,mismatchedPixels:0};let canvas,executionStage;
 try{
  if(typeof cancelled!=='function')fail('Invalid cancellation callback');
  if(typeof includeAlphaMask!=='boolean')fail('Invalid alpha-mask option');
  const check=()=>{if(cancelled())fail('Contour visibility cancelled');};check();
  const m=matrix(viewportTransform);
  if(!validCrop(image)||!(image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray)||image.data.length!==image.width*image.height*4)fail('Invalid or oversized original RGBA crop');
  checkRasterContract(image.rendering);
  if(!Array.isArray(paints)||!paints.length||paints.length>128||typeof createCanvas!=='function')fail('Invalid paint collection or canvas factory');
  if(!Array.isArray(contextPaints)||contextPaints.length>16||paints.length+contextPaints.length>128||!Array.isArray(authorizedContextIds)||authorizedContextIds.length!==contextPaints.length||new Set(authorizedContextIds).size!==authorizedContextIds.length||contextPaints.some(p=>!authorizedContextIds.includes(p?.id)))fail('Context paints need exact explicit source-authorized identities');
  const budget={values:0,pairs:0,transformValues:0,check},prepared=[],allIds=new Set();
  for(const [collection,context] of [[paints,false],[contextPaints,true]]){let last=-1;
   for(const p of collection){check();if(p?.id<=last||allIds.has(p?.id))fail('Paint identities must be unique and in original order');const entry=prepare(p,budget,m);last=p.id;allIds.add(p.id);
   const b=entry.bounds,corners=[[b[0],b[1]],[b[0],b[3]],[b[2],b[1]],[b[2],b[3]]].map(v=>point(m,...v)),v=extent(corners);
   // Reserve a pixel for antialiasing: partial-operation crops cannot certify
   // a convenient fragment while silently omitting a remote tail.
   if(v[0]<image.left+1-EPS||v[1]<image.top+1-EPS||v[2]>image.left+image.width-1+EPS||v[3]>image.top+image.height-1+EPS)fail('Complete painted footprint does not fit the verification crop');
    prepared.push({...entry,id:p.id,context});
   }
  }
  prepared.sort((a,b)=>a.id-b.id);const retained=prepared.filter(p=>!p.context),contexts=prepared.filter(p=>p.context);
  diagnostics.paintCount=retained.length;diagnostics.contextPaintCount=contexts.length;
  executionStage='canvas';canvas=createCanvas(image.width,image.height);if(!canvas||canvas.width!==image.width||canvas.height!==image.height)fail('Canvas dimensions differ from verification crop');
  // Reset also removes a stale clipping region if a factory reuses a canvas.
  canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',CONTOUR_CONTEXT_OPTIONS);if(!ctx)fail('Canvas rendering unavailable');readbackAttributes(ctx);executionStage=null;
  function render(entries,background=null){
   executionStage='render';
   check();ctx.resetTransform();ctx.clearRect(0,0,image.width,image.height);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.setLineDash([]);if(background){ctx.fillStyle=background;ctx.fillRect(0,0,image.width,image.height);}
   for(const p of entries){check();ctx.save();try{ctx.resetTransform();ctx.transform(1,0,0,1,-image.left,-image.top);ctx.transform(...m);p.draw(ctx);}finally{ctx.restore();}}
   check();executionStage='readback';const data=ctx.getImageData(0,0,image.width,image.height).data;executionStage=null;return data;
  }
  // A source-authorized context is explanatory paint, never replacement symbol
  // ink. Detect a context that erases all opaque support of any retained part.
  for(const p of retained){const later=contexts.filter(c=>c.id>p.id);if(!later.length)continue;const own=render([p]),cover=render(later);let core=0,remainingCore=0,remainingSupport=0;
   for(let i=3;i<own.length;i+=4){if((i&4095)===3)check();if(own[i]===255){core++;if(cover[i]<255)remainingCore++;}if(own[i]*(255-cover[i])/255>1)remainingSupport++;}
   if(!remainingSupport||core&&!remainingCore)fail('Context obscures an entire retained component');
  }
  const required=render(retained),expected=contexts.length?render(prepared):required,black=render(prepared,'#000000'),white=render(prepared,'#ffffff');
  for(let i=0;i<expected.length;i+=4){if((i&4095)===0)check();const a=required[i+3];if(!a)continue;diagnostics.foregroundPixels++;let compatible=image.data[i+3]===255;
   if(a===255){diagnostics.opaquePixels++;for(let c=0;c<3;c++)if(Math.abs(expected[i+c]-image.data[i+c])>1)compatible=false;}
   else{diagnostics.antialiasPixels++;for(let c=0;c<3;c++){const lower=Math.min(black[i+c],white[i+c]),upper=Math.max(black[i+c],white[i+c]),value=image.data[i+c];if(value<lower-1||value>upper+1)compatible=false;}}
   if(!compatible)diagnostics.mismatchedPixels++;
  }
  check();if(!diagnostics.foregroundPixels||!diagnostics.opaquePixels)fail('Paint has no opaque detail to verify');
  if(diagnostics.mismatchedPixels)fail('Original raster does not preserve retained paint');
  const alphaMask=includeAlphaMask?{left:image.left,top:image.top,width:image.width,height:image.height,alpha:Uint8Array.from({length:image.width*image.height},(_,i)=>required[i*4+3])}:undefined;
  if(includeAlphaMask)check();return {verified:true,proof:CONTOUR_VISIBILITY_VERSION,requiresSemanticVerification:true,requiresContextVerification:contexts.length>0,diagnostics,...includeAlphaMask?{alphaMask}:{}};
 // Unexpected renderer failures must not look like ordinary pixel refusals to
 // callers accumulating review proposals. Validation can also run inside draw;
 // its private error type keeps those bounded refusals distinct from execution.
 }catch(error){return {verified:false,proof:null,reason:error instanceof Error?error.message:'Contour visibility failed',...(!(error instanceof ContourRefusal)?{executionFailure:executionStage??'verification'}:{}),diagnostics};}
 finally{if(canvas){try{canvas.width=canvas.height=0;}catch{/* No retained canvas after verification. */}}}
}
