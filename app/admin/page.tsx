"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
import Footer from "../components/Footer";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "user" | "team member";
}

interface SystemSettings {
  appName: string;
  allowRegistration: boolean;
  defaultRole: "user" | "team member";
  sessionTimeout: string;
  dueDateReminders: boolean;
  commentNotifications: boolean;
  desktopNotifications: boolean;
  autoAssignCreator: boolean;
}

const DEFAULT_SETTINGS: SystemSettings = {
  appName: "Task Management System (TMS)",
  allowRegistration: true,
  defaultRole: "user",
  sessionTimeout: "7 days",
  dueDateReminders: true,
  commentNotifications: true,
  desktopNotifications: false,
  autoAssignCreator: true,
};

export default function AdminDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "users" | "customization" | "settings"
  >("dashboard");

  const [categories, setCategories] = useState<string[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isSavingCustomization, setIsSavingCustomization] = useState(false);
  const [customizationFeedback, setCustomizationFeedback] = useState<string | null>(null);

  // System Settings state
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");

    if (!storedUser) {
      alert("Access denied! Admins only.");
      router.push("/login");
      return;
    }

    const parsedUser: User = JSON.parse(storedUser);

    if (!parsedUser || parsedUser.role !== "admin") {
      alert("Access denied! Admins only.");
      router.push("/login");
      return;
    }

    setCurrentUser(parsedUser);
    setAuthorized(true);

    fetch("/api/users")
      .then((res) => res.json())
      .then((data: User[]) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsers([]));

    // saved categories & labels from PostgreSQL / Spring Boot
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setCategories(data))
      .catch(() => {});
    fetch("/api/labels")
      .then((res) => res.json())
      .then((data) => Array.isArray(data) && setLabels(data))
      .catch(() => {});

    // Load saved settings from local storage
    try {
      const saved = localStorage.getItem("tms_system_settings");
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch {}
  }, [router]);

  if (!authorized) return null;

  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalManagers = users.filter((u) => u.role === "manager").length;
  const totalTeamMembers = users.filter((u) => u.role === "team member").length;
  const totalDefaultUsers = users.filter((u) => u.role === "user").length;

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  const handleRoleChange = async (user: User, newRole: User["role"]) => {
    if (newRole === user.role) return;
    if (!confirm(`Change ${user.name}'s role from "${user.role}" to "${newRole}"?`)) return;

    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update role");
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
        );
      }
    } catch {
      alert("Server error, please try again");
    }
    setBusyId(null);
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;

    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete user");
      } else {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      }
    } catch {
      alert("Server error, please try again");
    }
    setBusyId(null);
  };

  // Add category helper
  const handleAddCategory = () => {
    const val = categoryInput.trim();
    if (!val) return;
    if (categories.some((c) => c.toLowerCase() === val.toLowerCase())) {
      alert("Category already exists");
      return;
    }
    setCategories([...categories, val]);
    setCategoryInput("");
  };

  // Add label helper
  const handleAddLabel = () => {
    const val = labelInput.trim();
    if (!val) return;
    if (labels.some((l) => l.toLowerCase() === val.toLowerCase())) {
      alert("Label already exists");
      return;
    }
    setLabels([...labels, val]);
    setLabelInput("");
  };

  // Save customization changes
  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCustomization(true);
    setCustomizationFeedback(null);

    try {
      const [catRes, labelRes] = await Promise.all([
        fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories }),
        }),
        fetch("/api/labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ labels }),
        }),
      ]);

      if (!catRes.ok || !labelRes.ok) {
        const bad = await (catRes.ok ? labelRes : catRes).json().catch(() => ({}));
        alert(bad.error || "Failed to save changes");
        setIsSavingCustomization(false);
        return;
      }

      setCategories(await catRes.json());
      setLabels(await labelRes.json());
      setCustomizationFeedback("Customization settings saved successfully to database!");
      setTimeout(() => setCustomizationFeedback(null), 4000);
    } catch {
      alert("Server error while saving customization");
    } finally {
      setIsSavingCustomization(false);
    }
  };

  // Save system settings
  const handleSaveSettings = () => {
    try {
      localStorage.setItem("tms_system_settings", JSON.stringify(settings));
      setSettingsFeedback("System settings updated successfully!");
      setTimeout(() => setSettingsFeedback(null), 3000);
    } catch {
      alert("Failed to save settings to storage");
    }
  };

  // Export full backup data as JSON
  const handleExportData = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      appName: settings.appName,
      users: users.map(({ id, name, email, role }) => ({ id, name, email, role })),
      categories,
      labels,
      systemSettings: settings,
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tms-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <h2>Admin</h2>
        <ul>
          <li
            className={activeTab === "dashboard" ? styles.active : ""}
            onClick={() => setActiveTab("dashboard")}
          >
            📊 Dashboard
          </li>
          <li
            className={activeTab === "users" ? styles.active : ""}
            onClick={() => setActiveTab("users")}
          >
            👥 User Management
          </li>
          <li
            className={activeTab === "customization" ? styles.active : ""}
            onClick={() => setActiveTab("customization")}
          >
            🎨 Customization
          </li>
          <li
            className={activeTab === "settings" ? styles.active : ""}
            onClick={() => setActiveTab("settings")}
          >
            ⚙️ System Settings
          </li>
          <li onClick={handleLogout} style={{ color: "#f87171", marginTop: 30 }}>
            🚪 Logout
          </li>
        </ul>
      </aside>

      <main className={styles.main}>
        <div className={styles.header}>
          <h2>
            {activeTab === "dashboard" && "Dashboard Overview"}
            {activeTab === "users" && "User & Access Management"}
            {activeTab === "customization" && "Platform Customization"}
            {activeTab === "settings" && "System Settings & Configuration"}
          </h2>
          <span>👤 {currentUser?.name} ({currentUser?.role})</span>
        </div>

        {activeTab === "dashboard" && (
          <div className={styles.cards}>
            <div className={`${styles.card} ${styles.purple}`}>
              <h3>Total Users</h3>
              <h2>{totalUsers}</h2>
            </div>

            <div className={`${styles.card} ${styles.blue}`}>
              <h3>Admins</h3>
              <h2>{totalAdmins}</h2>
            </div>

            <div className={`${styles.card} ${styles.orange}`}>
              <h3>Managers</h3>
              <h2>{totalManagers}</h2>
            </div>

            <div className={`${styles.card} ${styles.green}`}>
              <h3>Team Members</h3>
              <h2>{totalTeamMembers}</h2>
            </div>

            <div className={`${styles.card} ${styles.purple}`}>
              <h3>Standard Users</h3>
              <h2>{totalDefaultUsers}</h2>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className={styles.table}>
            <div className={styles.sectionHeader}>
              <h3>User Accounts</h3>
              <p>Manage roles and accounts registered across the Task Management System.</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        className={styles.roleSelect}
                        value={user.role}
                        disabled={busyId === user.id || user.id === currentUser?.id}
                        onChange={(e) =>
                          handleRoleChange(user, e.target.value as User["role"])
                        }
                      >
                        <option value="user">User</option>
                        <option value="team member">Team Member</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      {user.id === currentUser?.id ? (
                        <span className={styles.you}>Current Account</span>
                      ) : (
                        <button
                          className={styles.deleteBtn}
                          disabled={busyId === user.id}
                          onClick={() => handleDeleteUser(user)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===================== CUSTOMIZATION TAB ===================== */}
        {activeTab === "customization" && (
          <div className={styles.content}>
            <div className={styles.sectionHeader}>
              <h3>Task Categories & Labels</h3>
              <p>Configure the categories and labels available to users and managers when creating tasks.</p>
            </div>

            {customizationFeedback && (
              <div style={{ background: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>
                ✅ {customizationFeedback}
              </div>
            )}

            <form onSubmit={handleSaveCustomization}>
              <div className={styles.customizationGrid}>
                {/* Categories Card */}
                <div className={styles.cardSection}>
                  <div className={styles.cardSectionTitle}>
                    <span>📁</span> Task Categories ({categories.length})
                  </div>

                  <div className={styles.inputGroup}>
                    <input
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      placeholder="Add new category (e.g., Development)"
                    />
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={handleAddCategory}
                    >
                      + Add
                    </button>
                  </div>

                  <div className={styles.tagContainer}>
                    {categories.length === 0 ? (
                      <div className={styles.emptyHint}>No categories defined yet.</div>
                    ) : (
                      categories.map((c, i) => (
                        <span key={i} className={styles.tagPill}>
                          {c}
                          <button
                            type="button"
                            className={styles.tagRemoveBtn}
                            onClick={() =>
                              setCategories(categories.filter((_, idx) => idx !== i))
                            }
                            title="Remove category"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Labels Card */}
                <div className={styles.cardSection}>
                  <div className={styles.cardSectionTitle}>
                    <span>🏷️</span> Task Labels ({labels.length})
                  </div>

                  <div className={styles.inputGroup}>
                    <input
                      value={labelInput}
                      onChange={(e) => setLabelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddLabel();
                        }
                      }}
                      placeholder="Add new label (e.g., High Priority)"
                    />
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={handleAddLabel}
                    >
                      + Add
                    </button>
                  </div>

                  <div className={styles.tagContainer}>
                    {labels.length === 0 ? (
                      <div className={styles.emptyHint}>No labels defined yet.</div>
                    ) : (
                      labels.map((l, i) => (
                        <span key={i} className={`${styles.tagPill} ${styles.tagPillLabel}`}>
                          {l}
                          <button
                            type="button"
                            className={styles.tagRemoveBtn}
                            onClick={() =>
                              setLabels(labels.filter((_, idx) => idx !== i))
                            }
                            title="Remove label"
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.saveActions}>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={isSavingCustomization}
                >
                  {isSavingCustomization ? "Saving Changes..." : "💾 Save Customization"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ===================== SYSTEM SETTINGS TAB ===================== */}
        {activeTab === "settings" && (
          <div className={styles.content}>
            <div className={styles.sectionHeader}>
              <h3>System Settings</h3>
              <p>Control platform parameters, database synchronization, notifications, and backups.</p>
            </div>

            {settingsFeedback && (
              <div style={{ background: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: 8, marginBottom: 16 }}>
                ✅ {settingsFeedback}
              </div>
            )}

            {/* System Health / Status Card */}
            <div className={styles.systemStatusCard}>
              <div className={styles.statusIndicator}>
                <div className={styles.statusDot}></div>
                <div>
                  <strong>Backend Status: Online & Connected</strong>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: 2 }}>
                    Spring Boot REST API on port 8008 • PostgreSQL Neon Cloud Active
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={styles.exportBtn}
                onClick={handleExportData}
              >
                📥 Export System Data (JSON)
              </button>
            </div>

            <div className={styles.settingsGroup}>
              {/* Setting 1: Application Name */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Application Name</h4>
                  <p>Display name shown across the headers and dashboard titles.</p>
                </div>
                <input
                  type="text"
                  className={styles.settingInput}
                  value={settings.appName}
                  onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                />
              </div>

              {/* Setting 2: Allow Public Registration */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Allow Public Sign-Up</h4>
                  <p>Enable or disable new user account registration on the sign-up page.</p>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.allowRegistration}
                    onChange={(e) =>
                      setSettings({ ...settings, allowRegistration: e.target.checked })
                    }
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              {/* Setting 3: Default Role for New Users */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Default Role for New Users</h4>
                  <p>Assign initial system permissions when a new user signs up.</p>
                </div>
                <select
                  className={styles.settingSelect}
                  value={settings.defaultRole}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultRole: e.target.value as "user" | "team member",
                    })
                  }
                >
                  <option value="user">Standard User</option>
                  <option value="team member">Team Member</option>
                </select>
              </div>

              {/* Setting 4: Session Duration */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Login Session Duration</h4>
                  <p>Duration before users are required to sign in again.</p>
                </div>
                <select
                  className={styles.settingSelect}
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    setSettings({ ...settings, sessionTimeout: e.target.value })
                  }
                >
                  <option value="24 hours">24 Hours</option>
                  <option value="7 days">7 Days</option>
                  <option value="30 days">30 Days</option>
                </select>
              </div>

              {/* Setting 5: Due Date Reminders */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Due Date Reminders</h4>
                  <p>Show notifications when a task is due within 24 hours.</p>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.dueDateReminders}
                    onChange={(e) =>
                      setSettings({ ...settings, dueDateReminders: e.target.checked })
                    }
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              {/* Setting 6: Task Comment Notifications */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Comment Notifications</h4>
                  <p>Notify managers and assignees when someone adds a comment to a task.</p>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.commentNotifications}
                    onChange={(e) =>
                      setSettings({ ...settings, commentNotifications: e.target.checked })
                    }
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>

              {/* Setting 7: Auto-assign tasks */}
              <div className={styles.settingRow}>
                <div className={styles.settingInfo}>
                  <h4>Auto-assign Creator to Tasks</h4>
                  <p>Automatically set the task creator as the owner if unassigned.</p>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={settings.autoAssignCreator}
                    onChange={(e) =>
                      setSettings({ ...settings, autoAssignCreator: e.target.checked })
                    }
                  />
                  <span className={styles.slider}></span>
                </label>
              </div>
            </div>

            <div className={styles.saveActions}>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSaveSettings}
              >
                💾 Save System Settings
              </button>
            </div>
          </div>
        )}
        <Footer />
      </main>
    </div>
  );
}