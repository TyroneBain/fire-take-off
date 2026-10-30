import {createVectorTemplate} from './vector-recognition.mjs';
import {inkImage,exampleImage,isVectorAlgorithm,includesRotations,includesScales,matchingThreshold} from './matcher.mjs';
import {editedTemplate} from './pdf-elements.mjs';
import {isAppearanceAlgorithm} from './appearance-policy.mjs';
import {appearanceTemplate} from './appearance-template.mjs';
// Rendering and worker execution are injected, so the same orchestration is tested against actual PDFs in Node.
export async function recognizeDrawing({state,target,render,search,cancelled=()=>false,progress=()=>{}}){
 const headings=new Map(state.countItems.filter(i=>i.discipline_id===target.discipline_id).map(i=>[i.id,i]));
 const examples=state.countExamples.filter(e=>headings.has(e.item_id)).sort((a,b)=>a.created.localeCompare(b.created)||a.id.localeCompare(b.id));
 if(!examples.length)throw new Error('Save a symbol selection in this discipline first');if(examples.length>50||target.pages.length>20)throw new Error('Recount supports at most 50 selections and 20 pages');
 const check=()=>{if(cancelled())throw new Error('Recount cancelled; no results saved');};let count=0;const results=[];
 for(const e of examples){check();const def=e.example,source=state.drawings.find(d=>d.id===def.drawing_id&&d.digest===def.digest);if(!source)throw new Error('Selection source is missing or changed');if(def.algorithm==='binary-elements-1')throw new Error('Re-edit legacy cleaned selections before recounting');
  const appearance=isAppearanceAlgorithm(def.algorithm);if(appearance&&def.elements!==undefined)throw Error('Colour and fine-detail matching does not support cleaned selections');
  const original=await render(source,def.page,undefined,def.bounds),a=original.viewport.convertToViewportPoint(def.bounds[0],def.bounds[3]),b=original.viewport.convertToViewportPoint(def.bounds[2],def.bounds[1]),box=[...a,...b];check();
  let template=exampleImage(inkImage(original.data,original.width,original.height),box);
  const baseTemplate=template;
  if(def.elements){const filtered=await render(source,def.page,def.elements,def.bounds);check();template=editedTemplate(inkImage(original.data,original.width,original.height),inkImage(filtered.data,filtered.width,filtered.height),box);}
  if(appearance)template=appearanceTemplate(original,baseTemplate);
  template.matchAppearance=appearance;
  template.matchRotations=includesRotations(def.algorithm);template.matchScales=includesScales(def.algorithm);template.matchThreshold=matchingThreshold(def.algorithm);
  if(isVectorAlgorithm(def.algorithm)){const anchor=original.viewport.convertToPdfPoint(baseTemplate.left+baseTemplate.width/2,baseTemplate.top+baseTemplate.height/2);template.vector=createVectorTemplate(original.vectorPage,{bounds:def.bounds,ids:def.elements?.ids,excluded:def.elements?.excluded,anchor});}
  const matches=[];
  for(let page=1;page<=target.pages.length;page++){check();progress(`Searching ${headings.get(e.item_id).name} · page ${page}/${target.pages.length} · selection ${results.length+1}/${examples.length}`);const raster=await render(target,page);check();const hits=await search(raster,template);check();
   for(const hit of hits){if(++count>5000)throw new Error('Recount exceeds 5000 results');const [x,y]=Number.isFinite(hit.x)&&Number.isFinite(hit.y)?[hit.x,hit.y]:raster.viewport.convertToPdfPoint(hit.left+(hit.anchorX??template.anchorX??hit.width/2),hit.top+(hit.anchorY??template.anchorY??hit.height/2));matches.push({drawing_id:target.id,page,x,y,score:hit.score,digest:target.digest});}
  }
  results.push({id:e.id,version:e.version,item_version:headings.get(e.item_id).version,matches});
 }
 check();return {digest:target.digest,selections:results,expected_marks:state.countMarks.filter(m=>m.drawing_id===target.id).map(m=>({id:m.id,version:m.version}))};
}
