import {isVectorReviewAlgorithm,isVectorPageReviewAlgorithm,validVectorReview,vectorReviewPages} from './web/vector-review-policy.mjs';
import {randomUUID} from 'node:crypto';
export function migrateDrawingRecounts(db){
 if(db.prepare('SELECT version FROM schema_version').get().version!==15)return;
 db.exec(`BEGIN;CREATE TABLE IF NOT EXISTS count_drawing_recounts(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,drawing_id TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;UPDATE schema_version SET version=16;COMMIT`);
}
export function drawingRecounts(db,{drawing,item,exampleJSON,validateMark,insertMark,assertAppearanceCorrections,validateNativeResults,nativeDecisionMarks,applyNativeRejections,fail}){
 return {
  recountDrawing(drawingId,{digest,selections,expected_marks}={}){
   const target=drawing(drawingId);if(target.digest!==digest)fail('Drawing changed. Reload before recounting.',409);if(target.pages.length>20)fail('Recount supports at most 20 pages');
   const saved=db.prepare('SELECT e.* FROM count_examples e JOIN count_items i ON i.id=e.item_id WHERE i.discipline_id=? ORDER BY e.created,e.id').all(target.discipline_id);
   if(!saved.length)fail('Save a symbol selection in this discipline first');if(saved.length>50)fail('Recount supports at most 50 saved selections');
   if(!Array.isArray(selections)||selections.length!==saved.length||selections.some(s=>!s||typeof s.id!=='string')||new Set(selections.map(s=>s.id)).size!==selections.length)fail('Selections changed. Reload before recounting.',409);
   const inputs=new Map(selections.map(s=>[s.id,s])),active=new Set(),definitions=new Map(),operations=new Map(),refreshedPages=new Map();let total=0;
   for(const e of saved){const request=inputs.get(e.id),heading=item(e.item_id),source=JSON.parse(e.example);if(!request||request.version!==e.version||request.item_version!==heading.version)fail('Selection or heading changed. Reload before recounting.',409);exampleJSON(target.discipline_id,source);if(source.algorithm==='binary-elements-1')fail('Re-edit legacy cleaned selections before recounting');
    if(!Array.isArray(request.matches)||request.matches.length>5000)fail('Invalid recount results');
    const native=isVectorReviewAlgorithm(source.algorithm),pageSet=isVectorPageReviewAlgorithm(source.algorithm);
    let definition=source,operation=source;
    if(pageSet){
      const savedPages=vectorReviewPages(source).filter(p=>p.drawing_id===target.id);
      if(!savedPages.length){if(request.matches.length||request.vectorReview!==undefined)fail('Native vector review cannot recount an undeclared drawing');definitions.set(e.id,source);continue;}
      const review=request.vectorReview;
      if(!validVectorReview(review,request.matches.length)||review.version!==source.algorithm||review.layerPolicy!==source.vectorReview.layerPolicy||review.anchor.some((v,k)=>v!==source.vectorReview.anchor[k])||review.pages.some(p=>p.drawing_id!==target.id||!savedPages.some(old=>old.page===p.page&&old.digest===p.digest)))fail('Native page recount requires explicitly declared target pages and unchanged review policy');
      const refreshed=new Map(review.pages.map(p=>[p.page,p]));
      definition={...source,vectorReview:{...source.vectorReview,pages:vectorReviewPages(source).map(p=>p.drawing_id===target.id&&refreshed.has(p.page)?refreshed.get(p.page):p)}};
      exampleJSON(target.discipline_id,definition);operation={...source,vectorReview:review};validateNativeResults(operation,request.matches);
      refreshedPages.set(e.id,new Set(review.pages.map(p=>p.page)));
    }else if(native){
      if(source.drawing_id!==target.id){if(request.matches.length)fail('Native vector review cannot recount another drawing');definitions.set(e.id,source);continue;}
      if(!validVectorReview(request.vectorReview,request.matches.length)||request.vectorReview.version!==source.algorithm||request.vectorReview.sourceLayerScope!==source.vectorReview.sourceLayerScope||request.vectorReview.anchor.some((v,k)=>v!==source.vectorReview.anchor[k]))fail('Native source-page recount requires an explicit unchanged review policy');
      definition={...source,vectorReview:request.vectorReview};operation=definition;validateNativeResults(operation,request.matches);refreshedPages.set(e.id,new Set([source.page]));
    }
    operations.set(e.id,operation);
    active.add(e.id);definitions.set(e.id,definition);total+=request.matches.length;if(total>5000)fail('Recount supports at most 5000 results');for(const m of request.matches){validateMark(target.discipline_id,m,'automatic');if(m.drawing_id!==target.id)fail('Recount result outside target drawing');}
   }
   if(!Array.isArray(expected_marks)||expected_marks.some(m=>!m||typeof m.id!=='string'||!Number.isInteger(m.version)))fail('Complete target match snapshot required');
   const previous=db.prepare('SELECT * FROM count_marks WHERE drawing_id=? ORDER BY id').all(target.id),expected=new Map(expected_marks.map(m=>[m.id,m.version]));if(expected.size!==expected_marks.length||expected.size!==previous.length||previous.some(m=>expected.get(m.id)!==m.version))fail('Drawing matches changed. Reload before recounting.',409);
   const near=(a,b)=>a.page===b.page&&Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5;
   const obsolete=previous.filter(m=>{const e=saved.find(e=>e.id===m.example_id);return e&&active.has(e.id)&&(!isVectorReviewAlgorithm(definitions.get(e.id).algorithm)||refreshedPages.get(e.id).has(m.page))&&m.origin==='automatic'&&!m.reviewed&&m.included&&m.item_id===e.item_id&&!(isVectorReviewAlgorithm(definitions.get(e.id).algorithm)?nativeDecisionMarks(operations.get(e.id)):inputs.get(e.id).matches).some(n=>near(m,n));});
   const removed=new Set(obsolete.map(m=>m.id));for(const e of saved)if(active.has(e.id)){const definition=operations.get(e.id);assertAppearanceCorrections(e.item_id,definition,isVectorReviewAlgorithm(definition.algorithm)?nativeDecisionMarks(definition):inputs.get(e.id).matches,e.id,removed);}
   const id=randomUUID(),added=[],results=[];db.exec('BEGIN');
   try{
    for(const m of obsolete)db.prepare('DELETE FROM count_marks WHERE id=?').run(m.id);
    for(const e of saved){if(!active.has(e.id)){results.push({example_id:e.id,item_id:e.item_id,added:0,skipped:0,skipped_scope:true});continue;}let count=0,skipped=0;for(const m of inputs.get(e.id).matches){const exists=db.prepare('SELECT id FROM count_marks WHERE (item_id=? OR original_item_id=? OR example_id=?) AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(e.item_id,e.item_id,e.id,target.id,m.page,m.x,m.y);if(exists){skipped++;continue;}const mark=insertMark(e.item_id,target.discipline_id,m,'automatic',e.id);added.push(mark.id);count++;}const definition=definitions.get(e.id),rejected=applyNativeRejections(e.item_id,target.discipline_id,operations.get(e.id),e.id);
     if(isVectorReviewAlgorithm(definition.algorithm)){const encoded=exampleJSON(target.discipline_id,definition);db.prepare('UPDATE count_examples SET example=?,version=version+1 WHERE id=?').run(encoded,e.id);db.prepare('UPDATE count_items SET example=CASE WHEN example=? THEN ? ELSE example END,version=version+1 WHERE id=?').run(e.example,encoded,e.item_id);}
     results.push({example_id:e.id,item_id:e.item_id,added:count,skipped,...(isVectorReviewAlgorithm(definition.algorithm)?{rejected}:{} )});}
    const current={target:{id:target.id,name:target.name,digest:target.digest},selections:saved.map(e=>({...e,example:definitions.get(e.id),...(active.has(e.id)&&isVectorReviewAlgorithm(definitions.get(e.id).algorithm)?{version:e.version+1}:{}),heading:item(e.item_id).name})),results,vectorReviews:saved.filter(e=>active.has(e.id)&&isVectorReviewAlgorithm(definitions.get(e.id).algorithm)).map(e=>({example_id:e.id,vectorReview:definitions.get(e.id).vectorReview})),added,removed:obsolete.map(m=>m.id),retained_corrections:previous.filter(m=>!obsolete.includes(m)&&(m.reviewed||!m.included||m.origin==='manual'||saved.some(e=>e.id===m.example_id&&e.item_id!==m.item_id))).map(m=>m.id)};
    db.prepare('INSERT INTO count_drawing_recounts VALUES (?,?,?,?,?,?)').run(id,target.discipline_id,target.id,JSON.stringify({marks:previous,...(saved.some(e=>active.has(e.id)&&isVectorReviewAlgorithm(definitions.get(e.id).algorithm))?{selections:saved.map(e=>({...e,example:JSON.parse(e.example)}))}:{})}),JSON.stringify(current),new Date().toISOString());db.exec('COMMIT');return {id,added:added.length,removed:obsolete.length,skipped:results.reduce((n,r)=>n+r.skipped,0),selections:results.length};
   }catch(error){db.exec('ROLLBACK');throw error;}
  }
 };
}
