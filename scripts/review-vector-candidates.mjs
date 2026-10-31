// Read-only recognition review. This command never opens an application store.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument,OPS,version} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {renderMatchSelection} from '../apps/local/web/pdf-match-tiles.mjs';
import {inkImage,exampleImage} from '../apps/local/web/matcher.mjs';
import {validElementSelection} from '../apps/local/web/pdf-elements.mjs';
import {runVectorCandidateReview} from '../apps/local/web/vector-candidate-search.mjs';

const help='Usage: node scripts/review-vector-candidates.mjs --pdf drawing.pdf --selection saved-example.json --out review.json [--source-layer]\nRead-only, same-page candidate review at the original size with quarter-turn rotations; no quantities or saved matching policies are changed. The selection must contain the original digest, page, bounds and elements.ids/excluded. --source-layer explicitly limits proposals to the retained symbol\'s PDF layer; original verification still renders all visible layers.';
export async function reviewVectorFile({pdfPath,selectionPath,outputPath,sourceLayerScope=false,cancelled=()=>false,progress=()=>{}}){
 const check=()=>{if(cancelled())throw Error('Candidate review cancelled; no report saved');};check();
 if(!pdfPath||!selectionPath||!outputPath)throw Error(help);
 if((await stat(pdfPath)).size>25*1024*1024)throw Error('PDF exceeds the 25 MiB review limit');
 if((await stat(selectionPath)).size>65536)throw Error('Selection exceeds the review input limit');
 // Fail before expensive work when the destination exists. Exclusive creation
 // at publication also protects against a destination appearing during review.
 try{await stat(outputPath);throw Error('Output already exists; choose a new report path');}catch(error){if(error.code!=='ENOENT')throw error;}
 const [bytes,json]=await Promise.all([readFile(pdfPath),readFile(selectionPath,'utf8')]);check();
 if(bytes.length>25*1024*1024||Buffer.byteLength(json)>65536)throw Error('Review input grew beyond its limit');
 const input=JSON.parse(json),example=input.example??input,digest=createHash('sha256').update(bytes).digest('hex');
 if(example.digest!==digest)throw Error('Selection digest does not match the original PDF');
 if(!Number.isSafeInteger(example.page)||example.page<1||!Array.isArray(example.bounds)||example.bounds.length!==4||!example.bounds.every(Number.isFinite)||example.bounds[2]<=example.bounds[0]||example.bounds[3]<=example.bounds[1])throw Error('Invalid saved selection page or bounds');
 const elements=example.elements;
 if(!validElementSelection(elements))throw Error('Review requires compatible original selection element IDs and explicit exclusions');
 const options={isEvalSupported:false,standardFontDataUrl:new URL('../node_modules/pdfjs-dist/standard_fonts/',import.meta.url).pathname,cMapUrl:new URL('../node_modules/pdfjs-dist/cmaps/',import.meta.url).pathname,cMapPacked:true,wasmUrl:new URL('../node_modules/pdfjs-dist/wasm/',import.meta.url).pathname};
 async function open(){
  check();const task=getDocument({...options,data:new Uint8Array(bytes)});let timer;
  try{const doc=await Promise.race([task.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PDF opening timed out')),20000);})]);check();if(doc.numPages>200||example.page>doc.numPages)throw Error('PDF page scope exceeds the review limit');return{task,doc};}
  catch(error){await task.destroy().catch(()=>{});throw error;}finally{clearTimeout(timer);}
 }
 // Exactly the existing application's unfiltered, trimmed-raster anchor. A
 // separate document keeps original operators pristine on the proof page.
 let anchor;const original=await open();
 try{const page=await original.doc.getPage(example.page),viewport=page.getViewport({scale:2,rotation:0});let cancellationTimer,image;
  try{image=await renderMatchSelection({page,viewport,bounds:example.bounds,createCanvas,cancelled,onRender:task=>{cancellationTimer=setInterval(()=>{if(cancelled())task.cancel();},25);}});}finally{clearInterval(cancellationTimer);}
  check();const a=image.viewport.convertToViewportPoint(example.bounds[0],example.bounds[3]),b=image.viewport.convertToViewportPoint(example.bounds[2],example.bounds[1]);
  const base=exampleImage(inkImage(image.data,image.width,image.height),[...a,...b]);anchor=image.viewport.convertToPdfPoint(base.left+base.width/2,base.top+base.height/2);
 }finally{await original.task.destroy();}
 check();const proof=await open();let report;
 try{const page=await proof.doc.getPage(example.page),optionalContentConfig=await proof.doc.getOptionalContentConfig({intent:'display'});
  const result=await runVectorCandidateReview({page,OPS,optionalContentConfig,documentSha256:digest,selection:{page:example.page,bounds:[...example.bounds],anchor,ids:[...elements.ids],excluded:[...elements.excluded]},sourceLayerScope,createCanvas,pdfjsVersion:version,cancelled,progress});
  check();if(!result.completed)throw Error(result.reason||'Candidate review did not complete');
  report={format:'vector-candidate-review-file-1',scope:'Read-only same-page review; proposals and paint visibility are not accepted quantities or class approval',pdfSha256:digest,page:example.page,sourceLayerScope,reviewPolicy:{scale:1,rotations:[0,90,180,270],geometryTolerance:.05,savedAlgorithmUnchanged:example.algorithm??null},result};
 }finally{await proof.task.destroy();}
 check();await writeFile(outputPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
async function main(args){
 if(args.length===1&&args[0]==='--help'){console.log(help);return;}
 const options={};for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--source-layer'){if(options.sourceLayerScope)throw Error(help);options.sourceLayerScope=true;}else{const key=({'--pdf':'pdfPath','--selection':'selectionPath','--out':'outputPath'})[flag];if(!key||options[key]||!args[i+1]||args[i+1].startsWith('--'))throw Error(help);options[key]=args[++i];}}
 let interrupted=false;const interrupt=()=>{interrupted=true;};process.once('SIGINT',interrupt);
 try{const report=await reviewVectorFile({...options,cancelled:()=>interrupted,progress:({phase,completed,total})=>process.stderr.write(JSON.stringify({phase,completed,total})+'\n')});console.log(JSON.stringify({completed:true,proposals:report.result.proposals.length,verifiedPaint:report.result.proposals.filter(p=>p.visibility?.verified).length,quantitiesSaved:0}));}
 finally{process.removeListener('SIGINT',interrupt);}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
