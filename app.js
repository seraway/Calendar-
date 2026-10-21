const $ = id => document.getElementById(id);
const STORAGE_KEY = "workTasksCalendar.v1";
const todayISO = () => toISO(new Date());
function toISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function fromISO(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12);}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
function startOfWeek(d){const x=new Date(d);x.setDate(x.getDate()-((x.getDay()+6)%7));x.setHours(12,0,0,0);return x;}
function sameDay(a,b){return toISO(a)===toISO(b);}
function pretty(d,opts={weekday:"short",month:"short",day:"numeric"}){return d.toLocaleDateString(undefined,opts);}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
let tasks = loadTasks();
let selectedDate = todayISO();
let anchorDate = new Date(); anchorDate.setHours(12,0,0,0);
let viewMode = "week";
let toastTimer;
function loadTasks(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}}
function persist(){localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks));}
function occurrenceDates(task,start,end){
  const dates=[];let d=fromISO(start),last=fromISO(end),limit=0;
  if(d>last)return dates;
  while(d<=last && limit++<500){
    let match=false;
    if(task.repeat==="none") match=toISO(d)===task.date;
    else if(d>=fromISO(task.date)){
      if(task.repeat==="daily")match=true;
      if(task.repeat==="weekdays")match=d.getDay()>=1&&d.getDay()<=5;
      if(task.repeat==="weekly")match=(task.days||[]).includes(d.getDay());
      if(task.repeat==="monthly"){
        const wanted=Number(task.monthDay||fromISO(task.date).getDate());
        const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
        match=d.getDate()===Math.min(wanted,lastDay);
      }
    }
    if(match)dates.push(toISO(d));
    d=addDays(d,1);
  }
  return dates;
}
function isOccurrence(task,date){return occurrenceDates(task,date,date).length>0}
function isDone(task,date){return !!(task.completedDates||[]).includes(date)}
function visibleTasks(date){return tasks.filter(t=>isOccurrence(t,date)).sort((a,b)=>({high:0,medium:1,low:2}[a.priority]-({high:0,medium:1,low:2}[b.priority]))||a.name.localeCompare(b.name));}
function renderStats(){
  const all=visibleTasks(todayISO());
  $("openCount").textContent=all.filter(t=>!isDone(t,todayISO())).length;
  $("highCount").textContent=all.filter(t=>t.priority==="high"&&!isDone(t,todayISO())).length;
  $("doneCount").textContent=all.filter(t=>isDone(t,todayISO())).length;
}
function renderCalendar(){
  const cal=$("calendar");cal.innerHTML="";
  $("periodTitle").textContent=viewMode==="month"?anchorDate.toLocaleDateString(undefined,{month:"long",year:"numeric"}):viewMode==="list"?"Upcoming tasks":`${pretty(startOfWeek(anchorDate),{month:"short",day:"numeric"})} – ${pretty(addDays(startOfWeek(anchorDate),6),{month:"short",day:"numeric",year:"numeric"})}`;
  if(viewMode==="week"){
    const grid=document.createElement("div");grid.className="week-grid";
    const start=startOfWeek(anchorDate);
    for(let i=0;i<7;i++){const d=addDays(start,i),iso=toISO(d),dayTasks=visibleTasks(iso);
      const cell=document.createElement("div");cell.className="day-cell"+(iso===selectedDate?" selected":"")+(iso===todayISO()?" today":"");
      cell.innerHTML=`<div class="day-name">${pretty(d,{weekday:"short"})}</div><div class="day-number">${d.getDate()}</div>${dayTasks.slice(0,3).map(t=>`<div class="mini-task ${esc(t.priority)} ${isDone(t,iso)?"done":""}" title="${esc(t.name)}">${esc(t.name)}</div>`).join("")}${dayTasks.length>3?`<div class="more-tasks">+${dayTasks.length-3} more</div>`:""}`;
      cell.addEventListener("click",()=>{selectedDate=iso;anchorDate=new Date(d);renderAll();});grid.append(cell);
    }cal.append(grid);
  }else if(viewMode==="month"){
    const first=new Date(anchorDate.getFullYear(),anchorDate.getMonth(),1,12),offset=(first.getDay()+6)%7,start=addDays(first,-offset);
    const grid=document.createElement("div");grid.className="month-grid";
    ["MON","TUE","WED","THU","FRI","SAT","SUN"].forEach(n=>{const e=document.createElement("div");e.className="month-label";e.textContent=n;grid.append(e)});
    for(let i=0;i<42;i++){const d=addDays(start,i),iso=toISO(d),dayTasks=visibleTasks(iso),cell=document.createElement("div");cell.className="month-cell"+(iso===selectedDate?" selected":"")+(d.getMonth()!==anchorDate.getMonth()?" outside":"")+(iso===todayISO()?" today":"");
      cell.innerHTML=`<div class="day-number">${d.getDate()}</div>${dayTasks.slice(0,2).map(t=>`<div class="mini-task ${esc(t.priority)} ${isDone(t,iso)?"done":""}">${esc(t.name)}</div>`).join("")}${dayTasks.length>2?`<div class="more-tasks">+${dayTasks.length-2}</div>`:""}`;
      cell.addEventListener("click",()=>{selectedDate=iso;anchorDate=new Date(d);renderAll();});grid.append(cell);
    }cal.append(grid);
  }else{
    const end=toISO(addDays(new Date(),30)),start=todayISO(),items=[];
    tasks.forEach(t=>occurrenceDates(t,start,end).forEach(date=>items.push({t,date})));
    items.sort((a,b)=>a.date.localeCompare(b.date)||({high:0,medium:1,low:2}[a.t.priority]-({high:0,medium:1,low:2}[b.t.priority])));
    if(!items.length){cal.innerHTML='<div class="empty-state"><strong>No upcoming tasks</strong>Add a task to start planning.</div>';return;}
    const list=document.createElement("div");list.className="list-view";
    items.slice(0,80).forEach(({t,date})=>{const row=document.createElement("div");row.className="task-card"+(isDone(t,date)?" completed":"");row.innerHTML=`<div class="task-main"><div class="list-date">${pretty(fromISO(date),{weekday:"long",month:"short",day:"numeric"})}</div><div class="task-title">${esc(t.name)}</div><div class="task-meta"><span class="pill ${esc(t.priority)}">${esc(t.priority.toUpperCase())}</span></div></div>`;row.addEventListener("click",()=>{selectedDate=date;anchorDate=fromISO(date);viewMode="week";$("viewMode").value="week";renderAll()});list.append(row)});cal.append(list);
  }
}
function repeatLabel(t){return ({none:"One time",daily:"Every day",weekdays:"Mon–Fri",weekly:"Weekly: "+(t.days||[]).map(n=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][n]).join(", "),monthly:`Monthly · day ${t.monthDay||fromISO(t.date).getDate()}`})[t.repeat]||"";}
function renderTasks(){
  const date=selectedDate;const filter=$("taskFilter").value;
  $("selectedTitle").textContent=`Tasks for ${pretty(fromISO(date),{weekday:"long",month:"short",day:"numeric"})}`;
  let list=visibleTasks(date);
  if(filter==="open")list=list.filter(t=>!isDone(t,date));
  if(filter==="completed")list=list.filter(t=>isDone(t,date));
  if(filter==="high")list=list.filter(t=>t.priority==="high");
  const host=$("taskList");host.innerHTML="";
  if(!list.length){host.innerHTML=`<div class="empty-state"><strong>${filter==="completed"?"Nothing completed yet":"No tasks here"}</strong>${filter==="open"?"Enjoy the space, or add a task for this day.":"Try another filter or create a new task."}</div>`;return;}
  list.forEach(t=>{
    const done=isDone(t,date),card=document.createElement("div");card.className="task-card"+(done?" completed":"");
    card.innerHTML=`<input class="task-check" type="checkbox" aria-label="Mark ${esc(t.name)} complete" ${done?"checked":""}><div class="task-main"><div class="task-title">${esc(t.name)}</div>${t.description?`<div class="task-desc">${esc(t.description)}</div>`:""}<div class="task-meta"><span class="pill ${esc(t.priority)}">${esc(t.priority.toUpperCase())} PRIORITY</span><span class="repeat-tag">↻ ${esc(repeatLabel(t))}</span></div></div><div class="task-actions"><button class="small-btn edit-btn">Edit</button><button class="small-btn delete-btn">Delete</button></div>`;
    card.querySelector(".task-check").addEventListener("change",e=>{t.completedDates=t.completedDates||[];if(e.target.checked){if(!t.completedDates.includes(date))t.completedDates.push(date)}else t.completedDates=t.completedDates.filter(x=>x!==date);persist();renderAll();showToast(e.target.checked?"Task completed":"Task reopened")});
    card.querySelector(".edit-btn").addEventListener("click",()=>openTaskDialog(t));
    card.querySelector(".delete-btn").addEventListener("click",()=>deleteTask(t));
    host.append(card);
  });
}
function renderAll(){renderStats();renderCalendar();renderTasks();}
function openTaskDialog(task=null){
  $("taskForm").reset();$("formError").classList.add("hidden");$("taskId").value=task?.id||"";
  $("dialogTitle").textContent=task?"Edit task":"Create a task";
  $("taskName").value=task?.name||"";$("taskDescription").value=task?.description||"";$("taskDate").value=task?.date||selectedDate;
  $("taskPriority").value=task?.priority||"medium";$("repeatType").value=task?.repeat||"none";
  $("monthDay").innerHTML=Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}${[1,21,31].includes(i+1)?"st":[2,22].includes(i+1)?"nd":[3,23].includes(i+1)?"rd":"th"}</option>`).join("");
  $("monthDay").value=String(task?.monthDay||fromISO(task?.date||selectedDate).getDate());
  document.querySelectorAll("#weekdayPicker input").forEach(x=>x.checked=(task?.days||[]).includes(Number(x.value)));
  updateRepeatFields();$("taskDialog").showModal();setTimeout(()=>$("taskName").focus(),50);
}
function updateRepeatFields(){$("weekdayPicker").classList.toggle("hidden",$("repeatType").value!=="weekly");$("monthlyPicker").classList.toggle("hidden",$("repeatType").value!=="monthly");}
function deleteTask(task){if(!confirm(`Delete "${task.name}"?`))return;tasks=tasks.filter(t=>t.id!==task.id);persist();renderAll();showToast("Task deleted");}
function showToast(message){const t=$("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2300);}
$("newTaskTop").addEventListener("click",()=>openTaskDialog());
$("closeDialog").addEventListener("click",()=>$("taskDialog").close());
$("cancelDialog").addEventListener("click",()=>$("taskDialog").close());
$("repeatType").addEventListener("change",updateRepeatFields);
$("taskForm").addEventListener("submit",e=>{
  e.preventDefault();const name=$("taskName").value.trim(),repeat=$("repeatType").value;
  if(!name){$("formError").textContent="Please enter a task name.";$("formError").classList.remove("hidden");return;}
  const days=[...document.querySelectorAll("#weekdayPicker input:checked")].map(x=>Number(x.value));
  if(repeat==="weekly"&&!days.length){$("formError").textContent="Choose at least one day for a weekly task.";$("formError").classList.remove("hidden");return;}
  const id=$("taskId").value||crypto.randomUUID();
  const old=tasks.find(t=>t.id===id);
  const task={id,name,description:$("taskDescription").value.trim(),date:$("taskDate").value,priority:$("taskPriority").value,repeat,days:repeat==="weekly"?days:[],monthDay:Number($("monthDay").value),completedDates:old?.completedDates||[],createdAt:old?.createdAt||new Date().toISOString()};
  if(old)tasks=tasks.map(t=>t.id===id?task:t);else tasks.push(task);
  persist();selectedDate=task.date;anchorDate=fromISO(task.date);$("taskDialog").close();renderAll();showToast(old?"Task updated":"Task saved");
});
$("prevPeriod").addEventListener("click",()=>{anchorDate=viewMode==="month"?new Date(anchorDate.getFullYear(),anchorDate.getMonth()-1,15,12):addDays(anchorDate,viewMode==="week"?-7:-1);if(viewMode!=="month")selectedDate=toISO(anchorDate);renderAll()});
$("nextPeriod").addEventListener("click",()=>{anchorDate=viewMode==="month"?new Date(anchorDate.getFullYear(),anchorDate.getMonth()+1,15,12):addDays(anchorDate,viewMode==="week"?7:1);if(viewMode!=="month")selectedDate=toISO(anchorDate);renderAll()});
$("todayBtn").addEventListener("click",()=>{anchorDate=new Date();anchorDate.setHours(12,0,0,0);selectedDate=todayISO();renderAll()});
$("viewMode").addEventListener("change",e=>{viewMode=e.target.value;renderAll()});
$("taskFilter").addEventListener("change",renderTasks);
let deferredInstallPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installBtn").classList.remove("hidden")});
$("installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt){showToast("Use your browser menu and choose Install app or Add to Home screen.");return;}deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("installBtn").classList.add("hidden")});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
renderAll();