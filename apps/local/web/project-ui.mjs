import {PROJECT_STATUSES,LOCAL_OWNER,projectRows} from './project-model.mjs';
const $=id=>document.getElementById(id);
export function setupProjects({state,api,reload,paint,open,home,node,button,notice}){
  let scope='active',sort='created',direction=-1,editing=null,saving=false;
  const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const merged=id=>projectRows(state(),{scope:'active'}).concat(projectRows(state(),{scope:'archived'})).find(p=>p.id===id);
  function show(project=null){
    if(saving)return;editing=project;$('project-dialog-title').textContent=project?'Edit project':'Create a new project';
    $('project-name').value=project?.name??'';$('project-owner').value=project?.owner??LOCAL_OWNER;
    $('project-customer').value=project?.customer??'';$('project-building-type').value=project?.building_type??'';$('project-due-date').value=project?.due_date??'';
    $('project-status').replaceChildren(...PROJECT_STATUSES.map(value=>{const option=node('option',value);option.value=value;return option;}));$('project-status').value=project?.status??'Takeoff';
    $('project-save').textContent=project?'Save changes':'Create project';$('project-error').textContent='';$('project-dialog').showModal();$('project-name').focus();
  }
  $('project-cancel').onclick=()=>{if(!saving)$('project-dialog').close();};
  $('project-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  $('project-form').onsubmit=async e=>{
    e.preventDefault();if(saving)return;saving=true;$('project-save').disabled=true;$('project-cancel').disabled=true;
    const name=$('project-name').value,metadata={owner:$('project-owner').value,customer:$('project-customer').value,building_type:$('project-building-type').value,due_date:$('project-due-date').value,status:$('project-status').value};
    try{const result=editing?await api(`/api/projects/${editing.id}`,json('PATCH',{...metadata,name,version:editing.version})):await api('/api/entities',json('POST',{kind:'project',name,metadata}));$('project-dialog').close();await reload();open(editing?.id??result.id);notice(editing?'Project updated':'Project created');}
    catch(error){$('project-error').textContent=error.message;}
    finally{saving=false;$('project-save').disabled=false;$('project-cancel').disabled=false;}
  };
  async function update(project,fields){try{await api(`/api/projects/${project.id}`,json('PATCH',{...fields,version:project.version}));await reload();notice(fields.archived===true?'Project archived':fields.archived===false?'Project restored':'Project updated');}catch(error){await reload();notice(error.message,true);}}
  function navigation(){
    const list=$('projects');list.replaceChildren();
    for(const [key,label] of [['active','Active'],['own','Own'],['archived','Archived']]){
      const b=button('',()=>{scope=key;$('project-filter').value='';home();},'project-link');b.dataset.scope=key;b.classList.toggle('active',scope===key);b.setAttribute('aria-current',scope===key?'page':'false');b.append(node('span',label),node('span',String(projectRows(state(),{scope:key}).length),'project-count'));list.append(b);
    }
  }
  function index(content,actions){
    $('heading').textContent={active:'Active',own:'Own',archived:'Archived'}[scope];$('subtitle').textContent='';
    $('project-search').hidden=false;actions.append(button('+ Create project',()=>show(),'primary'));
    const wrap=node('div',null,'project-table-wrap'),table=node('table',null,'project-table');table.setAttribute('aria-label',`${$('heading').textContent} projects`);
    const thead=node('thead'),header=node('tr');
    for(const [key,label]of [['name','Project Name'],['customer','Customer'],['building_type','Building type'],['owner','Owner'],['status','Status'],['created','Created'],['due_date','Due Date']]){
      const th=node('th');th.scope='col';th.setAttribute('aria-sort',sort===key?(direction===1?'ascending':'descending'):'none');th.append(button(label+(sort===key?(direction===1?' ↑':' ↓'):''),()=>{direction=sort===key?-direction:1;sort=key;paint();}));header.append(th);
    }
    const actionHeader=node('th');actionHeader.scope='col';actionHeader.setAttribute('aria-label','Project actions');header.append(actionHeader);thead.append(header);table.append(thead);
    const tbody=node('tbody'),rows=projectRows(state(),{scope,sort,direction,filter:$('project-filter').value});
    for(const p of rows){
      const row=node('tr');row.dataset.projectId=p.id;const name=node('td');name.append(button(p.name,()=>open(p.id),'project-name-link'));row.append(name);
      for(const text of [p.customer,p.building_type,p.owner])row.append(node('td',text||'—'));
      const status=node('td'),select=node('select');select.setAttribute('aria-label',`Status for ${p.name}`);select.className='project-status';select.dataset.status=p.status;
      for(const value of PROJECT_STATUSES){const option=node('option',value);option.value=value;select.append(option);}select.value=p.status;select.onchange=()=>{select.disabled=true;update(p,{status:select.value});};status.append(select);row.append(status);
      for(const date of [p.created.slice(0,10),p.due_date]){const cell=node('td'),time=node('time',date||'—');if(date)time.dateTime=date;cell.append(time);row.append(cell);}
      const cell=node('td'),menu=node('details',null,'project-menu'),summary=node('summary','⋯');summary.setAttribute('aria-label',`Actions for ${p.name}`);const popup=node('div');popup.append(button('Edit project',()=>{menu.open=false;show(p);}),button(p.archived?'Restore project':'Archive project',()=>{menu.open=false;update(p,{archived:!p.archived});}));menu.append(summary,popup);cell.append(menu);row.append(cell);tbody.append(row);
    }
    if(!rows.length){const row=node('tr'),cell=node('td',$('project-filter').value?'No matching projects':scope==='archived'?'No archived projects':'No projects yet');cell.colSpan=8;cell.className='project-table-empty';row.append(cell);tbody.append(row);}
    table.append(tbody);wrap.append(table);content.append(wrap);
  }
  function details(project,content,actions){
    const p=merged(project.id);actions.prepend(button('← Projects',home),button('Edit project',()=>show(p)));
    const summary=node('div',null,'project-metadata-summary');
    for(const [label,value]of [['Customer',p.customer],['Building type',p.building_type],['Owner',p.owner],['Status',p.status],['Due date',p.due_date]]){const item=node('div');item.append(node('small',label),node('span',value||'—'));summary.append(item);}if(p.archived)summary.append(node('strong','Archived'));
    content.append(summary,node('h2','Takeoffs','project-section-title'));
  }
  $('project-filter').oninput=paint;
  return {navigation,index,details,create:()=>show()};
}
