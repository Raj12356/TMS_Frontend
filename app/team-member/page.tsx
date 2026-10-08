"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./TeamMemberDashboard.module.css";
import Footer from "../components/Footer";
import TaskAssistantBot from "./TaskAssistantBot";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Comment = {
  id: number;
  userId: number | null;
  userName?: string | null;
  message: string;
  createdAt: string;
};

type Task = {
  id: number;
  userId?: number | null;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: string;
  category?: string;
  status?: string;
  completed?: boolean;
  attachments?: string[];
  assignedTo?: number | null;
  transferRequestedTo?: number | null;
  transferRequestedBy?: number | null;
  transferNote?: string | null;
  comments?: Comment[];
};

type Manager = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type PeerMember = {
  id: number;
  name: string;
  email: string;
  role: string;
};

const TeamMemberDashboard = () => {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "in-progress" | "completed" | "transfers">("all");

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("Team Member");

  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [peerMembers, setPeerMembers] = useState<PeerMember[]>([]);

  // Task Transfer / Delegation state
  const [taskToTransfer, setTaskToTransfer] = useState<Task | null>(null);
  const [targetPeerId, setTargetPeerId] = useState<string>("");
  const [transferReason, setTransferReason] = useState<string>("");
  const [transferLoading, setTransferLoading] = useState<boolean>(false);

  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Complete Task & Upload File Modal state
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getAttachmentFileName = (url: string) => {
    try {
      const clean = url.split("?")[0];
      const name = clean.split("/").pop() || "Attachment";
      const match = name.match(/^\d+_(.+)$/) || name.match(/^\d+-(.+)$/);
      return match ? match[1] : name;
    } catch {
      return "Attachment";
    }
  };

  // Mount & Auth verification
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("currentUser");
      if (!stored) {
        router.push("/login");
        return;
      }
      const currentUser = JSON.parse(stored);
      if (currentUser?.id === undefined || currentUser?.id === null) {
        router.push("/login");
        return;
      }
      setCurrentUserId(Number(currentUser.id));
      if (currentUser.name) {
        setCurrentUserName(currentUser.name);
      }
    } catch {
      router.push("/login");
    }
  }, [router]);

  // LOAD MANAGERS AND PEER TEAM MEMBERS
  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((allUsers: any[]) => {
        if (Array.isArray(allUsers)) {
          // 1. Managers
          const onlyManagers = allUsers.filter(
            (u) => u && typeof u.role === "string" && u.role.trim().toLowerCase() === "manager"
          );
          setManagers(onlyManagers);
          if (onlyManagers.length > 0) {
            setSelectedManager((prev) => (prev && onlyManagers.some((m) => m.id === prev.id) ? prev : onlyManagers[0]));
          } else {
            setSelectedManager(null);
          }

          // 2. Peer Team Members (excluding self)
          const isTeamMember = (role?: string) => {
            if (!role) return false;
            return role.trim().toLowerCase().replace(/[-_]/g, " ") === "team member";
          };

          const peers = allUsers.filter(
            (u) => isTeamMember(u.role) && Number(u.id) !== currentUserId
          );
          setPeerMembers(peers);
        }
      })
      .catch((err) => console.error("Error fetching users:", err));
  }, [currentUserId]);

  // When a task is selected, auto-select the manager assigned to the task if available in managers list
  useEffect(() => {
    if (selectedTask && selectedTask.userId && managers.length > 0) {
      const taskMgr = managers.find((m) => m.id === Number(selectedTask.userId));
      if (taskMgr) {
        setSelectedManager(taskMgr);
      }
    }
  }, [selectedTask, managers]);

  // Function to reload tasks
  const reloadTasks = () => {
    if (currentUserId === null || currentUserId === undefined) return;
    fetch(`/api/tasks?assignedTo=${currentUserId}&includeTransfers=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list: Task[] = Array.isArray(data) ? data : [];
        setTasks(list);
      })
      .catch((err) => console.error("Error refreshing tasks:", err));
  };

  // LOAD TASKS (including incoming transfer requests)
  useEffect(() => {
    if (currentUserId === null || currentUserId === undefined) return;

    fetch(`/api/tasks?assignedTo=${currentUserId}&includeTransfers=true`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch tasks");
        }
        return res.json();
      })
      .then((data) => {
        const list: Task[] = Array.isArray(data) ? data : [];
        setTasks(list);

        const pending = list.filter((t) => t.status === "pending");
        const progress = list.filter((t) => t.status === "in-progress");
        const now = new Date();

        const overdue = list.filter((t) => {
          if (!t.dueDate || t.status === "completed") return false;
          const due = new Date(t.dueDate);
          return !isNaN(due.getTime()) && due < now;
        });

        let msg = "";
        if (pending.length) msg += `📌 ${pending.length} pending task(s). `;
        if (progress.length) msg += `🚧 ${progress.length} in progress. `;
        if (overdue.length) msg += `⚠️ ${overdue.length} overdue!`;

        if (msg) {
          setNotification(msg);
          setTimeout(() => setNotification(""), 5000);
        }
      })
      .catch((err) => {
        console.error("Error fetching tasks:", err);
        setTasks([]);
      });
  }, [currentUserId]);

  const logout = () => {
    fetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  // LOAD COMMENTS WHEN TASK OR SELECTED MANAGER CHANGES (filtered by manager for privacy)
  useEffect(() => {
    if (!selectedTask?.id) {
      setComments([]);
      return;
    }

    const managerParam = selectedManager?.id ? `?managerId=${selectedManager.id}` : "";
    fetch(`/api/tasks/${selectedTask.id}/comments${managerParam}`)
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setComments(data);
        }
      })
      .catch((err) => {
        console.error("Error loading comments:", err);
      });
  }, [selectedTask?.id, selectedManager?.id]);

  // AUTO SCROLL TO BOTTOM OF COMMENTS
  useEffect(() => {
    if (selectedTask && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, selectedTask]);

  // UPDATE STATUS
  const updateStatus = async (id: number, status: string) => {
    try {
      const isCompleted = status === "completed";
      let res = await fetch(`/api/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
          completed: isCompleted,
        }),
      });

      if (!res.ok) {
        res = await fetch(`/api/tasks/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            completed: isCompleted,
          }),
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Update failed:", res.status, errorData);
        alert(errorData.error || `Failed to update status (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();

      setTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, ...data, status, completed: isCompleted } : t
        )
      );

      if (selectedTask && selectedTask.id === id) {
        setSelectedTask((prev) =>
          prev ? { ...prev, ...data, status, completed: isCompleted } : null
        );
      }

      setNotification(`✅ Task marked as ${status}`);
      setTimeout(() => setNotification(""), 2500);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // COMPLETE TASK & FILE UPLOAD HANDLERS
  const openCompleteModal = (task: Task) => {
    setTaskToComplete(task);
    setSelectedFile(null);
    setCompletionNotes("");
    setUploadError("");
    setIsDragging(false);
  };

  const closeCompleteModal = () => {
    if (uploading) return;
    setTaskToComplete(null);
    setSelectedFile(null);
    setCompletionNotes("");
    setUploadError("");
    setIsDragging(false);
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      setUploadError("File exceeds 50MB size limit. Please choose a smaller file.");
      return;
    }
    setSelectedFile(file);
    setUploadError("");
  };

  const handleCompleteTaskWithFile = async () => {
    if (!taskToComplete) return;

    if (!selectedFile) {
      setUploadError("Please select a deliverable file to upload before completing the task.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      // 1. Upload the file to /api/upload
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with status ${uploadRes.status}`);
      }

      const uploadData = await uploadRes.json();
      const uploadedFileUrl: string = uploadData.url;

      // 2. Prepare updated attachments
      const currentAttachments = Array.isArray(taskToComplete.attachments)
        ? taskToComplete.attachments
        : [];
      const updatedAttachments = [...currentAttachments, uploadedFileUrl];

      // 3. Update task status to completed and persist attachments
      let updateRes = await fetch(`/api/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskToComplete.id,
          status: "completed",
          completed: true,
          attachments: updatedAttachments,
        }),
      });

      if (!updateRes.ok) {
        updateRes = await fetch(`/api/tasks/${taskToComplete.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            completed: true,
            attachments: updatedAttachments,
          }),
        });
      }

      if (!updateRes.ok) {
        const errJson = await updateRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to update task (HTTP ${updateRes.status})`);
      }

      const updatedTaskData = await updateRes.json();

      // 4. If completion note provided, record it as a comment for manager & team
      if (completionNotes.trim()) {
        try {
          const commentMsg = `📁 Deliverable uploaded: [${selectedFile.name}] - ${completionNotes.trim()}`;
          const commentRes = await fetch(`/api/tasks/${taskToComplete.id}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: commentMsg,
              userId: currentUserId,
              managerId: selectedManager?.id || (managers.length > 0 ? managers[0].id : null),
            }),
          });

          if (commentRes.ok) {
            const cData = await commentRes.json();
            const newCommentObj: Comment = cData?.comment || (cData?.id ? cData : null);
            if (newCommentObj && selectedTask?.id === taskToComplete.id) {
              setComments((prev) => [...prev, newCommentObj]);
            }
          }
        } catch (cErr) {
          console.warn("Could not post deliverable comment:", cErr);
        }
      }

      // 5. Update local tasks state
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskToComplete.id
            ? {
                ...t,
                ...updatedTaskData,
                status: "completed",
                completed: true,
                attachments: updatedAttachments,
              }
            : t
        )
      );

      if (selectedTask && selectedTask.id === taskToComplete.id) {
        setSelectedTask((prev) =>
          prev
            ? {
                ...prev,
                ...updatedTaskData,
                status: "completed",
                completed: true,
                attachments: updatedAttachments,
              }
            : null
        );
      }

      setNotification(`🎉 Task #${taskToComplete.id} marked as completed with uploaded file!`);
      setTimeout(() => setNotification(""), 3500);
      closeCompleteModal();
    } catch (err: any) {
      console.error("Error completing task with file:", err);
      setUploadError(err.message || "Failed to complete task. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // OPEN TRANSFER MODAL
  const openTransferModal = (task: Task) => {
    setTaskToTransfer(task);
    setTargetPeerId(peerMembers.length > 0 ? String(peerMembers[0].id) : "");
    setTransferReason("");
  };

  const closeTransferModal = () => {
    setTaskToTransfer(null);
    setTargetPeerId("");
    setTransferReason("");
    setTransferLoading(false);
  };

  // SUBMIT TRANSFER REQUEST
  const submitTransferRequest = async () => {
    if (!taskToTransfer || !targetPeerId || currentUserId === null) return;
    setTransferLoading(true);

    try {
      const targetUser = peerMembers.find((p) => p.id === Number(targetPeerId));
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskToTransfer.id,
          transferRequestedTo: Number(targetPeerId),
          transferRequestedBy: currentUserId,
          transferNote: transferReason.trim() || "No notes provided",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit task transfer request");
      }

      setNotification(`📤 Transfer request sent to ${targetUser?.name || "peer"}!`);
      setTimeout(() => setNotification(""), 3500);
      closeTransferModal();
      reloadTasks();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to request transfer");
    } finally {
      setTransferLoading(false);
    }
  };

  // ACCEPT TRANSFER
  const acceptTransfer = async (task: Task) => {
    if (currentUserId === null) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          assignedTo: currentUserId,
          transferRequestedTo: null,
          transferRequestedBy: null,
          transferNote: null,
        }),
      });

      if (!res.ok) throw new Error("Failed to accept task transfer");

      // Post an automatic comment acknowledging the hand-off
      try {
        await fetch(`/api/tasks/${task.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUserId,
            managerId: task.userId ?? null,
            message: `🤝 Task hand-off accepted by ${currentUserName}. Now taking over this task!`,
          }),
        });
      } catch { /* ignore comment failure */ }

      setNotification(`✅ Task #${task.id} accepted! Added to your active workload.`);
      setTimeout(() => setNotification(""), 3500);
      reloadTasks();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to accept task");
    }
  };

  // DECLINE TRANSFER
  const declineTransfer = async (task: Task) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          transferRequestedTo: null,
          transferRequestedBy: null,
          transferNote: null,
        }),
      });

      if (!res.ok) throw new Error("Failed to decline transfer");

      setNotification(`Task transfer request declined.`);
      setTimeout(() => setNotification(""), 3000);
      reloadTasks();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to decline transfer");
    }
  };

  // CANCEL TRANSFER REQUEST (by original sender)
  const cancelTransfer = async (task: Task) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          transferRequestedTo: null,
          transferRequestedBy: null,
          transferNote: null,
        }),
      });

      if (!res.ok) throw new Error("Failed to cancel transfer");

      setNotification(`Transfer request cancelled.`);
      setTimeout(() => setNotification(""), 3000);
      reloadTasks();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to cancel transfer");
    }
  };

  // ADD COMMENT
  const addComment = async () => {
    if (!selectedTask?.id || !newComment.trim() || currentUserId === null) {
      return;
    }
    if (!selectedManager) {
      alert("Please select a manager to chat with.");
      return;
    }

    const commentMessage = newComment.trim();
    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commentMessage,
          userId: currentUserId,
          managerId: selectedManager.id,  // route to the selected manager's private channel
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to add comment");
        setSubmittingComment(false);
        return;
      }

      const data = await res.json();
      const newCommentObj: Comment = data?.comment || (data?.id ? data : null);

      if (newCommentObj) {
        if (!newCommentObj.userName) {
          newCommentObj.userName = currentUserName;
        }

        setComments((prev) => [...prev, newCommentObj]);
        setNewComment("");
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
      alert("Error sending comment. Please verify server connection.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // SUMMARY CALCULATIONS
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  // Transfer requests
  const incomingTransfers = safeTasks.filter(
    (t) =>
      currentUserId !== null &&
      Number(t.transferRequestedTo) === Number(currentUserId) &&
      Number(t.assignedTo) !== Number(currentUserId)
  );
  const outgoingTransfers = safeTasks.filter(
    (t) =>
      currentUserId !== null &&
      Number(t.transferRequestedBy) === Number(currentUserId) &&
      Boolean(t.transferRequestedTo)
  );

  const myOwnTasks = safeTasks.filter(
    (t) => currentUserId !== null && Number(t.assignedTo) === Number(currentUserId)
  );

  const summary = {
    total: myOwnTasks.length,
    pending: myOwnTasks.filter((t) => t.status === "pending").length,
    inProgress: myOwnTasks.filter((t) => t.status === "in-progress").length,
    completed: myOwnTasks.filter((t) => t.status === "completed").length,
    incomingTransfers: incomingTransfers.length,
  };

  const chartData = [
    { name: "Pending", value: summary.pending },
    { name: "In Progress", value: summary.inProgress },
    { name: "Completed", value: summary.completed },
  ];

  const filteredTasks = safeTasks.filter((t) => {
    if (filterTab === "transfers") {
      return (
        (currentUserId !== null &&
          Number(t.transferRequestedTo) === Number(currentUserId) &&
          Number(t.assignedTo) !== Number(currentUserId)) ||
        (currentUserId !== null &&
          Number(t.transferRequestedBy) === Number(currentUserId) &&
          Boolean(t.transferRequestedTo))
      );
    }
    // For other tabs, only show tasks actually assigned to me
    if (currentUserId === null || Number(t.assignedTo) !== Number(currentUserId)) return false;
    if (filterTab === "all") return true;
    return t.status === filterTab;
  });

  return (
    <div className={`${styles.container} ${darkMode ? styles.dark : ""}`}>
      {/* TOP HEADER */}
      <div className={styles.topBar}>
        <div className={styles.headerLeft}>
          <div className={styles.userAvatar}>
            {currentUserName ? currentUserName[0].toUpperCase() : "T"}
          </div>
          <div className={styles.headerText}>
            <h1>{currentUserName}</h1>
            <p>
              <span className={styles.roleTag}>Team Member</span>
              <span>Task Workspace & Collaborations</span>
            </p>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={styles.themeBtn}
          >
            {darkMode ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button onClick={logout} className={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </div>

      {notification && <div className={styles.toast}>🔔 {notification}</div>}

      {/* STAT CARDS */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardInfo}>
            <span className={styles.cardTitle}>Total Tasks</span>
            <h3 className={styles.cardValue}>{summary.total}</h3>
          </div>
          <div className={`${styles.cardIcon} ${styles.iconTotal}`}>📑</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardInfo}>
            <span className={styles.cardTitle}>Pending</span>
            <h3 className={styles.cardValue}>{summary.pending}</h3>
          </div>
          <div className={`${styles.cardIcon} ${styles.iconPending}`}>⏳</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardInfo}>
            <span className={styles.cardTitle}>In Progress</span>
            <h3 className={styles.cardValue}>{summary.inProgress}</h3>
          </div>
          <div className={`${styles.cardIcon} ${styles.iconProgress}`}>⚡</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardInfo}>
            <span className={styles.cardTitle}>Completed</span>
            <h3 className={styles.cardValue}>{summary.completed}</h3>
          </div>
          <div className={`${styles.cardIcon} ${styles.iconCompleted}`}>✅</div>
        </div>
      </div>

      {/* CHART OVERVIEW */}
      {mounted && (
        <div className={styles.chartBox}>
          <div className={styles.chartHeader}>
            <h3>Workload Distribution</h3>
            <span>Breakdown of tasks currently assigned to you</span>
          </div>
          <div style={{ width: "100%", height: 220, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                <YAxis allowDecimals={false} stroke={darkMode ? "#94a3b8" : "#64748b"} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: darkMode ? "#1e293b" : "#ffffff",
                    borderColor: darkMode ? "#334155" : "#e2e8f0",
                    borderRadius: "8px",
                    color: darkMode ? "#ffffff" : "#0f172a",
                  }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* INCOMING TRANSFER ALERT BANNER */}
      {incomingTransfers.length > 0 && (
        <div className={styles.transferBanner}>
          <div className={styles.transferBannerInfo}>
            <div className={styles.transferBannerIcon}>📥</div>
            <div>
              <h4 className={styles.transferBannerTitle}>
                You have {incomingTransfers.length} Incoming Task Transfer Request{incomingTransfers.length > 1 ? "s" : ""}!
              </h4>
              <p className={styles.transferBannerDesc}>
                A teammate requested to delegate their task to you. Review and accept if you have bandwidth.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.acceptTransferBtn}
            onClick={() => setFilterTab("transfers")}
          >
            Review Requests ({incomingTransfers.length}) →
          </button>
        </div>
      )}

      {/* TASK LIST SECTION */}
      <div className={styles.taskSectionHeader}>
        <h2>Your Assigned Tasks</h2>
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTabBtn} ${filterTab === "all" ? styles.filterTabActive : ""}`}
            onClick={() => setFilterTab("all")}
          >
            All ({summary.total})
          </button>
          <button
            className={`${styles.filterTabBtn} ${filterTab === "pending" ? styles.filterTabActive : ""}`}
            onClick={() => setFilterTab("pending")}
          >
            Pending ({summary.pending})
          </button>
          <button
            className={`${styles.filterTabBtn} ${filterTab === "in-progress" ? styles.filterTabActive : ""}`}
            onClick={() => setFilterTab("in-progress")}
          >
            In Progress ({summary.inProgress})
          </button>
          <button
            className={`${styles.filterTabBtn} ${filterTab === "completed" ? styles.filterTabActive : ""}`}
            onClick={() => setFilterTab("completed")}
          >
            Completed ({summary.completed})
          </button>
          <button
            className={`${styles.filterTabBtn} ${filterTab === "transfers" ? styles.filterTabActive : ""}`}
            onClick={() => setFilterTab("transfers")}
            style={{
              fontWeight: incomingTransfers.length > 0 ? "bold" : "normal",
              color: incomingTransfers.length > 0 ? "#4338ca" : undefined,
            }}
          >
            🔄 Transfers {incomingTransfers.length > 0 ? `(${incomingTransfers.length})` : ""}
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <p>
            {safeTasks.length === 0
              ? "No tasks assigned to you currently."
              : `No tasks found in "${filterTab}" status.`}
          </p>
        </div>
      ) : (
        <div className={styles.taskGrid}>
          {filteredTasks.map((task) => {
            const isOverdue =
              task.dueDate &&
              task.status !== "completed" &&
              new Date(task.dueDate) < new Date();

            const isSelected = selectedTask?.id === task.id;

            return (
              <div
                key={task.id}
                className={`${styles.taskCard} ${isSelected ? styles.taskCardSelected : ""}`}
                onClick={() => setSelectedTask(task)}
              >
                <div className={styles.cardTopRow}>
                  <div className={styles.tagGroup}>
                    {task.priority && (
                      <span
                        className={`${styles.badge} ${
                          task.priority.toLowerCase() === "high"
                            ? styles.priorityHigh
                            : task.priority.toLowerCase() === "low"
                            ? styles.priorityLow
                            : styles.priorityMedium
                        }`}
                      >
                        ● {task.priority}
                      </span>
                    )}
                    {task.category && (
                      <span className={`${styles.badge} ${styles.categoryTag}`}>
                        🏷️ {task.category}
                      </span>
                    )}
                  </div>

                  <span
                    className={`${styles.status} ${
                      task.status === "completed"
                        ? styles.completed
                        : task.status === "in-progress"
                        ? styles.inProgress
                        : styles.pending
                    }`}
                  >
                    {task.status === "completed"
                      ? "✓ Done"
                      : task.status === "in-progress"
                      ? "⚡ In Progress"
                      : "⏳ Pending"}
                  </span>
                </div>

                <h3 className={styles.taskTitle}>{task.title}</h3>
                {task.description && (
                  <p className={styles.taskDescription}>{task.description}</p>
                )}

                <div className={styles.dueDateRow}>
                  <span className={isOverdue ? styles.dueDateOverdue : ""}>
                    📅 Due: {task.dueDate || "No deadline"}
                    {isOverdue && " (Overdue)"}
                  </span>
                </div>

                {/* ATTACHMENTS DISPLAY ON TASK CARD */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className={styles.taskAttachments}>
                    <span className={styles.attachmentsHeader}>
                      📎 Attachments ({task.attachments.length}):
                    </span>
                    <div className={styles.attachmentList}>
                      {task.attachments.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.attachmentTag}
                          onClick={(e) => e.stopPropagation()}
                          title={link}
                        >
                          📄 {getAttachmentFileName(link)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* TRANSFER STATUS INFO */}
                {currentUserId !== null &&
                  Number(task.transferRequestedTo) === Number(currentUserId) &&
                  Number(task.assignedTo) !== Number(currentUserId) && (
                  <div style={{
                    margin: "10px 0",
                    padding: "10px 12px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#1e40af",
                  }}>
                    <strong>📥 Transfer Requested to You:</strong>
                    {task.transferNote && <p style={{ margin: "4px 0 0", fontStyle: "italic" }}>&quot;{task.transferNote}&quot;</p>}
                  </div>
                )}

                {currentUserId !== null &&
                  Number(task.transferRequestedBy) === Number(currentUserId) &&
                  Boolean(task.transferRequestedTo) && (
                  <div className={styles.transferBadgePending}>
                    ⏳ Transfer request pending approval by teammate
                  </div>
                )}

                <div className={styles.buttons}>
                  {/* If incoming transfer requested to current user */}
                  {currentUserId !== null &&
                  Number(task.transferRequestedTo) === Number(currentUserId) &&
                  Number(task.assignedTo) !== Number(currentUserId) ? (
                    <>
                      <button
                        type="button"
                        className={styles.acceptTransferBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptTransfer(task);
                        }}
                      >
                        ✓ Accept & Take Over
                      </button>
                      <button
                        type="button"
                        className={styles.declineTransferBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          declineTransfer(task);
                        }}
                      >
                        ✕ Decline
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`${styles.btn} ${styles.start}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(task.id, "in-progress");
                        }}
                      >
                        ⚡ Start
                      </button>

                      <button
                        className={`${styles.btn} ${task.status === "completed" ? styles.completedBtn : styles.complete}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCompleteModal(task);
                        }}
                      >
                        {task.status === "completed" ? "✓ Completed" : "✓ Complete"}
                      </button>

                      {/* Request Transfer button (only for uncompleted tasks assigned to self) */}
                      {task.status !== "completed" &&
                        currentUserId !== null &&
                        Number(task.assignedTo) === Number(currentUserId) && (
                        task.transferRequestedTo ? (
                          <button
                            type="button"
                            className={styles.cancelTransferBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelTransfer(task);
                            }}
                            title="Cancel pending transfer request"
                          >
                            Cancel Transfer
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.transferBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              openTransferModal(task);
                            }}
                            title="Hand off this task to another team member"
                          >
                            🔄 Hand Off
                          </button>
                        )
                      )}

                      <button
                        className={`${styles.btn} ${styles.chatBtn}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTask(task);
                        }}
                      >
                        💬 Chat {task.comments?.length ? `(${task.comments.length})` : ""}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SLIDE-OUT DISCUSSION PANEL */}
      {selectedTask && (
        <div
          className={styles.detailOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTask(null);
          }}
        >
          <div className={styles.detailBox}>
            <div className={styles.detailHeader}>
              <div>
                <h3>💬 Task Discussion</h3>
                <p>
                  #{selectedTask.id}: {selectedTask.title}
                </p>
              </div>
              <button
                className={styles.closeIconBtn}
                onClick={() => setSelectedTask(null)}
              >
                ✕
              </button>
            </div>

            {/* MANAGER SELECTOR */}
            <div className={styles.managerSelectorBar}>
              <span className={styles.managerSelectorLabel}>
                👔 Chat with Manager:
              </span>
              {managers.length === 0 ? (
                <span className={styles.noManagerText}>No managers available</span>
              ) : (
                <select
                  className={styles.managerSelect}
                  value={selectedManager?.id ?? ""}
                  onChange={(e) => {
                    const mgr = managers.find((m) => m.id === Number(e.target.value));
                    setSelectedManager(mgr ?? null);
                  }}
                >
                  {managers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ATTACHMENTS SECTION IN DISCUSSION DRAWER */}
            {selectedTask.attachments && selectedTask.attachments.length > 0 && (
              <div className={styles.drawerAttachments}>
                <div className={styles.drawerAttachmentsHeader}>
                  📎 Attachments & Deliverables ({selectedTask.attachments.length}):
                </div>
                <div className={styles.drawerAttachmentList}>
                  {selectedTask.attachments.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.drawerAttachmentBadge}
                      title={link}
                    >
                      ⬇️ {getAttachmentFileName(link)}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.detailCommentsList}>
              {!comments || comments.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>💬</div>
                  <p>No messages yet. Send an update or question below!</p>
                </div>
              ) : (
                comments
                  .filter((c) => c && c.id)
                  .map((c) => (
                    <div key={c.id} className={styles.commentItem}>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthor}>
                          👤 {c.userName ?? (c.userId ? `User #${c.userId}` : "Collaborator")}
                        </span>
                        {c.createdAt && (
                          <span>
                            • {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className={styles.commentMessage}>{c.message}</div>
                    </div>
                  ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <div className={styles.detailInputArea}>
              {selectedManager && (
                <div className={styles.replyingToBar}>
                  ✉️ Sending to <strong>{selectedManager.name}</strong>
                </div>
              )}
              <div className={styles.inputRow}>
                <input
                  className={styles.commentInput}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      addComment();
                    }
                  }}
                  placeholder={
                    selectedManager
                      ? `Message ${selectedManager.name}...`
                      : "Type your message or update..."
                  }
                  disabled={submittingComment}
                />
                <button
                  className={styles.sendCommentBtn}
                  onClick={addComment}
                  disabled={submittingComment}
                >
                  {submittingComment ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTHOR FOOTER */}
      <Footer darkMode={darkMode} />

      {/* COMPLETE TASK WITH FILE UPLOAD MODAL */}
      {taskToComplete && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget && !uploading) {
              closeCompleteModal();
            }
          }}
        >
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <h3>
                  {taskToComplete.status === "completed"
                    ? "📁 Task Deliverables"
                    : "✓ Complete Task & Upload File"}
                </h3>
                <p>
                  {taskToComplete.status === "completed"
                    ? "Upload additional deliverable or files for this task."
                    : "Upload your completed deliverable or proof of work to finalize this task."}
                </p>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={closeCompleteModal}
                disabled={uploading}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Task Info Strip */}
              <div className={styles.modalTaskStrip}>
                <div className={styles.modalTaskStripTitle}>
                  #{taskToComplete.id}: {taskToComplete.title}
                </div>
                <div className={styles.modalTaskStripMeta}>
                  {taskToComplete.category && <span>🏷️ {taskToComplete.category}</span>}
                  {taskToComplete.priority && <span>⚡ {taskToComplete.priority} Priority</span>}
                  {taskToComplete.dueDate && <span>📅 Due: {taskToComplete.dueDate}</span>}
                </div>
              </div>

              {/* Current Attachments if any */}
              {taskToComplete.attachments && taskToComplete.attachments.length > 0 && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Current Attachments:</label>
                  <div className={styles.attachmentList}>
                    {taskToComplete.attachments.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.attachmentTag}
                        title={link}
                      >
                        📄 {getAttachmentFileName(link)}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* File Upload Section */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Deliverable File <span style={{ color: "#ef4444" }}>*</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                {!selectedFile ? (
                  <div
                    className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ""}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileSelect(e.dataTransfer.files[0]);
                      }
                    }}
                  >
                    <div className={styles.dropzoneIcon}>📁</div>
                    <p className={styles.dropzonePrompt}>
                      Click to browse or drag & drop deliverable file
                    </p>
                    <p className={styles.dropzoneSubtext}>
                      PDF, Word, Excel, images, ZIP or text files (up to 50MB)
                    </p>
                    <span className={styles.dropzoneBrowseBtn}>Browse File</span>
                  </div>
                ) : (
                  <div className={styles.selectedFileCard}>
                    <div className={styles.selectedFileInfo}>
                      <span className={styles.selectedFileIcon}>📄</span>
                      <div className={styles.selectedFileText}>
                        <span className={styles.selectedFileName} title={selectedFile.name}>
                          {selectedFile.name}
                        </span>
                        <span className={styles.selectedFileSize}>
                          {formatFileSize(selectedFile.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.removeFileBtn}
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      disabled={uploading}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {/* Completion Notes */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Completion Notes / Deliverable Summary (Optional)
                </label>
                <textarea
                  className={styles.fieldTextarea}
                  placeholder="Provide any summary, submission notes, or links for your manager..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  disabled={uploading}
                />
              </div>

              {/* Error Message */}
              {uploadError && <div className={styles.errorBanner}>⚠️ {uploadError}</div>}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={closeCompleteModal}
                disabled={uploading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.modalSubmitBtn}
                onClick={handleCompleteTaskWithFile}
                disabled={uploading}
              >
                {uploading ? (
                  <>⏳ Uploading & Completing...</>
                ) : taskToComplete.status === "completed" ? (
                  <>📁 Upload & Save</>
                ) : (
                  <>✓ Upload & Mark Completed</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TASK TRANSFER / HAND-OFF MODAL */}
      {taskToTransfer && (
        <div className={styles.modalOverlay} onClick={closeTransferModal}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleGroup}>
                <span className={styles.modalIcon}>🔄</span>
                <div>
                  <h3 className={styles.modalTitle}>Hand Off / Transfer Task</h3>
                  <p className={styles.modalSubtitle}>
                    Delegate #{taskToTransfer.id} &quot;{taskToTransfer.title}&quot; to a teammate
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={closeTransferModal}
                disabled={transferLoading}
              >
                ✕
              </button>
            </div>

            <div className={styles.transferModalContent}>
              <div className={styles.transferNotice}>
                ℹ️ When submitted, the selected teammate will receive an incoming transfer request on their dashboard. If they accept, the task will be reassigned to them.
              </div>

              {/* Select Peer Member */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Select Teammate to Take Over *
                </label>
                {peerMembers.length === 0 ? (
                  <p style={{ color: "#ef4444", fontSize: "13px" }}>
                    ⚠️ No other team members are currently available to receive task hand-offs.
                  </p>
                ) : (
                  <select
                    className={styles.managerSelect}
                    value={targetPeerId}
                    onChange={(e) => setTargetPeerId(e.target.value)}
                    disabled={transferLoading}
                    style={{ width: "100%", padding: "10px 14px" }}
                  >
                    {peerMembers.map((peer) => (
                      <option key={peer.id} value={peer.id}>
                        👤 {peer.name} ({peer.email || `ID: ${peer.id}`})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Transfer Note / Reason */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Reason / Notes for Hand-Off (Optional)
                </label>
                <textarea
                  className={styles.fieldTextarea}
                  placeholder="e.g. Under heavy workload with milestone deliverable, could you help take this over?"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  disabled={transferLoading}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={closeTransferModal}
                disabled={transferLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmitBtn}
                onClick={submitTransferRequest}
                disabled={transferLoading || peerMembers.length === 0}
                style={{ background: "#4f46e5" }}
              >
                {transferLoading ? "⏳ Sending Request..." : "📤 Send Transfer Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TASK ASSISTANT CHATBOT */}
      <TaskAssistantBot
        tasks={safeTasks}
        managers={managers}
        currentUserName={currentUserName}
        onSelectTask={(task) => setSelectedTask(task)}
      />
    </div>
  );
};

export default TeamMemberDashboard;