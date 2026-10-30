import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createCanvas} from '@napi-rs/canvas';
import {inkImage,exampleImage} from '../apps/local/web/matcher.mjs';
import {matchRequest} from '../apps/local/web/match-worker.mjs';
import {recognizeDrawing} from '../apps/local/web/recognize-drawing.mjs';
import {matchTiles,createTileBudget,renderMatchRegion,renderMatchSelection,tiledMatchPage,searchMatchTiles} from '../apps/local/web/pdf-match-tiles.mjs';

// Original geometry and labels, including seam intersections, are declared
// independently of the matcher. The full-page clip must remain in raster output.
const a1Labels=[[120,120,0],[744,120,90],[1488,120,180],[120,1640,270],[744,1640,0],[1488,896,90],[744.5,400.5,180],[1650,2350,270]];
function fixture(width,height,labels){
 const matrices={0:'1 0 0 1',90:'0 1 -1 0',180:'-1 0 0 -1',270:'0 -1 1 0'},glyph='-8 -10 16 3 re f -8 -10 3 20 re f -5 6 8 3 re f 4 -2 3 3 re f';
 const content=`q 0 0 ${width} ${height} re W n 0 g\n`+labels.map(([x,y,angle])=>`q ${matrices[angle]} ${x} ${y} cm ${glyph} Q`).join('\n')+'\nQ\n';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << >> /Contents 4 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(const [i,o]of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return new Uint8Array(Buffer.from(pdf));
}
const bounds=[108,106,132,134];
const cropTemplate=r=>{const b=bounds;return {...exampleImage(inkImage(r.data,r.width,r.height),[...r.viewport.convertToViewportPoint(b[0],b[3]),...r.viewport.convertToViewportPoint(b[2],b[1])]),matchRotations:true,matchThreshold:.95};};
const search=async(r,template)=>matchRequest({rgba:r.data,width:r.width,height:r.height,template});
const points=hits=>hits.map(h=>[h.x,h.y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
async function pageFor(t,width,height,labels){const task=getDocument({data:fixture(width,height,labels),isEvalSupported:false});t.after(()=>task.destroy());const page=await(await task.promise).getPage(1),viewport=page.getViewport({scale:2,rotation:0});return {page,viewport,createCanvas};}

test('A1 original PDF counts eight independently placed quarter-turn symbols across tile seams with native anchors intact',async t=>{
 const options=await pageFor(t,1684,2384,a1Labels),source=await renderMatchSelection({...options,bounds}),template=cropTemplate(source),raster=tiledMatchPage(options),hits=await searchMatchTiles({raster,template,search});
 assert.equal(raster.width,3368);assert.equal(raster.height,4768);assert.equal(raster.tiles.length,12);assert.equal(hits.length,a1Labels.length);
 assert.deepEqual(points(hits),a1Labels.map(([x,y])=>[x,y]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]));
 assert.ok(raster.tiles.every(tile=>tile.width*tile.height<=4000000));assert.ok(source.width<60&&source.height<65);assert.equal(source.vectorPage.supported,false);
 const anchor=source.viewport.convertToPdfPoint(template.left+template.width/2,template.top+template.height/2);assert.deepEqual(anchor,[120,120]);
 const state={countItems:[{id:'item',discipline_id:'discipline',name:'Owned symbols',version:1}],countExamples:[{id:'example',item_id:'item',version:1,created:'2026-10-30',example:{drawing_id:'drawing',digest:'original',page:1,bounds,algorithm:'binary-overlap-rotations-1'}}],countMarks:[],drawings:[{id:'drawing',digest:'original',discipline_id:'discipline',pages:[{}]}]},target=state.drawings[0];let sourceBounds;
 const recount=await recognizeDrawing({state,target,render:async(_d,_page,_elements,b)=>{if(b){sourceBounds=b;return renderMatchSelection({...options,bounds:b});}return tiledMatchPage(options);},search:(r,t)=>searchMatchTiles({raster:r,template:t,search})});
 assert.deepEqual(sourceBounds,bounds);assert.deepEqual(points(recount.selections[0].matches),points(hits));assert.deepEqual(state.countMarks,[]);
});

test('integer-aligned selection crops and overlapping tiles reproduce the existing whole-image matcher on a small PDF',async t=>{
 const labels=[[120,120,0],[744,120,90],[120,156,180],[744,156,270],[400.5,400.5,90]],options=await pageFor(t,900,900,labels),whole=await renderMatchRegion({...options,region:{left:0,top:0,width:1800,height:1800}}),crop=await renderMatchSelection({...options,bounds}),original=cropTemplate(whole),trimmed=cropTemplate(crop);
 assert.deepEqual(trimmed.data,original.data);assert.equal(trimmed.width,original.width);assert.equal(trimmed.height,original.height);
 const sourcePoint=r=>{const t=cropTemplate(r);return r.viewport.convertToPdfPoint(t.left+t.width/2,t.top+t.height/2);};assert.deepEqual(sourcePoint(crop),sourcePoint(whole));
 const baseline=(await search(whole,original)).map(h=>{const [x,y]=whole.viewport.convertToPdfPoint(h.left+h.anchorX,h.top+h.anchorY);return {...h,x,y};});
 const tiled=await searchMatchTiles({raster:tiledMatchPage(options),template:trimmed,search});assert.deepEqual(points(tiled),points(baseline));assert.equal(tiled.length,labels.length);
});

test('off-centre anchors retain quarter-turn geometry through tile ownership instead of using bounding-box centres',async t=>{
 const labels=[[120,120,0],[744,120,90],[120,156,180],[744,156,270]],options=await pageFor(t,900,900,labels),source=await renderMatchSelection({...options,bounds}),template=cropTemplate(source);template.anchorX=template.width/2+2;template.anchorY=template.height/2+4;
 const hits=await searchMatchTiles({raster:tiledMatchPage(options),template,search});
 const expected=labels.map(([x,y,angle])=>{const delta=({0:[1,-2],90:[2,1],180:[-1,2],270:[-2,-1]})[angle];return [x+delta[0],y+delta[1]];}).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);assert.deepEqual(points(hits),expected);
});

test('tile, memory, wall-time and cancellation bounds reject atomically without returning partial matches',async()=>{
 assert.throws(()=>matchTiles(100000,100000),/page budget/);assert.throws(()=>matchTiles(1,64000000),/tile budget/);assert.throws(()=>matchTiles(NaN,5),/page budget/);
 let now=0;const time=createTileBudget({maxMilliseconds:1,now:()=>now});now=2;assert.throws(()=>time.check(),/time budget/);
 const tile={left:0,top:0,width:10,height:10,core:[0,0,10,10]},raster={tiled:true,tiles:[tile,{...tile,left:10,core:[10,0,20,10]}],viewport:{convertToPdfPoint:(x,y)=>[x/2,y/2]},renderTile:async()=>({})},template={width:8,height:8};
 const hits=async()=>[{left:1,top:1,width:8,height:8,score:1}];await assert.rejects(searchMatchTiles({raster,template,search:hits,budget:createTileBudget({maxTiles:1})}),/work budget/);
 await assert.rejects(searchMatchTiles({raster,template,search:hits,budget:createTileBudget({maxPixels:50})}),/work budget/);
 let cancelled=false;await assert.rejects(searchMatchTiles({raster,template,search:async()=>{cancelled=true;return hits();},cancelled:()=>cancelled}),/cancelled/);
 await assert.rejects(searchMatchTiles({raster,template:{width:257,height:8},search:hits}),/template/);
});

test('scratch canvas backing is released after the independent pixel copy and after cancelled renders',async t=>{
 const options=await pageFor(t,900,900,[[120,120,0]]),canvases=[],factory=(w,h)=>{const c=createCanvas(w,h);canvases.push(c);return c;};
 const crop=await renderMatchSelection({...options,bounds,createCanvas:factory});assert.ok(crop.data.some(v=>v===0));assert.ok(cropTemplate(crop).count>8);assert.ok(canvases.every(c=>c.width<=1&&c.height<=1),'native canvas implementations may clamp zero to one');
 const cancelled=()=>true;await assert.rejects(renderMatchSelection({...options,bounds,createCanvas:factory,cancelled}),/cancelled/);assert.equal(canvases.length,1,'pre-cancelled work allocates no canvas');
 let wasCancelled=false;await assert.rejects(renderMatchSelection({...options,bounds,createCanvas:factory,cancelled:()=>wasCancelled,onRender:task=>{wasCancelled=true;task.cancel();}}));assert.ok(canvases.every(c=>c.width<=1&&c.height<=1));
});
