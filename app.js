(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const KEYS = {
    tasks: "studiq.tasks.v2", notes: "studiq.notes.v2", habits: "studiq.habits.v2",
    theme: "studiq.theme.v2", settings: "studiq.settings.v2", schedule: "studiq.schedule.v2",
    focus: "studiq.focus.v2", sessions: "studiq.sessions.v2"
  };
  const LANGUAGE_KEY = "studiq.language.v1";
  let currentLanguage = "th";
  try { currentLanguage = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "th"; } catch { currentLanguage = "th"; }
  const today = () => new Date().toISOString().slice(0, 10);
  const datePlus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
  const defaultTasks = [
    {id:1,title:"ทำแบบฝึกหัดหน้า 12",subject:"คณิตศาสตร์",due:today(),duration:30,priority:"medium",done:false,created:Date.now()},
    {id:2,title:"อ่านหนังสือบทที่ 1",subject:"วิทยาศาสตร์",due:datePlus(1),duration:25,priority:"medium",done:false,created:Date.now()},
    {id:3,title:"ทบทวนคำศัพท์ 10 คำ",subject:"ภาษาอังกฤษ",due:datePlus(2),duration:15,priority:"low",done:false,created:Date.now()},
    {id:4,title:"สรุปสิ่งที่เรียนวันนี้",subject:"ทั่วไป",due:today(),duration:20,priority:"medium",done:false,created:Date.now()},
    {id:5,title:"เตรียมอุปกรณ์สำหรับวันพรุ่งนี้",subject:"ทั่วไป",due:today(),duration:10,priority:"low",done:false,created:Date.now()}
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
  let activeUserId = null;
  let cloudReady = false;
  let supabaseClient = null;
  let cloudSaveTimer = null;
  let initializingUserId = null;
  let lastCloudErrorAt = 0;
  function storageKeyForUser(userId, key) { return `studiq.account.${userId || "preview"}.${key}`; }
  function storageKey(key) { return storageKeyForUser(activeUserId, key); }
  function read(key, fallback) { try { const v=localStorage.getItem(storageKey(key)); return v ? JSON.parse(v) : structuredClone(fallback); } catch { return structuredClone(fallback); } }
  function write(key, value) {
    try { localStorage.setItem(storageKey(key), JSON.stringify(value)); }
    catch(e) { console.warn("Could not save local data", e); }
    if (cloudReady && activeUserId) scheduleCloudSave();
  }
  let tasks = read(KEYS.tasks, defaultTasks), notes = read(KEYS.notes, defaultNotes), habits = read(KEYS.habits, defaultHabits);
  let schedule = read(KEYS.schedule, {}), settings = read(KEYS.settings, {name:"",dayStart:"08:00",sleepTime:"22:30",dailyGoal:120,defaultTheme:"white",availableStart:"16:00",availableEnd:"20:00",breakDuration:10});
  let sessions = read(KEYS.sessions, []), focusedMinutes = Number(read(KEYS.focus, 0)) || 0;
  let taskFilter = "all", currentNoteId = null, currentPage = "dashboard", toastTimer = null;
  let timerLength = 25*60, timerRemaining = timerLength, timerRunning = false, timerInterval = null, timerMode = "focus", focusSubject = "อ่านหนังสือ", sessionStartedAt = null;
  const themes = {white:{label:"White Mode",bg:"#f7f7f7",surface:"#ffffff",text:"#111111",accent:"#111111"},dark:{label:"Dark Mode",bg:"#101114",surface:"#191a1f",text:"#f5f5f6",accent:"#ffffff"},blue:{label:"Sky Blue",bg:"#edf7ff",surface:"#ffffff",text:"#183247",accent:"#438fca"},pink:{label:"Sakura Pink",bg:"#fff3f7",surface:"#ffffff",text:"#47283a",accent:"#d96b98"},green:{label:"Matcha Green",bg:"#f2f7ed",surface:"#ffffff",text:"#2d3c2b",accent:"#668b53"},red:{label:"Crimson Red",bg:"#fff4f3",surface:"#ffffff",text:"#3c2022",accent:"#d9363e"}};
  const escapeHTML = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = value => { if(!value) return currentLanguage==="en" ? "No due date" : "ไม่กำหนดวัน"; const d = new Date(value+"T12:00:00"); return d.toLocaleDateString(currentLanguage==="en"?"en-US":"th-TH",{day:"numeric",month:"short",year:"numeric"}); };
  const fmtShortDate = value => { if(!value) return currentLanguage==="en" ? "Not set" : "ไม่กำหนด"; if(value===today()) return currentLanguage==="en" ? "Today" : "วันนี้"; if(value===datePlus(1)) return currentLanguage==="en" ? "Tomorrow" : "พรุ่งนี้"; return fmtDate(value); };
  const priorityLabel = p => (currentLanguage==="en"?{high:"High",medium:"Medium",low:"Low"}:{high:"สูง",medium:"ปานกลาง",low:"ต่ำ"})[p]||(currentLanguage==="en"?"Medium":"ปานกลาง");
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
    if(!(schedule[$("#scheduleDate").value]||[]).length){if(!confirm(currentLanguage==="en"?"There is no schedule yet. Would you like to generate one first?":"ยังไม่มีตาราง ต้องการสร้างตารางอัตโนมัติก่อนหรือไม่?"))return;buildSchedule()}
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
    $("#notesGrid").innerHTML=filtered.length?filtered.map(n=>`<article class="note-card ${currentNoteId===n.id?"selected":""}" data-open-note="${n.id}"><span class="note-subject">${escapeHTML(n.subject||"ทั่วไป")}</span><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML(n.content||"ยังไม่มีเนื้อหา")}</p><footer><span>${new Date(n.updated||Date.now()).toLocaleDateString(currentLanguage==="en"?"en-US":"th-TH",{day:"numeric",month:"short"})}</span><button class="mini-action" data-delete-note="${n.id}">ลบ</button></footer></article>`).join(""):'<div class="empty-state">ยังไม่มีโน้ตที่ตรงกัน สร้างโน้ตแรกของคุณได้เลย</div>';
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
    const del=e.target.closest("[data-delete-note]");if(del){e.stopPropagation();const id=Number(del.dataset.deleteNote);if(confirm(currentLanguage==="en"?"Delete this note?":"ลบโน้ตนี้หรือไม่?")){notes=notes.filter(n=>n.id!==id);if(currentNoteId===id)clearNoteForm();saveNotes();renderNotes();renderProgressIfVisible();showToast("ลบโน้ตแล้ว")}return}
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
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.toISOString().slice(0,10);return{key,label:d.toLocaleDateString(currentLanguage==="en"?"en-US":"th-TH",{weekday:"short"}),value:sessions.filter(s=>s.date===key).reduce((sum,s)=>sum+s.minutes,0)}});
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
  $("#clearData").addEventListener("click",()=>{
    if(!confirm(currentLanguage==="en"?"Delete all of your tasks, notes, habits, schedules, settings, and focus statistics from this account? This cannot be undone.":"ต้องการลบงาน โน้ต นิสัย ตาราง การตั้งค่า และสถิติการโฟกัสของบัญชีนี้ทั้งหมดหรือไม่? การกระทำนี้ย้อนกลับไม่ได้"))return;
    tasks=[]; notes=[]; habits=[]; schedule={}; sessions=[]; focusedMinutes=0;
    settings={name:"",dayStart:"08:00",sleepTime:"22:30",dailyGoal:120,defaultTheme:"white",availableStart:"16:00",availableEnd:"20:00",breakDuration:10};
    Object.values(KEYS).forEach(k=>localStorage.removeItem(storageKey(k)));
    write(KEYS.tasks,tasks);write(KEYS.notes,notes);write(KEYS.habits,habits);write(KEYS.schedule,schedule);write(KEYS.settings,settings);write(KEYS.focus,focusedMinutes);write(KEYS.sessions,sessions);write(KEYS.theme,"white");
    applyTheme("white");fillSettings();renderTasks();renderHabits();renderNotes();renderSchedule();renderDashboard();renderProgress();
    scheduleCloudSave();showToast(currentLanguage==="en"?"Your account data was cleared.":"ลบข้อมูลของบัญชีนี้แล้ว");
  });
  const importButton=document.createElement("button");importButton.className="button button-secondary button-full";importButton.textContent="นำเข้าข้อมูลสำรอง JSON";$("#exportData").after(importButton);importButton.addEventListener("click",()=>$("#importFile").click());
  $("#importFile").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());if(!d||!Array.isArray(d.tasks))throw new Error("รูปแบบไม่ถูกต้อง");if(!confirm(currentLanguage==="en"?"Importing will overwrite current data. Do you want to continue?":"การนำเข้าจะเขียนทับข้อมูลปัจจุบัน ต้องการดำเนินการต่อหรือไม่?"))return;tasks=d.tasks;notes=Array.isArray(d.notes)?d.notes:[];habits=Array.isArray(d.habits)?d.habits:[];schedule=d.schedule||{};settings=d.settings||settings;focusedMinutes=Number(d.focusedMinutes)||0;sessions=Array.isArray(d.sessions)?d.sessions:[];saveTasks();saveNotes();saveHabits();write(KEYS.schedule,schedule);write(KEYS.settings,settings);write(KEYS.focus,focusedMinutes);write(KEYS.sessions,sessions);if(d.theme)applyTheme(d.theme);fillSettings();renderTasks();renderHabits();renderNotes();renderSchedule();renderDashboard();renderProgress();scheduleCloudSave();showToast(currentLanguage==="en"?"Backup imported.":"นำเข้าข้อมูลสำรองแล้ว")}catch(err){showToast("นำเข้าไม่สำเร็จ กรุณาเลือกไฟล์ STUDIQ JSON")}finally{e.target.value=""}});

  // Thai / English interface. User-created task, note, and habit content is left as entered.
  const LANGUAGE_PAIRS = [
    ["ระบบจัดการการเรียนส่วนตัว", "PERSONAL LEARNING SYSTEM"],
    ["เป้าหมายประจำสัปดาห์", "WEEKLY GOAL"],
    ["พื้นที่ทำงาน", "WORKSPACE"],
    ["ปรับแต่ง", "PERSONALIZE"],
    ["แดชบอร์ด", "Dashboard"],
    ["วางแผนอัจฉริยะ", "Smart Planner"],
    ["ตารางเวลาอัจฉริยะ", "Smart Schedule"],
    ["ห้องโฟกัส", "Focus Room"],
    ["บันทึกของฉัน", "My Notes"],
    ["วิเคราะห์ความก้าวหน้า", "Progress Analytics"],
    ["ติดตามนิสัย", "Habit Tracker"],
    ["ปรับแต่งธีม", "Theme Studio"],
    ["ตั้งค่า", "Settings"],
    ["ภาพรวม", "Overview"],
    ["จัดการงาน", "Task management"],
    ["วางแผนเวลา", "Plan your time"],
    ["ทำงานอย่างมีสมาธิ", "Deep work"],
    ["คลังความรู้", "Knowledge library"],
    ["ความก้าวหน้าของคุณ", "Your progress"],
    ["กิจวัตรประจำวัน", "Daily routines"],
    ["การตั้งค่า", "Preferences"],
    ["เปลี่ยนธีม", "Change theme"],
    ["พิมพ์หน้า", "Print page"],
    ["เปิดเมนู", "Open menu"],
    ["ทุกความสำเร็จเริ่มจากการวางแผนที่ดี วันนี้มาจัดการสิ่งสำคัญทีละอย่าง แล้วไปให้ถึงเป้าหมายกัน", "Every achievement starts with a good plan. Take care of one important thing at a time and move toward your goals."],
    ["วางแผนวันนี้", "Plan today"],
    ["งานที่เสร็จแล้ว", "Tasks completed"],
    ["เริ่มจากงานเล็ก ๆ ทีละอย่าง", "Start with one small task at a time"],
    ["เวลาโฟกัสวันนี้", "Focus time today"],
    ["นาที", "minutes"],
    ["ทุกนาทีที่ตั้งใจมีความหมาย", "Every focused minute counts"],
    ["งานที่กำลังทำ", "Active tasks"],
    ["จัดลำดับงานแล้วเริ่มได้เลย", "Prioritize your tasks and get started"],
    ["นิสัยวันนี้", "Habits today"],
    ["ความสม่ำเสมอสำคัญที่สุด", "Consistency matters most"],
    ["ภาพรวมการเรียนของคุณในวันนี้", "Your learning overview for today"],
    ["ดูภาพรวมทั้งหมด", "View all progress"],
    ["งานที่ต้องจัดการ", "Tasks to manage"],
    ["จัดการงาน +", "Manage tasks +"],
    ["ดูตาราง", "View schedule"],
    ["เป้าหมายเล็ก ๆ ที่พาไปสู่ความก้าวหน้า", "Small goals that lead to progress"],
    ["ทำภารกิจให้สำเร็จทีละข้อ", "Complete one mission at a time"],
    ["โฟกัสทีละอย่าง แล้วพักให้พอ", "Focus on one thing at a time, and take enough breaks"],
    ["ตั้งใจ 25 นาที พัก 5 นาที", "Focus for 25 minutes, then take a 5-minute break"],
    ["เปิด Focus Room", "Open Focus Room"],
    ["รวบรวมการบ้าน งานที่ต้องส่ง วันสอบ และกิจกรรมไว้ในที่เดียว", "Keep homework, assignments, exams, and activities in one place"],
    ["เพิ่มงานใหม่", "Add a task"],
    ["ทั้งหมด", "All"],
    ["ยังไม่เสร็จ", "In progress"],
    ["เสร็จแล้ว", "Completed"],
    ["ทุกวิชา", "All subjects"],
    ["ค้นหางาน...", "Search tasks..."],
    ["รายการงาน", "Task list"],
    ["รายการ", "items"],
    ["ใส่รายละเอียดให้ครบเพื่อจัดตารางได้ดีขึ้น", "Add details to create a better schedule"],
    ["ชื่องาน", "Task title"],
    ["เช่น อ่านบทที่ 3 วิชาชีววิทยา", "e.g. Read Chapter 3 of Biology"],
    ["วิชา", "Subject"],
    ["เช่น ชีววิทยา", "e.g. Biology"],
    ["วันครบกำหนด", "Due date"],
    ["เวลาที่คาดว่าจะใช้ (นาที)", "Estimated duration (minutes)"],
    ["ความสำคัญ", "Priority"],
    ["ปานกลาง", "Medium"],
    ["สูง", "High"],
    ["ต่ำ", "Low"],
    ["บันทึกงาน +", "Save task +"],
    ["ระบบประเมินงานจากวันครบกำหนด ความสำคัญ และเวลาที่ต้องใช้ เพื่อช่วยแนะนำงานที่ควรเริ่มก่อน", "The system scores tasks by due date, priority, and estimated duration to suggest what to start first."],
    ["สร้างตารางอ่านหนังสือและทำงานให้เข้ากับเวลาของคุณ", "Build a study and work schedule around your available time"],
    ["สร้างตารางอัตโนมัติ", "Generate schedule"],
    ["ตารางประจำวัน", "Daily schedule"],
    ["เลือกวันที่และเวลาว่างเพื่อวางแผน", "Choose a date and available hours to plan"],
    ["วันที่", "Date"],
    ["ส่งออก PNG", "Export PNG"],
    ["พิมพ์ A4", "Print A4"],
    ["ตั้งค่าเวลาว่าง", "Available time"],
    ["ใช้สำหรับช่วยจัดตารางอัตโนมัติ", "Used to automatically build your schedule"],
    ["เริ่มว่าง", "Available from"],
    ["สิ้นสุดเวลาว่าง", "Available until"],
    ["พักระหว่างงาน (นาที)", "Break between tasks (minutes)"],
    ["รวมงานที่ทำเสร็จแล้ว", "Include completed tasks"],
    ["บันทึกเวลา", "Save availability"],
    ["สร้างตารางใหม่ได้ทุกเมื่อ หากมีงานด่วนเพิ่มเข้ามา ระบบจะจัดลำดับตามความสำคัญและกำหนดส่ง", "Generate a new schedule any time. New urgent tasks are prioritized by importance and due date."],
    ["สร้างตารางสำหรับวันนี้", "No schedule for today"],
    ["กด “สร้างตารางอัตโนมัติ” หรือเพิ่มงานใน Smart Planner ก่อน", "Select “Generate schedule” or add tasks in Smart Planner first"],
    ["ลดสิ่งรบกวนและแบ่งเวลาอ่านหนังสือเป็นช่วงที่ทำได้จริง", "Reduce distractions and break study time into manageable sessions"],
    ["เริ่มโฟกัส", "Start focus"],
    ["เริ่มใหม่", "Reset"],
    ["ข้ามช่วง", "Skip"],
    ["ระยะเวลาพักสั้น", "Short break"],
    ["พักยาว", "Long break"],
    ["วิชาที่กำลังอ่าน", "Study subject"],
    ["ระยะเวลาโฟกัส (นาที)", "Focus duration (minutes)"],
    ["ตั้งค่าเซสชัน", "Set session"],
    ["โฟกัสสะสมวันนี้", "Focus time today"],
    ["จำไว้ว่า", "A gentle reminder"],
    ["พักสายตา ดื่มน้ำ และปรับเวลาพักตามความเหมาะสม การพักก็เป็นส่วนหนึ่งของการเรียนรู้", "Rest your eyes, drink water, and take breaks as needed. Rest is part of learning."],
    ["รวมสรุปบทเรียนและไอเดียสำคัญไว้ค้นหาได้ง่าย", "Keep lesson summaries and important ideas easy to find"],
    ["สร้างโน้ต", "Create note"],
    ["ค้นหาโน้ตหรือเนื้อหา...", "Search notes or content..."],
    ["บันทึกสิ่งที่อยากจำ", "Save what you want to remember"],
    ["ล้าง", "Clear"],
    ["หัวข้อโน้ต", "Note title"],
    ["เช่น สรุปเรื่องเซลล์", "e.g. Cell summary"],
    ["เนื้อหา", "Content"],
    ["เขียนสรุปหรือสิ่งที่ต้องทบทวน...", "Write a summary or things to review..."],
    ["บันทึกโน้ต", "Save note"],
    ["มองเห็นพัฒนาการจากข้อมูลจริงที่คุณบันทึกไว้", "See your progress from the data you record"],
    ["ส่งออกสรุป", "Export summary"],
    ["งานเสร็จทั้งหมด", "Tasks completed"],
    ["งานที่ทำเครื่องหมายว่าเสร็จ", "Tasks marked as completed"],
    ["เวลาที่โฟกัส", "Focus time"],
    ["เวลาที่สะสมผ่าน Focus Room", "Time recorded in Focus Room"],
    ["โน้ตทั้งหมด", "Total notes"],
    ["ความรู้ที่บันทึกไว้", "Knowledge saved"],
    ["นิสัยที่เช็กอิน", "Habits checked in"],
    ["ความคืบหน้าของวันนี้", "Today's progress"],
    ["งานที่เสร็จตามวิชา", "Completed tasks by subject"],
    ["จำนวนงานที่ทำเสร็จในแต่ละวิชา", "Completed tasks for each subject"],
    ["นาทีที่โฟกัสในแต่ละวัน", "Focused minutes per day"],
    ["ข้อสังเกตจากข้อมูลของคุณ", "Insights from your data"],
    ["สร้างกิจวัตรที่ดีทีละนิด โดยไม่ต้องทำทุกอย่างให้สมบูรณ์แบบ", "Build supportive routines gradually, without needing to be perfect"],
    ["เพิ่มนิสัย", "Add habit"],
    ["เริ่มต้นวันใหม่", "A fresh start"],
    ["เช็กอินเมื่อทำกิจกรรมที่ตั้งใจไว้", "Check in when you complete a planned activity"],
    ["เพิ่มนิสัยใหม่", "Add a new habit"],
    ["เลือกสิ่งเล็ก ๆ ที่อยากทำสม่ำเสมอ", "Choose a small thing to do consistently"],
    ["การเรียน", "Study"],
    ["สุขภาพ", "Wellbeing"],
    ["ชีวิตประจำวัน", "Daily life"],
    ["เลือกสีที่ใช่สำหรับพื้นที่เรียนของคุณ", "Choose the colors that fit your study space"],
    ["ธีมจะถูกบันทึกโดยอัตโนมัติ", "Your theme is saved automatically"],
    ["เมื่อกลับมาใช้เว็บไซต์บนเบราว์เซอร์เดิม ระบบจะจำธีมที่คุณเลือกไว้ ส่วนการพิมพ์จะใช้รูปแบบที่ประหยัดหมึก", "Your selected theme is remembered in this browser. Printing uses an ink-friendly layout."],
    ["กำหนดค่าเริ่มต้นให้เหมาะกับชีวิตประจำวันของคุณ", "Set defaults that fit your daily routine"],
    ["การตั้งค่าทั่วไป", "General settings"],
    ["ตั้งค่าเป้าหมายและเวลาที่สะดวก", "Set goals and preferred times"],
    ["ชื่อที่อยากให้แสดง", "Display name"],
    ["เช่น นักเรียนคนเก่ง", "e.g. Your name"],
    ["เวลาเริ่มวัน", "Day starts at"],
    ["เวลาเข้านอน", "Bedtime"],
    ["เป้าหมายอ่านหนังสือต่อวัน (นาที)", "Daily study goal (minutes)"],
    ["ธีมเริ่มต้น", "Default theme"],
    ["บันทึกการตั้งค่า", "Save settings"],
    ["ข้อมูลและความเป็นส่วนตัว", "Data & privacy"],
    ["ข้อมูลต้นแบบบันทึกในเบราว์เซอร์เครื่องนี้", "Prototype data is saved in this browser"],
    ["รายการงาน โน้ต ธีม และการตั้งค่าจะอยู่ใน LocalStorage ของเบราว์เซอร์นี้ ยังไม่มีบัญชีผู้ใช้หรือการซิงก์ข้ามอุปกรณ์", "Tasks, notes, themes, and settings are stored in this browser's local storage. There is no account or cross-device sync yet."],
    ["ส่งออกข้อมูลสำรอง JSON", "Export JSON backup"],
    ["นำเข้าข้อมูลสำรอง JSON", "Import JSON backup"],
    ["ลบข้อมูลใน STUDIQ", "Clear STUDIQ data"],
    ["Plan smarter. Learn better.", "Plan smarter. Learn better."],
    ["Make progress, not pressure.", "Make progress, not pressure."],
    ["ภาพรวมวันนี้", "Today's overview"],
    ["งานของฉัน", "My tasks"],
    ["ตารางวันนี้", "Today's schedule"],
    ["ภารกิจประจำวัน", "Daily mission"],
    ["ทีละก้าว", "One step at a time"],
    ["เซสชันการเรียน", "Study session"],
    ["เซสชันปัจจุบัน", "CURRENT SESSION"],
    ["พื้นที่การเรียนของคุณ", "YOUR STUDY SPACE"],
    ["ก้าวต่อไปของคุณ", "YOUR NEXT LEVEL"],
    ["โฟกัสกับ", "Focus on"],
    ["สิ่งสำคัญ", "what matters."],
    ["งาน", "TASKS"],
    ["โพโมโดโร", "POMODORO"],
    ["ข้อค้นพบ", "INSIGHTS"],
    ["วันนี้", "TODAY"],
    ["6 ธีม", "6 THEMES"],
    ["ข้อมูลเชิงลึกการเรียน", "Study insights"],
    ["โฟกัสรายสัปดาห์", "Weekly focus"],
    ["ปรับแต่งธีม", "Theme Studio"],
    ["ส่งออก PNG", "Export PNG"],
    ["พิมพ์ A4", "Print A4"],
    ["พักสั้น", "Short break"],
    ["พักยาว", "Long break"],
    ["โหมดขาว", "White Mode"],
    ["โหมดมืด", "Dark Mode"],
    ["ฟ้าสกายบลู", "Sky Blue"],
    ["ชมพูซากุระ", "Sakura Pink"],
    ["เขียวมัทฉะ", "Matcha Green"],
    ["แดงคริมสัน", "Crimson Red"],
    ["ขาว · ดำ", "White · Black"],
    ["ดำ · ขาว", "Black · White"],
    ["ฟ้าพาสเทล", "Pastel blue"],
    ["ชมพูพาสเทล", "Pastel pink"],
    ["เขียวพาสเทล", "Pastel green"],
    ["แดง", "Red"],
    ["ครบกำหนด:", "Due:"],
    ["แก้ไข", "Edit"],
    ["ลบ", "Delete"],
    ["ทำงานเสร็จ", "Mark task as done"],
    ["ยังไม่มีเนื้อหา", "No content yet"],
    ["ยังไม่มีโน้ตที่ตรงกัน สร้างโน้ตแรกของคุณได้เลย", "No matching notes. Create your first note."],
    ["สร้างโน้ตใหม่", "Create a new note"],
    ["แก้ไขโน้ต", "Edit note"],
    ["ทำได้ครบทุกนิสัยแล้ว!", "All habits completed!"],
    ["กำลังไปได้ดี", "You're doing great"],
    ["เริ่มจากสิ่งเล็ก ๆ", "Start small"],
    ["เช็กอินแล้ว", "Checked in"],
    ["นิสัยวันนี้", "habits today"],
    ["เช็กอินแล้ว", "Checked in"],
    ["ทำสำเร็จวันนี้", "Completed today"],
    ["ลบนิสัย", "Delete habit"],
    ["ยังไม่มีนิสัย เพิ่มเป้าหมายเล็ก ๆ ที่อยากทำได้เลย", "No habits yet. Add a small goal to get started."],
    ["ทำเครื่องหมายงานที่เสร็จแล้วเพื่อดูกราฟ", "Mark tasks as completed to see your chart"],
    ["เพิ่มงานใน Planner เพื่อเริ่มติดตามผล", "Add tasks in Planner to start tracking progress"],
    ["เริ่ม Focus Room เพื่อบันทึกเวลาอ่านหนังสือ", "Start Focus Room to track study time"],
    ["เพิ่มงานพร้อมระบุวิชาเพื่อดูคำแนะนำ", "Add tasks with subjects to see recommendations"],
    ["จุดที่ควรเริ่ม", "Where to start"],
    ["บันทึกโน้ตแล้ว", "Note saved"],
    ["ลบโน้ตแล้ว", "Note deleted"],
    ["เพิ่มนิสัยใหม่แล้ว", "New habit added"],
    ["ลบนิสัยแล้ว", "Habit deleted"],
    ["บันทึกการตั้งค่าแล้ว", "Settings saved"],
    ["ตั้งเวลาใหม่แล้ว", "Timer reset"],
    ["เปลี่ยนช่วงเวลาแล้ว", "Timer changed"],
    ["ส่งออกตารางเป็น PNG แล้ว", "Schedule exported as PNG"],
    ["สร้างตารางก่อนส่งออก PNG", "Generate a schedule before exporting PNG"],
    ["เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม", "End time must be after start time"],
    ["ไม่มีงานให้จัดตาราง เพิ่มงานใน Smart Planner ก่อน", "No tasks to schedule. Add tasks in Smart Planner first"],
    ["เวลาว่างไม่พอสำหรับงานแรก ลองขยายช่วงเวลาว่าง", "Not enough available time for the first task. Try extending your available hours"],
    ["ลบโน้ตนี้หรือไม่?", "Delete this note?"],
    ["ยังไม่มีตาราง ต้องการสร้างตารางอัตโนมัติก่อนหรือไม่?", "There is no schedule yet. Would you like to generate one first?"],
    ["ต้องการลบงาน โน้ต นิสัย ตาราง และสถิติที่บันทึกไว้ในเบราว์เซอร์นี้ทั้งหมดหรือไม่? การกระทำนี้ย้อนกลับไม่ได้", "Delete all tasks, notes, habits, schedules, and statistics saved in this browser? This action cannot be undone."],
    ["การนำเข้าจะเขียนทับข้อมูลปัจจุบัน ต้องการดำเนินการต่อหรือไม่?", "Importing will overwrite current data. Do you want to continue?"],
    ["นำเข้าไม่สำเร็จ กรุณาเลือกไฟล์ STUDIQ JSON", "Import failed. Please select a STUDIQ JSON file"],
    ["พักชั่วคราว", "Pause"],
    ["เริ่มโฟกัส", "Start focus"],
    ["ครบเวลาโฟกัส", "Focus session complete"],
    ["หมดเวลาพัก พร้อมเริ่มรอบใหม่เมื่อคุณพร้อม", "Break time is over. Start another session when you're ready"],
    ["เปลี่ยนธีมเป็น ", "Theme changed to "],
    [" แล้ว", ""],
    ["ตารางของคุณวันนี้", "Your schedule today"],
    ["กำลังโหลด", "Loading"],
    ["ระบบจัดตารางใหม่อัตโนมัติ", "Auto Reschedule"],
    ["สร้างกิจวัตรที่ดี", "Build routines that support you"],
    ["พักอย่างพอดี", "Deep work, gentle pace"],
    ["เก็บความรู้ไว้ใกล้ตัว", "Keep your knowledge close"],
    ["ทำให้เป็นพื้นที่ของคุณ", "Make it your space"],
    ["จัดเวลาให้สิ่งสำคัญ", "Make time for what matters"],
    ["ความพยายามของคุณเห็นได้ชัด", "Your effort, made visible"],
    ["ตั้งค่าพื้นที่การเรียนของคุณ", "Set up your study space"],
    ["มุ่งไปสู่ก้าวต่อไป", "Made for your next level."],
    ["เซสชันโฟกัส", "Focus session"],
    ["เริ่มจากงานเล็ก ๆ", "Small steps."],
    ["โหมดจัดเก็บข้อมูลในเครื่อง", "Local-first"],
    ["ตัวช่วยจัดตารางอัตโนมัติ", "Auto Reschedule"],
    ["กำลังใจ ไม่ใช่ความกดดัน", "Make progress, not pressure."],
    ["วางแผนให้ฉลาด เรียนรู้ให้ดีขึ้น", "Plan smarter. Learn better."],
    ["เซสชันการตั้งค่า", "Session settings"],
    ["ทุกงานที่ทำเสร็จ", "All tasks completed"],
    ["พื้นที่ทำงาน", "Workspace"],
    ["โฟกัสประจำห้อง", "Focus room"],
    ["เซสชันโฟกัส", "FOCUS SESSION"],
    ["ก้าวเล็ก ๆ ความก้าวหน้าใหญ่", "Big progress."],
    ["สร้างกิจวัตรที่ช่วยสนับสนุนคุณ", "BUILD ROUTINES THAT SUPPORT YOU"],
    ["ทำงานอย่างมีสมาธิในจังหวะที่พอดี", "DEEP WORK, GENTLE PACE"],
    ["เก็บความรู้ไว้ใกล้ตัว", "KEEP YOUR KNOWLEDGE CLOSE"],
    ["ทำให้พื้นที่นี้เป็นของคุณ", "MAKE IT YOUR SPACE"],
    ["จัดเวลาให้สิ่งสำคัญ", "MAKE TIME FOR WHAT MATTERS"],
    ["วางแผนอย่างชัดเจน", "PLAN WITH CLARITY"],
    ["วางแผน · ลงมือทำ · เติบโต", "PLAN · DO · GROW"],
    ["ความพยายามของคุณมองเห็นได้", "YOUR EFFORT, MADE VISIBLE"],
    ["ตั้งค่าพื้นที่การเรียนของคุณ", "SET UP YOUR STUDY SPACE"],
    ["เวลาสำหรับโฟกัส", "✳ TIME TO FOCUS"],
    ["ความก้าวหน้า", "Progress"],
    ["โฟกัส · 25 นาที", "Focus · 25 min"],
    ["แผนของคุณ จังหวะของคุณ", "Your plan, your pace."],
    ["STUDIQ — ระบบจัดการการเรียนส่วนตัว", "STUDIQ — Your Personal Learning System"],
    ["งานที่เสร็จแล้ว", "tasks completed"],
    ["ขาวดำ", "black and white"],
    ["ดำขาว", "black and white"],
    ["ภารกิจสำเร็จแล้ว!", "Mission completed!"],
    ["จาก", "from"],
    ["คุณทำงานสำเร็จ", "You completed"],
    ["ยังมีงานวิชา", "You still have tasks in"],
    ["ลองจัดเวลาให้วิชานี้", "Try setting aside time for this subject"],
    ["สะสม", "Accumulated"],
    ["พักหลังจบ", "break after the task"],
    ["สร้างตารางแล้ว", "Schedule created"],
    ["รายการโน้ต", "notes"],
    ["งานในรายการ", "tasks"],
    ["เพิ่มนิสัยแล้ว", "Habit added"],
    ["บันทึกงานแล้ว", "Task saved"],
    ["ลบงานแล้ว", "Task deleted"],
    ["แก้ไขงาน", "Edit task"],
    ["พร้อมเริ่มรอบใหม่", "Ready for a new session"],
    ["เวลาพักหมดแล้ว", "Break over"],
    ["ไม่มีตารางสำหรับวันนี้", "No schedule for today"],
    ["โหมดขาว — ขาวดำ", "White Mode — White and black"],
    ["โหมดมืด — ดำขาว", "Dark Mode — Black and white"],
    ["ฟ้าสกายบลู — ฟ้าพาสเทล", "Sky Blue — Pastel blue"],
    ["ชมพูซากุระ — ชมพูพาสเทล", "Sakura Pink — Pastel pink"],
    ["เขียวมัทฉะ — เขียวพาสเทล", "Matcha Green — Pastel green"],
    ["แดงคริมสัน — แดง", "Crimson Red — Red"],
    ["ข้อมูลของบัญชีที่ลงชื่อเข้าใช้", "Data for the signed-in account"],
    ["บัญชีส่วนตัวและการซิงก์", "Private account and sync"],
    ["รายการงาน โน้ต ตาราง ธีม และสถิติจะบันทึกในฐานข้อมูลบนคลาวด์ของบัญชีที่ลงชื่อเข้าใช้ และแคชในเบราว์เซอร์นี้ ระบบใช้สิทธิ์ฐานข้อมูลแยกตามบัญชีเพื่อไม่ให้บัญชีอื่นอ่านข้อมูลของคุณได้", "Tasks, notes, schedules, themes, and stats are synced to the signed-in account's cloud record, with a local browser cache. Database policies separate each account's data."],
    ["วิธีใช้ Smart Schedule", "How to use Smart Schedule"],
    ["1. เพิ่มงานใน Smart Planner พร้อมใส่เวลาที่คาดว่าจะใช้และวันครบกำหนด", "1. Add tasks in Smart Planner with estimated duration and a due date."],
    ["2. ตั้งเวลาเริ่มว่างและเวลาสิ้นสุด เช่น 16:00–19:00", "2. Set your available start and end times, for example 16:00–19:00."],
    ["3. กำหนดเวลาพักระหว่างงาน เช่น 10 นาที", "3. Set the break between tasks, for example 10 minutes."],
    ["4. กด “บันทึกเวลา” เพื่อบันทึกช่วงเวลาพร้อมสร้างตาราง หรือกด “สร้างตารางอัตโนมัติ” หลังตั้งค่าแล้ว", "4. Click Save time to save the availability and generate a schedule, or click Create schedule after setting it."],
    ["5. ตรวจตารางด้านซ้าย หากมีงานใหม่หรือเปลี่ยนเวลาว่าง ให้สร้างตารางใหม่อีกครั้ง", "5. Review the schedule. Regenerate it after adding tasks or changing availability."],
    ["ระบบจัดลำดับตามความสำคัญและวันครบกำหนด โดยวางงานภายในช่วงเวลาว่างที่คุณกำหนดไว้", "Tasks are ordered by priority and due date, then placed within the available time range you entered."]
  ];
  const textTranslations = {
    th: LANGUAGE_PAIRS.map(([th,en])=>[en,th]).filter(([en,th])=>en && en!==th),
    en: LANGUAGE_PAIRS.map(([th,en])=>[th,en]).filter(([th,en])=>th && th!==en)
  };
  function translateString(value) {
    let out=String(value);
    const pairs=[...textTranslations[currentLanguage]].sort((a,b)=>b[0].length-a[0].length);
    for(const [from,to] of pairs) out=out.split(from).join(to);
    return out;
  }
  function skipTranslationNode(node) {
    const p=node.parentElement;
    return !p || !!p.closest('[data-i18n-skip],input,textarea,script,style,.task-content strong,.task-row-title,.task-row-meta span:first-child,.note-card h3,.note-card p,.note-card .note-subject,.habit-card h3,.habit-card p,.mission-line,.entry-title,.bar-label');
  }
  function translateTree(root=document.body) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{if(!skipTranslationNode(node)){const next=translateString(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}});
    const elements=[root,...root.querySelectorAll('*')];
    elements.forEach(el=>{
      if(el.nodeType!==Node.ELEMENT_NODE || el.closest('[data-i18n-skip]'))return;
      ['placeholder','title','aria-label','aria-description'].forEach(attr=>{
        if(el.hasAttribute(attr)){const old=el.getAttribute(attr),next=translateString(old);if(old!==next)el.setAttribute(attr,next);}
      });
    });
    document.documentElement.lang=currentLanguage;
    document.title=currentLanguage==='en'?'STUDIQ — Your Personal Learning System':'STUDIQ — ระบบจัดการการเรียนส่วนตัว';
    const button=$('#languageToggle');
    if(button){button.textContent=currentLanguage==='th'?'EN':'ไทย';button.title=currentLanguage==='th'?'Switch to English':'เปลี่ยนเป็นภาษาไทย';button.setAttribute('aria-label',button.title);}
    const dateEl=$('#todayDate');
    if(dateEl) dateEl.textContent=new Date().toLocaleDateString(currentLanguage==='en'?'en-US':'th-TH',{weekday:'long',month:'long',day:'numeric'}).toUpperCase();
  }
  function setLanguage(language) {
    currentLanguage=language==='en'?'en':'th';
    try{localStorage.setItem(LANGUAGE_KEY,currentLanguage);}catch{}
    // Refresh generated labels and dates in the newly selected language without changing saved user data.
    renderTasks();renderHabits();renderNotes();renderSchedule();renderDashboard();renderProgress();
    translateTree(document.body);
    updateAuthLanguage();
  }
  $('#languageToggle').addEventListener('click',()=>setLanguage(currentLanguage==='th'?'en':'th'));
  const languageObserver = new MutationObserver(records=>{
    // Translate newly rendered UI strings; the current language makes this operation idempotent.
    for(const record of records){
      if(record.type==='childList')record.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE && !node.matches('#languageToggle'))translateTree(node);else if(node.nodeType===Node.TEXT_NODE && !skipTranslationNode(node)){const next=translateString(node.nodeValue);if(next!==node.nodeValue)node.nodeValue=next;}});
      else if(record.type==='characterData' && !skipTranslationNode(record.target)){const next=translateString(record.target.nodeValue);if(next!==record.target.nodeValue)record.target.nodeValue=next;}
    }
  });

  // Account-scoped cloud storage. The login UI is the only visible screen until auth succeeds.
  function collectSnapshot() {
    return {version:3,tasks,notes,habits,schedule,settings,focusedMinutes,sessions,theme:document.body.dataset.theme||"white",updatedAt:new Date().toISOString()};
  }
  function storeSnapshotForActiveUser(data) {
    const pairs = [
      [KEYS.tasks, Array.isArray(data.tasks)?data.tasks:defaultTasks],
      [KEYS.notes, Array.isArray(data.notes)?data.notes:defaultNotes],
      [KEYS.habits, Array.isArray(data.habits)?data.habits:defaultHabits],
      [KEYS.schedule, data.schedule && typeof data.schedule === "object" ? data.schedule : {}],
      [KEYS.settings, data.settings && typeof data.settings === "object" ? data.settings : {name:"",dayStart:"08:00",sleepTime:"22:30",dailyGoal:120,defaultTheme:"white",availableStart:"16:00",availableEnd:"20:00",breakDuration:10}],
      [KEYS.focus, Number(data.focusedMinutes)||0],
      [KEYS.sessions, Array.isArray(data.sessions)?data.sessions:[]],
      [KEYS.theme, typeof data.theme === "string" ? data.theme : "white"]
    ];
    for (const [key,value] of pairs) localStorage.setItem(storageKey(key),JSON.stringify(value));
  }
  async function flushCloudSave() {
    if (!cloudReady || !activeUserId || !supabaseClient) return {error:new Error("Not connected")};
    clearTimeout(cloudSaveTimer);
    const uid=activeUserId;
    const {error}=await supabaseClient.from("studiq_user_data").upsert(
      {user_id:uid,data:collectSnapshot(),updated_at:new Date().toISOString()},
      {onConflict:"user_id"}
    );
    const status=$("#cloudSyncStatus");
    if(error){
      if(status)status.textContent=currentLanguage==="en"?"Save status: cloud save failed — check Supabase setup and connection.":"สถานะการบันทึก: บันทึกออนไลน์ไม่สำเร็จ ตรวจการตั้งค่า Supabase และอินเทอร์เน็ต";
      const now=Date.now();if(now-lastCloudErrorAt>12000){showToast(currentLanguage==="en"?"Cloud save failed. Check your connection and Supabase setup.":"บันทึกออนไลน์ไม่สำเร็จ โปรดตรวจการเชื่อมต่อและการตั้งค่า Supabase");lastCloudErrorAt=now;}
    }else if(status)status.textContent=currentLanguage==="en"?"Save status: synced to your account.":"สถานะการบันทึก: ซิงก์กับบัญชีของคุณแล้ว";
    return {error};
  }
  function scheduleCloudSave() {
    if (!cloudReady || !activeUserId || !supabaseClient) return;
    clearTimeout(cloudSaveTimer);
    const uid=activeUserId;
    cloudSaveTimer=setTimeout(()=>{if(cloudReady&&activeUserId===uid)void flushCloudSave();},650);
  }
  function refreshInMemoryFromStorage() {
    tasks=read(KEYS.tasks,defaultTasks); notes=read(KEYS.notes,defaultNotes); habits=read(KEYS.habits,defaultHabits);
    schedule=read(KEYS.schedule,{}); settings=read(KEYS.settings,{name:"",dayStart:"08:00",sleepTime:"22:30",dailyGoal:120,defaultTheme:"white",availableStart:"16:00",availableEnd:"20:00",breakDuration:10});
    sessions=read(KEYS.sessions,[]); focusedMinutes=Number(read(KEYS.focus,0))||0;
    currentNoteId=null; taskFilter="all"; timerRunning=false; clearInterval(timerInterval); timerRemaining=timerLength; timerMode="focus";
  }
  function showAuthGate(message="") {
    $("#authGate").hidden=false; $(".app-shell").classList.add("auth-locked");
    const msg=$("#authMessage"); if(msg) msg.textContent=message;
  }
  function showSignedInApp(user) {
    $("#authGate").hidden=true; $(".app-shell").classList.remove("auth-locked");
    $("#currentAccountEmail").textContent=user.email||"STUDIQ account";
    $("#cloudSyncStatus").textContent=currentLanguage==="en"?"Save status: connected to your account.":"สถานะการบันทึก: เชื่อมต่อบัญชีแล้ว";
    applyTheme(read(KEYS.theme,settings.defaultTheme||"white")); fillSettings();
    renderTasks(); renderHabits(); renderNotes(); renderSchedule(); renderDashboard(); renderProgress();
    translateTree(document.body);
    updateAuthLanguage();
  }
  async function handleAuthSession(session) {
    const user=session?.user;
    if(!user){activeUserId=null;cloudReady=false;initializingUserId=null;showAuthGate();return;}
    if(activeUserId===user.id && cloudReady)return;
    if(initializingUserId===user.id)return;
    initializingUserId=user.id; activeUserId=user.id; cloudReady=false;
    showAuthGate(currentLanguage==="en"?"Signing in and loading your private data…":"กำลังเข้าสู่ระบบและโหลดข้อมูลส่วนตัวของคุณ…");
    try {
      const {data:row,error}=await supabaseClient.from("studiq_user_data").select("data").eq("user_id",user.id).maybeSingle();
      if(error) throw error;
      if(row && row.data && typeof row.data === "object") storeSnapshotForActiveUser(row.data);
      refreshInMemoryFromStorage();
      cloudReady=true;
      showSignedInApp(user);
      if(!row) scheduleCloudSave();
    } catch(error) {
      console.error("STUDIQ account data load failed",error);
      cloudReady=false;
      showAuthGate(currentLanguage==="en"?"Could not load private cloud data. Confirm that you ran supabase-setup.sql and configured the Supabase URL and publishable key, then refresh.":"โหลดข้อมูลส่วนตัวไม่สำเร็จ โปรดตรวจว่ารันไฟล์ supabase-setup.sql แล้ว และตั้งค่า Supabase URL กับ Publishable key ถูกต้อง จากนั้นรีเฟรชหน้า");
    } finally { initializingUserId=null; }
  }
  let authMode="login";
  function setAuthMode(mode) {
    authMode=mode==="signup"?"signup":"login";
    $("#authSignupTab").classList.toggle("selected",authMode==="signup");
    $("#authLoginTab").classList.toggle("selected",authMode==="login");
    $("#authSubmit").textContent=authMode==="signup"?(currentLanguage==="en"?"Create account":"สร้างบัญชี"): (currentLanguage==="en"?"Sign in":"เข้าสู่ระบบ");
    $("#authHeading").textContent=authMode==="signup"?(currentLanguage==="en"?"Create your account":"สร้างบัญชี STUDIQ"): (currentLanguage==="en"?"Welcome back":"เข้าสู่ STUDIQ");
    $("#authSubheading").textContent=authMode==="signup"?(currentLanguage==="en"?"Sign up to keep your study data private to your account.":"สมัครบัญชีเพื่อเก็บข้อมูลการเรียนแยกเป็นของคุณ"): (currentLanguage==="en"?"Sign in to continue your personal study plan.":"เข้าสู่ระบบเพื่อกลับไปยังแผนการเรียนส่วนตัว");
    $("#authMessage").textContent="";
    updateAuthLanguage();
  }
  function updateAuthLanguage() {
    const toggle=$("#authLanguageToggle"); if(toggle){toggle.textContent=currentLanguage==="th"?"EN":"ไทย";toggle.title=currentLanguage==="th"?"Switch to English":"เปลี่ยนเป็นภาษาไทย";}
    $("#authLoginTab").textContent=currentLanguage==="en"?"Sign in":"เข้าสู่ระบบ";
    $("#authSignupTab").textContent=currentLanguage==="en"?"Create account":"สร้างบัญชี";
    $("#authForm label:first-child").childNodes[0].textContent=currentLanguage==="en"?"Email":"อีเมล";
    $("#authForm label:nth-child(2)").childNodes[0].textContent=currentLanguage==="en"?"Password":"รหัสผ่าน";
    $("#authPassword").placeholder=currentLanguage==="en"?"At least 8 characters":"อย่างน้อย 8 ตัวอักษร";
    $(".auth-card .eyebrow").textContent=currentLanguage==="en"?"YOUR PERSONAL STUDY SPACE":"พื้นที่การเรียนส่วนตัวของคุณ";
    $(".auth-privacy p").innerHTML=currentLanguage==="en"?"<strong>Your data stays private</strong><br>Sign in to access the tasks, notes, and schedule for this account. Sign out when using a shared computer.":"<strong>ข้อมูลของคุณเป็นส่วนตัว</strong><br>ต้องลงชื่อเข้าใช้เพื่อเข้าถึงงาน โน้ต และตารางของบัญชีนี้ ออกจากระบบเมื่อใช้เครื่องร่วมกับผู้อื่น";
    $(".auth-footnote").textContent=currentLanguage==="en"?"STUDIQ does not store your password in the website files.":"STUDIQ ไม่เก็บรหัสผ่านไว้ในไฟล์เว็บไซต์";
    $("#logoutButton").textContent=currentLanguage==="en"?"Sign out":"ออกจากระบบ";
  }
  $("#authLanguageToggle").addEventListener("click",()=>setLanguage(currentLanguage==="th"?"en":"th"));
  $("#authLoginTab").addEventListener("click",()=>setAuthMode("login"));
  $("#authSignupTab").addEventListener("click",()=>setAuthMode("signup"));
  $("#authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    const email=$("#authEmail").value.trim(); const password=$("#authPassword").value;
    const msg=$("#authMessage"); const submit=$("#authSubmit");
    if(!supabaseClient){msg.textContent=currentLanguage==="en"?"Supabase is not configured yet. Follow README_SETUP.md.":"ยังไม่ได้ตั้งค่า Supabase โปรดทำตามขั้นตอนใน README_SETUP.md ก่อน";return;}
    if(!email || password.length<8){msg.textContent=currentLanguage==="en"?"Enter a valid email and a password of at least 8 characters.":"กรอกอีเมลให้ถูกต้องและใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร";return;}
    submit.disabled=true; msg.textContent=currentLanguage==="en"?"Please wait…":"กำลังดำเนินการ…";
    try {
      if(authMode==="signup"){
        const {data,error}=await supabaseClient.auth.signUp({email,password,options:{emailRedirectTo:window.location.href.split("#")[0]}});
        if(error)throw error;
        if(!data.session) msg.textContent=currentLanguage==="en"?"Account created. Check your email to confirm, then return here and sign in.":"สร้างบัญชีแล้ว โปรดเปิดอีเมลเพื่อยืนยันบัญชี จากนั้นกลับมาหน้านี้เพื่อเข้าสู่ระบบ";
        else msg.textContent=currentLanguage==="en"?"Account created. Opening your study space…":"สร้างบัญชีแล้ว กำลังเปิดพื้นที่การเรียนของคุณ…";
      } else {
        const {error}=await supabaseClient.auth.signInWithPassword({email,password}); if(error)throw error;
        msg.textContent=currentLanguage==="en"?"Signed in. Loading your data…":"เข้าสู่ระบบแล้ว กำลังโหลดข้อมูล…";
      }
    } catch(error) {
      msg.textContent=error?.message || (currentLanguage==="en"?"Authentication failed. Please try again.":"เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally { submit.disabled=false; }
  });
  $("#logoutButton").addEventListener("click",async()=>{
    if(!supabaseClient)return;
    $("#logoutButton").disabled=true;
    const signingOutUserId=activeUserId;
    try {
      const saved=await flushCloudSave();
      const {error}=await supabaseClient.auth.signOut(); if(error)throw error;
      // Remove this user's local cache after a successful cloud save to reduce data left on shared computers.
      if(!saved.error && signingOutUserId) Object.values(KEYS).forEach(k=>localStorage.removeItem(storageKeyForUser(signingOutUserId,k)));
    }
    catch(error){showToast(error?.message||"ออกจากระบบไม่สำเร็จ");}
    finally{$("#logoutButton").disabled=false;}
  });
  function initializeAuth() {
    setAuthMode("login");
    updateAuthLanguage();
    const url=window.STUDIQ_SUPABASE_URL; const key=window.STUDIQ_SUPABASE_PUBLISHABLE_KEY;
    if(!url || !key || url.includes("PASTE_") || key.includes("PASTE_") || !window.supabase?.createClient) {
      showAuthGate(currentLanguage==="en"?"Setup required: add your Supabase Project URL and publishable key in supabase-config.js, then run the SQL file. The app stays locked until authentication is configured.":"ต้องตั้งค่าก่อนใช้งาน: ใส่ Supabase Project URL และ Publishable key ใน supabase-config.js แล้วรันไฟล์ SQL ระบบจะยังไม่เปิดให้ใช้งานจนกว่าจะตั้งค่าบัญชีเสร็จ");
      return;
    }
    try {
      supabaseClient=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      supabaseClient.auth.onAuthStateChange((_event,session)=>{ Promise.resolve().then(()=>handleAuthSession(session)); });
    } catch(error) { showAuthGate(error?.message||"ตั้งค่า Supabase ไม่สำเร็จ"); }
  }
  translateTree(document.body);
  languageObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
  initializeAuth();
})();
