import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument,OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {vectorScaleQaFixture} from '../scripts/vector-scale-qa-fixture.mjs';
import {extractVectorPage,createVectorTemplate,findVectorMatches,VECTOR_SCALE_RANGE} from '../apps/local/web/vector-recognition.mjs';
import {vectorInkMask} from '../apps/local/web/vector-ink.mjs';
import {inkImage} from '../apps/local/web/matcher.mjs';

async function setup(){
 const fixture=vectorScaleQaFixture(),task=getDocument({data:new Uint8Array(fixture.bytes),isEvalSupported:false});
 try{const page=await(await task.promise).getPage(1),operatorList=await page.getOperatorList(),vectorPage=extractVectorPage({operatorList,OPS});assert.ok(vectorPage.supported,vectorPage.reason);
  const paths=operatorList.fnArray.flatMap((op,i)=>op===OPS.constructPath?[i]:[]),expectedPaths=new Map();let cursor=0;
  // Independent PDF fixture writer emits exactly four paint operations per
  // positive, then one separate pipe operation where declared in its labels.
  // Never use detected elementIds to decide the oracle's selected paths.
  for(const label of fixture.manifest.labels){expectedPaths.set(label.id,paths.slice(cursor,cursor+4));cursor+=4+(label.crossing?1:0);}
  const template=createVectorTemplate(vectorPage,{bounds:fixture.manifest.selection,ids:[5,6,7,8,13],excluded:[13],anchor:fixture.manifest.seed}),hits=findVectorMatches(vectorPage,template,{scaleRange:VECTOR_SCALE_RANGE});assert.equal(hits.length,16);
  return {fixture,task,page,vectorPage,hits,expectedPaths};
 }catch(e){await task.destroy();throw e;}
}
async function render(page,viewport,ids){const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),ctx=canvas.getContext('2d');await page.render({canvas,canvasContext:ctx,viewport,...(ids?{operationsFilter:(id,list)=>list.fnArray[id]!==OPS.constructPath||ids.has(id)}:{})}).promise;return inkImage(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);}

test('independent full-page PDF oracle validates scaled symbol colour and all excluded pipe pixels at rotated display views',async t=>{
 const q=await setup();let coloured=0,expectedTotal=0,pipePixels=0;
 try{for(const rotation of [0,90]){
   const viewport=q.page.getViewport({scale:rotation?1.5:2,rotation}),image=await render(q.page,viewport);
   for(const label of q.fixture.manifest.labels){const hit=q.hits.find(h=>Math.hypot(h.x-label.x,h.y-label.y)<.01);assert.ok(hit,label.id);assert.deepEqual([...hit.elementIds].sort((a,b)=>a-b),q.expectedPaths.get(label.id));
    const expected=await render(q.page,viewport,new Set(q.expectedPaths.get(label.id))),mask=vectorInkMask({vectorPage:q.vectorPage,hit,viewport,image,createCanvas});assert.ok(mask,label.id);
    let falseColour=0,missing=0;
    // Full page comparison catches glyph ink accidentally omitted by an
    // undersized helper crop, as well as ink painted outside the symbol.
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
     const idx=y*image.width+x,wanted=expected.data[idx]&image.data[idx],inCrop=x>=mask.left&&x<mask.left+mask.width&&y>=mask.top&&y<mask.top+mask.height,actual=inCrop?mask.data[(y-mask.top)*mask.width+x-mask.left]:0;
     coloured+=actual;expectedTotal+=wanted;falseColour+=actual&&!wanted?1:0;missing+=wanted&&!actual?1:0;
     if(label.crossing&&inCrop&&image.data[idx]&&!expected.data[idx]){pipePixels++;assert.equal(actual,0,'intersecting pipe-only pixel must stay uncoloured');}
    }
    assert.equal(falseColour,0,label.id+' outside colour');assert.equal(missing,0,label.id+' missing glyph pixels');
   }
  }
  assert.ok(pipePixels>0,'oracle must exercise visible crossing pipe pixels');assert.equal(coloured,expectedTotal);t.diagnostic(JSON.stringify({distinctSymbols:16,displayViews:2,colouredPixels:coloured,independentlyRenderedGlyphPixels:expectedTotal,excludedPipePixels:pipePixels,scope:'Original synthetic scale corpus; exact thresholded pixel agreement, not real-drawing fidelity'}));
 }finally{await q.task.destroy();}
});

test('independent vector mask rejects unknown/stale path identities and malformed or excessive path metadata before canvas allocation',async()=>{
 const q=await setup();try{const viewport=q.page.getViewport({scale:2,rotation:0}),image=await render(q.page,viewport),hit=q.hits[0],run=(patch={})=>vectorInkMask({vectorPage:q.vectorPage,hit,viewport,image,createCanvas,...patch});
  assert.equal(run({hit:{...hit,elementIds:[1000000]}}),null);assert.equal(run({hit:{...hit,elementIds:[hit.elementIds[0],hit.elementIds[0]]}}),null);
  const mutate=edit=>{const page=structuredClone(q.vectorPage);edit(page.elements.find(e=>e.id===hit.elementIds[0]));return page;};
  for(const vectorPage of [mutate(e=>delete e.pathCommands),mutate(e=>e.pathCommands=[0,Infinity,0]),mutate(e=>e.pathCommands=[0,0,0,99]),mutate(e=>e.pathCommands=Array.from({length:6000},()=>[0,80,80]).flat()),mutate(e=>e.paintClosesPath='true'),mutate(e=>e.style.cap=7)]){
   let allocated=false;assert.equal(run({vectorPage,createCanvas:()=>{allocated=true;throw Error('must not allocate');}}),null);assert.equal(allocated,false);
  }
  assert.equal(run({maxPixels:1}),null);assert.equal(run({image:{...image,data:new Uint8Array(image.data.length)}}),null);
 }finally{await q.task.destroy();}
});
