export function drawingChoices(state,selection={}){
  const entities=state.entities||[],drawings=state.drawings||[],pick=(items,id)=>items.find(x=>x.id===id)||items[0]||null;
  const projects=entities.filter(e=>e.kind==='project'),project=pick(projects,selection.projectId);
  const takeoffs=entities.filter(e=>e.kind==='takeoff'&&e.parent_id===project?.id),takeoff=pick(takeoffs,selection.takeoffId);
  const disciplines=entities.filter(e=>e.kind==='discipline'&&e.parent_id===takeoff?.id),discipline=pick(disciplines,selection.disciplineId);
  const available=drawings.filter(d=>d.discipline_id===discipline?.id),drawing=pick(available,selection.drawingId);
  return {projects,takeoffs,disciplines,drawings:available,project,takeoff,discipline,drawing};
}
export function initialDrawingSelection(state,base){
  const discipline=state.entities.find(e=>e.id===base?.discipline_id),takeoff=state.entities.find(e=>e.id===discipline?.parent_id),project=state.entities.find(e=>e.id===takeoff?.parent_id);
  const alternate=state.drawings.find(d=>d.discipline_id===discipline?.id&&d.id!==base?.id);
  return {projectId:project?.id,takeoffId:takeoff?.id,disciplineId:discipline?.id,drawingId:alternate?.id||base?.id};
}
export function setupDrawingPicker({prefix,context,onChoose}){
  const $=name=>document.getElementById(`${prefix}-${name}`);
  const fields=[['project','projects'],['takeoff','takeoffs'],['discipline','disciplines'],['drawing','drawings']];
  const selection=()=>Object.fromEntries(fields.map(([name])=>[`${name}Id`,$(name).value]));
  function render(ids){
    const choices=drawingChoices(context().state,ids);
    for(const [name,plural]of fields){const select=$(name);select.replaceChildren();for(const item of choices[plural]){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}select.value=choices[name]?.id||'';select.disabled=!choices[plural].length;}
    $('page').value=1;$('page').max=choices.drawing?.pages.length||1;$('page').disabled=!choices.drawing;
    $('submit').disabled=!choices.drawing;$('empty').hidden=!!choices.drawing;
  }
  for(const [name]of fields)$(name).onchange=()=>render(selection());
  $(`form`).onsubmit=e=>{e.preventDefault();const ids=selection(),choices=drawingChoices(context().state,ids),drawing=choices.drawing,page=Number($('page').value);if(!drawing||drawing.id!==ids.drawingId||!Number.isInteger(page)||page<1||page>drawing.pages.length)return;$('dialog').close();onChoose(drawing,page);};
  document.getElementById(`cancel-${prefix}-picker`).onclick=()=>$('dialog').close();
  return {open(){const c=context();render(initialDrawingSelection(c.state,c.drawing));$('dialog').showModal();$('project').focus();}};
}
