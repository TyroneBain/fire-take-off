import test from 'node:test';
import assert from 'node:assert/strict';
import {drawingChoices,initialDrawingSelection} from '../apps/local/web/drawing-picker.mjs';
const state={entities:[{id:'p1',kind:'project',name:'Same project'},{id:'p2',kind:'project',name:'Same project'},{id:'p3',kind:'project',name:'Empty project'},...['1','2'].flatMap(n=>[{id:'t'+n,kind:'takeoff',name:'Same takeoff',parent_id:'p'+n},{id:'d'+n,kind:'discipline',name:'Same discipline',parent_id:'t'+n}])],drawings:[{id:'a',discipline_id:'d1',name:'Same.pdf',pages:[{}]},{id:'b',discipline_id:'d1',name:'Revision.pdf',pages:[{},{}]},{id:'c',discipline_id:'d2',name:'Same.pdf',pages:[{},{},{}]}]};
test('drawing picker resolves stable IDs and ancestor changes cannot retain another project drawing',()=>{
  const before=structuredClone(state),ids=initialDrawingSelection(state,state.drawings[0]);assert.deepEqual(ids,{projectId:'p1',takeoffId:'t1',disciplineId:'d1',drawingId:'b'});
  const first=drawingChoices(state,ids);assert.equal(first.drawing.id,'b');assert.deepEqual(first.drawings.map(d=>d.id),['a','b']);
  const changed=drawingChoices(state,{...ids,projectId:'p2'});assert.equal(changed.takeoff.id,'t2');assert.equal(changed.discipline.id,'d2');assert.equal(changed.drawing.id,'c');assert.deepEqual(changed.drawings.map(d=>d.id),['c']);assert.deepEqual(state,before);
  assert.equal(drawingChoices(state,initialDrawingSelection(state,state.drawings[2])).drawing.id,'c');
});
test('drawing picker handles empty groups and removed descendants without selecting a stale drawing',()=>{
  const empty=drawingChoices(state,{projectId:'p3',takeoffId:'t1',disciplineId:'d1',drawingId:'a'});assert.equal(empty.project.id,'p3');assert.equal(empty.takeoff,null);assert.equal(empty.discipline,null);assert.equal(empty.drawing,null);assert.deepEqual(empty.drawings,[]);
  const removed={...state,drawings:state.drawings.filter(d=>d.id!=='b')};assert.equal(drawingChoices(removed,{projectId:'p1',drawingId:'b'}).drawing.id,'a');
  const none=drawingChoices({entities:[],drawings:[]});for(const key of ['project','takeoff','discipline','drawing'])assert.equal(none[key],null);
});
