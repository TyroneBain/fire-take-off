import test from 'node:test';
import assert from 'node:assert/strict';
import {OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {extractVectorPage,createVectorTemplate} from '../apps/local/web/vector-recognition.mjs';
const rect=(x0,y0,x1,y1)=>new Float32Array([0,x0,y0,1,x1,y0,1,x1,y1,1,x0,y1,4]);
const path=(paint,commands)=>[OPS.constructPath,[paint,[commands],[0,0,500,500]]];
const seed=path(OPS.stroke,rect(94,94,106,106));
function extract(extra){const entries=[seed,extra];return extractVectorPage({operatorList:{fnArray:entries.map(e=>e[0]),argsArray:entries.map(e=>e[1])},OPS});}
const definition={bounds:[88,88,112,112],anchor:[100,100]};
test('automatic vector selection ignores enclosing stroke-only outline with no nearby segment ink',()=>{
 const page=extract(path(OPS.stroke,rect(50,50,400,250)));assert.equal(page.supported,true);
 const template=createVectorTemplate(page,definition);assert.equal(template.supported,true);assert.deepEqual(template.elements.map(e=>e.id),[0]);
 assert.equal(createVectorTemplate(page,{...definition,ids:[0,1]}).supported,false,'explicit saved operation selection must remain authoritative');
});
test('crossing pipe requires explicit exclusion and enclosing filled shape is never discarded by stroke-only test',()=>{
 const pipe=extract(path(OPS.stroke,new Float32Array([0,50,100,1,400,100])));
 assert.equal(createVectorTemplate(pipe,definition).supported,false);
 const cleaned=createVectorTemplate(pipe,{...definition,ids:[0,1],excluded:[1]});assert.equal(cleaned.supported,true);assert.deepEqual(cleaned.excludedElements.map(e=>e.id),[1]);
 const fill=extract(path(OPS.fill,rect(50,50,400,250)));assert.equal(createVectorTemplate(fill,definition).supported,false);
});
test('nearby cap/join extent and overlapping curve control hull stay conservative',()=>{
 const near=extract(path(OPS.stroke,new Float32Array([0,50,84,1,400,84])));
 assert.equal(createVectorTemplate(near,definition).supported,false,'miter allowance may reach selection even when path centreline does not');
 const curve=extract(path(OPS.stroke,new Float32Array([0,50,50,2,100,150,150,50,200,50])));
 assert.equal(createVectorTemplate(curve,definition).supported,false,'control hull uncertainty must not silently discard a curve');
});
