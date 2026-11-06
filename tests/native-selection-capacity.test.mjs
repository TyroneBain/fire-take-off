import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectPdfElements} from '../apps/local/web/pdf-elements.mjs';

test('oversized native selection reports actual capacity and leaves rendering untouched',async()=>{
 const list={fnArray:new Array(1218070)},page={getViewport:()=>({width:200,height:200,convertToViewportPoint:(x,y)=>[2*x,2*y]}),getOperatorList:async()=>list};let canvases=0;
 await assert.rejects(inspectPdfElements({page,OPS:{},bounds:[10,10,20,20],nativeReviewOnly:true,createCanvas:()=>{canvases++;throw Error('unexpected rendering');}}),/This drawing is too complex for vector selection yet \(1,218,070 PDF operations; current limit 1,000,000\)\. No selection was saved\./);
 assert.equal(canvases,0);assert.equal(list.fnArray.length,1218070);
});
