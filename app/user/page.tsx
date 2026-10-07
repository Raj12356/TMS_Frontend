"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./user.module.css";
import Footer from "../components/Footer";

type User = {
  id: number;
  name: string;
  role: string;
};

type Task = {
  id: number;
  userId: number;
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  category: string;
  completed: boolean;
  attachments?: string[];
};

export default function UserDashboard() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "create" | "tasks">("dashboard");

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium",
    category: "",
    attachments: "",
  });

  const [activeFilters, setActiveFilters] = useState({
    status: "all",
    priority: "all",
    sort: "latest",
  });

  // AUTH CHECK
  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(stored);
      setCurrentUser(user);
      setAuthorized(true);

      if ("Notification" in window) {
        Notification.requestPermission();
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  // CATEGORIES
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setCategoryOptions(data))
      .catch(() => {});
  }, []);

  // FETCH TASKS
  useEffect(() => {
    if (!currentUser?.id) return;

    fetch(`/api/tasks?userId=${currentUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data);
        } else {
          setTasks([]);
        }
      })
      .catch(() => setTasks([]));
  }, [currentUser]);

  // LOGOUT
  const logout = () => {
    fetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  // ADD TASK
  const addTask = async () => {
    if (!form.title.trim() || !currentUser) {
      alert("Please enter a task title");
      return;
    }

    try {
      const res = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          attachments: form.attachments
            ? form.attachments.split(",").map((a) => a.trim()).filter(Boolean)
            : [],
          userId: currentUser.id,
          completed: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      const newTask = await res.json();
      setTasks((prev) => [newTask, ...prev]);

      setActiveTab("dashboard");

      setForm({
        title: "",
        description: "",
        dueDate: "",
        priority: "medium",
        category: "",
        attachments: "",
      });
    } catch (e) {
      console.error(e);
      alert("Failed to create task. Please try again.");
    }
  };

  // NOTIFICATION DUE REMINDERS
  useEffect(() => {
    if (!Array.isArray(tasks) || !tasks.length) return;

    const now = new Date();

    tasks.forEach((task) => {
      if (!task.dueDate || task.completed) return;

      const due = new Date(task.dueDate);
      const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      if (diff <= 1 && diff > 0) {
        if (Notification.permission === "granted") {
          new Notification("⏰ Task Reminder", {
            body: `"${task.title}" is due soon!`,
          });
        }
      }
    });
  }, [tasks]);

  // TOGGLE TASK STATUS
  const toggleTask = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          completed: !task.completed,
        }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: !task.completed } : t
        )
      );
    } catch (e) {
      console.error(e);
      alert("Failed to update task status");
    }
  };

  // DELETE TASK
  const deleteTask = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`/api/tasks?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete task");

      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
      alert("Failed to delete task");
    }
  };

  // SAVE EDIT
  const saveEdit = async () => {
    if (!editingTask) return;

    try {
      const res = await fetch(`/api/tasks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTask),
      });

      if (!res.ok) throw new Error("Failed to save changes");

      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? editingTask : t))
      );

      setEditingTask(null);
    } catch (e) {
      console.error(e);
      alert("Failed to save edits");
    }
  };

  // COMPUTED STATS
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const total = safeTasks.length;
  const completed = safeTasks.filter((t) => t.completed).length;

  const overdue = safeTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && !t.completed
  ).length;

  const dueSoon = safeTasks.filter((t) => {
    if (!t.dueDate || t.completed) return false;
    const diff =
      (new Date(t.dueDate).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24);
    return diff <= 2 && diff >= 0;
  }).length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const recentTasks = [...safeTasks]
    .sort((a, b) => b.id - a.id)
    .slice(0, 5);

  const filteredTasks = safeTasks
    .filter((task) => {
      if (activeFilters.status === "completed") return task.completed;
      if (activeFilters.status === "pending") return !task.completed;
      return true;
    })
    .filter((task) => {
      if (activeFilters.priority === "all") return true;
      return (task.priority || "").toLowerCase() === activeFilters.priority.toLowerCase();
    })
    .filter((task) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        task.title?.toLowerCase().includes(term) ||
        task.description?.toLowerCase().includes(term) ||
        task.category?.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (activeFilters.sort === "dueDate") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (activeFilters.sort === "title") {
        return (a.title || "").localeCompare(b.title || "");
      }
      return b.id - a.id;
    });

  if (!authorized) return null;

  return (
    <div className={styles.container}>
      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>✓</div>
          <div className={styles.brandText}>
            <h2>TaskHub</h2>
            <span>User Portal</span>
          </div>
        </div>

        <ul className={styles.navList}>
          <li
            className={`${styles.navItem} ${activeTab === "dashboard" ? styles.active : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span className={styles.navIcon}>📊</span>
            <span>Dashboard</span>
          </li>
          <li
            className={`${styles.navItem} ${activeTab === "create" ? styles.active : ""}`}
            onClick={() => setActiveTab("create")}
          >
            <span className={styles.navIcon}>➕</span>
            <span>Create Task</span>
          </li>
          <li
            className={`${styles.navItem} ${activeTab === "tasks" ? styles.active : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <span className={styles.navIcon}>📋</span>
            <span>My Tasks</span>
          </li>
        </ul>

        <button onClick={logout} className={styles.logoutBtn}>
          <span className={styles.navIcon}>🚪</span>
          <span>Sign Out</span>
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={styles.main}>
        {/* TOP HEADER */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h2>Welcome back, {currentUser?.name || "User"} 👋</h2>
            <p>Track your personal tasks, deadlines, and daily progress</p>
          </div>

          <div className={styles.userBadge}>
            <div className={styles.userAvatar}>
              {(currentUser?.name || "U")[0]}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{currentUser?.name}</span>
              <span className={styles.userRole}>{currentUser?.role || "Team Member"}</span>
            </div>
          </div>
        </div>

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === "dashboard" && (
          <>
            {/* STAT CARDS */}
            <div className={styles.cards}>
              <div className={`${styles.card} ${styles.purple}`}>
                <div className={styles.cardContent}>
                  <h3>Total Tasks</h3>
                  <h2>{total}</h2>
                </div>
                <div className={styles.cardIcon}>📑</div>
              </div>

              <div className={`${styles.card} ${styles.green}`}>
                <div className={styles.cardContent}>
                  <h3>Completed</h3>
                  <h2>{completed}</h2>
                </div>
                <div className={styles.cardIcon}>✅</div>
              </div>

              <div className={`${styles.card} ${styles.orange}`}>
                <div className={styles.cardContent}>
                  <h3>Due Soon</h3>
                  <h2>{dueSoon}</h2>
                </div>
                <div className={styles.cardIcon}>⏰</div>
              </div>

              <div className={`${styles.card} ${styles.red}`}>
                <div className={styles.cardContent}>
                  <h3>Overdue</h3>
                  <h2>{overdue}</h2>
                </div>
                <div className={styles.cardIcon}>⚠️</div>
              </div>
            </div>

            {/* COMPLETION PROGRESS */}
            <div className={styles.overviewProgress}>
              <div className={styles.progressHeader}>
                <h4>Overall Completion Rate</h4>
                <span>{completionRate}% Completed</span>
              </div>
              <div className={styles.progressBarBg}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${completionRate}%` }}
                />
              </div>
            </div>

            {/* RECENT TASKS */}
            <div className={styles.content}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Recent Tasks</h3>
                  <p>Your 5 most recently created or updated tasks</p>
                </div>
                <button
                  className={styles.actionPillBtn}
                  onClick={() => setActiveTab("tasks")}
                >
                  View All Tasks →
                </button>
              </div>

              {recentTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📝</div>
                  <h4>No tasks created yet</h4>
                  <p>Get started by creating your first task to stay organized</p>
                  <button
                    className={styles.btnPrimary}
                    onClick={() => setActiveTab("create")}
                  >
                    + Create Your First Task
                  </button>
                </div>
              ) : (
                <div className={styles.taskGrid}>
                  {recentTasks.map((task) => {
                    const isDueSoon =
                      task.dueDate &&
                      !task.completed &&
                      (new Date(task.dueDate).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24) <=
                        2 &&
                      (new Date(task.dueDate).getTime() - new Date().getTime()) >= 0;

                    const isOverdue =
                      task.dueDate &&
                      !task.completed &&
                      new Date(task.dueDate) < new Date();

                    return (
                      <div
                        key={task.id}
                        className={`${styles.taskCard} ${task.completed ? styles.done : ""}`}
                      >
                        <div className={styles.cardTopRow}>
                          <div className={styles.tagGroup}>
                            <span
                              className={`${styles.badge} ${
                                task.priority?.toLowerCase() === "high"
                                  ? styles.priorityHigh
                                  : task.priority?.toLowerCase() === "low"
                                  ? styles.priorityLow
                                  : styles.priorityMedium
                              }`}
                            >
                              ● {task.priority || "Medium"}
                            </span>
                            {task.category && (
                              <span className={`${styles.badge} ${styles.categoryBadge}`}>
                                🏷️ {task.category}
                              </span>
                            )}
                          </div>

                          <span
                            className={`${styles.statusPill} ${
                              task.completed
                                ? styles.statusDone
                                : isOverdue
                                ? styles.statusOverdue
                                : styles.statusPending
                            }`}
                          >
                            {task.completed
                              ? "✓ Done"
                              : isOverdue
                              ? "⚠️ Overdue"
                              : "⏳ Pending"}
                          </span>
                        </div>

                        <h4 className={styles.taskTitle}>{task.title}</h4>
                        {task.description && (
                          <p className={styles.taskDesc}>{task.description}</p>
                        )}

                        {task.dueDate && (
                          <div className={styles.metaRow}>
                            <span
                              className={`${styles.metaItem} ${
                                isOverdue
                                  ? styles.metaDueOverdue
                                  : isDueSoon
                                  ? styles.metaDueSoon
                                  : ""
                              }`}
                            >
                              📅 Due: {task.dueDate}
                              {isOverdue && " (Overdue)"}
                              {isDueSoon && " (Due soon)"}
                            </span>
                          </div>
                        )}

                        <div className={styles.taskActions}>
                          <button
                            className={task.completed ? styles.btnSecondary : styles.btnPrimary}
                            onClick={() => toggleTask(task)}
                          >
                            {task.completed ? "Mark Pending" : "✓ Mark Done"}
                          </button>
                          <button
                            className={styles.btnSecondary}
                            onClick={() => setEditingTask(task)}
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 2: CREATE TASK */}
        {activeTab === "create" && (
          <div className={styles.formCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h3>Create a New Task</h3>
                <p>Fill in the details below to add a new task to your personal board</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formFull}`}>
                <label className={styles.formLabel}>Task Title *</label>
                <input
                  className={styles.formInput}
                  placeholder="e.g., Complete quarterly review presentation"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.formFull}`}>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="Provide any details, notes, or instructions for this task..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Due Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  min={new Date().toISOString().split("T")[0]}
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Priority Level</label>
                <select
                  className={styles.formSelect}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="low">🟢 Low Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="high">🔴 High Priority</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Category</label>
                <input
                  className={styles.formInput}
                  placeholder="Select or enter category..."
                  list="tms-categories"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="tms-categories">
                  {categoryOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Attachments (Links)</label>
                <input
                  className={styles.formInput}
                  placeholder="https://drive.google.com/..., comma-separated"
                  value={form.attachments}
                  onChange={(e) => setForm({ ...form, attachments: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() =>
                  setForm({
                    title: "",
                    description: "",
                    dueDate: "",
                    priority: "medium",
                    category: "",
                    attachments: "",
                  })
                }
              >
                Clear Form
              </button>
              <button type="button" className={styles.submitBtn} onClick={addTask}>
                + Create Task
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: MY TASKS */}
        {activeTab === "tasks" && (
          <div className={styles.content}>
            <div className={styles.sectionHeader}>
              <div>
                <h3>My Task List</h3>
                <p>Filter, search, organize, and manage your assignments</p>
              </div>
              <button
                className={styles.btnPrimary}
                onClick={() => setActiveTab("create")}
              >
                + New Task
              </button>
            </div>

            {/* INTERACTIVE FILTERS & SEARCH */}
            <div className={styles.filters}>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search tasks by title, description or category..."
                  className={styles.searchInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <select
                className={styles.filterSelect}
                value={activeFilters.status}
                onChange={(e) =>
                  setActiveFilters({ ...activeFilters, status: e.target.value })
                }
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Only</option>
                <option value="completed">Completed Only</option>
              </select>

              <select
                className={styles.filterSelect}
                value={activeFilters.priority}
                onChange={(e) =>
                  setActiveFilters({ ...activeFilters, priority: e.target.value })
                }
              >
                <option value="all">All Priorities</option>
                <option value="high">🔴 High Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="low">🟢 Low Priority</option>
              </select>

              <select
                className={styles.filterSelect}
                value={activeFilters.sort}
                onChange={(e) =>
                  setActiveFilters({ ...activeFilters, sort: e.target.value })
                }
              >
                <option value="latest">Sort by: Latest Created</option>
                <option value="dueDate">Sort by: Due Date</option>
                <option value="title">Sort by: Title A-Z</option>
              </select>

              <span className={styles.filterCount}>
                Showing {filteredTasks.length} of {safeTasks.length} tasks
              </span>
            </div>

            {/* TASK CARDS */}
            {filteredTasks.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🔍</div>
                <h4>No matching tasks found</h4>
                <p>Try refining your search terms or filter selections</p>
                {searchTerm && (
                  <button
                    className={styles.btnSecondary}
                    onClick={() => {
                      setSearchTerm("");
                      setActiveFilters({ status: "all", priority: "all", sort: "latest" });
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className={styles.taskGrid}>
                {filteredTasks.map((task) => {
                  const isDueSoon =
                    task.dueDate &&
                    !task.completed &&
                    (new Date(task.dueDate).getTime() - new Date().getTime()) /
                      (1000 * 60 * 60 * 24) <=
                      2 &&
                    (new Date(task.dueDate).getTime() - new Date().getTime()) >= 0;

                  const isOverdue =
                    task.dueDate &&
                    !task.completed &&
                    new Date(task.dueDate) < new Date();

                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskCard} ${task.completed ? styles.done : ""}`}
                    >
                      <div className={styles.cardTopRow}>
                        <div className={styles.tagGroup}>
                          <span
                            className={`${styles.badge} ${
                              task.priority?.toLowerCase() === "high"
                                ? styles.priorityHigh
                                : task.priority?.toLowerCase() === "low"
                                ? styles.priorityLow
                                : styles.priorityMedium
                            }`}
                          >
                            ● {task.priority || "Medium"}
                          </span>

                          {task.category && (
                            <span className={`${styles.badge} ${styles.categoryBadge}`}>
                              🏷️ {task.category}
                            </span>
                          )}
                        </div>

                        <span
                          className={`${styles.statusPill} ${
                            task.completed
                              ? styles.statusDone
                              : isOverdue
                              ? styles.statusOverdue
                              : styles.statusPending
                          }`}
                        >
                          {task.completed
                            ? "✓ Done"
                            : isOverdue
                            ? "⚠️ Overdue"
                            : "⏳ Pending"}
                        </span>
                      </div>

                      <h4 className={styles.taskTitle}>{task.title}</h4>
                      {task.description && (
                        <p className={styles.taskDesc}>{task.description}</p>
                      )}

                      {task.dueDate && (
                        <div className={styles.metaRow}>
                          <span
                            className={`${styles.metaItem} ${
                              isOverdue
                                ? styles.metaDueOverdue
                                : isDueSoon
                                ? styles.metaDueSoon
                                : ""
                            }`}
                          >
                            📅 {task.dueDate}
                            {isOverdue && " (Overdue)"}
                            {isDueSoon && " (Due soon)"}
                          </span>
                        </div>
                      )}

                      {task.attachments && task.attachments.length > 0 && (
                        <div className={styles.attachmentList}>
                          {task.attachments.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className={styles.attachmentLink}
                            >
                              📎 Attachment {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className={styles.taskActions}>
                        <button
                          className={task.completed ? styles.btnSecondary : styles.btnPrimary}
                          onClick={() => toggleTask(task)}
                        >
                          {task.completed ? "Mark Pending" : "✓ Complete"}
                        </button>
                        <button
                          className={styles.btnSecondary}
                          onClick={() => setEditingTask(task)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className={styles.btnDanger}
                          onClick={() => deleteTask(task.id)}
                          title="Delete Task"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL: EDIT TASK */}
        {editingTask && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditingTask(null);
            }}
          >
            <div className={styles.modalDialog}>
              <div className={styles.modalHeader}>
                <h3>✏️ Edit Task #{editingTask.id}</h3>
                <button
                  className={styles.closeBtn}
                  onClick={() => setEditingTask(null)}
                >
                  ✕
                </button>
              </div>

              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label className={styles.formLabel}>Task Title</label>
                  <input
                    className={styles.formInput}
                    value={editingTask.title}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, title: e.target.value })
                    }
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.formFull}`}>
                  <label className={styles.formLabel}>Description</label>
                  <textarea
                    className={styles.formTextarea}
                    value={editingTask.description || ""}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Due Date</label>
                  <input
                    type="date"
                    className={styles.formInput}
                    value={editingTask.dueDate || ""}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, dueDate: e.target.value })
                    }
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Priority</label>
                  <select
                    className={styles.formSelect}
                    value={editingTask.priority || "medium"}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, priority: e.target.value })
                    }
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🔴 High</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Category</label>
                  <input
                    className={styles.formInput}
                    value={editingTask.category || ""}
                    list="tms-edit-categories"
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, category: e.target.value })
                    }
                  />
                  <datalist id="tms-edit-categories">
                    {categoryOptions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Attachments (comma-separated)</label>
                  <input
                    className={styles.formInput}
                    value={
                      Array.isArray(editingTask.attachments)
                        ? editingTask.attachments.join(", ")
                        : (editingTask.attachments as unknown as string) || ""
                    }
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        attachments: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={saveEdit}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
        <Footer />
      </main>
    </div>
  );
}