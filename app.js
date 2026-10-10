(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const KEYS = {
    tasks: "studiq.tasks.v2", notes: "studiq.notes.v2", habits: "studiq.habits.v2",
    theme: "studiq.theme.v2", settings: "studiq.settings.v2", schedule: "studiq.schedule.v2",
    focus: "studiq.focus.v2", sessions: "studiq.sessions.v2"
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const datePlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
  const defaultTasks = [
    {id:1,title:"ทำแบบฝึกหัดคณิตศาสตร์",subject:"คณิตศาสตร์",due:today(),duration:45,priority:"high",done:false,created:Date.now()},
    {id:2,title:"สรุปบทเรียนเรื่องระบบนิเวศ",subject:"วิทยาศาสตร์",due:today(),duration:45,priority:"medium",done:false,created:Date.now()},
    {id:3,title:"ท่องศัพท์ภาษาอังกฤษ 20 คำ",subject:"ภาษาอังกฤษ",due:today(),duration:25,priority:"low",done:true,created:Date.now()},
    {id:4,title:"อ่านหนังสือเตรียมสอบกลางภาค",subject:"ชีววิทยา",due:datePlus(5),duration:60,priority:"high",done:false,created:Date.now()},
    {id:5,title:"ส่งรายงานประวัติศาสตร์",subject:"สังคมศึกษา",due:datePlus(1),duration:50,priority:"high",done:false,created:Date.now()},
    {id:6,title:"ทบทวนสูตรฟิสิกส์",subject:"ฟิสิกส์",due:datePlus(3),duration:30,priority:"medium",done:false,created:Date.now()}
  ];
  const defaultNotes = [
    {id:1,title:"สูตรคณิตศาสตร์ที่ต้องจำ",subject:"คณิตศาสตร์",content:"• ทบทวนสูตรฟังก์ชัน\\n• ฝึกโจทย์พื้นฐานก่อนโจทย์ประยุกต์\\n• จดข้อผิดพลาดที่พบบ่อย",updated:Date.now()},
    {id:2,title:"Vocabulary — Unit 4",subject:"ภาษาอังกฤษ",content:"รวบรวมคำศัพท์ใหม่ พร้อมตัวอย่างประโยคและความหมายที่ต้องทบทวน",updated:Date.now()},
    {id:3,title:"สรุประบบนิเวศ",subject:"วิทยาศาสตร์",content:"ระบบนิเวศประกอบด้วยสิ่งมีชีวิตและสิ่งไม่มีชีวิตที่มีปฏิสัมพันธ์กัน เช่น ผู้ผลิต ผู้บริโภค และผู้ย่อยสลาย",updated:Date.now()}
  ];
  const defaultHabits = [
    {id:1,name:"อ่านหนังสือ 20 นาที",category:"การเรียน",emoji:"📚",checks:{}},
    {id:2,name:"ทบทวนบทเรียน",category:"การเรียน",emoji:"✍️",checks:{}},
    {id:3,name:"ดื่มน้ำให้เพียงพอ",category:"สุขภาพ",emoji:"💧",checks:{}},
    {id:4,name:"ขยับร่างกาย / ยืดเส้น",category:"สุขภาพ",emoji:"🌿",checks:{}},
    {id:5,name:"เตรียมของสำหรับวันพรุ่งนี้",category:"ชีวิตประจำวัน",emoji:"🎒",checks:{}}
  ];
  function read(key, fallback) { try { const v=localStorage.getItem(key); return v ? JSON.parse(v) : structuredClone(fallback); } catch { return structuredClone(fallback); } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { console.warn("Could not save local data", e); } }
  let tasks = read(KEYS.tasks, defaultTasks), notes = read(KEYS.notes, defaultNotes), habits = read(KEYS.habits, defaultHabits);
  let schedule = read(KEYS.schedule, {}), settings = read(KEYS.settings, {name:"",dayStart:"08:00",sleepTime:"22:30",dailyGoal:120,defaultTheme:"white",availableStart:"16:00",availableEnd:"20:00",breakDuration:10});
  let sessions = read(KEYS.sessions, []), focusedMinutes = Number(read(KEYS.focus, 0)) || 0;
  let taskFilter = "all", currentNoteId = null, currentPage = "dashboard", toastTimer = null;
  let timerLength = 25*60, timerRemaining = timerLength, timerRunning = false, timerInterval = null, timerMode = "focus", focusSubject = "อ่านหนังสือ", sessionStartedAt = null;
  const themes = {white:{label:"White Mode",bg:"#f7f7f7",surface:"#ffffff",text:"#111111",accent:"#111111"},dark:{label:"Dark Mode",bg:"#101114",surface:"#191a1f",text:"#f5f5f6",accent:"#ffffff"},blue:{label:"Sky Blue",bg:"#edf7ff",surface:"#ffffff",text:"#183247",accent:"#438fca"},pink:{label:"Sakura Pink",bg:"#fff3f7",surface:"#ffffff",text:"#47283a",accent:"#d96b98"},green:{label:"Matcha Green",bg:"#f2f7ed",surface:"#ffffff",text:"#2d3c2b",accent:"#668b53"},red:{label:"Crimson Red",bg:"#fff4f3",surface:"#ffffff",text:"#3c2022",accent:"#d9363e"}};
  const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = value => { if(!value) return "ไม่กำหนดวัน"; const d = new Date(value+"T12:00:00"); return d.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"}); };
  const fmtShortDate = value => { if(!value) return "ไม่กำหนด"; if(value===today()) return "วันนี้"; if(value===datePlus(1)) return "พรุ่งนี้"; return fmtDate(value); };
  const priorityLabel = p => ({high:"สูง",medium:"ปานกลาง",low:"ต่ำ"}[p]||"ปานกลาง");
  const priorityScore = task => {
    const dueDays = task.due ? Math.ceil((new Date(task.due+"T00:00:00") - new Date(today()+"T00:00:00"))/86400000) : 7;
    return (task.priority==="high"?30:task.priority==="medium"?18:8) + (dueDays<0?40:dueDays===0?35:dueDays===1?25:dueDays<=3?14:0) + Math.min(Number(task.duration)||30,180)/30;
  };
  function showToast(message) {
    const el=$("#toast"); if(!el) return; el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2300);
  }
  function saveTasks(){write(KEYS.tasks,tasks)}
  function saveNotes(){write(KEYS.notes,notes)}
  function saveHabits(){write(KEYS.habits,habits)}
  function getHabitCount(){return habits.filter(h=>h.checks&&h.checks[today()]).length}
  function getDoneTasks(){return tasks.filter(t=>t.done).length}
  function applyTheme(theme, notify=false) {
    if(!themes[theme]) theme="white";
    document.body.dataset.theme=theme; write(KEYS.theme,theme);
    const meta=$('meta[name="theme-color"]'); if(meta) meta.content=themes[theme].bg;
    $$("[data-theme-choice]").forEach(b=>b.classList.toggle("selected",b.dataset.themeChoice===theme));
    const select=$("#defaultTheme"); if(select) select.value=settings.defaultTheme||"white";
    if(notify) showToast("เปลี่ยนธีมเป็น "+themes[theme].label+" แล้ว");
  }
  function goPage(page) {
    if(!$("#page-"+page)) page="dashboard";
    currentPage=page;
    $$(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
    $$(".nav-link[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
    const names={dashboard:["Dashboard","Overview"],planner:["Smart Planner","Task management"],schedule:["Smart Schedule","Plan your time"],focus:["Focus Room","Deep work"],notes:["My Notes","Knowledge library"],progress:["Progress Analytics","Your progress"],habits:["Habit Tracker","Daily routines"],themes:["Theme Studio","Personalize"],settings:["Settings","Preferences"]};
    $("#pageTitle").innerHTML=names[page][0]+(page==="dashboard"?' <span class="title-spark">✳</span>':"");
    $("#breadcrumbCurrent").textContent=names[page][1];
    $("#sidebar").classList.remove("open");
    if(page==="progress") renderProgress();
    if(page==="schedule") renderSchedule();
    if(page==="notes") renderNotes();
    if(page==="habits") renderHabits();
    if(page==="themes") renderThemeGallery();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  $$(".nav-link[data-page]").forEach(b=>b.addEventListener("click",()=>goPage(b.dataset.page)));
  $$("[data-go]").forEach(b=>b.addEventListener("click",()=>goPage(b.dataset.go)));
  $("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#topTheme").addEventListener("click",()=>goPage("themes"));
  $("#topPrint").addEventListener("click",()=>window.print());
  $("#todayDate").textContent=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}).toUpperCase();

  // Tasks
  function taskMarkup(t, compact=false) {
    const due = fmtShortDate(t.due), meta = `${escapeHTML(t.subject||"ทั่วไป")} · ${due}${t.duration?` · ${t.duration} นาที`:""}`;
    if(compact) return `<div class="compact-task ${t.done?"is-done":""}"><input type="checkbox" class="task-check" data-task-check="${t.id}" ${t.done?"checked":""} aria-label="ทำงานเสร็จ"><div class="task-content"><strong>${escapeHTML(t.title)}</strong><small>${meta}</small></div><span class="tag ${t.priority==="high"?"high":""}">${priorityLabel(t.priority)}</span></div>`;
    return `<div class="task-row ${t.done?"is-done":""}"><input type="checkbox" class="task-check" data-task-check="${t.id}" ${t.done?"checked":""} aria-label="ทำงานเสร็จ"><div class="task-row-main"><div class="task-row-title">${escapeHTML(t.title)}</div><div class="task-row-meta"><span>${escapeHTML(t.subject||"ทั่วไป")}</span><span>ครบกำหนด: ${due}</span><span>${t.duration||30} นาที</span></div></div><span class="tag ${t.priority==="high"?"high":""}">${priorityLabel(t.priority)}</span><div class="task-actions"><button class="mini-action" data-edit-task="${t.id}" title="แก้ไข">แก้ไข</button><button class="mini-action" data-delete-task="${t.id}" title="ลบ">×</button></div></div>`;
  }
  function renderTasks() {
    const sorted=[...tasks].sort((a,b)=>(a.done-b.done)||(priorityScore(b)-priorityScore(a)));
    const subjects=[...new Set(tasks.map(t=>t.subject||"ทั่วไป"))].sort();
    const subjectSelect=$("#subjectFilter"), old=subjectSelect.value;
    subjectSelect.innerHTML='<option value="all">ทุกวิชา</option>'+subjects.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
    if(subjects.includes(old)) subjectSelect.value=old;
    const search=($("#taskSearch").value||"").toLowerCase(), subj=subjectSelect.value;
    const filtered=sorted.filter(t=>(taskFilter==="all"||(taskFilter==="done"?t.done:!t.done))&&(subj==="all"||(t.subject||"ทั่วไป")===subj)&&(`${t.title} ${t.subject}`.toLowerCase().includes(search)));
    $("#plannerTaskList").innerHTML=filtered.length?filtered.map(t=>taskMarkup(t)).join(""):'<div class="empty-state">ไม่พบงานในรายการนี้ ลองเพิ่มงานใหม่ได้เลย ✦</div>';
    $("#plannerCount").textContent=`${filtered.length} จาก ${tasks.length} รายการ`;
    const compact=sorted.filter(t=>!t.done).slice(0,4);
    $("#dashboardTasks").innerHTML=compact.length?compact.map(t=>taskMarkup(t,true)).join(""):'<div class="empty-state">ไม่มีงานค้างแล้ว เยี่ยมมาก! 🎉</div>';
    $("#dashTasksDone").innerHTML=`${getDoneTasks()} <small>/ ${tasks.length}</small>`;
    $("#dashActiveTasks").textContent=tasks.filter(t=>!t.done).length;
    const percent=tasks.length?Math.round(getDoneTasks()/tasks.length*100):0;
    $("#sideProgress").style.width=percent+"%"; $("#sideProgressText").textContent=`${getDoneTasks()} / ${tasks.length} tasks completed`; $("#sidePercent").textContent=percent+"%";
    renderProgressIfVisible();
  }
  $("#taskForm").addEventListener("submit",e=>{
    e.preventDefault(); const title=$("#taskTitle").value.trim(); if(!title)return;
    tasks.push({id:Date.now(),title,subject:$("#taskSubject").value.trim()||"ทั่วไป",due:$("#taskDue").value||"",duration:Math.max(5,Number($("#taskDuration").value)||30),priority:$("#taskPriority").value,done:false,created:Date.now()});
    saveTasks(); $("#taskForm").reset(); $("#taskSubject").value="ทั่วไป"; $("#taskDuration").value=45; renderTasks(); renderSchedule(); renderDashboard(); showToast("เพิ่มงานใหม่เรียบร้อยแล้ว");
  });
  $("#plannerAddJump").addEventListener("click",()=>{$("#taskTitle").focus();$("#taskFormPanel").scrollIntoView({behavior:"smooth",block:"center"})});
  $("#taskFilters").addEventListener("click",e=>{const b=e.target.closest("[data-filter]");if(!b)return;taskFilter=b.dataset.filter;$$("[data-filter]").forEach(x=>x.classList.toggle("selected",x===b));renderTasks()});
  $("#subjectFilter").addEventListener("change",renderTasks); $("#taskSearch").addEventListener("input",renderTasks);
  document.addEventListener("change",e=>{
    const check=e.target.closest("[data-task-check]"); if(check){const task=tasks.find(t=>t.id===Number(check.dataset.taskCheck));if(task){task.done=check.checked;task.completedAt=task.done?Date.now():null;saveTasks();renderTasks();renderDashboard();renderSchedule();showToast(task.done?"บันทึกงานเสร็จแล้ว ✓":"ย้ายงานกลับไปยังรายการที่ต้องทำ")}}
  });
  document.addEventListener("click",e=>{
    const del=e.target.closest("[data-delete-task]"); if(del){const t=tasks.find(x=>x.id===Number(del.dataset.deleteTask));if(t&&confirm(`ลบงาน "${t.title}" หรือไม่?`)){tasks=tasks.filter(x=>x.id!==t.id);saveTasks();renderTasks();renderDashboard();renderSchedule();showToast("ลบงานแล้ว")}}
    const edit=e.target.closest("[data-edit-task]"); if(edit){const t=tasks.find(x=>x.id===Number(edit.dataset.editTask));if(!t)return;const title=prompt("แก้ไขชื่องาน",t.title);if(title===null)return;if(!title.trim()){showToast("ชื่องานห้ามว่าง");return}t.title=title.trim();const subject=prompt("วิชา",t.subject||"ทั่วไป");if(subject!==null)t.subject=subject.trim()||"ทั่วไป";const due=prompt("วันครบกำหนด (YYYY-MM-DD) หรือเว้นว่าง",t.due||"");if(due!==null)t.due=/^\d{4}-\d{2}-\d{2}$/.test(due)?due:"";saveTasks();renderTasks();renderSchedule();renderDashboard();showToast("แก้ไขงานแล้ว")}
  });
  function renderDashboard(){
    $("#dashFocusTime").innerHTML=`${focusedMinutes} <small>นาที</small>`;
    $("#dashHabits").innerHTML=`${getHabitCount()} <small>/ ${habits.length}</small>`;
    const entries=(schedule[today()]||[]).slice(0,4);
    $("#dashboardSchedule").innerHTML=entries.length?entries.map((e,i)=>`<div class="timeline-item"><div class="timeline-time">${escapeHTML(e.start)}</div><div class="timeline-event ${["c-blue","c-pink","c-green","c-red"][i%4]}"><strong>${escapeHTML(e.title)}</strong><small>${escapeHTML(e.subject||"Study session")} · ${e.duration} นาที</small></div></div>`).join(""):'<div class="empty-state">ยังไม่มีตารางวันนี้ <br>ไปที่ Smart Schedule เพื่อสร้างตารางได้เลย</div>';
    const completed=getHabitCount(), pct=habits.length?Math.round(completed/habits.length*100):0;
    $("#dashMissionPercent").textContent=pct+"%";$("#dashMissionRing").style.background=`conic-gradient(var(--accent) ${pct}%,var(--surface2) ${pct}%)`;
    $("#dashMissionTitle").textContent=pct===100?"Mission completed!":pct>=50?"You're doing great!":"One step at a time";
    $("#dashMissionCaption").textContent=`เช็กอินแล้ว ${completed} จาก ${habits.length} นิสัย`;
    $("#dashboardHabits").innerHTML=habits.slice(0,3).map(h=>`<label class="mission-line"><input type="checkbox" data-habit-check="${h.id}" ${h.checks&&h.checks[today()]?"checked":""}> ${escapeHTML(h.name)}</label>`).join("");
    $("#miniTimer").textContent=timerDisplay(timerRemaining);
  }
  function renderProgressIfVisible(){if(currentPage==="progress")renderProgress()}

  // Schedule builder, saved per date
  function timeToMinutes(s){if(!s||!s.includes(":"))return 0;const [h,m]=s.split(":").map(Number);return h*60+m}
  function minutesToTime(n){n=Math.max(0,Math.min(1439,n));return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}
  function renderSchedule(){
    const date=$("#scheduleDate").value||today();$("#paperDate").textContent=fmtDate(date);
    const entries=schedule[date]||[];
    $("#scheduleEntries").innerHTML=entries.length?entries.map(e=>`<div class="schedule-entry"><div class="entry-time">${escapeHTML(e.start)} – ${escapeHTML(e.end)}</div><div><div class="entry-title">${escapeHTML(e.title)}</div><div class="entry-meta">${escapeHTML(e.subject||"Study session")}${e.breakAfter?" · พักหลังจบ":""}</div></div><div class="entry-duration">${e.duration} นาที</div></div>`).join(""):'<div class="empty-state">ยังไม่มีตารางสำหรับวันนี้<br>กด “สร้างตารางอัตโนมัติ” หรือเพิ่มงานใน Smart Planner ก่อน</div>';
    renderDashboard();
  }
  $("#scheduleDate").value=today();
  $("#scheduleDate").addEventListener("change",renderSchedule);
  function buildSchedule(){
    const date=$("#scheduleDate").value||today();
    const start=timeToMinutes(settings.availableStart||"16:00"), end=timeToMinutes(settings.availableEnd||"20:00"), pause=Math.max(0,Math.min(60,Number(settings.breakDuration)||0));
    if(end<=start){showToast("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม");return}
    const includeDone=$("#includeCompleted").checked;
    const list=tasks.filter(t=>includeDone||!t.done).sort((a,b)=>priorityScore(b)-priorityScore(a));
    if(!list.length){showToast("ไม่มีงานให้จัดตาราง เพิ่มงานใน Smart Planner ก่อน");return}
    const entries=[];let cursor=start;
    list.forEach(t=>{
      const duration=Math.max(5,Math.min(180,Number(t.duration)||30));
      if(cursor+duration>end)return;
      entries.push({id:t.id,start:minutesToTime(cursor),end:minutesToTime(cursor+duration),title:t.title,subject:t.subject||"ทั่วไป",duration,breakAfter:pause>0});
      cursor+=duration+pause;
    });
    if(!entries.length){showToast("เวลาว่างไม่พอสำหรับงานแรก ลองขยายช่วงเวลาว่าง");return}
    schedule[date]=entries;write(KEYS.schedule,schedule);renderSchedule();showToast(`สร้างตารางแล้ว ${entries.length} งาน`);
  }
  $("#autoSchedule").addEventListener("click",buildSchedule);
  $("#availabilityForm").addEventListener("submit",e=>{
    e.preventDefault();settings.availableStart=$("#availableStart").value;settings.availableEnd=$("#availableEnd").value;settings.breakDuration=Number($("#breakDuration").value)||0;write(KEYS.settings,settings);buildSchedule();
  });
  function printSchedule(){
    if(currentPage!=="schedule")goPage("schedule");
    if(!(schedule[$("#scheduleDate").value]||[]).length){if(!confirm("ยังไม่มีตาราง ต้องการสร้างตารางอัตโนมัติก่อนหรือไม่?"))return;buildSchedule()}
    window.print();
  }
  $("#printSchedule").addEventListener("click",printSchedule);
  async function exportSchedulePNG(){
    const date=$("#scheduleDate").value||today(), entries=schedule[date]||[];
    if(!entries.length){showToast("สร้างตารางก่อนส่งออก PNG");return}
    const scale=2, width=1000, pad=60, rowH=84, height=240+entries.length*rowH+70;
    const canvas=document.createElement("canvas");canvas.width=width*scale;canvas.height=height*scale;
    const ctx=canvas.getContext("2d");ctx.scale(scale,scale);
    const theme=themes[document.body.dataset.theme]||themes.white, dark=document.body.dataset.theme==="dark";
    ctx.fillStyle=theme.bg;ctx.fillRect(0,0,width,height);ctx.fillStyle=theme.text;ctx.font="800 36px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText("STUDIQ",pad,65);
    ctx.font="700 27px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText("My Study Schedule",pad,116);
    ctx.fillStyle=theme.text;ctx.globalAlpha=.65;ctx.font="16px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText(fmtDate(date),pad,148);ctx.globalAlpha=1;
    ctx.strokeStyle=theme.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,174);ctx.lineTo(width-pad,174);ctx.stroke();
    let y=200;
    entries.forEach((e,i)=>{
      ctx.fillStyle=dark?"#22242b":"#ffffff";ctx.fillRect(pad,y,width-pad*2,66);
      ctx.fillStyle=theme.accent;ctx.fillRect(pad,y,5,66);
      ctx.fillStyle=theme.text;ctx.font="700 17px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText(`${e.start} – ${e.end}`,pad+22,y+27);
      ctx.font="700 18px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText(e.title.slice(0,52),pad+180,y+27);
      ctx.globalAlpha=.65;ctx.font="14px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText(`${e.subject||"ทั่วไป"} · ${e.duration} นาที`,pad+180,y+49);ctx.globalAlpha=1;y+=rowH;
    });
    ctx.fillStyle=theme.text;ctx.globalAlpha=.55;ctx.font="13px 'DM Sans','Noto Sans Thai',sans-serif";ctx.fillText("Plan smarter. Learn better. · STUDIQ",pad,height-28);ctx.globalAlpha=1;
    const a=document.createElement("a");a.download=`studiq-schedule-${date}.png`;a.href=canvas.toDataURL("image/png");a.click();showToast("ส่งออกตารางเป็น PNG แล้ว");
  }
  $("#exportPng").addEventListener("click",exportSchedulePNG);

  // Pomodoro timer
  function timerDisplay(seconds){return `${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,"0")}:${String(Math.max(0,seconds)%60).padStart(2,"0")}`}
  function paintTimer(){
    const display=timerDisplay(timerRemaining), pct=timerLength?((timerLength-timerRemaining)/timerLength*100):0;
    $("#bigTimer").textContent=display;$("#miniTimer").textContent=display;$("#timerMode").textContent=timerMode==="focus"?"FOCUS SESSION":timerMode==="short"?"SHORT BREAK":"LONG BREAK";
    $("#timerStart").textContent=timerRunning?"พักชั่วคราว Ⅱ":"เริ่มโฟกัส ▶";$("#timerProgress").style.width=pct+"%";
  }
  function stopTimer(){timerRunning=false;clearInterval(timerInterval);timerInterval=null;paintTimer()}
  function setTimer(minutes,mode="focus"){stopTimer();timerMode=mode;timerLength=minutes*60;timerRemaining=timerLength;sessionStartedAt=null;$$(".session-tabs button").forEach(b=>b.classList.toggle("selected",b.dataset.mode===mode));paintTimer()}
  function finishTimer(){
    stopTimer();
    if(timerMode==="focus"){const minutes=Math.max(1,Math.round(timerLength/60));focusedMinutes+=minutes;write(KEYS.focus,focusedMinutes);sessions.push({date:today(),minutes,subject:focusSubject,finishedAt:Date.now()});write(KEYS.sessions,sessions);showToast(`ครบเวลาโฟกัส ${minutes} นาทีแล้ว พักสักหน่อยนะ ☕`);setTimer(5,"short")}
    else{showToast("หมดเวลาพัก พร้อมเริ่มรอบใหม่เมื่อคุณพร้อม");setTimer(25,"focus")}
    renderDashboard();renderProgressIfVisible();$("#focusTodayTotal").textContent=focusedMinutes+" นาที";
  }
  $("#timerStart").addEventListener("click",()=>{
    if(timerRunning){stopTimer();return}
    timerRunning=true;sessionStartedAt=Date.now();paintTimer();
    timerInterval=setInterval(()=>{timerRemaining--;if(timerRemaining<=0){finishTimer();return}paintTimer()},1000);
  });
  $("#timerReset").addEventListener("click",()=>{stopTimer();timerRemaining=timerLength;paintTimer();showToast("ตั้งเวลาใหม่แล้ว")});
  $("#timerSkip").addEventListener("click",()=>{stopTimer();setTimer(timerMode==="focus"?5:25,timerMode==="focus"?"short":"focus");showToast("เปลี่ยนช่วงเวลาแล้ว")});
  $$(".session-tabs button").forEach(b=>b.addEventListener("click",()=>setTimer(Number(b.dataset.minutes),b.dataset.mode)));
  $("#focusForm").addEventListener("submit",e=>{e.preventDefault();focusSubject=$("#focusSubject").value.trim()||"อ่านหนังสือ";setTimer(Math.max(1,Math.min(180,Number($("#focusLength").value)||25)),"focus");showToast("ตั้งค่า Focus Session แล้ว")});
  $("#focusTodayTotal").textContent=focusedMinutes+" นาที";

  // Notes CRUD
  function renderNotes(){
    const search=($("#noteSearch").value||"").toLowerCase(), subject=$("#noteSubjectFilter").value||"all";
    const subjects=[...new Set(notes.map(n=>n.subject||"ทั่วไป"))].sort(), select=$("#noteSubjectFilter"), prev=select.value;
    select.innerHTML='<option value="all">ทุกวิชา</option>'+subjects.map(s=>`<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
    if(subjects.includes(prev))select.value=prev;
    const filtered=notes.filter(n=>(subject==="all"||(n.subject||"ทั่วไป")===subject)&&(`${n.title} ${n.content} ${n.subject}`.toLowerCase().includes(search)));
    $("#notesGrid").innerHTML=filtered.length?filtered.map(n=>`<article class="note-card ${currentNoteId===n.id?"selected":""}" data-open-note="${n.id}"><span class="note-subject">${escapeHTML(n.subject||"ทั่วไป")}</span><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML(n.content||"ยังไม่มีเนื้อหา")}</p><footer><span>${new Date(n.updated||Date.now()).toLocaleDateString("th-TH",{day:"numeric",month:"short"})}</span><button class="mini-action" data-delete-note="${n.id}">ลบ</button></footer></article>`).join(""):'<div class="empty-state">ยังไม่มีโน้ตที่ตรงกัน สร้างโน้ตแรกของคุณได้เลย</div>';
  }
  function clearNoteForm(){currentNoteId=null;$("#noteId").value="";$("#noteTitle").value="";$("#noteSubject").value="ทั่วไป";$("#noteContent").value="";$("#noteEditorTitle").textContent="สร้างโน้ตใหม่";renderNotes()}
  $("#newNoteBtn").addEventListener("click",()=>{clearNoteForm();$("#noteTitle").focus()});
  $("#clearNote").addEventListener("click",clearNoteForm);
  $("#noteForm").addEventListener("submit",e=>{
    e.preventDefault();const title=$("#noteTitle").value.trim();if(!title)return;
    const note={id:currentNoteId||Date.now(),title,subject:$("#noteSubject").value.trim()||"ทั่วไป",content:$("#noteContent").value,updated:Date.now()};
    const index=notes.findIndex(n=>n.id===note.id);if(index>=0)notes[index]=note;else notes.unshift(note);
    currentNoteId=note.id;saveNotes();renderNotes();renderProgressIfVisible();$("#noteEditorTitle").textContent="แก้ไขโน้ต";showToast("บันทึกโน้ตแล้ว");
  });
  $("#notesGrid").addEventListener("click",e=>{
    const del=e.target.closest("[data-delete-note]");if(del){e.stopPropagation();const id=Number(del.dataset.deleteNote);if(confirm("ลบโน้ตนี้หรือไม่?")){notes=notes.filter(n=>n.id!==id);if(currentNoteId===id)clearNoteForm();saveNotes();renderNotes();renderProgressIfVisible();showToast("ลบโน้ตแล้ว")}return}
    const card=e.target.closest("[data-open-note]");if(card){const n=notes.find(x=>x.id===Number(card.dataset.openNote));if(!n)return;currentNoteId=n.id;$("#noteId").value=n.id;$("#noteTitle").value=n.title;$("#noteSubject").value=n.subject||"ทั่วไป";$("#noteContent").value=n.content||"";$("#noteEditorTitle").textContent="แก้ไขโน้ต";renderNotes()}
  });
  $("#noteSearch").addEventListener("input",renderNotes);$("#noteSubjectFilter").addEventListener("change",renderNotes);

  // Habit tracker
  function renderHabits(){
    const done=getHabitCount(), pct=habits.length?Math.round(done/habits.length*100):0;
    $("#habitPercent").textContent=pct+"%";$("#habitRing").style.background=`conic-gradient(var(--accent) ${pct}%,var(--surface2) ${pct}%)`;
    $("#habitSummaryTitle").textContent=pct===100?"ทำได้ครบทุกนิสัยแล้ว!":pct>=50?"กำลังไปได้ดี":"เริ่มจากสิ่งเล็ก ๆ";
    $("#habitSummaryText").textContent=`เช็กอินแล้ว ${done} จาก ${habits.length} นิสัยวันนี้`;
    $("#habitsGrid").innerHTML=habits.length?habits.map(h=>`<article class="habit-card"><div class="habit-card-top"><span class="habit-emoji">${h.emoji||"✳"}</span><button class="mini-action" data-delete-habit="${h.id}" title="ลบนิสัย">×</button></div><h3>${escapeHTML(h.name)}</h3><p>${escapeHTML(h.category||"ส่วนตัว")}</p><label class="habit-check"><input type="checkbox" data-habit-check="${h.id}" ${h.checks&&h.checks[today()]?"checked":""}> ${h.checks&&h.checks[today()]?"เช็กอินแล้ว":"ทำสำเร็จวันนี้"}</label></article>`).join(""):'<div class="empty-state">ยังไม่มีนิสัย เพิ่มเป้าหมายเล็ก ๆ ที่อยากทำได้เลย</div>';
    $("#dashHabits").innerHTML=habits.slice(0,3).map(h=>`<label class="mission-line"><input type="checkbox" data-habit-check="${h.id}" ${h.checks&&h.checks[today()]?"checked":""}> ${escapeHTML(h.name)}</label>`).join("");
    renderDashboardStatsOnly();
  }
  function renderDashboardStatsOnly(){$("#dashHabits").innerHTML=habits.slice(0,3).map(h=>`<label class="mission-line"><input type="checkbox" data-habit-check="${h.id}" ${h.checks&&h.checks[today()]?"checked":""}> ${escapeHTML(h.name)}</label>`).join("");}
  function toggleHabit(id,checked){const h=habits.find(x=>x.id===id);if(!h)return;if(!h.checks)h.checks={};if(checked)h.checks[today()]=true;else delete h.checks[today()];saveHabits();renderHabits();renderDashboard();renderProgressIfVisible()}
  document.addEventListener("change",e=>{const cb=e.target.closest("[data-habit-check]");if(cb)toggleHabit(Number(cb.dataset.habitCheck),cb.checked)});
  $("#habitForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#habitName").value.trim();if(!name)return;const category=$("#habitCategory").value;const emoji=category==="สุขภาพ"?"🌿":category==="การเรียน"?"📚":"✳";habits.push({id:Date.now(),name,category,emoji,checks:{}});saveHabits();$("#habitName").value="";renderHabits();renderDashboard();showToast("เพิ่มนิสัยใหม่แล้ว")});
  $("#addHabitBtn").addEventListener("click",()=>{$("#habitName").focus();$("#habitForm").scrollIntoView({behavior:"smooth",block:"center"})});
  $("#habitsGrid").addEventListener("click",e=>{const b=e.target.closest("[data-delete-habit]");if(!b)return;const id=Number(b.dataset.deleteHabit);habits=habits.filter(h=>h.id!==id);saveHabits();renderHabits();renderDashboard();showToast("ลบนิสัยแล้ว")});

  // Progress analytics
  function renderProgress(){
    $("#progressDone").textContent=getDoneTasks();$("#progressMinutes").innerHTML=`${focusedMinutes} <small>นาที</small>`;$("#progressNotes").textContent=notes.length;
    const pct=habits.length?Math.round(getHabitCount()/habits.length*100):0;$("#progressHabitRate").textContent=pct+"%";
    const map={};tasks.filter(t=>t.done).forEach(t=>{const s=t.subject||"ทั่วไป";map[s]=(map[s]||0)+1});
    const pairs=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,7), max=Math.max(1,...pairs.map(p=>p[1]));
    $("#subjectChart").innerHTML=pairs.length?pairs.map(([s,n])=>`<div class="bar-row"><span class="bar-label" title="${escapeHTML(s)}">${escapeHTML(s)}</span><div class="bar-track"><span style="width:${n/max*100}%"></span></div><span class="bar-number">${n}</span></div>`).join(""):'<div class="empty-state">ทำเครื่องหมายงานที่เสร็จแล้วเพื่อดูกราฟ</div>';
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.toISOString().slice(0,10);return{key,label:d.toLocaleDateString("th-TH",{weekday:"short"}),value:sessions.filter(s=>s.date===key).reduce((sum,s)=>sum+s.minutes,0)}});
    const maxFocus=Math.max(25,...days.map(d=>d.value));
    $("#focusChart").innerHTML=days.map(d=>`<div class="week-col"><span class="week-value">${d.value}</span><div class="week-bar" style="height:${Math.max(3,d.value/maxFocus*105)}px"></div><span class="week-day">${d.label}</span></div>`).join("");
    const topSubject=Object.entries(tasks.reduce((acc,t)=>{if(!t.done)acc[t.subject||"ทั่วไป"]=(acc[t.subject||"ทั่วไป"]||0)+1;return acc},{})).sort((a,b)=>b[1]-a[1])[0];
    const completed=tasks.filter(t=>t.done).length, total=tasks.length, focusGoal=Number(settings.dailyGoal)||120;
    const insights=[
      ["✓", "งานที่ทำสำเร็จ", total?`คุณทำงานสำเร็จ ${completed} จาก ${total} รายการ (${Math.round(completed/total*100)}%)`:"เพิ่มงานใน Planner เพื่อเริ่มติดตามผล"],
      ["◷", "เวลาโฟกัส", focusedMinutes?`สะสม ${focusedMinutes} นาที จากเป้าหมาย ${focusGoal} นาทีต่อวัน`:"เริ่ม Focus Room เพื่อบันทึกเวลาอ่านหนังสือ"],
      ["✦", "จุดที่ควรเริ่ม", topSubject?`ยังมีงานวิชา${topSubject[0]} ${topSubject[1]} รายการ ลองจัดเวลาให้วิชานี้`:"เพิ่มงานพร้อมระบุวิชาเพื่อดูคำแนะนำ"]
    ];
    $("#insightsList").innerHTML=insights.map(([icon,title,desc])=>`<div class="insight-card"><span>${icon}</span><strong>${title}</strong><p>${escapeHTML(desc)}</p></div>`).join("");
  }
  function renderProgressIfVisible(){if(currentPage==="progress")renderProgress()}
  $("#exportProgress").addEventListener("click",()=>{const data={generatedAt:new Date().toISOString(),tasks,notesCount:notes.length,focusedMinutes,sessions,habits};downloadBlob(JSON.stringify(data,null,2),"studiq-progress.json","application/json")});

  // Theme Studio
  function renderThemeGallery(){$$("[data-theme-choice]").forEach(b=>b.classList.toggle("selected",b.dataset.themeChoice===document.body.dataset.theme))}
  document.addEventListener("click",e=>{const b=e.target.closest("[data-theme-choice]");if(!b)return;applyTheme(b.dataset.themeChoice,true);renderThemeGallery()});

  // Settings and data backup
  function fillSettings(){
    $("#displayName").value=settings.name||"";$("#dayStart").value=settings.dayStart||"08:00";$("#sleepTime").value=settings.sleepTime||"22:30";$("#dailyGoal").value=settings.dailyGoal||120;$("#defaultTheme").value=settings.defaultTheme||"white";
    $("#availableStart").value=settings.availableStart||"16:00";$("#availableEnd").value=settings.availableEnd||"20:00";$("#breakDuration").value=settings.breakDuration??10;
  }
  $("#settingsForm").addEventListener("submit",e=>{e.preventDefault();settings={...settings,name:$("#displayName").value.trim(),dayStart:$("#dayStart").value,sleepTime:$("#sleepTime").value,dailyGoal:Math.max(10,Number($("#dailyGoal").value)||120),defaultTheme:$("#defaultTheme").value};write(KEYS.settings,settings);if(settings.name)showToast("บันทึกการตั้งค่าแล้ว ยินดีต้อนรับ "+settings.name);else showToast("บันทึกการตั้งค่าแล้ว")});
  function downloadBlob(content,filename,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  $("#exportData").addEventListener("click",()=>downloadBlob(JSON.stringify({version:2,tasks,notes,habits,schedule,settings,focusedMinutes,sessions,theme:document.body.dataset.theme},null,2),"studiq-backup.json","application/json"));
  $("#clearData").addEventListener("click",()=>{if(!confirm("ต้องการลบงาน โน้ต นิสัย ตาราง และสถิติที่บันทึกไว้ในเบราว์เซอร์นี้ทั้งหมดหรือไม่? การกระทำนี้ย้อนกลับไม่ได้"))return;Object.values(KEYS).forEach(k=>localStorage.removeItem(k));location.reload()});
  const importButton=document.createElement("button");importButton.className="button button-secondary button-full";importButton.textContent="นำเข้าข้อมูลสำรอง JSON";$("#exportData").after(importButton);importButton.addEventListener("click",()=>$("#importFile").click());
  $("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(!d||!Array.isArray(d.tasks))throw new Error("รูปแบบไม่ถูกต้อง");if(!confirm("การนำเข้าจะเขียนทับข้อมูลปัจจุบัน ต้องการดำเนินการต่อหรือไม่?"))return;tasks=d.tasks;notes=Array.isArray(d.notes)?d.notes:[];habits=Array.isArray(d.habits)?d.habits:[];schedule=d.schedule||{};settings=d.settings||settings;focusedMinutes=Number(d.focusedMinutes)||0;sessions=Array.isArray(d.sessions)?d.sessions:[];saveTasks();saveNotes();saveHabits();write(KEYS.schedule,schedule);write(KEYS.settings,settings);write(KEYS.focus,focusedMinutes);write(KEYS.sessions,sessions);if(d.theme)write(KEYS.theme,d.theme);location.reload()}catch(err){showToast("นำเข้าไม่สำเร็จ กรุณาเลือกไฟล์ STUDIQ JSON")}finally{e.target.value=""}});

  // Initialise
  applyTheme(read(KEYS.theme,settings.defaultTheme||"white"));
  fillSettings();
  renderTasks();renderHabits();renderNotes();renderSchedule();renderDashboard();renderProgress();
  if(!schedule[today()]?.length) {
    // Seed a friendly timetable only on first run, using example activities; users can replace it.
    schedule[today()] = [
      {id:"sample1",start:"16:00",end:"16:45",title:"ทบทวนคณิตศาสตร์",subject:"คณิตศาสตร์",duration:45},
      {id:"sample2",start:"16:55",end:"17:20",title:"ท่องศัพท์ภาษาอังกฤษ",subject:"ภาษาอังกฤษ",duration:25},
      {id:"sample3",start:"17:30",end:"18:15",title:"สรุปบทเรียน",subject:"วิทยาศาสตร์",duration:45}
    ];
    write(KEYS.schedule,schedule);renderSchedule();renderDashboard();
  }
})();
