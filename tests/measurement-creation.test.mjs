import test from 'node:test';
import assert from 'node:assert/strict';
import {nextMeasureName} from '../apps/local/web/measurement-creation.mjs';
test('neutral measurement names avoid existing case-insensitive names without mutating them',()=>{
 const records=[{name:'length 1'},{name:'Length 3'},{name:'Point 1'},{name:'Area 1'}],before=structuredClone(records);
 assert.equal(nextMeasureName('length',records),'Length 2');assert.equal(nextMeasureName('point',records),'Point 2');assert.equal(nextMeasureName('area',records),'Area 2');assert.deepEqual(records,before);
});
