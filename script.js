// ==================== 1. تهيئة البيانات وحفظها محلياً ====================
let studentXP = parseInt(localStorage.getItem("prod_user_xp")) || 0;
let studentStreak = parseInt(localStorage.getItem("prod_user_streak")) || 0;
let lastActiveDate = localStorage.getItem("prod_last_active_date") || "";

let studentTimeline = JSON.parse(localStorage.getItem("prod_timeline")) || [];
let atomicHabits = JSON.parse(localStorage.getItem("prod_habits")) || [];
let eisenhowerTasks = JSON.parse(localStorage.getItem("prod_matrix")) || {
  q1: [],
  q2: [],
  q3: [],
  q4: [],
};
let studentNotes = JSON.parse(localStorage.getItem("prod_notes")) || [];
let flashcards = JSON.parse(localStorage.getItem("prod_flashcards")) || [];
let spacedRepetition = JSON.parse(localStorage.getItem("prod_spaced")) || [];

let currentFlashcardIndex = -1;
const noteColors = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fed7aa", "#fbcfe8"];

document.addEventListener("DOMContentLoaded", () => {
  checkDailyStreak();
  sortAndRenderTimeline();
  renderHabits();
  renderMatrix();
  renderNotes();
  renderFlashcard();
  renderSpacedRepetition();
  initPomodoroAndSounds();
  calculateWeeklyAnalytics();
});

function saveAll() {
  localStorage.setItem("prod_timeline", JSON.stringify(studentTimeline));
  localStorage.setItem("prod_habits", JSON.stringify(atomicHabits));
  localStorage.setItem("prod_matrix", JSON.stringify(eisenhowerTasks));
  localStorage.setItem("prod_notes", JSON.stringify(studentNotes));
  localStorage.setItem("prod_flashcards", JSON.stringify(flashcards));
  localStorage.setItem("prod_spaced", JSON.stringify(spacedRepetition));
  localStorage.setItem("prod_user_xp", studentXP);
  localStorage.setItem("prod_user_streak", studentStreak);
  localStorage.setItem("prod_last_active_date", lastActiveDate);
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

function sortAndRenderTimeline() {
  studentTimeline.sort((a, b) => a.startTime.localeCompare(b.startTime));
  saveAll();

  const tableBody = document.getElementById("table-body");
  const searchTerm = document
    .getElementById("table-search")
    .value.toLowerCase();
  tableBody.innerHTML = "";

  const filtered = studentTimeline.filter((r) =>
    r.activity.toLowerCase().includes(searchTerm),
  );

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8;">الجدول الدراسي فارغ! أضف مهام يومك.</td></tr>`;
    document.getElementById("row-count").innerText = `المهام: 0`;
    return;
  }

  filtered.forEach((row) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", row.id);
    if (row.completed) tr.classList.add("completed-task");

    tr.innerHTML = `
      <td class="editable-text" onclick="makeRowEditable(this, ${row.id}, 'activity', 'text')">${row.activity}</td>
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
    `إجمالي الفترات: ${studentTimeline.length}`;
  setupInlineEditing();
}

document
  .getElementById("add-schedule-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    studentTimeline.push({
      id: Date.now(),
      startTime: this.querySelector("#new-start-time").value,
      duration: parseInt(this.querySelector("#new-duration").value),
      activity: this.querySelector("#new-activity").value.trim(),
      priority: this.querySelector("#new-priority").value,
      completed: false,
    });
    this.reset();
    sortAndRenderTimeline();
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
    if (target.completed) gainXP(10);
    sortAndRenderTimeline();
    calculateWeeklyAnalytics();
  }
};

window.deleteSingleRow = function (id) {
  studentTimeline = studentTimeline.filter((r) => r.id !== id);
  sortAndRenderTimeline();
  calculateWeeklyAnalytics();
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
    if (habit.doneToday) gainXP(15);
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
    flashcards.push({
      id: Date.now(),
      question: q,
      answer: a,
      status: "normal",
    });
    this.reset();
    saveAll();
    if (currentFlashcardIndex === -1) currentFlashcardIndex = 0;
    renderFlashcard();
  });

function renderFlashcard() {
  const frontText = document.getElementById("fc-front-text");
  const backText = document.getElementById("fc-back-text");
  const evalBtns = document.getElementById("fc-eval-buttons");
  const inner = document.getElementById("fc-inner");

  inner.classList.remove("flipped");
  const activeCards = flashcards.filter((c) => c.status !== "easy");

  if (activeCards.length === 0) {
    frontText.innerText = "لا توجد كروت نشطة حالياً! أضف كروت جديدة 🌟";
    backText.innerText = "";
    evalBtns.style.display = "none";
    currentFlashcardIndex = -1;
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
}

window.flipFlashcard = function () {
  const inner = document.getElementById("fc-inner");
  if (flashcards.filter((c) => c.status !== "easy").length === 0) return;

  inner.classList.toggle("flipped");
  const evalBtns = document.getElementById("fc-eval-buttons");

  if (inner.classList.contains("flipped")) {
    evalBtns.style.display = "flex";
  } else {
    evalBtns.style.display = "none";
  }
};

window.evaluateFlashcard = function (level) {
  const activeCards = flashcards.filter((c) => c.status !== "easy");
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
    const today = new Date();
    const format = (d) => d.toISOString().split("T")[0];

    const d1 = new Date(today);
    d1.setDate(today.getDate() + 1);
    const d2 = new Date(today);
    d2.setDate(today.getDate() + 3);
    const d3 = new Date(today);
    d3.setDate(today.getDate() + 7);
    const d4 = new Date(today);
    d4.setDate(today.getDate() + 30);

    spacedRepetition.push({
      id: Date.now(),
      topic: topic,
      dateStudied: format(today),
      rev1: format(d1),
      rev1Done: false,
      rev2: format(d2),
      rev2Done: false,
      rev3: format(d3),
      rev3Done: false,
      rev4: format(d4),
      rev4Done: false,
    });

    document.getElementById("spaced-topic").value = "";
    renderSpacedRepetition();
  });

function renderSpacedRepetition() {
  const tbody = document.getElementById("spaced-table-body");
  tbody.innerHTML = "";
  const todayStr = new Date().toISOString().split("T")[0];

  if (spacedRepetition.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">لم تضف أي فترات تكرار علمية بعد.</td></tr>`;
    return;
  }

  spacedRepetition.forEach((item) => {
    const tr = document.createElement("tr");

    const b1 = item.rev1Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev1 <= todayStr
        ? "⚠️ راجع الآن"
        : item.rev1;
    const b2 = item.rev2Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev2 <= todayStr
        ? "⚠️ راجع الآن"
        : item.rev2;
    const b3 = item.rev3Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev3 <= todayStr
        ? "⚠️ راجع الآن"
        : item.rev3;
    const b4 = item.rev4Done
      ? '<span class="done-badge">تمت</span>'
      : item.rev4 <= todayStr
        ? "⚠️ راجع الآن"
        : item.rev4;

    tr.innerHTML = `
      <td style="font-weight:700;">${item.topic}</td>
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

// ==================== 7. إدارة الملاحظات اللاصقة (Sticky Notes) ====================
function renderNotes() {
  const container = document.getElementById("notes-container");
  container.innerHTML = "";
  studentNotes.forEach((note) => {
    const div = document.createElement("div");
    div.className = "sticky-note";
    div.style.backgroundColor = note.color;
    div.innerHTML = `
      <textarea oninput="updateNoteText(${note.id}, this.value)">${note.text}</textarea>
      <div class="note-footer">
          <button class="action-icon-btn" onclick="changeNoteColor(${note.id})">🎨</button>
          <button class="action-icon-btn" style="color:red;" onclick="deleteNote(${note.id})">🗑️</button>
      </div>
    `;
    container.appendChild(div);
  });
  saveAll();
}

document.getElementById("add-note-btn").addEventListener("click", () => {
  studentNotes.push({ id: Date.now(), text: "", color: noteColors[0] });
  renderNotes();
});

window.updateNoteText = function (id, val) {
  const note = studentNotes.find((n) => n.id === id);
  if (note) {
    note.text = val;
    localStorage.setItem("prod_notes", JSON.stringify(studentNotes));
  }
};

window.changeNoteColor = function (id) {
  const note = studentNotes.find((n) => n.id === id);
  if (note) {
    note.color =
      noteColors[(noteColors.indexOf(note.color) + 1) % noteColors.length];
    renderNotes();
  }
};

window.deleteNote = function (id) {
  studentNotes = studentNotes.filter((n) => n.id !== id);
  renderNotes();
};

// ==================== 8. مؤقت البومودورو والتحكم في الهندسة الصوتية ====================

// 1. دالة التشغيل الفورية المتوافقة مع الموبايل والكمبيوتر
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

// 2. دالة التحكم في مستوى الصوت العام (تتحكم في كل الأصوات الشغالة معاً)
window.changeVolume = function (volumeValue) {
  const parseFloatValue = parseFloat(volumeValue);
  ["quite", "focus", "lofi", "timer-alarm"].forEach((soundType) => {
    const audio = document.getElementById(`audio-${soundType}`);
    if (audio) {
      audio.volume = parseFloatValue;
    }
  });
};

// 3. تهيئة مؤقت البومودورو والأزرار التابعة له
function initPomodoroAndSounds() {
  let timer,
    isRunning = false,
    timeLeft = 25 * 60,
    isBreak = false;
  const display = document.getElementById("pomodoro-timer");
  const status = document.getElementById("pomodoro-status");
  const alarm = document.getElementById("timer-alarm");

  // دالة مخصصة لإيقاف جرس التنبيه تلقائياً عند التفاعل الجديد
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

  const startBtn = document.getElementById("pomodoro-start");
  const pauseBtn = document.getElementById("pomodoro-pause");
  const resetBtn = document.getElementById("pomodoro-reset");

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      stopAlarmNotification(); // 🛑 إيقاف الجرس المزعج تلقائياً فور بدء الفترة الجديدة
      if (isRunning) return;
      isRunning = true;
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
          isBreak = !isBreak;
          timeLeft = isBreak ? 5 * 60 : 25 * 60;
          if (status)
            status.innerText = isBreak
              ? "انتهت الجلسة! خذ راحة 5 دقائق 🎉"
              : "انتهت الراحة! لنعد للعمل العميق.. 💪";
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
      stopAlarmNotification(); // 🛑 إيقاف الجرس لو أراد المستخدم الإيقاف المؤقت
      clearInterval(timer);
      isRunning = false;
      if (status) status.innerText = "المؤقت متوقف مؤقتاً ⏸️";
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      stopAlarmNotification(); // 🛑 إيقاف الجرس عند الضغط على إعادة تعيين
      clearInterval(timer);
      isRunning = false;
      stopAllActiveSounds();
      isBreak = false;
      timeLeft = 25 * 60;
      if (status) status.innerText = "مستعد للبدء؟ 🎯";
      if (display) display.innerText = "25:00";
    });
  }
}

// ==================== 9. نظام التلعيب، مستويات الـ XP والتحليلات الأسبوعية ====================
function updateGamificationHub() {
  const xpPerLevel = 100;
  const currentLevel = Math.floor(studentXP / xpPerLevel) + 1;
  const xpInCurrentLevel = studentXP % xpPerLevel;

  let rankTitle = "طالب مبتدئ 🎓";
  if (currentLevel >= 3) rankTitle = "محارب المهام الصعبة ⚔️";
  if (currentLevel >= 6) rankTitle = "أسطورة الإنتاجية والتركيز 👑";
  if (currentLevel >= 10) rankTitle = "التنين الخارق وعقليّة الـ 5 صباحاً 🐉";

  document.getElementById("user-level-badge").innerText =
    `المستوى ${currentLevel}: مستمر بالتطور 🎯`;
  document.getElementById("user-rank-title").innerText = `رتبة: ${rankTitle}`;
  document.getElementById("current-xp-display").innerText =
    `${xpInCurrentLevel} / ${xpPerLevel} XP (إجمالي الخبرة: ${studentXP})`;

  const fillPercent = (xpInCurrentLevel / xpPerLevel) * 100;
  document.getElementById("xp-progress-fill").style.width = `${fillPercent}%`;
  document.getElementById("daily-streak-count").innerText =
    `${studentStreak} يوم`;
  saveAll();
}

function gainXP(amount) {
  studentXP += amount;
  updateGamificationHub();
}

function checkDailyStreak() {
  const todayStr = new Date().toISOString().split("T")[0];

  if (lastActiveDate === "") {
    studentStreak = 1;
    lastActiveDate = todayStr;
  } else {
    const lastDate = new Date(lastActiveDate);
    const todayDate = new Date(todayStr);
    const diffTime = Math.abs(todayDate - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      studentStreak += 1;
      lastActiveDate = todayStr;
    } else if (diffDays > 1) {
      studentStreak = 1;
      lastActiveDate = todayStr;
    }
  }
  updateGamificationHub();
}

function calculateWeeklyAnalytics() {
  const totalDoneTimeline = studentTimeline.filter((t) => t.completed).length;
  const allCompleted = totalDoneTimeline;
  document.getElementById("stat-completed-tasks").innerText = allCompleted;

  let habitScore = 0;
  if (atomicHabits.length > 0) {
    const doneHabits = atomicHabits.filter((h) => h.doneToday).length;
    habitScore = Math.round((doneHabits / atomicHabits.length) * 100);
  }
  document.getElementById("stat-habits-score").innerText = `${habitScore}%`;

  let efficiencyRate = 0;
  const totalExpectedTasks = studentTimeline.length;

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
  renderWeeklyChart(efficiencyRate);
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

// ==================== 10. النوافذ العائمة والقائمة الجانبية (Sidebar & Layouts) ====================
function toggleSidebar() {
  const sidebar = document.getElementById("mobile-sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
}

function scrollToSection(selector) {
  const section = document.querySelector(selector);
  if (section) {
    toggleSidebar();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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
  const priority = document.getElementById("modal-priority").value;

  studentTimeline.push({
    id: Date.now(),
    startTime: startTime,
    duration: duration,
    activity: activity,
    priority: priority,
    completed: false,
  });

  sortAndRenderTimeline();
  if (typeof calculateWeeklyAnalytics === "function")
    calculateWeeklyAnalytics();
  gainXP(5);
  document.getElementById("modal-schedule-form").reset();
  toggleTaskModal();
}

function openSectionForm(formId) {
  if (window.innerWidth <= 768) {
    const targetForm = document.getElementById(formId);
    const allMobileForms = document.querySelectorAll(".section-mobile-form");

    allMobileForms.forEach((form) => {
      if (form.id !== formId) form.classList.remove("active-form");
    });

    if (targetForm) targetForm.classList.toggle("active-form");
  }
}

function handleCustomTimer(event) {
  event.preventDefault();
  const customMin = document.getElementById("custom-minutes").value;
  if (customMin && typeof isMinutes !== "undefined") {
    isMinutes = parseInt(customMin);
    isSeconds = 0;
    if (typeof updateTimerDisplay === "function") updateTimerDisplay();
    openSectionForm("pomodoro-setup-form");
  } else {
    const timerDisplay = document.getElementById("pomodoro-timer");
    if (customMin && timerDisplay) {
      timerDisplay.textContent = `${String(customMin).padStart(2, "0")}:00`;
      openSectionForm("pomodoro-setup-form");
    }
  }
}

document.querySelectorAll(".section-mobile-form").forEach((form) => {
  form.addEventListener("submit", () => {
    if (window.innerWidth <= 768) form.classList.remove("active-form");
  });
});

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
      sortAndRefresh();
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

// ==================== 11. الـ Service Worker وميزة التثبيت المخصص الـ PWA ====================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) =>
        console.log("تم تفعيل نظام الأوفلاين الشامل للموقع بنجاح!", reg),
      )
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
