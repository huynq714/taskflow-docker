'use strict';
const $ = (selector) => document.querySelector(selector);
let tasks = [];
let activeFilter = 'all';
let editingId = null;
let toastTimeout;
const STATUS_LABEL = {todo:'Cần làm',in_progress:'Đang làm',done:'Hoàn thành'};
const PRIORITY_LABEL = {low:'Ưu tiên thấp',medium:'Trung bình',high:'Ưu tiên cao'};

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2800);
}
async function api(path, options={}) {
  const response = await fetch(path, {headers:{'Content-Type':'application/json'}, ...options});
  if(!response.ok) {
    let message = `Lỗi ${response.status}`;
    try { message = (await response.json()).error || message; } catch(_) {}
    throw new Error(message);
  }
  if(response.status === 204) return null;
  return response.json();
}
function formatDue(value) {
  if(!value) return '';
  const [y,m,d] = value.split('-');
  return `${d}/${m}/${y}`;
}
function isOverdue(task) {
  if(!task.due_date || task.status === 'done') return false;
  const today = new Date();
  const local = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return task.due_date < local;
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text !== undefined) node.textContent = text;
  return node;
}
function renderRow(task) {
  const row = el('article','task-row');
  const check = el('button', `check-btn ${task.status === 'done' ? 'checked' : ''}`, task.status === 'done' ? '✓' : '');
  check.type = 'button'; check.title = task.status === 'done' ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành';
  check.setAttribute('aria-label',check.title);
  check.addEventListener('click', () => updateTask(task.id, {...task,status:task.status === 'done'?'todo':'done'}));
  row.append(check);
  const body = el('div','task-body');
  body.append(el('h3',`task-title ${task.status==='done'?'done':''}`,task.title));
  if(task.description) body.append(el('p','task-description',task.description));
  const tags = el('div','task-tags');
  tags.append(el('span',`pill ${task.priority}`,PRIORITY_LABEL[task.priority]));
  tags.append(el('span',`pill status ${task.status}`,STATUS_LABEL[task.status]));
  if(task.due_date) tags.append(el('span',`due ${isOverdue(task)?'overdue':''}`,`${isOverdue(task)?'⚠ Quá hạn · ':'◷ '}${formatDue(task.due_date)}`));
  body.append(tags);row.append(body);
  const actions = el('div','row-actions');
  const edit = el('button','icon-btn','✎'); edit.type='button'; edit.title='Chỉnh sửa';edit.setAttribute('aria-label',`Sửa ${task.title}`);edit.addEventListener('click',()=>openModal(task));
  const remove = el('button','icon-btn delete','♲'); remove.type='button'; remove.title='Xóa';remove.setAttribute('aria-label',`Xóa ${task.title}`);
  remove.addEventListener('click',async()=>{if(!confirm(`Xóa công việc "${task.title}"?`))return;try{await api(`/api/tasks/${task.id}`,{method:'DELETE'});await loadTasks();showToast('Đã xóa công việc.');}catch(error){showToast(error.message)}});
  actions.append(edit,remove);row.append(actions);
  return row;
}
function render() {
  const counts = {all:tasks.length,todo:0,in_progress:0,done:0};
  tasks.forEach(task => counts[task.status]++);
  $('#countAll').textContent = counts.all;$('#countTodo').textContent=counts.todo;$('#countProgress').textContent=counts.in_progress;$('#countDone').textContent=counts.done;
  $('#tabCountAll').textContent=counts.all;
  $('#taskTotalTag').textContent=`${counts.all} công việc`;
  document.querySelectorAll('[data-filter]').forEach(node => node.classList.toggle('active',node.dataset.filter===activeFilter));
  document.querySelectorAll('[data-view]').forEach(node => node.classList.toggle('active',node.dataset.view===activeFilter));
  const term=$('#searchInput').value.trim().toLocaleLowerCase('vi');
  const priority=$('#priorityFilter').value;
  const visible=tasks.filter(task=>(activeFilter==='all'||task.status===activeFilter)&&(priority==='all'||task.priority===priority)&&(`${task.title} ${task.description}`.toLocaleLowerCase('vi').includes(term)));
  const list=$('#taskList');list.replaceChildren();
  if(!visible.length){const empty=el('div','empty-state');empty.append(el('div','empty-icon','✦'),el('h3','',tasks.length?'Không tìm thấy công việc':'Bắt đầu với công việc đầu tiên'),el('p','',tasks.length?'Hãy thử bộ lọc hoặc từ khóa khác.':'Tạo một công việc mới để xây dựng kế hoạch của riêng bạn.'));list.append(empty);return;}
  visible.forEach(task=>list.append(renderRow(task)));
}
async function loadTasks(){try{tasks=await api('/api/tasks');render()}catch(error){showToast('Không tải được dữ liệu: '+error.message)}}
async function updateTask(id, task){try{await api(`/api/tasks/${id}`,{method:'PUT',body:JSON.stringify({title:task.title,description:task.description,status:task.status,priority:task.priority,due_date:task.due_date})});await loadTasks();showToast('Đã cập nhật công việc.')}catch(error){showToast(error.message)}}
function openModal(task=null){editingId=task?.id??null;$('#modalTitle').textContent=task?'Chỉnh sửa công việc':'Tạo công việc mới';$('#taskTitle').value=task?.title??'';$('#taskDescription').value=task?.description??'';$('#taskPriority').value=task?.priority??'medium';$('#taskStatus').value=task?.status??'todo';$('#taskDue').value=task?.due_date??'';$('#formError').classList.add('hidden');$('#modalOverlay').classList.remove('hidden');$('#taskTitle').focus()}
function closeModal(){$('#modalOverlay').classList.add('hidden');editingId=null}
$('#newTaskBtn').addEventListener('click',()=>openModal());$('#closeModal').addEventListener('click',closeModal);$('#cancelModal').addEventListener('click',closeModal);
$('#modalOverlay').addEventListener('click',(event)=>{if(event.target===$('#modalOverlay'))closeModal()});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!$('#modalOverlay').classList.contains('hidden'))closeModal()});
$('#taskForm').addEventListener('submit',async(event)=>{event.preventDefault();const payload={title:$('#taskTitle').value,description:$('#taskDescription').value,priority:$('#taskPriority').value,status:$('#taskStatus').value,due_date:$('#taskDue').value||null};const button=$('#saveTaskBtn');button.disabled=true;try{await api(editingId?`/api/tasks/${editingId}`:'/api/tasks',{method:editingId?'PUT':'POST',body:JSON.stringify(payload)});const wasEditing=editingId!==null;closeModal();await loadTasks();showToast(wasEditing?'Đã lưu thay đổi.':'Đã tạo công việc mới.')}catch(error){$('#formError').textContent=error.message;$('#formError').classList.remove('hidden')}finally{button.disabled=false}});
document.querySelectorAll('[data-filter]').forEach(node=>node.addEventListener('click',()=>{activeFilter=node.dataset.filter;render()}));
document.querySelectorAll('[data-view]').forEach(node=>node.addEventListener('click',()=>{activeFilter=node.dataset.view;render()}));
$('#searchInput').addEventListener('input',render);$('#priorityFilter').addEventListener('change',render);
$('#todayLabel').textContent=new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
loadTasks();
