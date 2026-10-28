// Retain historical heading records for attribution while hiding emptied move sources.
export function visibleCountHeadings(state,disciplineId){
 const movedFrom=new Set((state.countSelectionMoves||[]).map(e=>e.source_item_id)),used=new Set([...(state.countExamples||[]).map(e=>e.item_id),...(state.countMarks||[]).map(m=>m.item_id)]);
 return (state.countItems||[]).filter(i=>i.discipline_id===disciplineId&&(!movedFrom.has(i.id)||used.has(i.id)));
}
