// Read-only reconciliation of a heading's source selections on one complete drawing.
export function selectionList(state,itemId,drawingId){
  const rows=(state?.countExamples||[]).filter(e=>e.item_id===itemId).map(record=>({record,matches:0,quantity:0,excluded:0,moved:0}));
  const byExample=new Map(rows.map(r=>[r.record.id,r]));
  const other={matches:0,quantity:0,excluded:0,manual:0,unlinked:0,reclassified:0};
  for(const mark of state?.countMarks||[]){
    if(mark.drawing_id!==drawingId)continue;
    const row=byExample.get(mark.example_id);
    if(mark.item_id!==itemId){if(row&&mark.included)row.moved++;continue;}
    const target=row||other;
    if(!mark.included){target.excluded++;continue;}
    target.matches++;target.quantity+=mark.quantity??mark.multiplier??1;
    if(!row)other[mark.origin==='manual'?'manual':mark.example_id?'reclassified':'unlinked']++;
  }
  return {rows,other,matches:rows.reduce((n,r)=>n+r.matches,other.matches),quantity:rows.reduce((n,r)=>n+r.quantity,other.quantity),excluded:rows.reduce((n,r)=>n+r.excluded,other.excluded)};
}
