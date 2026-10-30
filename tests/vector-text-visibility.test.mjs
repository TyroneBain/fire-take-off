import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractVectorPage,resolveVectorTextBounds,createVectorTemplate,findVectorMatches} from '../apps/local/web/vector-recognition.mjs';
// Geometry-first unit contract. Independent QA separately exercises actual PDF
// rendering and the recorded font bounds, rather than trusting this fake reader.
const glyph=(x,y)=>[OPS.constructPath,[OPS.fill,[new Float32Array([0,x,y,1,x+6,y,1,x+6,y+8,1,x,y+8,4])],[x,y,x+6,y+8]]];
function page(mode=0){const ops=[glyph(20,20),glyph(70,20),[OPS.setTextRenderingMode,[mode]],[OPS.showText,[[]]]];return extractVectorPage({operatorList:{fnArray:ops.map(o=>o[0]),argsArray:ops.map(o=>o[1])},OPS});}
const viewport={convertToPdfPoint:(x,y)=>[x/2,100-y/2]};
const reader=box=>({isEmpty:()=>false,minX:()=>box[0],minY:()=>box[1],maxX:()=>box[2],maxY:()=>box[3]});
const resolve=(p,box)=>resolveVectorTextBounds(p,{reader:reader(box),viewport,width:200,height:200});
test('text geometry remains pending until rendered bounds are supplied and detached labels preserve native anchors',()=>{
 const pending=page();assert.equal(pending.supported,false);assert.equal(pending.pendingTextBounds,true);assert.deepEqual(pending.textOperationIds,[3]);
 const resolved=resolve(pending,[.1,.1,.3,.2]);assert.equal(resolved.supported,true);assert.deepEqual(resolved.textRegions,[[9,79,31,91]]);
 const template=createVectorTemplate(resolved,{bounds:[18,18,28,30],anchor:[23,24]});assert.equal(template.supported,true);
 assert.deepEqual(findVectorMatches(resolved,template,{rotations:false}).map(h=>[h.x,h.y]),[[23,24],[73,24]]);
 assert.deepEqual(structuredClone(resolved),resolved);assert.equal(pending.supported,false,'resolving must not mutate pending source');
});
test('source overlap selects raster; a candidate overlap raises a typed atomic fallback instead of returning partial matches',()=>{
 const source=resolve(page(),[.18,.72,.28,.82]);assert.equal(createVectorTemplate(source,{bounds:[18,18,28,30],anchor:[23,24]}).supported,false);
 const target=resolve(page(),[.68,.72,.78,.82]),template=createVectorTemplate(target,{bounds:[18,18,28,30],anchor:[23,24]});assert.equal(template.supported,true);
 assert.throws(()=>findVectorMatches(target,template,{rotations:false}),error=>error.code==='VECTOR_TEXT_OVERLAP');
});
test('unknown text bounds, full-page font uncertainty and clipped/stroked text cannot enable vector counting',()=>{
 for(const box of [[0,0,1,1],[NaN,0,.5,.5],[-.1,0,.5,.5],[.1,.1,.1,.5],[0,0,1.1,1]])assert.equal(resolve(page(),box).supported,false);
 assert.equal(resolveVectorTextBounds(page(),{viewport,width:200,height:200}).supported,false);
 assert.equal(resolveVectorTextBounds(page(),{reader:{...reader([.1,.1,.2,.2]),isEmpty:()=>true},viewport,width:200,height:200}).supported,false);
 for(const mode of [1,2,4,5,6,7]){const p=page(mode);assert.equal(p.supported,false);assert.equal(p.pendingTextBounds,undefined);assert.match(p.reason,/Stroked or clipping text/);}
 const invisible=page(3);assert.equal(invisible.supported,true);assert.equal(invisible.pendingTextBounds,undefined);
});
test('text guard coordinates include all viewport corners and text adjacency outside the stroke envelope remains usable',()=>{
 const rotated={convertToPdfPoint:(x,y)=>[100-y/2,x/2]};
 const p=resolveVectorTextBounds(page(),{reader:reader([.1,.1,.3,.2]),viewport:rotated,width:200,height:200});
 assert.deepEqual(p.textRegions,[[79,9,91,31]]);
 const template=createVectorTemplate(p,{bounds:[18,18,28,30],anchor:[23,24]});assert.equal(findVectorMatches(p,template,{rotations:false}).length,2);
});
