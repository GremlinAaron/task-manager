const APP_KEY = "quadrant-task-manager.projects";
const LEGACY_TASK_KEY = "quadrant-task-manager.tasks";

const quadrants = [
  "important-urgent",
  "important-not-urgent",
  "urgent-not-important",
  "not-urgent-not-important"
];

const quadrantNames = {
  "important-urgent": "重要紧急",
  "important-not-urgent": "重要不紧急",
  "urgent-not-important": "紧急不重要",
  "not-urgent-not-important": "不紧急不重要"
};

const taskForm = document.querySelector("#taskForm");
const projectForm = document.querySelector("#projectForm");
const subtaskForm = document.querySelector("#subtaskForm");
const taskTitle = document.querySelector("#taskTitle");
const taskQuadrant = document.querySelector("#taskQuadrant");
const taskDue = document.querySelector("#taskDue");
const projectName = document.querySelector("#projectName");
const template = document.querySelector("#taskTemplate");
const overviewTemplate = document.querySelector("#overviewTemplate");
const filterButtons = document.querySelectorAll(".filter");
const projectList = document.querySelector("#projectList");
const currentProjectName = document.querySelector("#currentProjectName");
const renameProjectBtn = document.querySelector("#renameProjectBtn");
const deleteProjectBtn = document.querySelector("#deleteProjectBtn");
const openOverview = document.querySelector("#openOverview");
const doneOverview = document.querySelector("#doneOverview");
const taskModal = document.querySelector("#taskModal");
const modalTaskTitle = document.querySelector("#modalTaskTitle");
const modalTaskQuadrant = document.querySelector("#modalTaskQuadrant");
const modalTaskDue = document.querySelector("#modalTaskDue");
const modalTaskDone = document.querySelector("#modalTaskDone");
const modalProjectName = document.querySelector("#modalProjectName");
const modalTitle = document.querySelector("#modalTitle");
const modalSaveTask = document.querySelector("#modalSaveTask");
const modalDeleteTask = document.querySelector("#modalDeleteTask");
const subtaskTitle = document.querySelector("#subtaskTitle");
const subtaskList = document.querySelector("#subtaskList");
const subtaskProgress = document.querySelector("#subtaskProgress");
const totals = {
  total: document.querySelector("#totalCount"),
  open: document.querySelector("#openCount"),
  done: document.querySelector("#doneCount"),
  project: document.querySelector("#projectCount"),
  overview: document.querySelector("#overviewCount")
};

let state = loadState();
let activeFilter = "all";
let activeTaskId = null;

function uid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeTask(task) {
  return {
    id: task.id || uid(),
    title: task.title || "未命名任务",
    quadrant: quadrants.includes(task.quadrant) ? task.quadrant : "important-urgent",
    due: task.due || "",
    done: Boolean(task.done),
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    createdAt: task.createdAt || Date.now()
  };
}

function createDefaultProject(tasks = []) {
  return {
    id: uid(),
    name: "默认项目",
    tasks: tasks.map(normalizeTask),
    createdAt: Date.now()
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_KEY));
    if (saved?.projects?.length) {
      return {
        activeProjectId: saved.activeProjectId || saved.projects[0].id,
        projects: saved.projects.map((project) => ({
          id: project.id || uid(),
          name: project.name || "未命名项目",
          tasks: Array.isArray(project.tasks) ? project.tasks.map(normalizeTask) : [],
          createdAt: project.createdAt || Date.now()
        }))
      };
    }
  } catch {
    localStorage.removeItem(APP_KEY);
  }

  let legacyTasks = [];
  try {
    legacyTasks = JSON.parse(localStorage.getItem(LEGACY_TASK_KEY)) || [];
  } catch {
    legacyTasks = [];
  }

  const project = createDefaultProject(legacyTasks);
  return { activeProjectId: project.id, projects: [project] };
}

function saveState() {
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function getActiveProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
}

function getTasks() {
  return getActiveProject().tasks;
}

function setTasks(tasks) {
  getActiveProject().tasks = tasks;
  saveState();
}

function createTask(title, quadrant, due) {
  return {
    id: uid(),
    title: title.trim(),
    quadrant,
    due,
    done: false,
    subtasks: [],
    createdAt: Date.now()
  };
}

function taskMatchesFilter(task) {
  if (activeFilter === "open") return !task.done;
  if (activeFilter === "done") return task.done;
  return true;
}

function formatDueDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short"
  });
}

function getSubtaskText(task) {
  const total = task.subtasks.length;
  if (!total) return "无子项";
  const done = task.subtasks.filter((item) => item.done).length;
  return `子项 ${done}/${total}`;
}

function render() {
  renderProjects();
  renderMatrix();
  renderOverview();
  updateCounts();
}

function renderProjects() {
  const activeProject = getActiveProject();
  currentProjectName.textContent = activeProject.name;
  modalProjectName.textContent = activeProject.name;
  projectList.innerHTML = "";

  state.projects
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((project) => {
      const button = document.createElement("button");
      const openCount = project.tasks.filter((task) => !task.done).length;
      button.type = "button";
      button.className = "project-item";
      button.classList.toggle("active", project.id === activeProject.id);
      button.dataset.id = project.id;
      button.innerHTML = `<span>${escapeHtml(project.name)}</span><small>${project.tasks.length} 项 / ${openCount} 待办</small>`;
      button.addEventListener("click", () => {
        state.activeProjectId = project.id;
        activeTaskId = null;
        saveState();
        closeModal();
        render();
      });
      projectList.appendChild(button);
    });

  deleteProjectBtn.disabled = state.projects.length <= 1;
}

function renderMatrix() {
  document.querySelectorAll(".task-list").forEach((list) => {
    list.innerHTML = "";
  });

  getTasks()
    .filter(taskMatchesFilter)
    .sort((a, b) => a.done - b.done || a.createdAt - b.createdAt)
    .forEach((task) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const checkbox = node.querySelector("input");
      const title = node.querySelector("strong");
      const subtaskMeta = node.querySelector("small");
      const due = node.querySelector("time");
      const taskButton = node.querySelector(".task-main");
      const deleteButton = node.querySelector(".delete-btn");

      node.dataset.id = task.id;
      node.classList.toggle("done", task.done);
      checkbox.checked = task.done;
      title.textContent = task.title;
      subtaskMeta.textContent = getSubtaskText(task);
      due.textContent = formatDueDate(task.due);
      due.dateTime = task.due || "";

      checkbox.addEventListener("change", () => {
        updateTask(task.id, { done: checkbox.checked });
      });

      taskButton.addEventListener("click", () => {
        openTaskModal(task.id);
      });

      deleteButton.addEventListener("click", () => {
        deleteTask(task.id);
      });

      node.addEventListener("dragstart", (event) => {
        node.classList.add("dragging");
        event.dataTransfer.setData("text/plain", task.id);
      });

      node.addEventListener("dragend", () => {
        node.classList.remove("dragging");
      });

      document.querySelector(`[data-quadrant="${task.quadrant}"] .task-list`).appendChild(node);
    });

  updateEmptyStates();
}

function renderOverview() {
  openOverview.innerHTML = "";
  doneOverview.innerHTML = "";

  getTasks()
    .sort((a, b) => a.done - b.done || a.createdAt - b.createdAt)
    .forEach((task) => {
      const node = overviewTemplate.content.firstElementChild.cloneNode(true);
      const title = node.querySelector(".overview-title");
      const deleteButton = node.querySelector(".mini-delete");
      title.textContent = `${task.title} · ${quadrantNames[task.quadrant]}`;
      title.addEventListener("click", () => openTaskModal(task.id));
      deleteButton.addEventListener("click", () => deleteTask(task.id));
      (task.done ? doneOverview : openOverview).appendChild(node);
    });

  toggleOverviewEmpty(openOverview, "暂无未完成任务");
  toggleOverviewEmpty(doneOverview, "暂无已完成任务");
}

function toggleOverviewEmpty(list, text) {
  if (list.children.length) return;
  const item = document.createElement("li");
  item.className = "overview-empty";
  item.textContent = text;
  list.appendChild(item);
}

function updateTask(id, patch) {
  setTasks(getTasks().map((task) => task.id === id ? { ...task, ...patch } : task));
  render();
  if (activeTaskId === id) renderModal();
}

function deleteTask(id) {
  const task = getTasks().find((item) => item.id === id);
  if (task && !confirm(`确定删除任务“${task.title}”吗？`)) return;
  setTasks(getTasks().filter((task) => task.id !== id));
  if (activeTaskId === id) closeModal();
  render();
}

function updateEmptyStates() {
  document.querySelectorAll(".task-list").forEach((list) => {
    list.classList.toggle("empty", list.children.length === 0);
  });
}

function updateCounts() {
  const tasks = getTasks();
  totals.total.textContent = tasks.length;
  totals.open.textContent = tasks.filter((task) => !task.done).length;
  totals.done.textContent = tasks.filter((task) => task.done).length;
  totals.project.textContent = state.projects.length;
  totals.overview.textContent = tasks.length;

  quadrants.forEach((quadrant) => {
    const count = tasks.filter((task) => task.quadrant === quadrant).length;
    document.querySelector(`[data-count="${quadrant}"]`).textContent = count;
  });
}

function openTaskModal(id) {
  activeTaskId = id;
  renderModal();
  taskModal.classList.add("open");
  taskModal.setAttribute("aria-hidden", "false");
  modalTaskTitle.focus();
}

function closeModal() {
  taskModal.classList.remove("open");
  taskModal.setAttribute("aria-hidden", "true");
  activeTaskId = null;
}

function getActiveTask() {
  return getTasks().find((task) => task.id === activeTaskId);
}

function renderModal() {
  const task = getActiveTask();
  if (!task) return;

  modalTitle.textContent = task.title;
  modalTaskTitle.value = task.title;
  modalTaskQuadrant.value = task.quadrant;
  modalTaskDue.value = task.due || "";
  modalTaskDone.checked = task.done;
  subtaskList.innerHTML = "";

  task.subtasks.forEach((subtask) => {
    const item = document.createElement("li");
    item.className = subtask.done ? "done" : "";

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const span = document.createElement("span");
    checkbox.type = "checkbox";
    checkbox.checked = subtask.done;
    span.textContent = subtask.title;
    checkbox.addEventListener("change", () => {
      updateSubtask(subtask.id, { done: checkbox.checked });
    });
    label.append(checkbox, span);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-delete";
    button.textContent = "删除";
    button.addEventListener("click", () => deleteSubtask(subtask.id));

    item.append(label, button);
    subtaskList.appendChild(item);
  });

  if (!task.subtasks.length) {
    const item = document.createElement("li");
    item.className = "overview-empty";
    item.textContent = "暂无子项";
    subtaskList.appendChild(item);
  }

  const done = task.subtasks.filter((item) => item.done).length;
  subtaskProgress.textContent = `${done}/${task.subtasks.length}`;
}

function updateSubtask(id, patch) {
  const task = getActiveTask();
  if (!task) return;
  const subtasks = task.subtasks.map((item) => item.id === id ? { ...item, ...patch } : item);
  updateTask(task.id, { subtasks });
}

function deleteSubtask(id) {
  const task = getActiveTask();
  if (!task) return;
  const subtask = task.subtasks.find((item) => item.id === id);
  if (subtask && !confirm(`确定删除子项“${subtask.title}”吗？`)) return;
  updateTask(task.id, { subtasks: task.subtasks.filter((item) => item.id !== id) });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) return;

  setTasks([
    createTask(title, taskQuadrant.value, taskDue.value),
    ...getTasks()
  ]);

  taskForm.reset();
  taskQuadrant.value = "important-urgent";
  taskTitle.focus();
  render();
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = projectName.value.trim();
  if (!name) return;

  const project = {
    id: uid(),
    name,
    tasks: [],
    createdAt: Date.now()
  };

  state.projects.push(project);
  state.activeProjectId = project.id;
  projectForm.reset();
  saveState();
  render();
});

deleteProjectBtn.addEventListener("click", () => {
  if (state.projects.length <= 1) return;
  const project = getActiveProject();
  const ok = confirm(`确定删除项目“${project.name}”及其中所有任务吗？`);
  if (!ok) return;
  state.projects = state.projects.filter((item) => item.id !== project.id);
  state.activeProjectId = state.projects[0].id;
  saveState();
  closeModal();
  render();
});

renameProjectBtn.addEventListener("click", () => {
  const project = getActiveProject();
  const name = prompt("请输入新的项目名称", project.name)?.trim();
  if (!name || name === project.name) return;

  project.name = name;
  saveState();
  render();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

document.querySelectorAll(".quadrant").forEach((quadrant) => {
  quadrant.addEventListener("dragover", (event) => {
    event.preventDefault();
    quadrant.classList.add("drag-over");
  });

  quadrant.addEventListener("dragleave", () => {
    quadrant.classList.remove("drag-over");
  });

  quadrant.addEventListener("drop", (event) => {
    event.preventDefault();
    quadrant.classList.remove("drag-over");
    const id = event.dataTransfer.getData("text/plain");
    updateTask(id, { quadrant: quadrant.dataset.quadrant });
  });
});

modalSaveTask.addEventListener("click", () => {
  const task = getActiveTask();
  const title = modalTaskTitle.value.trim();
  if (!task || !title) return;

  updateTask(task.id, {
    title,
    quadrant: modalTaskQuadrant.value,
    due: modalTaskDue.value,
    done: modalTaskDone.checked
  });
  closeModal();
});

modalDeleteTask.addEventListener("click", () => {
  if (!activeTaskId) return;
  deleteTask(activeTaskId);
});

subtaskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = getActiveTask();
  const title = subtaskTitle.value.trim();
  if (!task || !title) return;

  updateTask(task.id, {
    subtasks: [
      ...task.subtasks,
      { id: uid(), title, done: false, createdAt: Date.now() }
    ]
  });
  subtaskForm.reset();
  subtaskTitle.focus();
});

taskModal.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && taskModal.classList.contains("open")) closeModal();
});

if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

saveState();
render();
