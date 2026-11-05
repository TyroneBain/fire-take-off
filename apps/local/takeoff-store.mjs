import {VECTOR_REVIEW_VERSION,VECTOR_PAGE_REVIEW_VERSION,isVectorReviewAlgorithm,isVectorPageReviewAlgorithm,validVectorReview,vectorReviewPages,vectorReviewAppliesToPage} from './web/vector-review-policy.mjs';
import {VECTOR_MATCHER_VERSION,VECTOR_FIXED_VERSION,VECTOR_SCALE_VERSION,VECTOR_SCALE_FIXED_VERSION} from './web/vector-recognition.mjs';
import {isVectorAlgorithm,includesRotations,includesScales,ROTATION_ELEMENTS_VERSION,ROTATION_MATCHER_VERSION,EXACT_MATCHER_VERSION} from './web/matcher.mjs';
import {drawingRecounts} from './drawing-recounts.mjs';
import {APPEARANCE_MATCHER_VERSION,APPEARANCE_FIXED_VERSION,isAppearanceAlgorithm} from './web/appearance-policy.mjs';
import {validElementSelection} from './web/pdf-elements.mjs';
import { randomUUID } from 'node:crypto';
import {validMultiplier} from './quantity-multipliers.mjs';
import { validateGeometry,pathLength,unitMetres,quantity } from './web/takeoff-geometry.mjs';
export function migrateTakeoff(db) {
  if(db.prepare('SELECT version FROM schema_version').get().version!==3)return;
  db.exec(`BEGIN;
    CREATE TABLE IF NOT EXISTS count_items(id TEXT PRIMARY KEY,discipline_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,name TEXT NOT NULL,color TEXT NOT NULL,example TEXT,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS count_marks(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES count_items(id) ON DELETE CASCADE,drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,x REAL NOT NULL,y REAL NOT NULL,score REAL NOT NULL,origin TEXT NOT NULL,included INTEGER NOT NULL,reviewed INTEGER NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS count_events(id TEXT PRIMARY KEY,mark_id TEXT NOT NULL REFERENCES count_marks(id) ON DELETE CASCADE,action TEXT NOT NULL,previous TEXT NOT NULL,current TEXT NOT NULL,created TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS calibrations(drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,points TEXT NOT NULL,distance REAL NOT NULL,unit TEXT NOT NULL,metres_per_point REAL NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(drawing_id,page)) STRICT;
    CREATE TABLE IF NOT EXISTS measurements(id TEXT PRIMARY KEY,drawing_id TEXT NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,page INTEGER NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,points TEXT NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
    UPDATE schema_version SET version=4;COMMIT;`);
}
export function migrateCountExamples(db) {
  if(db.prepare('SELECT version FROM schema_version').get().version!==5)return;
  db.exec('BEGIN');
  try {
    if(!db.prepare('PRAGMA table_info(count_items)').all().some(c=>c.name==='version'))db.exec('ALTER TABLE count_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
    if(!db.prepare('PRAGMA table_info(count_marks)').all().some(c=>c.name==='original_item_id'))db.exec('ALTER TABLE count_marks ADD COLUMN original_item_id TEXT REFERENCES count_items(id)');
    db.exec(`UPDATE count_marks SET original_item_id=item_id WHERE original_item_id IS NULL;
      CREATE TABLE IF NOT EXISTS count_examples(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES count_items(id) ON DELETE CASCADE,example TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(item_id,example)) STRICT;`);
    for(const i of db.prepare('SELECT * FROM count_items WHERE example IS NOT NULL').all())db.prepare('INSERT OR IGNORE INTO count_examples (id,item_id,example,created) VALUES (?,?,?,?)').run(randomUUID(),i.id,i.example,i.created);
    db.exec('UPDATE schema_version SET version=6; COMMIT');
  } catch(error) {db.exec('ROLLBACK');throw error;}
}
export function migrateCountMultipliers(db) {
  if(db.prepare('SELECT version FROM schema_version').get().version!==6)return;
  db.exec('BEGIN');
  try {
    const columns=db.prepare('PRAGMA table_info(count_examples)').all();
    if(!columns.some(c=>c.name==='multiplier'))db.exec('ALTER TABLE count_examples ADD COLUMN multiplier INTEGER NOT NULL DEFAULT 1');
    if(!columns.some(c=>c.name==='version'))db.exec('ALTER TABLE count_examples ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
    if(!db.prepare('PRAGMA table_info(count_marks)').all().some(c=>c.name==='example_id'))db.exec('ALTER TABLE count_marks ADD COLUMN example_id TEXT REFERENCES count_examples(id)');
    db.exec(`CREATE TABLE IF NOT EXISTS count_example_events(id TEXT PRIMARY KEY,example_id TEXT NOT NULL REFERENCES count_examples(id) ON DELETE CASCADE,previous INTEGER NOT NULL,current INTEGER NOT NULL,version INTEGER NOT NULL,created TEXT NOT NULL) STRICT;
      UPDATE count_marks SET example_id=(SELECT id FROM count_examples WHERE item_id=count_marks.original_item_id LIMIT 1)
      WHERE origin='automatic' AND example_id IS NULL AND (SELECT count(*) FROM count_examples WHERE item_id=count_marks.original_item_id)=1;
      UPDATE schema_version SET version=7; COMMIT;`);
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function takeoffStore(db,{drawing,requireEntity,name,AppError}) {
  function fail(message,status=400){throw new AppError(status,message);}
  function item(id){const row=db.prepare('SELECT * FROM count_items WHERE id=?').get(id);if(!row)fail('Count item not found',404);return row;}
  function mark(id){const row=db.prepare('SELECT * FROM count_marks WHERE id=?').get(id);if(!row)fail('Match not found',404);return row;}
  function geometry(drawingId,page,kind,points) {
    const d=drawing(drawingId);if(!Number.isInteger(page)||page<1||page>d.pages.length)fail('Invalid drawing page');
    try{validateGeometry(kind,points,d.pages[page-1].view);}catch(error){fail(error.message);}
    return d;
  }
  function validateMark(disciplineId,m,origin) {
    if(!m||typeof m!=='object')fail('Invalid match');
    const d=geometry(m.drawing_id,m.page,'point',[[m.x,m.y]]);
    if(d.discipline_id!==disciplineId)fail('Count scope does not include this drawing');
    if(origin==='automatic'&&(m.digest!==d.digest||!Number.isFinite(m.score)||m.score<0||m.score>1))fail('Invalid or stale matching source');
    return d;
  }
  function exampleJSON(disciplineId,example) {
    if(!example||!Array.isArray(example.bounds)||example.bounds.length!==4||!(example.bounds[2]>example.bounds[0])||!(example.bounds[3]>example.bounds[1]))fail('Invalid example rectangle');
    const d=geometry(example.drawing_id,example.page,'length',[[example.bounds[0],example.bounds[1]],[example.bounds[2],example.bounds[3]]]);
    if(d.discipline_id!==disciplineId||d.digest!==example.digest||!['binary-overlap-1','binary-elements-1','binary-elements-2',EXACT_MATCHER_VERSION,ROTATION_MATCHER_VERSION,ROTATION_ELEMENTS_VERSION,VECTOR_MATCHER_VERSION,VECTOR_FIXED_VERSION,VECTOR_SCALE_VERSION,VECTOR_SCALE_FIXED_VERSION,APPEARANCE_MATCHER_VERSION,APPEARANCE_FIXED_VERSION,VECTOR_REVIEW_VERSION,VECTOR_PAGE_REVIEW_VERSION].includes(example.algorithm))fail('Invalid matching example');
    if(isAppearanceAlgorithm(example.algorithm)&&example.elements!==undefined)fail('Colour and fine-detail matching does not support cleaned selections');
    if((example.algorithm.startsWith('binary-elements-')||example.elements!==undefined)&&!validElementSelection(example.elements))fail('Invalid source element selection');
    if(isVectorReviewAlgorithm(example.algorithm)){
      if(!validElementSelection(example.elements)||!validVectorReview(example.vectorReview)||example.vectorReview.version!==example.algorithm)fail('Invalid native vector review metadata');
      geometry(example.drawing_id,example.page,'point',[example.vectorReview.anchor]);
      if(!vectorReviewAppliesToPage(example,example.drawing_id,example.page))fail('Native page scope must include the original source page');
      for(const bundle of vectorReviewPages(example)){
        const target=drawing(bundle.drawing_id);if(target.discipline_id!==disciplineId||target.digest!==bundle.digest)fail('Native target drawing changed or belongs to another discipline',409);
        if(!Number.isInteger(bundle.page)||bundle.page<1||bundle.page>target.pages.length)fail('Invalid native target page');
        for(const decision of bundle.decisions)geometry(target.id,bundle.page,'point',[[decision.x,decision.y]]);
      }
    }
    return JSON.stringify({drawing_id:d.id,page:example.page,bounds:example.bounds,digest:d.digest,algorithm:example.algorithm,...(isVectorReviewAlgorithm(example.algorithm)?{vectorReview:example.vectorReview}:{}),...(example.elements?{elements:{renderer:example.elements.renderer,ids:example.elements.ids,excluded:example.elements.excluded}}:{})});
  }
  function assertAppearanceCorrections(itemId,source,matches,exampleId=null,removed=new Set()) {
    if((!isAppearanceAlgorithm(source.algorithm)&&!isVectorReviewAlgorithm(source.algorithm))||!matches.length)return;
    const dimension=definition=>{const b=definition?.bounds;return b?Math.max(b[2]-b[0],b[3]-b[1]):0;},radius=dimension(source),groups=new Map();
    const rows=db.prepare('SELECT m.*,coalesce(e.example,i.example) AS source_definition FROM count_marks m LEFT JOIN count_examples e ON e.id=m.example_id LEFT JOIN count_items i ON i.id=m.original_item_id WHERE m.item_id=? OR m.original_item_id=? OR m.example_id=?').all(itemId,itemId,exampleId);
    for(const m of rows){if(removed.has(m.id))continue;const key=m.drawing_id+':'+m.page;if(!groups.has(key))groups.set(key,{exact:new Map(),protected:[],radius});const group=groups.get(key),cell=Math.floor(m.x)+':'+Math.floor(m.y);if(!group.exact.has(cell))group.exact.set(cell,[]);group.exact.get(cell).push(m);
      if(m.reviewed||!m.included||m.origin==='manual'||m.item_id!==itemId){const r=Math.max(radius,m.source_definition?dimension(JSON.parse(m.source_definition)):0);group.protected.push({...m,radius:r});group.radius=Math.max(group.radius,r);}
    }
    for(const group of groups.values()){group.bins=new Map();for(const m of group.protected){const key=Math.floor(m.x/group.radius)+':'+Math.floor(m.y/group.radius);if(!group.bins.has(key))group.bins.set(key,[]);group.bins.get(key).push(m);}}
    for(const m of matches){const group=groups.get(m.drawing_id+':'+m.page);if(!group?.protected.length)continue;let exists=false;
      for(let y=Math.floor(m.y)-1;y<=Math.floor(m.y)+1;y++)for(let x=Math.floor(m.x)-1;x<=Math.floor(m.x)+1;x++)if((group.exact.get(x+':'+y)||[]).some(p=>Math.abs(p.x-m.x)<.5&&Math.abs(p.y-m.y)<.5))exists=true;
      if(exists)continue;
      // Bounds are deliberately conservative: an unknown trimmed anchor or a
      // quarter turn must not let a shifted proposal bypass a manual decision.
      // Dense genuine neighbours may require another selection; never merge them.
      for(let y=Math.floor(m.y/group.radius)-1;y<=Math.floor(m.y/group.radius)+1;y++)for(let x=Math.floor(m.x/group.radius)-1;x<=Math.floor(m.x/group.radius)+1;x++)if((group.bins.get(x+':'+y)||[]).some(p=>Math.abs(p.x-m.x)<=p.radius&&Math.abs(p.y-m.y)<=p.radius))fail((isVectorReviewAlgorithm(source.algorithm)?'Native vector review':'Colour and fine-detail')+' results overlap an existing correction. No results saved; review the nearby symbols or use another selection.',409);
    }
  }
  function validateNativeResults(source,matches) {
    if(!isVectorReviewAlgorithm(source.algorithm))return;
    if(!Array.isArray(matches)||!validVectorReview(source.vectorReview,matches.length)||source.vectorReview.version!==source.algorithm)fail('Invalid native vector review decision');
    const key=m=>JSON.stringify([m?.drawing_id,m?.page,m?.x,m?.y]),selected=new Map(nativeDecisionMarks(source,{included:true}).map(m=>[key(m),m]));
    if(new Set(matches.map(key)).size!==matches.length)fail('Duplicate native vector review results');
    for(const m of matches){const decision=selected.get(key(m));if(!m||!decision||m.score!==1||m.digest!==decision.digest)fail('Native vector review results must match explicit source-page decisions');}
    for(const bundle of vectorReviewPages(source)){
      const target=drawing(bundle.drawing_id);if(target.digest!==bundle.digest||target.discipline_id!==drawing(source.drawing_id).discipline_id)fail('Native target drawing changed or belongs to another discipline',409);
      if(bundle.page<1||bundle.page>target.pages.length)fail('Invalid native target page');
      for(const decision of bundle.decisions)geometry(bundle.drawing_id,bundle.page,'point',[[decision.x,decision.y]]);
    }
  }
  const nativeDecisionMarks=(source,{included}={})=>vectorReviewPages(source).flatMap(p=>p.decisions.filter(d=>included===undefined||d.included===included).map(d=>({drawing_id:p.drawing_id,page:p.page,digest:p.digest,x:d.x,y:d.y,score:1})));
  function applyNativeRejections(itemId,disciplineId,source,exampleId) {
    if(!isVectorReviewAlgorithm(source.algorithm))return 0;let rejected=0;
    for(const d of nativeDecisionMarks(source,{included:false})){
      let existing=db.prepare('SELECT * FROM count_marks WHERE (item_id=? OR original_item_id=? OR example_id=?) AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5 ORDER BY reviewed DESC,created,id LIMIT 1').get(itemId,itemId,exampleId,d.drawing_id,d.page,d.x,d.y);
      if(existing&&!existing.included)continue;
      if(existing&&(existing.reviewed||existing.origin==='manual'||existing.item_id!==itemId||existing.example_id!==exampleId))fail('A draft rejection conflicts with an existing correction. Review that saved mark directly.',409);
      if(!existing)existing=insertMark(itemId,disciplineId,d,'automatic',exampleId);
      updateMark(existing.id,{included:false,reviewed:true,version:existing.version});rejected++;
    }
    return rejected;
  }
  function insertMark(itemId,disciplineId,m,origin,exampleId=null) {
    const d=validateMark(disciplineId,m,origin);
    if(db.prepare('SELECT id FROM count_marks WHERE item_id=? AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(itemId,d.id,m.page,m.x,m.y))fail('This location is already counted for this item',409);
    const id=randomUUID();db.prepare('INSERT INTO count_marks (id,item_id,drawing_id,page,x,y,score,origin,included,reviewed,version,created,original_item_id,example_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,itemId,d.id,m.page,m.x,m.y,origin==='manual'?1:m.score,origin,1,origin==='manual'?1:0,1,new Date().toISOString(),itemId,exampleId);return mark(id);
  }
  function updateMark(id,{included,reviewed,version,item_id:destination}={}) {
    const old=mark(id);if(version!==old.version)fail('Match changed. Reload before reviewing.',409);
    if(typeof included!=='boolean'||reviewed!==true)fail('Explicit inclusion and review decision required');
    const target=destination===undefined?old.item_id:destination;
    if(typeof target!=='string')fail('Invalid destination heading');
    if(item(target).discipline_id!==drawing(old.drawing_id).discipline_id)fail('Destination heading belongs to another discipline');
    if(target!==old.item_id&&db.prepare('SELECT id FROM count_marks WHERE item_id=? AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5 AND id<>?').get(target,old.drawing_id,old.page,old.x,old.y,id))fail('Destination already has a match at this location',409);
    db.exec('SAVEPOINT match_decision');
    try {
      db.prepare('UPDATE count_marks SET item_id=?,included=?,reviewed=1,version=version+1 WHERE id=?').run(target,included?1:0,id);
      const updated=mark(id);db.prepare('INSERT INTO count_events VALUES (?,?,?,?,?,?)').run(randomUUID(),id,target!==old.item_id?'reclassify':included?'include':'exclude',JSON.stringify(old),JSON.stringify(updated),new Date().toISOString());
      db.exec('RELEASE match_decision');return updated;
    } catch(error) {db.exec('ROLLBACK TO match_decision; RELEASE match_decision');throw error;}
  }
  return {
    ...drawingRecounts(db,{drawing,item,exampleJSON,validateMark,insertMark,assertAppearanceCorrections,validateNativeResults,nativeDecisionMarks,applyNativeRejections,fail}),
    snapshot(){
      const calibrations=db.prepare('SELECT * FROM calibrations ORDER BY drawing_id,page').all().map(c=>({...c,points:JSON.parse(c.points)}));
      return {countItems:db.prepare('SELECT * FROM count_items ORDER BY created,id').all().map(i=>({...i,example:i.example?JSON.parse(i.example):null})),
        countExamples:db.prepare('SELECT * FROM count_examples ORDER BY created,id').all().map(e=>({...e,example:JSON.parse(e.example)})),
        countMarks:db.prepare('SELECT m.*,coalesce(e.multiplier,1) AS multiplier FROM count_marks m LEFT JOIN count_examples e ON e.id=m.example_id ORDER BY m.created,m.id').all().map(m=>({...m,quantity:m.included?m.multiplier:0})),calibrations,
        countSelectionEvents:db.prepare('SELECT * FROM count_selection_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)})),
        countSelectionDeletions:db.prepare('SELECT * FROM count_selection_deletions ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous)})),
        countDrawingRecounts:db.prepare('SELECT * FROM count_drawing_recounts ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)})),
        countSelectionMoves:db.prepare('SELECT * FROM count_selection_moves ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)})),
        countExampleEvents:db.prepare('SELECT * FROM count_example_events ORDER BY rowid').all(),
        measurementFactorEvents:db.prepare('SELECT * FROM measurement_factor_events ORDER BY rowid').all(),
        countEvents:db.prepare('SELECT * FROM count_events ORDER BY rowid').all().map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)})),
        measurements:db.prepare('SELECT * FROM measurements ORDER BY created,id').all().map(m=>{const points=JSON.parse(m.points),c=calibrations.find(c=>c.drawing_id===m.drawing_id&&c.page===m.page),base=quantity(m.kind,points,c?.metres_per_point);return {...m,points,base_quantity:base,quantity:{...base,value:base.value===null?null:base.value*m.multiplier}};})};
    },
    createCount(disciplineId,{name:value,color='#168a90',example=null,matches=[]}={}){
      requireEntity(disciplineId,'discipline');const label=name(value);
      if(!/^#[0-9a-f]{6}$/i.test(color))fail('Invalid item colour');
      if(!Array.isArray(matches)||matches.length>5000)fail('Too many match results');
      const encoded=example?exampleJSON(disciplineId,example):null;
      if(example)validateNativeResults(example,matches);
      if(!example&&matches.length)fail('Automatic results require a source example');
      const id=randomUUID();db.exec('BEGIN');
      try{const created=new Date().toISOString(),exampleId=encoded?randomUUID():null;db.prepare('INSERT INTO count_items (id,discipline_id,name,color,example,created) VALUES (?,?,?,?,?,?)').run(id,disciplineId,label,color,encoded,created);if(encoded)db.prepare('INSERT INTO count_examples (id,item_id,example,created) VALUES (?,?,?,?)').run(exampleId,id,encoded,created);for(const m of matches)insertMark(id,disciplineId,m,'automatic',exampleId);if(example)applyNativeRejections(id,disciplineId,example,exampleId);db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      return item(id);
    },
    addCountExample(itemId,{version,example,matches}={}) {
      const i=item(itemId);if(version!==i.version)fail('Heading changed. Reload before adding an example.',409);
      const encoded=exampleJSON(i.discipline_id,example);
      if(!Array.isArray(matches)||matches.length>5000)fail('Invalid match results');
      validateNativeResults(example,matches);
      let saved=db.prepare('SELECT * FROM count_examples WHERE item_id=? AND example=?').get(itemId,encoded);
      if(!saved&&db.prepare('SELECT count(*) AS n FROM count_examples WHERE item_id=?').get(itemId).n>=50)fail('Limit of 50 examples per heading reached');
      for(const m of matches)validateMark(i.discipline_id,m,'automatic');
      assertAppearanceCorrections(itemId,example,isVectorReviewAlgorithm(example.algorithm)?nativeDecisionMarks(example):matches,saved?.id);
      let added=0,skipped=0,linked=0;const isNew=!saved;
      db.exec('BEGIN');
      try {
        if(!saved){saved={id:randomUUID()};db.prepare('INSERT INTO count_examples (id,item_id,example,created) VALUES (?,?,?,?)').run(saved.id,itemId,encoded,new Date().toISOString());}
        for(const m of matches){
          validateMark(i.discipline_id,m,'automatic');
          const exists=db.prepare('SELECT * FROM count_marks WHERE (item_id=? OR original_item_id=? OR example_id=?) AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5 ORDER BY (original_item_id=?) DESC,created,id LIMIT 1').get(itemId,itemId,saved.id,m.drawing_id,m.page,m.x,m.y,itemId);
          if(exists){if(exists.origin==='automatic'&&!exists.example_id&&exists.original_item_id===itemId){db.prepare('UPDATE count_marks SET example_id=?,version=version+1 WHERE id=?').run(saved.id,exists.id);db.prepare('INSERT INTO count_events VALUES (?,?,?,?,?,?)').run(randomUUID(),exists.id,'link-example',JSON.stringify(exists),JSON.stringify(mark(exists.id)),new Date().toISOString());linked++;}skipped++;continue;}insertMark(itemId,i.discipline_id,m,'automatic',saved.id);added++;
        }
        const rejected=applyNativeRejections(itemId,i.discipline_id,example,saved.id);
        if(isNew||added||linked||rejected)db.prepare('UPDATE count_items SET example=coalesce(example,?),version=version+1 WHERE id=?').run(encoded,itemId);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {item:item(itemId),example_id:saved.id,added,skipped,linked};
    },
    editCountSelection(exampleId,{version,item_version,elements,matches,scope,expected_marks,rotations,vector,scales,appearance,vectorReview}={}) {
      const e=db.prepare('SELECT * FROM count_examples WHERE id=?').get(exampleId);if(!e)fail('Selection not found',404);
      if(e.version!==version)fail('Selection changed. Reload before editing.',409);
      const source=JSON.parse(e.example),i=item(e.item_id),native=vectorReview!==undefined,pageSet=native&&isVectorPageReviewAlgorithm(vectorReview?.version);
      if(isVectorReviewAlgorithm(source.algorithm)&&!native)fail('Native vector reviews require an explicit Apply decision');
      if(native){
        if(item_version!==i.version)fail('Heading changed. Reload before applying vector review.',409);
        if(!validVectorReview(vectorReview,Array.isArray(matches)?matches.length:-1)||!validElementSelection(elements))fail('Invalid native vector review decision or source elements');
        if([rotations,vector,scales,appearance].some(v=>v!==undefined))fail('Native vector review cannot use legacy matching settings');
        if(isVectorPageReviewAlgorithm(source.algorithm)&&!pageSet)fail('A multi-page vector selection cannot downgrade to a source-page policy');
        if(isVectorReviewAlgorithm(source.algorithm)&&source.vectorReview.anchor.some((v,k)=>v!==vectorReview.anchor[k]))fail('The saved native selection anchor cannot change');
        if(!pageSet&&db.prepare('SELECT drawing_id,page FROM count_marks WHERE example_id=?').all(exampleId).some(m=>m.drawing_id!==source.drawing_id||m.page!==source.page))fail('This selection has results on another page. Preserve them and create a separate source-page selection.',409);
      }
      if(vector!==undefined&&typeof vector!=='boolean')fail('Invalid vector setting');
      if(rotations!==undefined&&typeof rotations!=='boolean')fail('Invalid rotation setting');
      if(scales!==undefined&&typeof scales!=='boolean')fail('Invalid scale setting');
      if(appearance!==undefined&&typeof appearance!=='boolean')fail('Invalid appearance setting');
      const useAppearance=!native&&isAppearanceAlgorithm(source.algorithm);
      if(appearance!==undefined&&appearance!==useAppearance)fail('Choose colour and fine-detail matching only when adding a new selection');
      if(elements===undefined){if(typeof rotations!=='boolean'&&typeof vector!=='boolean'&&typeof scales!=='boolean')fail('Invalid source element selection');elements=source.elements;}
      if(elements!==undefined&&!validElementSelection(elements))fail('Invalid source element selection');
      const rotate=rotations??(useAppearance?source.algorithm===APPEARANCE_MATCHER_VERSION:includesRotations(source.algorithm)),useVector=vector??isVectorAlgorithm(source.algorithm),scale=scales??includesScales(source.algorithm);
      if(useAppearance&&(elements!==undefined||useVector||scale))fail('Colour and fine-detail matching requires an uncleaned selection at its original size');
      if(scale&&!useVector)fail('Scaled symbols require vector geometry');
      const algorithm=native?vectorReview.version:useAppearance?(rotate?APPEARANCE_MATCHER_VERSION:APPEARANCE_FIXED_VERSION):useVector?(scale?(rotate?VECTOR_SCALE_VERSION:VECTOR_SCALE_FIXED_VERSION):(rotate?VECTOR_MATCHER_VERSION:VECTOR_FIXED_VERSION)):elements?(rotate?ROTATION_ELEMENTS_VERSION:'binary-elements-2'):(rotate?ROTATION_MATCHER_VERSION:EXACT_MATCHER_VERSION);
      const definition={...source,algorithm,...(elements?{elements}:{}),...(native?{vectorReview}:{} )},encodedDefinition=exampleJSON(i.discipline_id,definition);
      if(db.prepare('SELECT id FROM count_examples WHERE item_id=? AND example=? AND id<>?').get(i.id,encodedDefinition,exampleId))fail('Another saved selection already uses these matching settings',409);
      if(!Array.isArray(scope)||!scope.length||scope.length>20||scope.some(d=>!d||typeof d.id!=='string'||typeof d.digest!=='string')||new Set(scope.map(d=>d.id)).size!==scope.length)fail('Invalid matching scope');
      if(native&&!pageSet&&(scope.length!==1||scope[0].id!==source.drawing_id))fail('Native vector review scope must be the original source page');
      let pages=0;const scopedPages=new Set();for(const d of scope){const actual=drawing(d.id);if(actual.discipline_id!==i.discipline_id||actual.digest!==d.digest)fail('Drawing scope changed',409);
        if(pageSet){if(!Array.isArray(d.pages)||!d.pages.length||d.pages.length>20||d.pages.some((p,k)=>!Number.isSafeInteger(p)||p<1||p>actual.pages.length||k>0&&p<=d.pages[k-1]))fail('Explicit sorted native scope pages required');for(const p of d.pages)scopedPages.add(JSON.stringify([d.id,p]));pages+=d.pages.length;}else pages+=native?1:actual.pages.length;
      }if(pages>20)fail('Select a scope of at most 20 pages');
      if(pageSet){
        const bundles=vectorReviewPages(definition);if(scopedPages.size!==bundles.length||bundles.some(p=>!scopedPages.has(JSON.stringify([p.drawing_id,p.page]))||scope.find(d=>d.id===p.drawing_id)?.digest!==p.digest))fail('Native page bundles must exactly match declared scope');
      }
      const ids=new Set(scope.map(d=>d.id));if(!ids.has(source.drawing_id))fail('Scope must contain the selection source');
      if(!Array.isArray(matches)||matches.length>5000||!Array.isArray(expected_marks)||expected_marks.length>5000||expected_marks.some(m=>!m||typeof m.id!=='string'||!Number.isInteger(m.version)))fail('Invalid matching results');
      // Explicit page-set Apply may change the future search scope. Snapshot all
      // existing example marks, and preserve every mark outside that scope.
      const previous=db.prepare('SELECT * FROM count_marks WHERE example_id=? ORDER BY id').all(exampleId).filter(m=>pageSet||ids.has(m.drawing_id));
      if(expected_marks.length!==previous.length||new Set(expected_marks.map(m=>m.id)).size!==expected_marks.length||previous.some(m=>!expected_marks.some(p=>p.id===m.id&&p.version===m.version)))fail('Matches changed. Reload before editing.',409);
      // Selection changes must cover every drawing previously searched by this example.
      if(!pageSet&&db.prepare('SELECT drawing_id FROM count_marks WHERE example_id=?').all(exampleId).some(m=>!ids.has(m.drawing_id)))fail('Search all drawings containing this selection before editing');
      validateNativeResults(definition,matches);
      for(const m of matches){validateMark(i.discipline_id,m,'automatic');if(!ids.has(m.drawing_id))fail('Result outside matching scope');}
      const near=(a,b)=>a.drawing_id===b.drawing_id&&a.page===b.page&&Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5;
      const decisionMarks=native?nativeDecisionMarks(definition):matches;
      const obsolete=previous.filter(m=>(!pageSet||scopedPages.has(JSON.stringify([m.drawing_id,m.page])))&&(!native||m.origin==='automatic')&&!m.reviewed&&m.included&&m.item_id===e.item_id&&!decisionMarks.some(n=>near(m,n)));
      assertAppearanceCorrections(i.id,definition,decisionMarks,exampleId,new Set(obsolete.map(m=>m.id)));
      let added=0,skipped=0,rejected=0;db.exec('BEGIN');
      try{
        for(const m of obsolete)db.prepare('DELETE FROM count_marks WHERE id=?').run(m.id);
        const encoded=encodedDefinition;db.prepare('UPDATE count_examples SET example=?,version=version+1 WHERE id=?').run(encoded,exampleId);
        for(const m of matches){const existing=db.prepare('SELECT * FROM count_marks WHERE (item_id=? OR original_item_id=? OR example_id=?) AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5').get(i.id,i.id,exampleId,m.drawing_id,m.page,m.x,m.y);if(existing){skipped++;continue;}insertMark(i.id,i.discipline_id,m,'automatic',exampleId);added++;}
        rejected=applyNativeRejections(i.id,i.discipline_id,definition,exampleId);
        db.prepare('UPDATE count_items SET example=CASE WHEN example=? THEN ? ELSE example END,version=version+1 WHERE id=?').run(e.example,encoded,i.id);
        db.prepare('INSERT INTO count_selection_events VALUES (?,?,?,?,?)').run(randomUUID(),exampleId,JSON.stringify({example:source,version:e.version,marks:previous}),JSON.stringify({example:JSON.parse(encoded),version:e.version+1,scope,added,...(native?{rejected}:{}),removed:obsolete.map(m=>m.id),retained_corrections:previous.filter(m=>m.reviewed||!m.included||m.item_id!==i.id).map(m=>m.id)}),new Date().toISOString());
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {id:exampleId,version:e.version+1,added,removed:obsolete.length,skipped,...(native?{rejected}:{} )};
    },
    moveCountSelection(exampleId,{version,item_version,destination_id,destination_version,expected_marks}={}) {
      const e=db.prepare('SELECT * FROM count_examples WHERE id=?').get(exampleId);if(!e)fail('Selection not found',404);
      if(typeof destination_id!=='string')fail('Destination heading required');
      const source=item(e.item_id),destination=item(destination_id);
      if(source.discipline_id!==destination.discipline_id)fail('Destination heading belongs to another discipline');
      if(version!==e.version||item_version!==source.version||destination_version!==destination.version)fail('Selection or heading changed. Reload before moving.',409);
      if(!Array.isArray(expected_marks)||expected_marks.some(m=>!m||typeof m.id!=='string'||!Number.isInteger(m.version)))fail('Complete match snapshot required');
      const marks=db.prepare('SELECT * FROM count_marks WHERE example_id=? ORDER BY id').all(exampleId),expected=new Map(expected_marks.map(m=>[m.id,m.version]));
      if(expected.size!==expected_marks.length||marks.length!==expected.size||marks.some(m=>expected.get(m.id)!==m.version))fail('Matches changed. Reload before moving.',409);
      if(source.id===destination.id)return {id:exampleId,item_id:destination.id,moved:0,retained:0,version:e.version};
      if(db.prepare('SELECT id FROM count_examples WHERE item_id=? AND example=?').get(destination.id,e.example))fail('Destination already has this selection',409);
      if(db.prepare('SELECT count(*) AS n FROM count_examples WHERE item_id=?').get(destination.id).n>=50)fail('Limit of 50 examples per heading reached');
      const moving=marks.filter(m=>m.item_id===source.id),retained=marks.filter(m=>m.item_id!==source.id);
      for(const m of moving)if(db.prepare('SELECT id FROM count_marks WHERE item_id=? AND drawing_id=? AND page=? AND abs(x-?)<0.5 AND abs(y-?)<0.5 AND id<>?').get(destination.id,m.drawing_id,m.page,m.x,m.y,m.id))fail('Destination already has a match at a moved location. Resolve it before moving.',409);
      const created=new Date().toISOString();db.exec('BEGIN');
      try{
        db.prepare('UPDATE count_examples SET item_id=?,version=version+1 WHERE id=?').run(destination.id,exampleId);
        for(const m of moving){db.prepare('UPDATE count_marks SET item_id=?,version=version+1 WHERE id=?').run(destination.id,m.id);db.prepare('INSERT INTO count_events VALUES (?,?,?,?,?,?)').run(randomUUID(),m.id,'move-selection',JSON.stringify(m),JSON.stringify(mark(m.id)),created);}
        const next=db.prepare('SELECT example FROM count_examples WHERE item_id=? ORDER BY created,id LIMIT 1').get(source.id);
        db.prepare('UPDATE count_items SET example=CASE WHEN example=? THEN ? ELSE example END,version=version+1 WHERE id=?').run(e.example,next?.example??null,source.id);
        db.prepare('UPDATE count_items SET example=coalesce(example,?),version=version+1 WHERE id=?').run(e.example,destination.id);
        db.prepare('INSERT INTO count_selection_moves VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(),source.discipline_id,exampleId,source.id,destination.id,JSON.stringify({selection:e,source,destination,marks}),JSON.stringify({version:e.version+1,moved:moving.map(m=>m.id),retained:retained.map(m=>m.id),source_version:source.version+1,destination_version:destination.version+1}),created);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {id:exampleId,item_id:destination.id,moved:moving.length,retained:retained.length,version:e.version+1};
    },
    deleteCountSelection(exampleId,{version,item_version,expected_marks}={}) {
      const e=db.prepare('SELECT * FROM count_examples WHERE id=?').get(exampleId);if(!e)fail('Selection not found',404);
      const i=item(e.item_id);if(version!==e.version||item_version!==i.version)fail('Selection or heading changed. Reload before deleting.',409);
      if(!Array.isArray(expected_marks)||expected_marks.some(m=>!m||typeof m.id!=='string'||!Number.isInteger(m.version)))fail('Complete match snapshot required');
      const previous=db.prepare('SELECT * FROM count_marks WHERE example_id=? ORDER BY id').all(exampleId),expected=new Map(expected_marks.map(m=>[m.id,m.version]));
      if(expected.size!==expected_marks.length||previous.length!==expected.size||previous.some(m=>expected.get(m.id)!==m.version))fail('Matches changed. Reload before deleting.',409);
      const saved={selection:{...e,example:JSON.parse(e.example)},heading:i,marks:previous,
        reviews:db.prepare('SELECT v.* FROM count_events v JOIN count_marks m ON m.id=v.mark_id WHERE m.example_id=? ORDER BY v.rowid').all(exampleId),
        factors:db.prepare('SELECT * FROM count_example_events WHERE example_id=? ORDER BY rowid').all(exampleId),
        edits:db.prepare('SELECT * FROM count_selection_events WHERE example_id=? ORDER BY rowid').all(exampleId),
        coverage:db.prepare('SELECT * FROM coverage_events WHERE count_item_id=? ORDER BY rowid').all(i.id)};
      let pruned=false;db.exec('BEGIN');
      try{
        db.prepare('DELETE FROM count_marks WHERE example_id=?').run(exampleId);
        db.prepare('DELETE FROM count_examples WHERE id=?').run(exampleId);
        const next=db.prepare('SELECT example FROM count_examples WHERE item_id=? ORDER BY created,id LIMIT 1').get(i.id);
        if(!next&&!db.prepare('SELECT id FROM count_marks WHERE item_id=? OR original_item_id=? LIMIT 1').get(i.id,i.id)){
          db.prepare('DELETE FROM count_items WHERE id=?').run(i.id);pruned=true;
        }else db.prepare('UPDATE count_items SET example=CASE WHEN example=? THEN ? ELSE example END,version=version+1 WHERE id=?').run(e.example,next?.example??null,i.id);
        db.prepare('INSERT INTO count_selection_deletions VALUES (?,?,?,?,?)').run(randomUUID(),i.discipline_id,exampleId,JSON.stringify({...saved,pruned_heading:pruned}),new Date().toISOString());
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {deleted:true,id:exampleId,removed:previous.length,pruned_heading:pruned};
    },
    updateCountMultiplier(exampleId,{version,multiplier}={}) {
      const e=db.prepare('SELECT * FROM count_examples WHERE id=?').get(exampleId);if(!e)fail('Selection not found',404);
      if(version!==e.version)fail('Selection changed. Reload before editing.',409);
      if(!Number.isInteger(multiplier)||multiplier<1||multiplier>10000)fail('Multiplier must be a whole number from 1 to 10000');
      if(multiplier===e.multiplier)return {id:exampleId,multiplier,version:e.version};
      if(db.prepare("SELECT id FROM count_marks WHERE original_item_id=? AND origin='automatic' AND example_id IS NULL LIMIT 1").get(e.item_id))fail('Re-run Add to current for this heading to identify its legacy selections before changing multipliers',409);
      db.exec('BEGIN');
      try{db.prepare('UPDATE count_examples SET multiplier=?,version=version+1 WHERE id=?').run(multiplier,exampleId);db.prepare('INSERT INTO count_example_events VALUES (?,?,?,?,?,?)').run(randomUUID(),exampleId,e.multiplier,multiplier,e.version+1,new Date().toISOString());db.exec('COMMIT');}
      catch(error){db.exec('ROLLBACK');throw error;}
      return {id:exampleId,multiplier,version:e.version+1};
    },
    updateCountItem(itemId,{name:value,color,version}={}) {
      const i=item(itemId);if(version!==i.version)fail('Heading changed. Reload before editing.',409);
      const label=name(value);if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))fail('Invalid item colour');
      db.prepare('UPDATE count_items SET name=?,color=?,version=version+1 WHERE id=?').run(label,color,itemId);return item(itemId);
    },
    addManualMark(itemId,data){const i=item(itemId);return insertMark(itemId,i.discipline_id,data,'manual');},
    updateMark,
    reviewMarks(itemId,decisions){item(itemId);if(!Array.isArray(decisions)||decisions.length>5000)fail('Invalid review batch');
      db.exec('BEGIN');try{for(const decision of decisions){if(mark(decision.id).item_id!==itemId)fail('Match belongs to another item');updateMark(decision.id,decision);}db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}return {reviewed:decisions.length};},
    events(itemId){item(itemId);return db.prepare("SELECT e.* FROM count_events e JOIN count_marks m ON m.id=e.mark_id WHERE m.item_id=? OR m.original_item_id=? OR json_extract(e.previous,'$.item_id')=? OR json_extract(e.current,'$.item_id')=? ORDER BY e.rowid").all(itemId,itemId,itemId,itemId).map(e=>({...e,previous:JSON.parse(e.previous),current:JSON.parse(e.current)}));},
    calibrate(drawingId,{page,points,distance,unit,version}={}){
      geometry(drawingId,page,'length',points);
      if(points.length!==2||typeof distance!=='number'||!Number.isFinite(distance)||distance<=0||distance>1e9||!Object.hasOwn(unitMetres,unit))fail('Calibration requires two points, a positive distance and supported units');
      const previous=db.prepare('SELECT * FROM calibrations WHERE drawing_id=? AND page=?').get(drawingId,page);
      if(version!==(previous?.version||0))fail('Calibration changed. Reload before editing.',409);
      const ratio=distance*unitMetres[unit]/pathLength(points);
      db.prepare('INSERT INTO calibrations VALUES (?,?,?,?,?,?,?) ON CONFLICT(drawing_id,page) DO UPDATE SET points=excluded.points,distance=excluded.distance,unit=excluded.unit,metres_per_point=excluded.metres_per_point,version=excluded.version').run(drawingId,page,JSON.stringify(points),distance,unit,ratio,(previous?.version||0)+1);
      return {metres_per_point:ratio,version:(previous?.version||0)+1};
    },
    createMeasure(drawingId,{page,kind,points,name:value}={}){
      geometry(drawingId,page,kind,points);const id=randomUUID();
      db.prepare('INSERT INTO measurements (id,drawing_id,page,name,kind,points,version,created) VALUES (?,?,?,?,?,?,?,?)').run(id,drawingId,page,name(value),kind,JSON.stringify(points),1,new Date().toISOString());return {id};
    },
    updateMeasure(id,{points,name:value,version,multiplier}={}) {
      const m=db.prepare('SELECT * FROM measurements WHERE id=?').get(id);if(!m)fail('Measurement not found',404);
      if(version!==m.version)fail('Measurement changed. Reload before editing.',409);
      geometry(m.drawing_id,m.page,m.kind,points);const label=name(value);
      const factor=multiplier===undefined?m.multiplier:multiplier;
      if(!validMultiplier(factor))fail('Multiplier must be a whole number from 1 to 10000');
      if(m.kind!=='length'&&factor!==1)fail('Multipliers are supported for lengths only');
      db.exec('BEGIN');
      try {
        db.prepare('UPDATE measurements SET points=?,name=?,multiplier=?,version=version+1 WHERE id=?').run(JSON.stringify(points),label,factor,id);
        if(factor!==m.multiplier)db.prepare('INSERT INTO measurement_factor_events VALUES (?,?,?,?,?,?)').run(randomUUID(),id,m.multiplier,factor,m.version+1,new Date().toISOString());
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return {id,version:m.version+1};
    },
    deleteMeasure(id,version){const m=db.prepare('SELECT * FROM measurements WHERE id=?').get(id);if(!m)fail('Measurement not found',404);if(version!==m.version)fail('Measurement changed',409);db.prepare('DELETE FROM measurements WHERE id=?').run(id);},
  };
}
