import {countGroupSections} from './count-groups.mjs';
const $=id=>document.getElementById(id);
export function setupCountGroups({context,api,reload,node,button,notice,paint,hiddenMarkers,onVisibilityChange}){
 const collapsed=new Set();let pending=null,dragged=null,busy=false;
 const dialog=node('dialog');dialog.id='count-group-dialog';dialog.setAttribute('aria-labelledby','count-group-title');
 const form=node('form'),title=node('h2'),label=node('label'),input=node('input'),choice=node('select'),error=node('p'),actions=node('div',null,'dialog-actions');
 title.id='count-group-title';input.id='count-group-name';input.maxLength=160;choice.id='count-group-choice';error.id='count-group-error';error.setAttribute('role','alert');
 const cancel=button('Cancel',close),save=button('Save',()=>{});cancel.type='button';save.type='submit';save.className='primary';actions.append(cancel,save);form.append(title,label,input,choice,error,actions);dialog.append(form);document.body.append(dialog);
 const snapshot=()=>{const c=context(),id=c.drawing?.discipline_id;return {id,version:(c.state.countGroupScopes||[]).find(s=>s.discipline_id===id)?.version??0};};
 const groups=()=>(context().state.countGroups||[]).filter(g=>g.discipline_id===context().drawing?.discipline_id);
 function close(){if(busy)return;pending=null;dialog.close();}
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 function open(kind,record=null){
  if(busy||!context().drawing)return;pending={...snapshot(),kind,record};title.textContent=kind==='create'?'Create group':kind==='rename'?'Rename group':kind==='delete'?'Delete empty group':`Group for ${record.name}`;
  const naming=kind==='create'||kind==='rename';input.hidden=!naming;input.required=naming;choice.hidden=kind!=='assign';label.textContent=naming?'Group name':kind==='assign'?'Destination group':`Delete ${record.name}? Move all its items out before deleting it.`;label.htmlFor=naming?input.id:choice.id;input.value=kind==='rename'?record.name:'';choice.replaceChildren();
  if(kind==='assign'){for(const g of [...groups(),{id:'',name:'Misc'}]){const option=node('option',g.name);option.value=g.id;choice.append(option);}choice.value=(context().state.countGroupMembers||[]).find(m=>m.item_id===record.id)?.group_id??'';}
  error.textContent='';save.textContent=kind==='delete'?'Delete group':kind==='create'?'Create group':'Save';dialog.showModal();(naming?input:kind==='assign'?choice:cancel).focus();
 }
 async function write(saved,groupId){
  const kind=saved.kind,path=kind==='create'?`/api/disciplines/${saved.id}/count-groups`:kind==='assign'?`/api/items/${saved.record.id}/group`:`/api/count-groups/${saved.record.id}`;
  const body={version:saved.version,...(kind==='assign'?{group_id:groupId}:kind!=='delete'?{name:input.value}:{})};
  await api(path,{method:kind==='create'?'POST':kind==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});await reload();paint();
 }
 form.onsubmit=async e=>{e.preventDefault();if(!pending||busy)return;busy=true;save.disabled=cancel.disabled=input.disabled=choice.disabled=true;
  try{await write(pending,choice.value||null);busy=false;close();notice('Groups saved');}catch(e){error.textContent=e.message;}finally{busy=false;save.disabled=cancel.disabled=input.disabled=choice.disabled=false;}
 };
 function key(g){return `${snapshot().id}/${g.id??'misc'}`;}
 $('create-count-group').onclick=()=>open('create');
 $('collapse-count-groups').onclick=()=>{const sections=[...groups(),{id:null}],fold=sections.some(g=>!collapsed.has(key(g)));for(const g of sections)fold?collapsed.add(key(g)):collapsed.delete(key(g));paint();};
 function dropTarget(element,g){
  element.addEventListener('dragover',e=>{if(!dragged||busy||dragged.id!==snapshot().id)return;e.preventDefault();e.dataTransfer.dropEffect='move';element.classList.add('heading-drop-target');});
  element.addEventListener('dragleave',()=>element.classList.remove('heading-drop-target'));
  element.addEventListener('drop',e=>{element.classList.remove('heading-drop-target');if(!dragged||busy||dragged.id!==snapshot().id||e.dataTransfer.getData('application/x-fire-heading')!==dragged.record.id)return;e.preventDefault();e.stopPropagation();const saved=dragged;dragged=null;busy=true;write(saved,g.id).then(()=>notice(`Heading moved to ${g.name}`)).catch(e=>notice(e.message,true)).finally(()=>{busy=false;});});
 }
 return {
  create:()=>open('create'),
  attach(row,item){
   const handle=row.querySelector('.count-item');handle.draggable=true;handle.title='Drag this heading to a group';handle.addEventListener('dragstart',e=>{if(busy){e.preventDefault();return;}dragged={...snapshot(),kind:'assign',record:item};e.dataTransfer.setData('application/x-fire-heading',item.id);e.dataTransfer.effectAllowed='move';});
   handle.addEventListener('dragend',()=>{dragged=null;document.querySelectorAll('.heading-drop-target').forEach(e=>e.classList.remove('heading-drop-target'));});
   const assign=button('Group',()=>open('assign',item),'heading-group-action');assign.setAttribute('aria-label',`Choose group for ${item.name}`);row.append(assign);
  },
  render(list,items,filter,renderItem){
   const state=context().state,id=snapshot().id,all=countGroupSections(state,id,items),sections=countGroupSections(state,id,items,filter),hasGroups=groups().length>0;
   $('collapse-count-groups').hidden=!hasGroups;$('collapse-count-groups').textContent=all.every(g=>collapsed.has(key(g)))?'Expand groups':'Collapse groups';
   for(const g of sections){if(!g.name){for(const item of g.items)list.append(renderItem(item));continue;}
    const section=node('section',null,'count-group');section.dataset.groupId=g.id??'misc';const header=node('div',null,'count-group-header'),folded=!filter.trim()&&collapsed.has(key(g));
    const fold=button(`${folded?'▸':'▾'} ${g.name}`,()=>{collapsed.has(key(g))?collapsed.delete(key(g)):collapsed.add(key(g));paint();},'count-group-name');fold.setAttribute('aria-expanded',String(!folded));fold.setAttribute('aria-label',`${folded?'Expand':'Collapse'} ${g.name}`);header.append(fold);
    const members=all.find(s=>s.id===g.id)?.items||[],hidden=members.length>0&&members.every(i=>hiddenMarkers.has(i.id));
    const visibility=button(hidden?'○':'◉',()=>{const hide=members.some(i=>!hiddenMarkers.has(i.id));for(const i of members)hide?hiddenMarkers.add(i.id):hiddenMarkers.delete(i.id);paint();onVisibilityChange();},'marker-visibility');visibility.disabled=!members.length;visibility.setAttribute('aria-pressed',String(hidden));visibility.setAttribute('aria-label',`${hidden?'Show':'Hide'} ${g.name} markers`);header.append(visibility);
    if(g.id){const rename=button('Rename',()=>open('rename',g),'group-action'),remove=button('Delete',()=>open('delete',g),'group-action');rename.setAttribute('aria-label',`Rename ${g.name} group`);remove.setAttribute('aria-label',`Delete ${g.name} group`);header.append(rename,remove);}
    section.append(header);dropTarget(section,g);if(!folded)for(const item of g.items)section.append(renderItem(item));list.append(section);
   }
  }
 };
}
