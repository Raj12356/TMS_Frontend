"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./manager.module.css";
import Footer from "../components/Footer";

type Comment = {
  id: number;
  userId: number | null;
  managerId?: number | null;
  userName?: string | null;
  message: string;
  createdAt: string;
};

type Task = {
  id: number;
  title: string;
  description?: string;
  assignedTo: number;
  priority: string;
  status: string;
  completed: boolean;
  dueDate: string;
  attachments?: string[];
  comments?: Comment[];
};

type User = {
  id: number;
  name: string;
  email?: string;
  role?: string;
};

export default function ManagerDashboard() {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [currentManager, setCurrentManager] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<"dashboard" | "assign" | "reports">("dashboard");

  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "Medium",
    dueDate: "",
    attachments: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  const [activeTaskChat, setActiveTaskChat] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [privateComments, setPrivateComments] = useState<Comment[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // AUTH CHECK
  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setCurrentManager(u);
      } catch {
        // ignore
      }
    }
  }, []);

  // FETCH TASKS
  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTasks(data);
      } else {
        setTasks([]);
      }
    } catch {
      setTasks([]);
    }
  };

  // FETCH USERS
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch {
      // ignore
    } finally {
      setUsersLoading(false);
    }
  };

  // Only users with role "team member" can receive tasks assigned by manager
  // Roles "user", "manager", and "admin" are explicitly excluded
  const isTeamMember = (role?: string) => {
    if (!role) return false;
    const normalized = role.toLowerCase().trim().replace(/[-_]/g, " ");
    return normalized === "team member";
  };

  const teamMembers = users.filter((u) => isTeamMember(u.role));

  useEffect(() => {
    fetchTasks();
    fetchUsers();
  }, []);

  // FETCH PRIVATE COMMENTS for the active chat task filtered by this manager's id
  useEffect(() => {
    if (!activeTaskChat) {
      setPrivateComments([]);
      return;
    }

    // Read directly from localStorage to avoid state timing issues
    let managerId: number | null = null;
    try {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.id && Number.isInteger(Number(u.id))) {
          managerId = Number(u.id);
        }
      }
    } catch { /* ignore */ }

    if (!managerId) {
      setPrivateComments([]);
      return;
    }

    fetch(`/api/tasks/${activeTaskChat}/comments?managerId=${managerId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Comment[]) => {
        if (Array.isArray(data)) {
          // If server returns items with managerId populated, keep only matching ones;
          // otherwise if managerId is not on the response objects, display all returned comments for this task channel.
          const filtered = data.filter(
            (c) => c.managerId === undefined || c.managerId === null || c.managerId === managerId
          );
          setPrivateComments(filtered);
        }
      })
      .catch(() => setPrivateComments([]));
  }, [activeTaskChat, currentManager?.id]);

  // AUTO SCROLL CHAT
  useEffect(() => {
    if (activeTaskChat && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTaskChat, privateComments]);

  // INPUT HANDLER
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ADD TASK
  const addTask = async () => {
    if (!form.title.trim() || !form.assignedTo) {
      alert("Please provide a task title and select a team member");
      return;
    }

    const targetUser = users.find((u) => String(u.id) === String(form.assignedTo));
    if (targetUser && !isTeamMember(targetUser.role)) {
      alert("Only users with the 'team member' role can receive tasks assigned by a manager. Users with role 'user', 'manager', or 'admin' cannot be assigned tasks.");
      return;
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          assignedTo: Number(form.assignedTo),
          priority: form.priority.toLowerCase(),
          dueDate: form.dueDate,
          status: "pending",
          attachments: form.attachments
            ? form.attachments.split(",").map((a) => a.trim()).filter(Boolean)
            : [],
          comments: [],
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      setForm({
        title: "",
        description: "",
        assignedTo: "",
        priority: "Medium",
        dueDate: "",
        attachments: "",
      });

      await fetchTasks();
      setActiveTab("dashboard");
    } catch (e) {
      console.error(e);
      alert("Failed to assign task");
    }
  };

  // SEND MESSAGE
  const sendMessage = async (taskId: number) => {
    if (!newMessage.trim()) return;

    try {
      const currentStored = localStorage.getItem("currentUser");
      const userObj = currentStored ? JSON.parse(currentStored) : {};
      const managerId = userObj?.id && Number.isInteger(Number(userObj.id))
        ? Number(userObj.id)
        : null;

      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: managerId,
          managerId: managerId,   // manager IS the channel owner
          message: newMessage.trim(),
        }),
      });

      if (!res.ok) throw new Error("Failed to post message");

      setNewMessage("");

      // Refresh private comments for this manager's channel
      if (managerId) {
        const cRes = await fetch(`/api/tasks/${taskId}/comments?managerId=${managerId}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          if (Array.isArray(cData)) {
            setPrivateComments(
              cData.filter(
                (c: Comment) =>
                  c.managerId === undefined || c.managerId === null || c.managerId === managerId
              )
            );
          }
        }
      }
    } catch (e) {
      console.error(e);
      alert("Failed to send message");
    }
  };

  // EXPORT TO CSV
  const exportToCSV = () => {
    if (!safeTasks || safeTasks.length === 0) {
      alert("No tasks available to export.");
      return;
    }

    const headers = ["ID", "Title", "Assignee", "Priority", "Status", "Due Date", "Completed", "Attachments Count"];
    const rows = safeTasks.map((t) => {
      const assigneeUser = users.find((u) => u.id === t.assignedTo);
      const assigneeName = assigneeUser ? assigneeUser.name : (t.assignedTo ? `User #${t.assignedTo}` : "Unassigned");
      const cleanTitle = (t.title || "").replace(/"/g, '""');
      const priority = t.priority || "Medium";
      const status = t.status || (t.completed ? "completed" : "pending");
      const dueDate = t.dueDate || "No deadline";
      const isCompleted = t.completed ? "Yes" : "No";
      const attachmentsCount = t.attachments ? t.attachments.length : 0;

      return `"${t.id}","${cleanTitle}","${assigneeName}","${priority}","${status}","${dueDate}","${isCompleted}","${attachmentsCount}"`;
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `TMS_Task_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // EXPORT TO PRINTABLE PDF REPORT
  const exportToPDF = () => {
    if (!safeTasks || safeTasks.length === 0) {
      alert("No tasks available to export.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to generate printable report.");
      return;
    }

    const dateStr = new Date().toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const rowsHtml = safeTasks
      .map((t, idx) => {
        const assigneeUser = users.find((u) => u.id === t.assignedTo);
        const assigneeName = assigneeUser ? assigneeUser.name : (t.assignedTo ? `User #${t.assignedTo}` : "Unassigned");
        const status = t.status || (t.completed ? "completed" : "pending");
        const priority = t.priority || "Medium";
        const isDone = t.completed || status === "completed";

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
            <td style="padding: 10px; font-weight: 600; color: #475569;">#${t.id}</td>
            <td style="padding: 10px; font-weight: 600; color: #0f172a;">${t.title}</td>
            <td style="padding: 10px; color: #334155;">${assigneeName}</td>
            <td style="padding: 10px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${
                priority.toLowerCase() === "high" ? "#fee2e2; color: #991b1b" : priority.toLowerCase() === "low" ? "#ecfdf5; color: #065f46" : "#fef3c7; color: #92400e"
              };">
                ${priority}
              </span>
            </td>
            <td style="padding: 10px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${
                isDone ? "#dcfce7; color: #166534" : status === "in-progress" ? "#dbeafe; color: #1e40af" : "#f1f5f9; color: #475569"
              };">
                ${isDone ? "Completed" : status}
              </span>
            </td>
            <td style="padding: 10px; color: #475569; font-size: 12px;">${t.dueDate || "No deadline"}</td>
          </tr>
        `;
      })
      .join("");

    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>TMS Executive Task Report - ${dateStr}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 30px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
            .title h1 { margin: 0; font-size: 24px; color: #1e1b4b; }
            .title p { margin: 4px 0 0; color: #64748b; font-size: 14px; }
            .stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
            .stat-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; }
            .stat-box h4 { margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; }
            .stat-box p { margin: 6px 0 0; font-size: 22px; font-weight: 800; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
            th { background: #f1f5f9; padding: 12px 10px; font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
            .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; }
            @media print {
              button.print-btn { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div style="text-align: right; margin-bottom: 14px;">
            <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
              🖨️ Print / Save as PDF
            </button>
          </div>

          <div class="header">
            <div class="title">
              <h1>Task Management System</h1>
              <p>Executive Team Delivery & Milestone Report</p>
            </div>
            <div style="text-align: right; font-size: 13px; color: #64748b;">
              <strong>Generated:</strong> ${dateStr}<br/>
              <strong>Prepared by:</strong> ${currentManager?.name || "Manager"}
            </div>
          </div>

          <div class="stats-bar">
            <div class="stat-box">
              <h4>Total Tasks</h4>
              <p>${total}</p>
            </div>
            <div class="stat-box">
              <h4>Completed</h4>
              <p style="color: #10b981;">${completed}</p>
            </div>
            <div class="stat-box">
              <h4>In Progress</h4>
              <p style="color: #2563eb;">${inProgress}</p>
            </div>
            <div class="stat-box">
              <h4>Completion Rate</h4>
              <p style="color: #4f46e5;">${completionRate}%</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 80px;">Task #</th>
                <th>Task Title</th>
                <th>Assigned To</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <span>Task Management System • Confidential & Internal Use Only</span>
            <span>Author: Raja vishagan</span>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 400);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  // LOGOUT
  const logout = () => {
    fetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  // STATS
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const total = safeTasks.length;
  const completed = safeTasks.filter((t) => t.status === "completed" || t.completed).length;
  const inProgress = safeTasks.filter((t) => t.status === "in-progress").length;
  const overdue = safeTasks.filter((t) => {
    if (t.status === "overdue") return true;
    if (t.dueDate && !t.completed && t.status !== "completed") {
      return new Date(t.dueDate) < new Date();
    }
    return false;
  }).length;
  const pending = safeTasks.filter((t) => t.status === "pending" || (!t.completed && t.status !== "in-progress" && t.status !== "overdue")).length;

  const max = Math.max(total, completed, inProgress, overdue, 1);
  const getHeight = (v: number) => `${Math.max((v / max) * 100, 4)}%`;

  const highPriorityCount = safeTasks.filter((t) => (t.priority || "").toLowerCase() === "high").length;
  const medPriorityCount = safeTasks.filter((t) => (t.priority || "").toLowerCase() === "medium").length;
  const lowPriorityCount = safeTasks.filter((t) => (t.priority || "").toLowerCase() === "low").length;

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // FILTERED TASKS
  const filteredTasks = safeTasks.filter((task) => {
    // Status filter
    if (filterStatus !== "all") {
      const taskStatus = (task.status || (task.completed ? "completed" : "pending")).toLowerCase();
      if (filterStatus === "completed" && !(taskStatus === "completed" || task.completed)) return false;
      if (filterStatus === "in-progress" && taskStatus !== "in-progress") return false;
      if (filterStatus === "pending" && (taskStatus !== "pending" && !task.completed)) return false;
      if (filterStatus === "overdue") {
        const isOver = task.dueDate && !task.completed && new Date(task.dueDate) < new Date();
        if (!isOver && taskStatus !== "overdue") return false;
      }
    }

    // Priority filter
    if (filterPriority !== "all") {
      if ((task.priority || "").toLowerCase() !== filterPriority.toLowerCase()) return false;
    }

    // Search query
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const assigneeName = users.find((u) => u.id === task.assignedTo)?.name?.toLowerCase() || "";
      const matchesTitle = task.title?.toLowerCase().includes(term);
      const matchesDesc = task.description?.toLowerCase().includes(term);
      const matchesAssignee = assigneeName.includes(term) || String(task.assignedTo).includes(term);
      return matchesTitle || matchesDesc || matchesAssignee;
    }

    return true;
  });

  const activeChatTask = safeTasks.find((t) => t.id === activeTaskChat);

  return (
    <div className={styles.container}>
      {/* SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>💼</div>
          <div className={styles.brandText}>
            <h2>TaskHub</h2>
            <span>Manager Workspace</span>
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
            className={`${styles.navItem} ${activeTab === "assign" ? styles.active : ""}`}
            onClick={() => setActiveTab("assign")}
          >
            <span className={styles.navIcon}>➕</span>
            <span>Assign Task</span>
          </li>
          <li
            className={`${styles.navItem} ${activeTab === "reports" ? styles.active : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <span className={styles.navIcon}>📈</span>
            <span>Reports</span>
          </li>
        </ul>

        <button onClick={logout} className={styles.logoutBtn}>
          <span className={styles.navIcon}>🚪</span>
          <span>Sign Out</span>
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={styles.main}>
        {/* TOPBAR */}
        <div className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <h2>Team Oversight & Management</h2>
            <p>Assign tasks, track deadlines, analyze reports, and communicate in real-time</p>
          </div>

          <div className={styles.userBadge}>
            <div className={styles.userAvatar}>
              {(currentManager?.name || "M")[0]}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{currentManager?.name || "Manager"}</span>
              <span className={styles.userRole}>Manager</span>
            </div>
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === "dashboard" && (
          <>
            {/* STAT CARDS */}
            <div className={styles.stats}>
              <div className={`${styles.card} ${styles.cardIndigo}`}>
                <div className={styles.cardContent}>
                  <h3>Total Tasks</h3>
                  <h2>{total}</h2>
                </div>
                <div className={styles.cardIcon}>📑</div>
              </div>

              <div className={`${styles.card} ${styles.cardBlue}`}>
                <div className={styles.cardContent}>
                  <h3>In Progress</h3>
                  <h2>{inProgress}</h2>
                </div>
                <div className={styles.cardIcon}>⚡</div>
              </div>

              <div className={`${styles.card} ${styles.cardGreen}`}>
                <div className={styles.cardContent}>
                  <h3>Completed</h3>
                  <h2>{completed}</h2>
                </div>
                <div className={styles.cardIcon}>✅</div>
              </div>

              <div className={`${styles.card} ${styles.cardRed}`}>
                <div className={styles.cardContent}>
                  <h3>Overdue</h3>
                  <h2>{overdue}</h2>
                </div>
                <div className={styles.cardIcon}>⚠️</div>
              </div>
            </div>

            {/* TASKS TABLE SECTION */}
            <div className={styles.content}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>All Team Tasks</h3>
                  <p>Comprehensive overview of tasks assigned across all team members</p>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={styles.exportCsvBtn}
                    onClick={exportToCSV}
                    title="Export all tasks to CSV spreadsheet"
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    type="button"
                    className={styles.exportPdfBtn}
                    onClick={exportToPDF}
                    title="Generate printable executive PDF report"
                    style={{ padding: "8px 14px", fontSize: "13px" }}
                  >
                    📄 Export PDF
                  </button>
                  <button
                    className={styles.submitBtn}
                    onClick={() => setActiveTab("assign")}
                  >
                    + Assign New Task
                  </button>
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className={styles.filters}>
                <div className={styles.searchBox}>
                  <span className={styles.searchIcon}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search tasks, descriptions, or assignee..."
                    className={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <select
                  className={styles.filterSelect}
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>

                <select
                  className={styles.filterSelect}
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">🔴 High Priority</option>
                  <option value="medium">🟡 Medium Priority</option>
                  <option value="low">🟢 Low Priority</option>
                </select>

                <span className={styles.filterCount}>
                  Showing {filteredTasks.length} of {safeTasks.length} tasks
                </span>
              </div>

              {/* TABLE */}
              {filteredTasks.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>📋</div>
                  <h4>No tasks found</h4>
                  <p>No tasks matched your active search or filters</p>
                  {searchTerm && (
                    <button
                      className={styles.cancelBtn}
                      onClick={() => {
                        setSearchTerm("");
                        setFilterStatus("all");
                        setFilterPriority("all");
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Task Details</th>
                        <th>Assignee</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Attachments</th>
                        <th>Discussion</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredTasks.map((t) => {
                        const assignee = users.find((u) => u.id === t.assignedTo);
                        const isOverdue =
                          t.dueDate &&
                          !t.completed &&
                          t.status !== "completed" &&
                          new Date(t.dueDate) < new Date();

                        const taskStatus = t.status || (t.completed ? "completed" : "pending");

                        return (
                          <tr key={t.id}>
                            <td>
                              <div className={styles.taskTitleCell}>
                                <span className={styles.taskTitleMain}>{t.title}</span>
                                {t.description && (
                                  <span className={styles.taskDescSub}>{t.description}</span>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className={styles.assigneePill}>
                                <div className={styles.assigneeAvatar}>
                                  {assignee?.name ? assignee.name[0].toUpperCase() : "#"}
                                </div>
                                <span>
                                  {assignee?.name || `User ID: ${t.assignedTo}`}
                                </span>
                              </div>
                            </td>

                            <td>
                              <span
                                className={`${styles.badge} ${
                                  (t.priority || "").toLowerCase() === "high"
                                    ? styles.badgeHigh
                                    : (t.priority || "").toLowerCase() === "low"
                                    ? styles.badgeLow
                                    : styles.badgeMedium
                                }`}
                              >
                                ● {t.priority || "Medium"}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`${styles.statusPill} ${
                                  taskStatus === "completed" || t.completed
                                    ? styles.statusCompleted
                                    : taskStatus === "in-progress"
                                    ? styles.statusInProgress
                                    : isOverdue
                                    ? styles.statusOverdue
                                    : styles.statusPending
                                }`}
                              >
                                {taskStatus === "completed" || t.completed
                                  ? "✓ Completed"
                                  : taskStatus === "in-progress"
                                  ? "⚡ In Progress"
                                  : isOverdue
                                  ? "⚠️ Overdue"
                                  : "⏳ Pending"}
                              </span>
                            </td>

                            <td>
                              <div
                                className={`${styles.dueDateCell} ${
                                  isOverdue ? styles.dueDateOverdue : ""
                                }`}
                              >
                                📅 {t.dueDate || "No deadline"}
                              </div>
                            </td>

                            <td>
                              {t.attachments && t.attachments.length > 0 ? (
                                <div className={styles.attachmentsCell}>
                                  {t.attachments.map((link, i) => (
                                    <a
                                      key={i}
                                      href={link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={styles.attachmentBtn}
                                    >
                                      📎 Link {i + 1}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                              )}
                            </td>

                            <td>
                              <button
                                className={styles.chatTriggerBtn}
                                onClick={() => setActiveTaskChat(t.id)}
                              >
                                💬 Chat
                                {t.comments && t.comments.length > 0 && (
                                  <span>({t.comments.length})</span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TASK DISCUSSION DRAWER */}
            {activeTaskChat && activeChatTask && (
              <div
                className={styles.chatOverlay}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setActiveTaskChat(null);
                }}
              >
                <div className={styles.chatDrawer}>
                  <div className={styles.chatHeader}>
                    <div className={styles.chatHeaderTitle}>
                      <h3>💬 Task Discussion</h3>
                      <p>
                        #{activeChatTask.id}: {activeChatTask.title}
                      </p>
                    </div>
                    <button
                      className={styles.closeChatBtn}
                      onClick={() => setActiveTaskChat(null)}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Private channel indicator */}
                  <div style={{
                    padding: "8px 20px",
                    background: "#f0fdf4",
                    borderBottom: "1px solid #bbf7d0",
                    fontSize: "12px",
                    color: "#166534",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}>
                    🔒 Private channel — only you and the team member can see these messages
                  </div>

                  <div className={styles.chatMessages}>
                    {privateComments.length === 0 ? (
                      <div className={styles.emptyChat}>
                        <div className={styles.emptyChatIcon}>💬</div>
                        <p>No messages yet.</p>
                        <span>Start the discussion with the assigned team member!</span>
                      </div>
                    ) : (
                      privateComments.map((c) => {
                        const isSelf =
                          currentManager?.id && c.userId === currentManager.id;

                        return (
                          <div
                            key={c.id}
                            className={`${styles.chatBubbleWrapper} ${
                              isSelf ? styles.chatBubbleSelf : styles.chatBubbleOther
                            }`}
                          >
                            <div className={styles.chatMeta}>
                              <span className={styles.chatSenderName}>
                                {c.userName ||
                                  (c.userId
                                    ? users.find((u) => u.id === c.userId)?.name || `User ${c.userId}`
                                    : "Manager")}
                              </span>
                              {c.createdAt && (
                                <span>
                                  • {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            <div className={styles.chatBubble}>{c.message}</div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <div className={styles.chatInputArea}>
                    <input
                      className={styles.chatInput}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage(activeTaskChat);
                      }}
                      placeholder="Type your private message to the team member..."
                    />
                    <button
                      className={styles.chatSendBtn}
                      onClick={() => sendMessage(activeTaskChat)}
                    >
                      Send ➤
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: ASSIGN TASK */}
        {activeTab === "assign" && (
          <div className={styles.formCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h3>Assign a New Task</h3>
                <p>Delegate responsibilities, define priorities, and set strict deadlines</p>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.formGroup} ${styles.formFull}`}>
                <label className={styles.formLabel}>Task Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g., Implement secure API endpoint and run unit tests"
                  className={styles.formInput}
                />
              </div>

              <div className={`${styles.formGroup} ${styles.formFull}`}>
                <label className={styles.formLabel}>Task Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Provide detailed instructions, context, or deliverables..."
                  className={styles.formTextarea}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Assign To (Team Member Only) *</label>
                {usersLoading ? (
                  <select className={styles.formSelect} disabled>
                    <option>Loading team members...</option>
                  </select>
                ) : teamMembers.length > 0 ? (
                  <>
                    <select
                      name="assignedTo"
                      value={form.assignedTo}
                      onChange={handleChange}
                      className={styles.formSelect}
                    >
                      <option value="">Select a team member...</option>
                      {teamMembers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} (Team Member - ID: {u.id})
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                    </span>
                  </>
                ) : (
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "10px",
                      color: "#b91c1c",
                      fontSize: "12.5px",
                      lineHeight: "1.5",
                    }}
                  >
                    ⚠️ <strong>No eligible team members found:</strong> Only users with the <em>Team Member</em> role can receive tasks from a manager. Standard users, managers, and administrators cannot be assigned tasks. Please have an Administrator assign the &quot;team member&quot; role in the Admin Panel.
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Priority Level</label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className={styles.formSelect}
                >
                  <option value="High">🔴 High Priority</option>
                  <option value="Medium">🟡 Medium Priority</option>
                  <option value="Low">🟢 Low Priority</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Due Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  name="dueDate"
                  value={form.dueDate}
                  onChange={handleChange}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Attachments (URLs)</label>
                <input
                  name="attachments"
                  value={form.attachments}
                  onChange={handleChange}
                  placeholder="Comma-separated URLs (e.g. Figma, Google Docs)"
                  className={styles.formInput}
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
                    assignedTo: "",
                    priority: "Medium",
                    dueDate: "",
                    attachments: "",
                  })
                }
              >
                Clear
              </button>
              <button type="button" className={styles.submitBtn} onClick={addTask}>
                + Assign Task
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: REPORTS & ANALYTICS */}
        {activeTab === "reports" && (
          <div className={styles.reportsLayout}>
            {/* EXPORT REPORT BANNER */}
            <div className={styles.exportBanner}>
              <div className={styles.exportBannerInfo}>
                <h3>📊 Executive Reports & Data Export</h3>
                <p>Download task records in CSV spreadsheet or generate a formal printable PDF deliverable report</p>
              </div>
              <div className={styles.exportActions}>
                <button
                  type="button"
                  className={styles.exportCsvBtn}
                  onClick={exportToCSV}
                  title="Download CSV Spreadsheet"
                >
                  📥 Export CSV
                </button>
                <button
                  type="button"
                  className={styles.exportPdfBtn}
                  onClick={exportToPDF}
                  title="Generate & Print PDF Report"
                >
                  📄 Export PDF Report
                </button>
              </div>
            </div>

            {/* COMPLETION RATE CARD */}
            <div className={styles.reportCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Team Delivery Velocity</h3>
                  <p>Aggregate ratio of completed milestones against open backlog</p>
                </div>
              </div>

              <div className={styles.rateMeter}>
                <div className={styles.rateDetails}>
                  <h4>{completionRate}% Completed</h4>
                  <p>
                    {completed} out of {total} total tasks marked as done
                  </p>
                </div>
                <div className={styles.rateNumber}>{completionRate}%</div>
              </div>

              <div className={styles.priorityStatsGrid}>
                <div className={styles.priorityMiniCard}>
                  <h5>Pending</h5>
                  <b>{pending}</b>
                </div>
                <div className={styles.priorityMiniCard}>
                  <h5>In Progress</h5>
                  <b>{inProgress}</b>
                </div>
                <div className={styles.priorityMiniCard}>
                  <h5>Overdue</h5>
                  <b style={{ color: "#ef4444" }}>{overdue}</b>
                </div>
              </div>
            </div>

            {/* PRIORITY BREAKDOWN CARD */}
            <div className={styles.reportCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Priority Allocation</h3>
                  <p>Breakdown of workload criticality across current tasks</p>
                </div>
              </div>

              <div className={styles.priorityStatsGrid} style={{ marginTop: "24px" }}>
                <div className={styles.priorityMiniCard} style={{ borderLeft: "4px solid #ef4444" }}>
                  <h5>🔴 High</h5>
                  <b>{highPriorityCount}</b>
                </div>
                <div className={styles.priorityMiniCard} style={{ borderLeft: "4px solid #f59e0b" }}>
                  <h5>🟡 Medium</h5>
                  <b>{medPriorityCount}</b>
                </div>
                <div className={styles.priorityMiniCard} style={{ borderLeft: "4px solid #6366f1" }}>
                  <h5>🟢 Low</h5>
                  <b>{lowPriorityCount}</b>
                </div>
              </div>
            </div>

            {/* STATUS BAR CHART */}
            <div className={`${styles.reportCard} ${styles.reportCardFull}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Task Status Distribution</h3>
                  <p>Comparative visual workload indicators</p>
                </div>
              </div>

              <div className={styles.barChart}>
                <div className={styles.barItem}>
                  <div className={styles.barTrack}>
                    <div className={styles.bar} style={{ height: getHeight(total) }} />
                  </div>
                  <span>Total</span>
                  <b>{total}</b>
                </div>

                <div className={styles.barItem}>
                  <div className={styles.barTrack}>
                    <div className={styles.barGreen} style={{ height: getHeight(completed) }} />
                  </div>
                  <span>Completed</span>
                  <b>{completed}</b>
                </div>

                <div className={styles.barItem}>
                  <div className={styles.barTrack}>
                    <div className={styles.barBlue} style={{ height: getHeight(inProgress) }} />
                  </div>
                  <span>In Progress</span>
                  <b>{inProgress}</b>
                </div>

                <div className={styles.barItem}>
                  <div className={styles.barTrack}>
                    <div className={styles.barRed} style={{ height: getHeight(overdue) }} />
                  </div>
                  <span>Overdue</span>
                  <b>{overdue}</b>
                </div>
              </div>
            </div>
          </div>
        )}
        <Footer />
      </main>
    </div>
  );
}