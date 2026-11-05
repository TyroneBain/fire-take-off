// Verified original glyph alpha for explicitly applied, page-bound native decisions.
// Colour is supplied by the existing CSS overlay, never baked into this mask.
import {vectorReviewAppliesToPage,vectorReviewPage,validVectorReview} from './vector-review-policy.mjs';
import {preparePdfContourPaints,verifyPdfContourPaints} from './pdf-contour-verification.mjs';
export function nativeDecisionForMark({mark,example,drawing,pageNumber}){
 const def=example?.example;
 if(!drawing||!mark?.included||mark.origin!=='automatic'||mark.example_id!==example?.id||mark.drawing_id!==drawing.id||mark.page!==pageNumber||!vectorReviewAppliesToPage(def,drawing.id,pageNumber)||!validVectorReview(def.vectorReview)||def.algorithm!==def.vectorReview.version||!Number.isFinite(mark.x)||!Number.isFinite(mark.y))return null;
 const bundle=vectorReviewPage(def,drawing.id,pageNumber);if(!bundle||bundle.digest!==drawing.digest)return null;
 const found=bundle.decisions.filter(d=>Math.abs(d.x-mark.x)<.5&&Math.abs(d.y-mark.y)<.5);return found.length===1&&found[0].included?found[0]:null;
}
export async function prepareNativeCountInk({pdfjs,drawing,pageNumber,marks,examples,createCanvas,cancelled=()=>false,maxMilliseconds=120000}={}){
 if(!pdfjs||typeof pdfjs.getDocument!=='function'||!pdfjs.OPS||typeof createCanvas!=='function'||typeof cancelled!=='function'||!Array.isArray(marks)||marks.length>128||new Set(marks.map(m=>m.id)).size!==marks.length||!Array.isArray(examples)||examples.length>5000||!Number.isInteger(pageNumber)||pageNumber<1||typeof drawing?.id!=='string'||typeof drawing.digest!=='string'||!/^[a-f0-9]{64}$/.test(drawing.digest)||!Number.isSafeInteger(maxMilliseconds)||maxMilliseconds<1||maxMilliseconds>120000)throw Error('Invalid native glyph batch');
 const deadline=performance.now()+maxMilliseconds,check=()=>{if(cancelled())throw Error('Native glyph preparation cancelled');if(performance.now()>=deadline)throw Error('Native glyph preparation timed out');},byId=new Map(examples.map(e=>[e.id,e])),masks=new Map(marks.map(m=>[m.id,null])),refusals=[],selected=[];
 check();for(const mark of marks){const example=byId.get(mark.example_id),decision=nativeDecisionForMark({mark,example,drawing,pageNumber});if(decision)selected.push({mark,decision});else refusals.push({markId:mark.id,reason:'No unambiguous included native decision on the original page'});}
 if(!selected.length)return{masks,refusals};
 const task=pdfjs.getDocument({url:`/api/drawings/${encodeURIComponent(drawing.id)}/source`,isEvalSupported:false,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/',wasmUrl:'/vendor/wasm/'});let activeRender,output;
 const wait=(promise,label)=>new Promise((resolve,reject)=>{let done=false;const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);error?reject(error):resolve(value);},poll=setInterval(()=>{try{check();}catch(error){finish(error);}},25),timer=setTimeout(()=>finish(Error(label+' timed out')),Math.max(1,Math.min(20000,Math.ceil(deadline-performance.now()))));Promise.resolve(promise).then(value=>{try{check();finish(null,value);}catch(error){finish(error);}},error=>finish(error));});
 try{
  const doc=await wait(task.promise,'Native PDF opening'),page=await wait(doc.getPage(pageNumber),'Native page opening'),config=await wait(doc.getOptionalContentConfig({intent:'display'}),'Native layer configuration'),hash=config.getHash(),viewport=page.getViewport({scale:2,rotation:0}),prepared=[];
  const current=()=>{check();if(config.getHash()!==hash)throw Error('Native layer configuration changed');};
  for(const row of selected){current();const handle=await preparePdfContourPaints({page,OPS:pdfjs.OPS,elementIds:row.decision.elementIds,contextIds:row.decision.contextIds??[],optionalContentConfig:config,cancelled:()=>{current();return false;}});current();prepared.push({...row,handle});if(prepared.length%8===0){await new Promise(resolve=>setTimeout(resolve,0));current();}}
  // No PDF rendering has occurred before every original-ID handle is prepared.
  for(const {mark,handle}of prepared){current();if(!handle.supported){refusals.push({markId:mark.id,reason:handle.reason});continue;}let timer,poll,proof;
   try{proof=await verifyPdfContourPaints({prepared:handle,createCanvas,pdfjsVersion:pdfjs.version,includeAlphaMask:true,cancelled:()=>{current();return false;},onRender:render=>{clearTimeout(timer);clearInterval(poll);activeRender=render;const stop=()=>{try{current();}catch{render.cancel();}};timer=setTimeout(stop,Math.max(1,Math.ceil(deadline-performance.now())));poll=setInterval(stop,25);stop();}});}
   finally{clearTimeout(timer);clearInterval(poll);activeRender=null;}
   current();if(proof.executionFailure)throw Error('Native glyph execution failed: '+proof.reason);if(!proof.verified){refusals.push({markId:mark.id,reason:proof.reason});continue;}
   const alpha=proof.alphaMask;if(!alpha||!(alpha.alpha instanceof Uint8Array)||alpha.alpha.length!==alpha.width*alpha.height||alpha.width>256||alpha.height>256||![2,8].includes(proof.verificationScale??2))throw Error('Verified native alpha is unavailable');
   const maskViewport=proof.verificationScale===8?page.getViewport({scale:8,rotation:0}):viewport;
   let canvas;try{canvas=createCanvas(alpha.width,alpha.height);current();const ctx=canvas.getContext('2d'),rgba=ctx.createImageData(alpha.width,alpha.height);for(let i=0;i<alpha.alpha.length;i++)rgba.data[i*4+3]=alpha.alpha[i];ctx.putImageData(rgba,0,0);const url=canvas.toDataURL('image/png');current();masks.set(mark.id,{left:alpha.left,top:alpha.top,width:alpha.width,height:alpha.height,url,viewport:maskViewport});}finally{if(canvas)canvas.width=canvas.height=0;}
   await new Promise(resolve=>setTimeout(resolve,0));current();
  }
  current();output={masks,refusals};
 }finally{activeRender?.cancel();await task.destroy();}
 check();return output;
}
