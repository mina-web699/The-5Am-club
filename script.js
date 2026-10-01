// ==================== 0. أدوات التاريخ (بتوقيت جهاز المستخدم مش UTC) ====================
// مهم: toISOString() بترجّع تاريخ UTC. في مصر (UTC+2/+3) ده معناه إن "النهاردة" بيبقى
// غلط بعد 12 بالليل، وإن التنقل بين الأيام بيتعلّق أو بيقفز يومين. عشان كده كل التواريخ
// في الموقع بتتحسب من مكوّنات التاريخ المحلي (سنة/شهر/يوم) بالدوال دي.
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return formatLocalDate(new Date());
}

// إضافة/طرح أيام لتاريخ بصيغة YYYY-MM-DD بدون أي تأثر بالتوقيت الصيفي أو UTC
function addDaysToDateStr(dateStr, delta) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return formatLocalDate(new Date(y, m - 1, d + delta));
}

// ==================== 1. تهيئة البيانات وحفظها محلياً ====================
let studentTimeline = JSON.parse(localStorage.getItem("prod_timeline")) || [];

// ترحيل البيانات القديمة: أي مهمة من نسخة سابقة مفيهاش تاريخ نعتبرها مهمة النهاردة
(function migrateTimelineDates() {
  const todayForMigration = todayStr();
  let migrated = false;
  studentTimeline.forEach((item) => {
    if (!item.date) {
      item.date = todayForMigration;
      migrated = true;
    }
  });
  if (migrated)
    localStorage.setItem("prod_timeline", JSON.stringify(studentTimeline));
})();

let currentViewDate = todayStr();
let lastKnownToday = todayStr();

let atomicHabits = JSON.parse(localStorage.getItem("prod_habits")) || [];
let eisenhowerTasks = JSON.parse(localStorage.getItem("prod_matrix")) || {
  q1: [],
  q2: [],
  q3: [],
  q4: [],
};
let flashcards = JSON.parse(localStorage.getItem("prod_flashcards")) || [];
let spacedRepetition = JSON.parse(localStorage.getItem("prod_spaced")) || [];
let subjects = JSON.parse(localStorage.getItem("prod_subjects")) || [];
let subjectStudyMinutes =
  JSON.parse(localStorage.getItem("prod_subject_minutes")) || {};

let remindersEnabled =
  JSON.parse(localStorage.getItem("prod_reminders_enabled")) || false;
let reminderLeadMinutes =
  parseInt(localStorage.getItem("prod_reminder_lead")) || 10;
let notifiedLog = JSON.parse(localStorage.getItem("prod_notified_log")) || {};

let currentFlashcardIndex = -1;
let activeSubjectFilter = "all";
let resources = JSON.parse(localStorage.getItem("prod_resources")) || [];
let activeResourceFilter = "all";
// دايمًا أول يوم في الشهر المعروض (لو بدأنا من يوم 31 بيقفز شهر كامل عند التنقل)
let calendarViewDate = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
})();

document.addEventListener("DOMContentLoaded", () => {
  initSidebarNav();
  sortAndRenderTimeline();
  renderHabits();
  renderMatrix();
  renderSubjects();
  renderSubjectSelectors();
  renderFlashcard();
  renderSpacedRepetition();
  initPomodoroAndSounds();
  initReminders();
  calculateWeeklyAnalytics();
  updateNextTaskPreview();
  updateExamCountdownPreview();
  renderGpaCalculator();
  renderStudyPlan();
  renderResources();
  renderExamCalendar();
  setInterval(checkReminders, 30000);
  setInterval(checkDayRollover, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkDayRollover();
  });
  initOnboarding();
});

// لو الصفحة فضلت مفتوحة وعدّى منتصف الليل: نحدّث "النهاردة" في كل الشاشات
function checkDayRollover() {
  const now = todayStr();
  if (now === lastKnownToday) return;
  if (currentViewDate === lastKnownToday) currentViewDate = now;
  lastKnownToday = now;
  sortAndRenderTimeline();
  calculateWeeklyAnalytics();
  updateNextTaskPreview();
  updateExamCountdownPreview();
  renderSubjects();
  renderSpacedRepetition();
  renderStudyPlan();
  renderExamCalendar();
}

function saveAll() {
  localStorage.setItem("prod_timeline", JSON.stringify(studentTimeline));
  localStorage.setItem("prod_habits", JSON.stringify(atomicHabits));
  localStorage.setItem("prod_matrix", JSON.stringify(eisenhowerTasks));
  localStorage.setItem("prod_flashcards", JSON.stringify(flashcards));
  localStorage.setItem("prod_spaced", JSON.stringify(spacedRepetition));
  localStorage.setItem("prod_subjects", JSON.stringify(subjects));
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = target - now;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatDateArabic(dateStr) {
  const dayNames = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  const monthNames = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  const d = new Date(dateStr + "T00:00:00");
  return `${dayNames[d.getDay()]}، ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

// ==================== 2. إدارة ومحاذاة خط السير اليومي والجدول ====================
function formatTime12Hr(timeStr, addedMinutes = 0) {
  let [hours, minutes] = timeStr.split(":").map(Number);
  if (addedMinutes > 0) {
    minutes += addedMinutes;
    hours += Math.floor(minutes / 60);
    minutes = minutes % 60;
    hours = hours % 24;
  }
  const ampm = hours >= 12 ? "م" : "ص";
  hours = hours % 12 || 12;
  return `${hours < 10 ? "0" : ""}${hours}:${minutes < 10 ? "0" : ""}${minutes} ${ampm}`;
}

window.changeScheduleDay = function (delta) {
  currentViewDate = addDaysToDateStr(currentViewDate, delta);
  sortAndRenderTimeline();
};

window.jumpToToday = function () {
  currentViewDate = todayStr();
  sortAndRenderTimeline();
};

function sortAndRenderTimeline() {
  studentTimeline.sort((a, b) => a.startTime.localeCompare(b.startTime));
  saveAll();

  const tableBody = document.getElementById("table-body");
  const searchTerm = document
    .getElementById("table-search")
    .value.toLowerCase();
  tableBody.innerHTML = "";

  const dateLabel = document.getElementById("schedule-date-label");
  const todayJumpBtn = document.getElementById("jump-today-btn");
  const isToday = currentViewDate === todayStr();
  if (dateLabel) {
    dateLabel.innerText = isToday
      ? `اليوم — ${formatDateArabic(currentViewDate)}`
      : formatDateArabic(currentViewDate);
  }
  if (todayJumpBtn)
    todayJumpBtn.style.display = isToday ? "none" : "inline-flex";

  const dayItems = studentTimeline.filter((r) => r.date === currentViewDate);

  const filtered = dayItems.filter((r) =>
    r.activity.toLowerCase().includes(searchTerm),
  );

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8;">${dayItems.length === 0 ? "مفيش مهام مجدولة في اليوم ده." : "مفيش نتايج تطابق بحثك."}</td></tr>`;
    document.getElementById("row-count").innerText = `المهام: 0`;
    return;
  }

  filtered.forEach((row) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", row.id);
    if (row.completed) tr.classList.add("completed-task");

    tr.innerHTML = `
      <td class="editable-text" onclick="makeRowEditable(this, ${row.id}, 'activity', 'text')">${row.activity}${subjectTagHtml(row.subjectId)}</td>
      <td class="editable-time" onclick="makeRowEditable(this, ${row.id}, 'startTime', 'time')">${formatTime12Hr(row.startTime)}</td>
      <td class="editable-num" onclick="makeRowEditable(this, ${row.id}, 'duration', 'number')">${row.duration} دقيقة</td>
      <td class="desktop-only" style="font-weight:600; color:#475569;">${formatTime12Hr(row.startTime, row.duration)}</td>
      <td><span class="badge ${row.priority}">${row.priority}</span></td>
      <td>
        <button class="check-row-btn" onclick="toggleCompleteRow(${row.id})">
          <i class="${row.completed ? "fa-solid fa-circle-check" : "fa-regular fa-circle"}"></i>
        </button>
      </td>
      <td>
        <button class="delete-row-btn" onclick="deleteSingleRow(${row.id})"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  document.getElementById("row-count").innerText =
    `إجمالي الفترات: ${dayItems.length}`;
  setupInlineEditing();
}

document
  .getElementById("add-schedule-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    studentTimeline.push({
      id: Date.now(),
      date: currentViewDate,
      startTime: this.querySelector("#new-start-time").value,
      duration: parseInt(this.querySelector("#new-duration").value),
      activity: this.querySelector("#new-activity").value.trim(),
      subjectId: this.querySelector("#new-activity-subject").value || null,
      priority: this.querySelector("#new-priority").value,
      completed: false,
    });
    this.reset();
    sortAndRenderTimeline();
    updateNextTaskPreview();
  });

function setupInlineEditing() {
  document.querySelectorAll(".editable-text").forEach((cell) => {
    cell.addEventListener("dblclick", function () {
      if (this.querySelector("input")) return;
      const rowId = this.parentElement.getAttribute("data-id");
      const target = studentTimeline.find((r) => r.id == rowId);
      const input = document.createElement("input");
      input.type = "text";
      input.value = target.activity;
      input.classList.add("inline-edit-input");
      this.innerText = "";
      this.appendChild(input);
      input.focus();
      input.addEventListener("blur", () => {
        if (input.value.trim()) target.activity = input.value.trim();
        sortAndRenderTimeline();
      });
    });
  });
  document.querySelectorAll(".editable-num").forEach((cell) => {
    cell.addEventListener("dblclick", function () {
      if (this.querySelector("input")) return;
      const rowId = this.parentElement.getAttribute("data-id");
      const target = studentTimeline.find((r) => r.id == rowId);
      const input = document.createElement("input");
      input.type = "number";
      input.value = target.duration;
      input.classList.add("inline-edit-input");
      this.innerText = "";
      this.appendChild(input);
      input.focus();
      input.addEventListener("blur", () => {
        if (parseInt(input.value) > 0) target.duration = parseInt(input.value);
        sortAndRenderTimeline();
      });
    });
  });
  document.querySelectorAll(".editable-time").forEach((cell) => {
    cell.addEventListener("dblclick", function () {
      if (this.querySelector("input")) return;
      const rowId = this.parentElement.getAttribute("data-id");
      const target = studentTimeline.find((r) => r.id == rowId);
      const input = document.createElement("input");
      input.type = "time";
      input.value = target.startTime;
      input.classList.add("inline-edit-input");
      this.innerText = "";
      this.appendChild(input);
      input.focus();
      input.addEventListener("blur", () => {
        if (input.value) target.startTime = input.value;
        sortAndRenderTimeline();
      });
    });
  });
}

window.toggleCompleteRow = function (id) {
  const target = studentTimeline.find((r) => r.id === id);
  if (target) {
    target.completed = !target.completed;
    sortAndRenderTimeline();
    calculateWeeklyAnalytics();
    updateNextTaskPreview();
  }
};

window.deleteSingleRow = function (id) {
  studentTimeline = studentTimeline.filter((r) => r.id !== id);
  sortAndRenderTimeline();
  calculateWeeklyAnalytics();
  updateNextTaskPreview();
};

document
  .getElementById("table-search")
  .addEventListener("input", sortAndRenderTimeline);

// ==================== 3. بناء ونظام العادات الذرية ====================
function renderHabits() {
  const list = document.getElementById("habits-list");
  list.innerHTML = "";
  atomicHabits.forEach((habit) => {
    const div = document.createElement("div");
    div.className = `habit-item ${habit.doneToday ? "done" : ""}`;
    div.innerHTML = `
      <span>${habit.name}</span>
      <div class="habit-actions">
          <span class="habit-streak-badge">🔥 ${habit.streak} أيام</span>
          <button class="action-icon-btn" onclick="toggleHabit(${habit.id})">✅</button>
          <button class="action-icon-btn" onclick="deleteHabit(${habit.id})">❌</button>
      </div>
    `;
    list.appendChild(div);
  });
  saveAll();
}

document
  .getElementById("add-habit-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const input = document.getElementById("new-habit-name");
    atomicHabits.push({
      id: Date.now(),
      name: input.value.trim(),
      streak: 0,
      doneToday: false,
    });
    input.value = "";
    renderHabits();
  });

window.toggleHabit = function (id) {
  const habit = atomicHabits.find((h) => h.id === id);
  if (habit) {
    habit.doneToday = !habit.doneToday;
    habit.streak = habit.doneToday
      ? habit.streak + 1
      : Math.max(0, habit.streak - 1);
    renderHabits();
    calculateWeeklyAnalytics();
  }
};

window.deleteHabit = function (id) {
  atomicHabits = atomicHabits.filter((h) => h.id !== id);
  renderHabits();
};

// ==================== 4. نظام الفلاش كارد (الاسترجاع النشط) ====================
document
  .getElementById("add-flashcard-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const q = document.getElementById("fc-question").value.trim();
    const a = document.getElementById("fc-answer").value.trim();
    const subjectId = document.getElementById("fc-subject").value || null;
    flashcards.push({
      id: Date.now(),
      question: q,
      answer: a,
      subjectId: subjectId,
      status: "normal",
    });
    this.reset();
    saveAll();
    currentFlashcardIndex = -1;
    renderFlashcard();
  });

function getFilteredFlashcards() {
  return flashcards.filter((c) => {
    if (activeSubjectFilter !== "all" && c.subjectId !== activeSubjectFilter)
      return false;
    return true;
  });
}

function renderFlashcard() {
  const frontText = document.getElementById("fc-front-text");
  const backText = document.getElementById("fc-back-text");
  const evalBtns = document.getElementById("fc-eval-buttons");
  const inner = document.getElementById("fc-inner");
  const posIndicator = document.getElementById("fc-position-indicator");

  inner.classList.remove("flipped");
  const activeCards = getFilteredFlashcards();

  if (activeCards.length === 0) {
    frontText.innerText =
      activeSubjectFilter === "all"
        ? "لا توجد كروت بعد! أضف كروت جديدة 🌟"
        : "لا توجد كروت لهذه المادة! 🌟";
    backText.innerText = "";
    evalBtns.style.display = "none";
    if (posIndicator) posIndicator.innerText = "";
    currentFlashcardIndex = -1;
    renderFlashcardsList();
    return;
  }

  if (
    currentFlashcardIndex >= activeCards.length ||
    currentFlashcardIndex < 0
  ) {
    currentFlashcardIndex = 0;
  }

  const card = activeCards[currentFlashcardIndex];
  frontText.innerText = card.question;
  backText.innerText = card.answer;
  evalBtns.style.display = "none";
  if (posIndicator)
    posIndicator.innerText = `${currentFlashcardIndex + 1} / ${activeCards.length}`;
  renderFlashcardsList();
}

window.prevFlashcard = function () {
  const activeCards = getFilteredFlashcards();
  if (activeCards.length === 0) return;
  currentFlashcardIndex =
    (currentFlashcardIndex - 1 + activeCards.length) % activeCards.length;
  renderFlashcard();
};

window.nextFlashcard = function () {
  const activeCards = getFilteredFlashcards();
  if (activeCards.length === 0) return;
  currentFlashcardIndex = (currentFlashcardIndex + 1) % activeCards.length;
  renderFlashcard();
};

function renderFlashcardsList() {
  const container = document.getElementById("flashcards-list");
  const countEl = document.getElementById("fc-total-count");
  if (!container) return;
  if (countEl) countEl.innerText = flashcards.length;

  if (flashcards.length === 0) {
    container.innerHTML = `<span class="subjects-empty-hint">لسه مفيش كروت. أضف أول كارت من الفورم فوق.</span>`;
    return;
  }

  container.innerHTML = flashcards
    .map((c) => {
      const statusIcon =
        c.status === "easy" ? "🟢" : c.status === "hard" ? "🔴" : "🟡";
      return `
      <div class="flashcard-list-item" onclick="jumpToFlashcard(${c.id})">
        <span class="fc-list-status">${statusIcon}</span>
        <div class="fc-list-content">
          <span class="fc-list-question">${c.question}</span>
          ${subjectTagHtml(c.subjectId)}
        </div>
        <button class="delete-row-btn" onclick="event.stopPropagation(); deleteFlashcard(${c.id})"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
    })
    .join("");
}

window.jumpToFlashcard = function (id) {
  activeSubjectFilter = "all";
  const filterSelect = document.getElementById("fc-subject-filter");
  if (filterSelect) filterSelect.value = "all";
  const activeCards = getFilteredFlashcards();
  const idx = activeCards.findIndex((c) => c.id === id);
  if (idx !== -1) {
    currentFlashcardIndex = idx;
    renderFlashcard();
    const box = document.getElementById("active-flashcard");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

window.deleteFlashcard = function (id) {
  flashcards = flashcards.filter((c) => c.id !== id);
  saveAll();
  currentFlashcardIndex = -1;
  renderFlashcard();
};

const fcSubjectFilterEl = document.getElementById("fc-subject-filter");
if (fcSubjectFilterEl) {
  fcSubjectFilterEl.addEventListener("change", function () {
    activeSubjectFilter = this.value;
    currentFlashcardIndex = -1;
    renderFlashcard();
  });
}

window.flipFlashcard = function () {
  const inner = document.getElementById("fc-inner");
  if (getFilteredFlashcards().length === 0) return;

  inner.classList.toggle("flipped");
  const evalBtns = document.getElementById("fc-eval-buttons");

  if (inner.classList.contains("flipped")) {
    evalBtns.style.display = "flex";
  } else {
    evalBtns.style.display = "none";
  }
};

window.evaluateFlashcard = function (level) {
  const activeCards = getFilteredFlashcards();
  if (activeCards.length === 0) return;

  const currentCard = activeCards[currentFlashcardIndex];

  if (level === "easy") {
    currentCard.status = "easy";
  } else if (level === "hard") {
    currentCard.status = "hard";
  } else {
    currentCard.status = "normal";
  }

  saveAll();
  currentFlashcardIndex++;
  renderFlashcard();
};

// ==================== 5. جدول وجدولة التكرار المتباعد الذكي ====================
document
  .getElementById("add-spaced-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const topic = document.getElementById("spaced-topic").value.trim();
    const subjectId = document.getElementById("spaced-subject").value || null;
    const today = todayStr();

    spacedRepetition.push({
      id: Date.now(),
      topic: topic,
      subjectId: subjectId,
      dateStudied: today,
      rev1: addDaysToDateStr(today, 1),
      rev1Done: false,
      rev2: addDaysToDateStr(today, 3),
      rev2Done: false,
      rev3: addDaysToDateStr(today, 7),
      rev3Done: false,
      rev4: addDaysToDateStr(today, 30),
      rev4Done: false,
    });

    document.getElementById("spaced-topic").value = "";
    renderSpacedRepetition();
  });

function renderSpacedRepetition() {
  const tbody = document.getElementById("spaced-table-body");
  tbody.innerHTML = "";
  const todayDateStr = todayStr();

  if (spacedRepetition.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">لم تضف أي فترات تكرار علمية بعد.</td></tr>`;
    return;
  }

  spacedRepetition.forEach((item) => {
    const tr = document.createElement("tr");

    const b1 = item.rev1Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev1 <= todayDateStr
        ? "⚠️ راجع الآن"
        : item.rev1;
    const b2 = item.rev2Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev2 <= todayDateStr
        ? "⚠️ راجع الآن"
        : item.rev2;
    const b3 = item.rev3Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev3 <= todayDateStr
        ? "⚠️ راجع الآن"
        : item.rev3;
    const b4 = item.rev4Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev4 <= todayDateStr
        ? "⚠️ راجع الآن"
        : item.rev4;

    tr.innerHTML = `
      <td style="font-weight:700;">${item.topic}${subjectTagHtml(item.subjectId)}</td>
      <td>${item.dateStudied}</td>
      <td onclick="toggleSpacedDay(${item.id}, 1)" style="cursor:pointer;">${b1}</td>
      <td onclick="toggleSpacedDay(${item.id}, 2)" style="cursor:pointer;">${b2}</td>
      <td onclick="toggleSpacedDay(${item.id}, 3)" style="cursor:pointer;">${b3}</td>
      <td onclick="toggleSpacedDay(${item.id}, 4)" style="cursor:pointer;">${b4}</td>
      <td><button class="delete-row-btn" onclick="deleteSpaced(${item.id})">❌</button></td>
    `;
    tbody.appendChild(tr);
  });
  saveAll();
}

window.toggleSpacedDay = function (id, num) {
  const item = spacedRepetition.find((s) => s.id === id);
  if (item) {
    item[`rev${num}Done`] = !item[`rev${num}Done`];
    renderSpacedRepetition();
  }
};

window.deleteSpaced = function (id) {
  spacedRepetition = spacedRepetition.filter((s) => s.id !== id);
  renderSpacedRepetition();
};

// ==================== 6. تصنيف مصفوفة إيزنهاور للمهام ====================
function renderMatrix() {
  ["q1", "q2", "q3", "q4"].forEach((q) => {
    document.getElementById(`list-${q}`).innerHTML = "";
  });
  ["q1", "q2", "q3", "q4"].forEach((q) => {
    const ul = document.getElementById(`list-${q}`);
    eisenhowerTasks[q].forEach((taskObj, index) => {
      const li = document.createElement("li");
      let diffColor =
        taskObj.difficulty === "صعبة"
          ? "#ef4444"
          : taskObj.difficulty === "متوسطة"
            ? "#f59e0b"
            : "#22c55e";
      li.innerHTML = `
        <span style="display:flex; flex-direction:column;">
            <strong>${taskObj.text}</strong>
            <small style="color:${diffColor}; font-weight:700; font-size:0.75rem;">الصعوبة: ${taskObj.difficulty}</small>
        </span> 
        <i class="fa-solid fa-circle-xmark" onclick="deleteMatrixItem('${q}', ${index})"></i>
      `;
      ul.appendChild(li);
    });
  });
  saveAll();
}

document
  .getElementById("matrix-generator-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const text = document.getElementById("matrix-input-text").value.trim();
    const urgency = document.getElementById("matrix-input-urgency").value;
    const difficulty = document.getElementById("matrix-input-difficulty").value;

    let q = "q4";
    if (urgency === "urgent_important") {
      q = difficulty === "صعبة" || difficulty === "متوسطة" ? "q1" : "q3";
    } else if (urgency === "not_urgent_important") {
      q = "q2";
    } else if (urgency === "low_importance") {
      q = difficulty === "صعبة" ? "q4" : "q3";
    }

    eisenhowerTasks[q].push({ text: text, difficulty: difficulty });
    this.reset();
    renderMatrix();
  });

window.deleteMatrixItem = function (q, index) {
  eisenhowerTasks[q].splice(index, 1);
  renderMatrix();
};

// ==================== 7. مؤقت البومودورو والتحكم في الهندسة الصوتية ====================
window.togglePlaySound = function (soundType, btnElement) {
  const audio = document.getElementById(`audio-${soundType}`);
  if (!audio) {
    console.error(`خطأ: لم يتم العثور على عنصر الصوت: audio-${soundType}`);
    return;
  }

  if (audio.paused) {
    const volumeSlider = document.getElementById("global-volume");
    if (volumeSlider) {
      audio.volume = parseFloat(volumeSlider.value);
    }

    audio
      .play()
      .then(() => {
        btnElement.innerText = "إيقاف";
        btnElement.classList.add("playing");
        btnElement.style.backgroundColor = "#ef4444";
      })
      .catch((err) => {
        console.error("المتصفح منع التشغيل التلقائي:", err);
      });
  } else {
    audio.pause();
    btnElement.innerText = "تشغيل";
    btnElement.classList.remove("playing");
    btnElement.style.backgroundColor = "";
  }
};

window.changeVolume = function (volumeValue) {
  const parseFloatValue = parseFloat(volumeValue);
  ["quite", "focus", "lofi", "timer-alarm"].forEach((soundType) => {
    const audio = document.getElementById(`audio-${soundType}`);
    if (audio) {
      audio.volume = parseFloatValue;
    }
  });
};

function logStudySession(subjectId, minutes) {
  const key = subjectId || "_none";
  subjectStudyMinutes[key] = (subjectStudyMinutes[key] || 0) + minutes;
  localStorage.setItem(
    "prod_subject_minutes",
    JSON.stringify(subjectStudyMinutes),
  );
  renderSubjectStats();
}

function initPomodoroAndSounds() {
  let timer,
    isRunning = false,
    timeLeft = 25 * 60,
    isBreak = false,
    activeSessionSubjectId = "";

  let pomodoroCycle =
    parseInt(localStorage.getItem("prod_pomodoro_cycle")) || 0;

  const display = document.getElementById("pomodoro-timer");
  const status = document.getElementById("pomodoro-status");
  const alarm = document.getElementById("timer-alarm");
  const subjectSelect = document.getElementById("pomodoro-subject");

  function stopAlarmNotification() {
    if (alarm) {
      alarm.pause();
      alarm.currentTime = 0;
    }
  }

  function stopAllActiveSounds() {
    ["quite", "focus", "lofi"].forEach((soundType) => {
      const audio = document.getElementById(`audio-${soundType}`);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    document.querySelectorAll(".btn-sound-toggle").forEach((btn) => {
      btn.innerText = "تشغيل";
      btn.classList.remove("playing");
      btn.style.backgroundColor = "";
    });
  }

  function updateCycleDots() {
    document.querySelectorAll(".cycle-dot").forEach((dot) => {
      const n = parseInt(dot.dataset.n);
      dot.classList.toggle("filled", n <= pomodoroCycle);
      dot.classList.toggle("current", n === pomodoroCycle + 1 && !isBreak);
    });
  }
  updateCycleDots();

  const startBtn = document.getElementById("pomodoro-start");
  const pauseBtn = document.getElementById("pomodoro-pause");
  const resetBtn = document.getElementById("pomodoro-reset");

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      stopAlarmNotification();
      if (isRunning) return;
      isRunning = true;
      if (!isBreak)
        activeSessionSubjectId = subjectSelect ? subjectSelect.value : "";
      if (status)
        status.innerText = isBreak
          ? "وقت الراحة والاسترخاء ☕"
          : "وضع العمل العميق نشط! اترك المشتتات 📚";

      timer = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          let m = Math.floor(timeLeft / 60),
            s = timeLeft % 60;
          if (display)
            display.innerText = `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
        } else {
          if (alarm) {
            alarm
              .play()
              .catch((e) => console.log("جرس المنبه واجه قيوداً:", e));
          }
          clearInterval(timer);
          isRunning = false;
          stopAllActiveSounds();

          if (!isBreak) {
            logStudySession(activeSessionSubjectId, 25);
            pomodoroCycle++;
            localStorage.setItem("prod_pomodoro_cycle", pomodoroCycle);
          }

          isBreak = !isBreak;

          if (isBreak) {
            const isLongBreak = pomodoroCycle > 0 && pomodoroCycle % 4 === 0;
            timeLeft = isLongBreak ? 20 * 60 : 5 * 60;
            if (status)
              status.innerText = isLongBreak
                ? "4 جلسات خلصوا! خذ راحة أطول 20 دقيقة 🎉"
                : "انتهت الجلسة! خذ راحة 5 دقائق 🎉";
          } else {
            timeLeft = 25 * 60;
            if (status)
              status.innerText = "انتهت الراحة! لنعد للعمل العميق.. 💪";
            if (pomodoroCycle >= 4) {
              pomodoroCycle = 0;
              localStorage.setItem("prod_pomodoro_cycle", pomodoroCycle);
            }
          }

          updateCycleDots();
          let m = Math.floor(timeLeft / 60),
            s = timeLeft % 60;
          if (display)
            display.innerText = `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
        }
      }, 1000);
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      stopAlarmNotification();
      clearInterval(timer);
      isRunning = false;
      if (status) status.innerText = "المؤقت متوقف مؤقتاً ⏸️";
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      stopAlarmNotification();
      clearInterval(timer);
      isRunning = false;
      stopAllActiveSounds();
      isBreak = false;
      timeLeft = 25 * 60;
      if (status) status.innerText = "مستعد للبدء؟ 🎯";
      if (display) display.innerText = "25:00";
      updateCycleDots();
    });
  }
}

// ==================== 8. المواد الدراسية (Subjects) ====================
document
  .getElementById("add-subject-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const nameInput = document.getElementById("new-subject-name");
    const colorInput = document.getElementById("new-subject-color");
    const examInput = document.getElementById("new-subject-exam-date");
    subjects.push({
      id: String(Date.now()),
      name: nameInput.value.trim(),
      color: colorInput.value,
      examDate: examInput.value || null,
    });
    nameInput.value = "";
    examInput.value = "";
    saveAll();
    renderSubjects();
    renderSubjectSelectors();
    updateExamCountdownPreview();
    renderGpaCalculator();
    renderStudyPlan();
    renderExamCalendar();
  });

function renderSubjects() {
  const list = document.getElementById("subjects-list");
  if (subjects.length === 0) {
    list.innerHTML = `<span class="subjects-empty-hint">لسه مفيش مواد مضافة. أضف أول مادة عشان تربط بيها أدواتك.</span>`;
    return;
  }
  list.innerHTML = subjects
    .map((s) => {
      let examHtml = "";
      if (s.examDate) {
        const days = daysUntil(s.examDate);
        if (days !== null) {
          const label =
            days < 0
              ? "الامتحان خلص"
              : days === 0
                ? "الامتحان النهاردة"
                : `الامتحان بعد ${days} يوم`;
          examHtml = `<span class="exam-badge">${label}</span>`;
        }
      }
      return `
      <span class="subject-chip" style="background:${s.color};">
        ${s.name}
        ${examHtml}
        <button type="button" class="subject-delete-btn" onclick="deleteSubject('${s.id}')">✕</button>
      </span>
    `;
    })
    .join("");
}

window.deleteSubject = function (id) {
  subjects = subjects.filter((s) => s.id !== id);
  saveAll();
  renderSubjects();
  renderSubjectSelectors();
  sortAndRenderTimeline();
  renderSpacedRepetition();
  calculateWeeklyAnalytics();
  updateExamCountdownPreview();
  renderGpaCalculator();
  renderStudyPlan();
  renderResources();
  renderExamCalendar();
};

function renderSubjectSelectors() {
  const optionsHtml = subjects
    .map((s) => `<option value="${s.id}">${s.name}</option>`)
    .join("");

  document.querySelectorAll(".subject-assign-select").forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = `<option value="">بدون مادة</option>${optionsHtml}`;
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  });

  document.querySelectorAll(".subject-filter-select").forEach((sel) => {
    const current = sel.value;
    sel.innerHTML = `<option value="all">كل المواد</option>${optionsHtml}`;
    if ([...sel.options].some((o) => o.value === current)) sel.value = current;
  });
}

function subjectTagHtml(subjectId) {
  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) return "";
  return `<div class="subject-tag"><span class="dot" style="background:${subject.color};"></span>${subject.name}</div>`;
}

// ==================== 9. عداد الامتحانات والاقتراح الذكي ====================
function updateExamCountdownPreview() {
  const container = document.getElementById("exam-countdown-preview");
  if (!container) return;

  const withExams = subjects
    .filter((s) => s.examDate)
    .map((s) => ({ ...s, days: daysUntil(s.examDate) }))
    .filter((s) => s.days !== null && s.days >= 0)
    .sort((a, b) => a.days - b.days);

  if (withExams.length === 0) {
    container.innerHTML = `<span class="empty-hint">مفيش امتحانات متسجلة. حط تاريخ امتحان لأي مادة من شاشة "المواد الدراسية".</span>`;
    return;
  }

  container.innerHTML = withExams
    .slice(0, 3)
    .map((s) => {
      const urgencyClass = s.days <= 2 ? "urgent" : s.days <= 7 ? "soon" : "";
      const daysText =
        s.days === 0
          ? "النهاردة!"
          : s.days === 1
            ? "بكرة"
            : `بعد ${s.days} يوم`;
      return `<div class="exam-countdown-row ${urgencyClass}">
        <span style="display:flex;align-items:center;gap:8px;font-weight:700;">
          <span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block;"></span>
          ${s.name}
        </span>
        <span class="exam-countdown-days">${daysText}</span>
      </div>`;
    })
    .join("");
}

window.suggestWhatToStudy = function () {
  const suggestions = [];
  const todayDateStr = todayStr();

  subjects.forEach((s) => {
    if (!s.examDate) return;
    const days = daysUntil(s.examDate);
    if (days !== null && days >= 0 && days <= 2) {
      suggestions.push({
        text: `امتحان ${s.name} ${days === 0 ? "النهاردة" : days === 1 ? "بكرة" : "بعد " + days + " أيام"} — ذاكره الأول`,
        priority: 1,
      });
    }
  });

  spacedRepetition.forEach((item) => {
    ["rev1", "rev2", "rev3", "rev4"].forEach((revKey) => {
      if (!item[`${revKey}Done`] && item[revKey] <= todayDateStr) {
        suggestions.push({
          text: `مراجعة مستحقة: ${item.topic}`,
          priority: 2,
        });
      }
    });
  });

  eisenhowerTasks.q1.forEach((t) => {
    suggestions.push({ text: `مهمة عاجلة ومهمة: ${t.text}`, priority: 3 });
  });

  studentTimeline
    .filter(
      (t) => !t.completed && t.priority === "عالية" && t.date === todayDateStr,
    )
    .forEach((t) => {
      suggestions.push({
        text: `مهمة عالية الأولوية: ${t.activity}`,
        priority: 4,
      });
    });

  suggestions.sort((a, b) => a.priority - b.priority);

  const result = document.getElementById("smart-suggest-result");
  if (suggestions.length === 0) {
    result.innerHTML = `<div class="smart-suggest-item">مفيش حاجة عاجلة دلوقتي 🎉 وقت كويس تبدأ حاجة جديدة من "الجدول اليومي" أو تراجع مادة من "المواد الدراسية".</div>`;
    return;
  }

  result.innerHTML = suggestions
    .slice(0, 3)
    .map(
      (s, i) =>
        `<div class="smart-suggest-item"><span class="rank-num">${i + 1}</span> ${s.text}</div>`,
    )
    .join("");
};

// ==================== 10. التحليلات الأسبوعية وتوزيع المواد ====================
function calculateWeeklyAnalytics() {
  const todayItems = studentTimeline.filter((t) => t.date === todayStr());
  const allCompleted = todayItems.filter((t) => t.completed).length;
  document.getElementById("stat-completed-tasks").innerText = allCompleted;
  document.getElementById("stat-completed-tasks-home").innerText = allCompleted;

  let habitScore = 0;
  if (atomicHabits.length > 0) {
    const doneHabits = atomicHabits.filter((h) => h.doneToday).length;
    habitScore = Math.round((doneHabits / atomicHabits.length) * 100);
  }
  document.getElementById("stat-habits-score").innerText = `${habitScore}%`;
  document.getElementById("stat-habits-score-home").innerText =
    `${habitScore}%`;

  let efficiencyRate = 0;
  const totalExpectedTasks = todayItems.length;

  if (totalExpectedTasks > 0 || atomicHabits.length > 0) {
    const taskRatio =
      totalExpectedTasks > 0 ? allCompleted / totalExpectedTasks : 0;
    const habitRatio = atomicHabits.length > 0 ? habitScore / 100 : 0;

    if (totalExpectedTasks > 0 && atomicHabits.length > 0) {
      efficiencyRate = Math.round(((taskRatio + habitRatio) / 2) * 100);
    } else if (totalExpectedTasks > 0) {
      efficiencyRate = Math.round(taskRatio * 100);
    } else {
      efficiencyRate = habitScore;
    }
  }
  document.getElementById("stat-efficiency-rate").innerText =
    `${efficiencyRate}%`;
  document.getElementById("stat-efficiency-rate-home").innerText =
    `${efficiencyRate}%`;
  renderWeeklyChart(efficiencyRate);
  renderSubjectStats();
}

function renderWeeklyChart(currentEfficiency) {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const currentDayIndex = new Date().getDay();
  const currentDayName = days[currentDayIndex];

  const targetBar = document.getElementById(`bar-${currentDayName}`);
  if (targetBar) {
    targetBar.style.height = `${Math.max(currentEfficiency, 5)}%`;
  }
}

function renderSubjectStats() {
  const container = document.getElementById("subject-stats-container");
  if (!container) return;

  if (subjects.length === 0) {
    container.innerHTML = `<span class="subjects-empty-hint">أضف موادك الدراسية من شاشة "المواد الدراسية" عشان تظهر إحصائياتها هنا.</span>`;
    return;
  }

  const rows = subjects.map((s) => ({
    subject: s,
    minutes: subjectStudyMinutes[s.id] || 0,
  }));

  const maxMinutes = Math.max(1, ...rows.map((r) => r.minutes));

  container.innerHTML = rows
    .map(
      (r) => `
      <div class="subject-stat-row">
        <span class="subject-stat-name">${r.subject.name}</span>
        <div class="subject-stat-bar-track">
          <div class="subject-stat-bar-fill" style="width:${(r.minutes / maxMinutes) * 100}%; background:${r.subject.color};"></div>
        </div>
        <span class="subject-stat-count">${r.minutes} د</span>
      </div>
    `,
    )
    .join("");
}

// ==================== 11. أقرب مهمة (شاشة الرئيسية) ====================
function updateNextTaskPreview() {
  const container = document.getElementById("next-task-preview");
  if (!container) return;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayDateStr = todayStr();

  const upcoming = studentTimeline
    .filter((t) => !t.completed && t.date === todayDateStr)
    .map((t) => {
      const [h, m] = t.startTime.split(":").map(Number);
      return { ...t, minutesOfDay: h * 60 + m };
    })
    .filter((t) => t.minutesOfDay >= nowMinutes)
    .sort((a, b) => a.minutesOfDay - b.minutesOfDay);

  if (upcoming.length === 0) {
    container.innerHTML = `<span class="empty-hint">مفيش مهام قادمة النهاردة. روح شاشة "الجدول اليومي" وضيف مهمة جديدة.</span>`;
    return;
  }

  const next = upcoming[0];
  container.innerHTML = `
    <span class="next-task-name">${next.activity}${subjectTagHtml(next.subjectId)}</span>
    <span class="next-task-time">${formatTime12Hr(next.startTime)}</span>
  `;
}

// ==================== 12. التذكيرات والتنبيهات (Notifications) ====================
function initReminders() {
  const enableBtn = document.getElementById("enable-reminders-btn");
  const leadGroup = document.getElementById("reminder-lead-group");
  const leadInput = document.getElementById("reminder-lead-input");
  const status = document.getElementById("reminder-status");

  if (!("Notification" in window)) {
    enableBtn.disabled = true;
    enableBtn.innerText = "الإشعارات مش مدعومة في المتصفح ده";
    return;
  }

  leadInput.value = reminderLeadMinutes;

  function refreshUI() {
    if (remindersEnabled && Notification.permission === "granted") {
      enableBtn.style.display = "none";
      leadGroup.style.display = "flex";
      status.innerText = "التذكيرات مفعّلة ✅";
    } else {
      enableBtn.style.display = "inline-flex";
      leadGroup.style.display = "none";
      status.innerText = "";
    }
  }

  enableBtn.addEventListener("click", () => {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        remindersEnabled = true;
        localStorage.setItem("prod_reminders_enabled", "true");
        refreshUI();
      } else {
        status.innerText = "محتاج تسمح بالإشعارات من إعدادات المتصفح.";
      }
    });
  });

  leadInput.addEventListener("change", () => {
    reminderLeadMinutes = parseInt(leadInput.value) || 10;
    localStorage.setItem("prod_reminder_lead", reminderLeadMinutes);
  });

  refreshUI();
}

function markNotified(key) {
  notifiedLog[key] = true;
  localStorage.setItem("prod_notified_log", JSON.stringify(notifiedLog));
}

function checkReminders() {
  if (
    !remindersEnabled ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return;

  const now = new Date();
  const todayDateStr = todayStr();

  studentTimeline.forEach((item) => {
    if (item.completed || item.date !== todayDateStr) return;
    const [h, m] = item.startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(h, m, 0, 0);
    const diffMin = (startDate - now) / 60000;
    const key = `sched-${item.id}-${todayDateStr}`;

    if (diffMin >= 0 && diffMin <= reminderLeadMinutes && !notifiedLog[key]) {
      new Notification("⏰ تذكير بموعد المذاكرة", {
        body: `${item.activity} هتبدأ الساعة ${formatTime12Hr(item.startTime)}`,
        icon: "icon-192.png",
      });
      markNotified(key);
    }
  });

  spacedRepetition.forEach((item) => {
    ["rev1", "rev2", "rev3", "rev4"].forEach((revKey) => {
      if (item[`${revKey}Done`]) return;
      if (item[revKey] <= todayDateStr) {
        const key = `spaced-${item.id}-${revKey}-${todayDateStr}`;
        if (!notifiedLog[key]) {
          new Notification("🧠 مراجعة مستحقة", {
            body: `حان وقت مراجعة: ${item.topic}`,
            icon: "icon-192.png",
          });
          markNotified(key);
        }
      }
    });
  });

  subjects.forEach((s) => {
    if (!s.examDate) return;
    const days = daysUntil(s.examDate);
    if (days !== null && days >= 0 && days <= 2) {
      const key = `exam-${s.id}-${todayDateStr}`;
      if (!notifiedLog[key]) {
        new Notification("📚 امتحان قرّب", {
          body: `امتحان ${s.name} ${days === 0 ? "النهاردة" : days === 1 ? "بكرة" : "بعد " + days + " أيام"}`,
          icon: "icon-192.png",
        });
        markNotified(key);
      }
    }
  });
}

// ==================== 13. القائمة الجانبية وتبديل الشاشات (Sidebar & Views) ====================
function initSidebarNav() {
  const savedView = localStorage.getItem("prod_last_view") || "home";
  switchView(savedView);
}

function switchView(viewName) {
  document.querySelectorAll(".app-view").forEach((view) => {
    view.classList.toggle("active-view", view.id === `view-${viewName}`);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  localStorage.setItem("prod_last_view", viewName);

  if (viewName === "home") {
    updateNextTaskPreview();
    updateExamCountdownPreview();
  }

  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar.classList.contains("open")) toggleSidebar();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleSidebar() {
  const sidebar = document.getElementById("app-sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
}

function toggleTaskModal() {
  const modal = document.getElementById("task-modal");
  modal.classList.toggle("show");

  if (modal.classList.contains("show")) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    document.getElementById("modal-start-time").value = `${hours}:${minutes}`;
  }
}

function handleModalSubmit(event) {
  event.preventDefault();
  const startTime = document.getElementById("modal-start-time").value;
  const duration = parseInt(document.getElementById("modal-duration").value);
  const activity = document.getElementById("modal-activity").value;
  const subjectId = document.getElementById("modal-subject").value || null;
  const priority = document.getElementById("modal-priority").value;

  studentTimeline.push({
    id: Date.now(),
    date: todayStr(),
    startTime: startTime,
    duration: duration,
    activity: activity,
    subjectId: subjectId,
    priority: priority,
    completed: false,
  });

  currentViewDate = todayStr();
  sortAndRenderTimeline();
  if (typeof calculateWeeklyAnalytics === "function")
    calculateWeeklyAnalytics();
  updateNextTaskPreview();
  document.getElementById("modal-schedule-form").reset();
  toggleTaskModal();
}

function makeRowEditable(element, rowId, fieldName, inputType) {
  if (element.querySelector("input")) return;

  const targetRow = studentTimeline.find((row) => row.id === rowId);
  if (!targetRow) return;

  const originalValue = targetRow[fieldName];
  const input = document.createElement("input");
  input.type = inputType;
  input.value = originalValue;
  input.classList.add("inline-edit-input");

  element.innerHTML = "";
  element.appendChild(input);
  input.focus();

  let isSaving = false;

  function saveAndRefresh() {
    if (isSaving) return;
    isSaving = true;

    let newValue = input.value.trim();

    if (newValue !== "") {
      if (inputType === "number") {
        newValue = parseInt(newValue, 10) || originalValue;
      }
      targetRow[fieldName] = newValue;
      sortAndRenderTimeline();
    } else {
      sortAndRenderTimeline();
    }
  }

  input.addEventListener("blur", saveAndRefresh);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.keyCode === 13) {
      event.preventDefault();
      input.blur();
    }
  });
}

// ==================== 14. الترحيب بالمستخدم الجديد (Onboarding) ====================
function showOnboarding() {
  const modal = document.getElementById("onboarding-modal");
  if (modal) modal.style.display = "flex";
}

function closeOnboarding() {
  const modal = document.getElementById("onboarding-modal");
  if (modal) modal.style.display = "none";
  localStorage.setItem("prod_seen_onboarding", "true");
}

function initOnboarding() {
  const seen = localStorage.getItem("prod_seen_onboarding");
  if (!seen) showOnboarding();
}

// ==================== 15. المعدل التراكمي وخطة المذاكرة الزمنية ====================
function renderGpaCalculator() {
  const tbody = document.getElementById("gpa-table-body");
  const resultEl = document.getElementById("gpa-result");
  if (!tbody) return;

  if (subjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a3b8;">أضف موادك الدراسية الأول من شاشة "المواد الدراسية".</td></tr>`;
    if (resultEl) resultEl.innerText = "";
    return;
  }

  tbody.innerHTML = subjects
    .map(
      (s) => `
    <tr>
      <td style="font-weight:700;"><span class="dot" style="background:${s.color};"></span> ${s.name}</td>
      <td><input type="number" min="0" step="0.5" value="${s.creditHours ?? ""}" placeholder="مثال: 3" onchange="updateSubjectGpaField('${s.id}','creditHours', this.value)"></td>
      <td><input type="number" min="0" max="100" value="${s.grade ?? ""}" placeholder="مثال: 85" onchange="updateSubjectGpaField('${s.id}','grade', this.value)"></td>
    </tr>
  `,
    )
    .join("");

  let totalWeighted = 0,
    totalHours = 0,
    countedSubjects = 0;
  subjects.forEach((s) => {
    if (s.creditHours && s.grade !== null && s.grade !== undefined) {
      totalWeighted += s.creditHours * s.grade;
      totalHours += s.creditHours;
      countedSubjects++;
    }
  });

  if (resultEl) {
    if (totalHours > 0) {
      const avg = (totalWeighted / totalHours).toFixed(1);
      resultEl.innerHTML = `<strong>المعدل التراكمي: ${avg} / 100</strong> (بناءً على ${countedSubjects} مادة)`;
    } else {
      resultEl.innerText =
        "حط الساعات المعتمدة والدرجة لأي مادة عشان يظهر المعدل.";
    }
  }
}

window.updateSubjectGpaField = function (id, field, value) {
  const s = subjects.find((x) => x.id === id);
  if (!s) return;
  s[field] = value === "" ? null : parseFloat(value);
  saveAll();
  renderGpaCalculator();
};

function renderStudyPlan() {
  const tbody = document.getElementById("study-plan-table-body");
  if (!tbody) return;

  if (subjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">أضف موادك الدراسية الأول من شاشة "المواد الدراسية".</td></tr>`;
    return;
  }

  tbody.innerHTML = subjects
    .map((s) => {
      const daysLeft = s.examDate ? daysUntil(s.examDate) : null;
      let targetText = "—";
      if (daysLeft !== null && daysLeft > 0 && s.remainingUnits) {
        const minutesPerUnit = s.minutesPerUnit || 60;
        const unitsPerDay = s.remainingUnits / daysLeft;
        const hoursPerDay = (unitsPerDay * minutesPerUnit) / 60;
        targetText = `${unitsPerDay.toFixed(1)} وحدة (${hoursPerDay.toFixed(1)} ساعة) يوميًا`;
      } else if (daysLeft !== null && daysLeft <= 0) {
        targetText = "الامتحان وصل!";
      }
      return `
      <tr>
        <td style="font-weight:700;"><span class="dot" style="background:${s.color};"></span> ${s.name}</td>
        <td>${daysLeft !== null ? daysLeft + " يوم" : "بدون تاريخ"}</td>
        <td><input type="number" min="0" value="${s.remainingUnits ?? ""}" placeholder="مثال: 10" onchange="updateSubjectPlanField('${s.id}','remainingUnits', this.value)"></td>
        <td><input type="number" min="1" value="${s.minutesPerUnit ?? ""}" placeholder="60" onchange="updateSubjectPlanField('${s.id}','minutesPerUnit', this.value)"></td>
        <td style="font-weight:700; color:var(--primary);">${targetText}</td>
      </tr>`;
    })
    .join("");
}

window.updateSubjectPlanField = function (id, field, value) {
  const s = subjects.find((x) => x.id === id);
  if (!s) return;
  s[field] = value === "" ? null : parseFloat(value);
  saveAll();
  renderStudyPlan();
};

// ==================== 16. مكتبة الموارد الدراسية ====================
document
  .getElementById("add-resource-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    const title = document.getElementById("new-resource-title").value.trim();
    let url = document.getElementById("new-resource-url").value.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const subjectId =
      document.getElementById("new-resource-subject").value || null;
    resources.push({ id: Date.now(), title, url, subjectId });
    localStorage.setItem("prod_resources", JSON.stringify(resources));
    this.reset();
    renderResources();
  });

function renderResources() {
  const container = document.getElementById("resources-list");
  if (!container) return;

  const filtered = resources.filter(
    (r) =>
      activeResourceFilter === "all" || r.subjectId === activeResourceFilter,
  );

  if (filtered.length === 0) {
    container.innerHTML = `<span class="subjects-empty-hint">${resources.length === 0 ? "لسه مفيش موارد محفوظة. أضف أول رابط من الفورم فوق." : "مفيش موارد لهذه المادة."}</span>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (r) => `
    <div class="resource-item">
      <a href="${r.url}" target="_blank" rel="noopener" class="resource-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${r.title}</a>
      ${subjectTagHtml(r.subjectId)}
      <button class="delete-row-btn" onclick="deleteResource(${r.id})"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  `,
    )
    .join("");
}

window.deleteResource = function (id) {
  resources = resources.filter((r) => r.id !== id);
  localStorage.setItem("prod_resources", JSON.stringify(resources));
  renderResources();
};

const resourceFilterEl = document.getElementById("resource-subject-filter");
if (resourceFilterEl) {
  resourceFilterEl.addEventListener("change", function () {
    activeResourceFilter = this.value;
    renderResources();
  });
}

// ==================== 17. تقويم الامتحانات الشامل ====================
function renderExamCalendar() {
  const grid = document.getElementById("exam-calendar-grid");
  const label = document.getElementById("exam-calendar-label");
  const listContainer = document.getElementById("exam-calendar-list");
  if (!grid) return;

  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 1) % 7; // السبت أول يوم في الأسبوع
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];
  if (label) label.innerText = `${monthNames[month]} ${year}`;

  const examMap = {};
  subjects.forEach((s) => {
    if (s.examDate) {
      if (!examMap[s.examDate]) examMap[s.examDate] = [];
      examMap[s.examDate].push(s);
    }
  });

  const currentTodayStr = todayStr();
  let html = "";
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="calendar-cell empty"></div>`;
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const examsToday = examMap[dateStr] || [];
    const isToday = dateStr === currentTodayStr;
    const dotsHtml = examsToday
      .map(
        (s) =>
          `<span class="calendar-exam-dot" style="background:${s.color};" title="امتحان ${s.name}"></span>`,
      )
      .join("");
    html += `<div class="calendar-cell ${isToday ? "today" : ""} ${examsToday.length ? "has-exam" : ""}">
      <span class="calendar-day-num">${day}</span>
      <div class="calendar-dots">${dotsHtml}</div>
    </div>`;
  }
  grid.innerHTML = html;

  if (listContainer) {
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthExams = Object.keys(examMap)
      .filter((d) => d.startsWith(monthPrefix))
      .sort()
      .flatMap((d) => examMap[d].map((s) => ({ ...s, examDateOnly: d })));

    if (monthExams.length === 0) {
      listContainer.innerHTML = `<span class="subjects-empty-hint">مفيش امتحانات مسجلة الشهر ده.</span>`;
    } else {
      listContainer.innerHTML = monthExams
        .map(
          (s) => `
        <div class="exam-list-row">
          <span class="dot" style="background:${s.color};"></span>
          <span>${s.name}</span>
          <span class="exam-list-date">${formatDateArabic(s.examDateOnly)}</span>
        </div>
      `,
        )
        .join("");
    }
  }
}

window.changeCalendarMonth = function (delta) {
  calendarViewDate = new Date(
    calendarViewDate.getFullYear(),
    calendarViewDate.getMonth() + delta,
    1,
  );
  renderExamCalendar();
};

// ==================== 18. نسخة احتياطية من البيانات (Export / Import) ====================
function exportData() {
  const data = {
    prod_timeline: studentTimeline,
    prod_habits: atomicHabits,
    prod_matrix: eisenhowerTasks,
    prod_flashcards: flashcards,
    prod_spaced: spacedRepetition,
    prod_subjects: subjects,
    prod_subject_minutes: subjectStudyMinutes,
    prod_resources: resources,
    exportedAt: new Date().toISOString(),
    appVersion: "2.2.0",
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `5am-club-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importDataFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch (err) {
      alert("الملف ده مش نسخة احتياطية صحيحة (JSON غير سليم).");
      event.target.value = "";
      return;
    }

    const looksValid =
      data &&
      (Array.isArray(data.prod_timeline) ||
        Array.isArray(data.prod_habits) ||
        Array.isArray(data.prod_subjects));
    if (!looksValid) {
      alert("الملف ده مش نسخة احتياطية من The 5 AM Club.");
      event.target.value = "";
      return;
    }

    if (
      !confirm("هيتم استبدال كل بياناتك الحالية بالنسخة اللي هتستوردها. متأكد؟")
    ) {
      event.target.value = "";
      return;
    }

    studentTimeline = data.prod_timeline || [];
    atomicHabits = data.prod_habits || [];
    eisenhowerTasks = data.prod_matrix || { q1: [], q2: [], q3: [], q4: [] };
    flashcards = data.prod_flashcards || [];
    spacedRepetition = data.prod_spaced || [];
    subjects = data.prod_subjects || [];
    subjectStudyMinutes = data.prod_subject_minutes || {};
    resources = data.prod_resources || [];
    localStorage.setItem(
      "prod_subject_minutes",
      JSON.stringify(subjectStudyMinutes),
    );
    localStorage.setItem("prod_resources", JSON.stringify(resources));

    saveAll();
    sortAndRenderTimeline();
    renderHabits();
    renderMatrix();
    renderSubjects();
    renderSubjectSelectors();
    currentFlashcardIndex = -1;
    renderFlashcard();
    renderSpacedRepetition();
    calculateWeeklyAnalytics();
    updateNextTaskPreview();
    updateExamCountdownPreview();
    renderGpaCalculator();
    renderStudyPlan();
    renderResources();
    renderExamCalendar();
    event.target.value = "";
    alert("تم استيراد بياناتك بنجاح! ✅");
  };
  reader.readAsText(file);
}

// ==================== 19. الـ Service Worker وميزة التثبيت المخصص الـ PWA ====================
function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.className = "update-banner";
  banner.innerHTML = `
    <span>🚀 في نسخة جديدة من الموقع جاهزة</span>
    <div class="update-banner-actions">
      <button class="update-btn" onclick="window.location.reload()">تحديث الآن</button>
      <button class="update-dismiss-btn" onclick="document.getElementById('update-banner').remove()">×</button>
    </div>
  `;
  document.body.appendChild(banner);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("تم تفعيل نظام الأوفلاين الشامل للموقع بنجاح!", reg);

        // لو فيه نسخة جديدة من sw.js شغالة، نوري بانر التحديث — بس لما يكون فيه
        // نسخة قديمة كانت شغالة أصلاً (مش أول تثبيت للموقع على الإطلاق)
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner();
            }
          });
        });
      })
      .catch((err) => console.log("فشل تسجيل نظام الأوفلاين:", err));
  });
}

let deferredPrompt;
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = "block";
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`قرار المستخدم: ${outcome}`);
      deferredPrompt = null;
      installBtn.style.display = "none";
    }
  });
}

window.addEventListener("appinstalled", (evt) => {
  console.log("تم تثبيت التطبيق بنجاح على الشاشة الرئيسية!");
  if (installBtn) installBtn.style.display = "none";
});

if (window.matchMedia("(display-mode: standalone)").matches) {
  if (installBtn) installBtn.style.display = "none";
}

function togglePrivacyModal(event) {
  if (event) event.preventDefault();
  const privacyModal = document.getElementById("privacy-modal");
  if (privacyModal) {
    if (privacyModal.style.display === "flex") {
      privacyModal.style.display = "none";
    } else {
      privacyModal.style.display = "flex";
    }
  }
}

window.addEventListener("click", function (event) {
  const privacyModal = document.getElementById("privacy-modal");
  if (event.target === privacyModal) {
    privacyModal.style.display = "none";
  }
  const onboardingModal = document.getElementById("onboarding-modal");
  if (event.target === onboardingModal) {
    closeOnboarding();
  }
});
