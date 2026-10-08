"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "./TaskAssistantBot.module.css";

export type AssistantTask = {
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
};

export type AssistantManager = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type Message = {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: string;
  taskCards?: AssistantTask[];
};

interface TaskAssistantBotProps {
  tasks: AssistantTask[];
  managers: AssistantManager[];
  currentUserName: string;
  onSelectTask?: (task: AssistantTask) => void;
}

export default function TaskAssistantBot({
  tasks,
  managers,
  currentUserName,
  onSelectTask,
}: TaskAssistantBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const getManagerName = (userId?: number | null) => {
    if (!userId) return "your Manager";
    const found = managers.find((m) => m.id === Number(userId));
    return found ? `${found.name} (Manager)` : `Manager #${userId}`;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "bot",
      text: `👋 Hi ${currentUserName || "there"}! I'm your Task Assistant.\n\nAsk me anything about your assigned tasks, upcoming deadlines, task priorities, or who assigned them to you!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isTyping]);

  const quickPrompts = [
    "📅 Upcoming deadlines",
    "👔 Who assigned my tasks?",
    "⚡ High priority tasks",
    "⏳ Pending tasks",
    "✅ Completed tasks",
  ];

  const generateAnswer = (query: string): { text: string; taskCards?: AssistantTask[] } => {
    const q = query.toLowerCase().trim();
    const now = new Date();

    // 1. Due dates / Deadlines / Upcoming
    if (q.includes("due date") || q.includes("deadline") || q.includes("upcoming") || q.includes("when is") || q.includes("due")) {
      const activeTasksWithDue = tasks
        .filter((t) => t.dueDate && t.status !== "completed")
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      if (activeTasksWithDue.length === 0) {
        return {
          text: "🎉 You have no pending tasks with upcoming due dates! All clear or completed.",
        };
      }

      const overdue = activeTasksWithDue.filter((t) => new Date(t.dueDate!) < now);
      const upcoming = activeTasksWithDue.filter((t) => new Date(t.dueDate!) >= now);

      let reply = `📅 **Task Deadlines Summary:**\n\n`;
      if (overdue.length > 0) {
        reply += `⚠️ **Overdue Tasks (${overdue.length}):**\n` +
          overdue.map((t) => `• **${t.title}** was due on **${t.dueDate}** (Assigned by ${getManagerName(t.userId)})`).join("\n") +
          "\n\n";
      }

      if (upcoming.length > 0) {
        reply += `⏳ **Upcoming Deadlines (${upcoming.length}):**\n` +
          upcoming.map((t) => `• **${t.title}** is due on **${t.dueDate}** (Priority: ${t.priority || "Medium"})`).join("\n");
      }

      return {
        text: reply,
        taskCards: activeTasksWithDue.slice(0, 4),
      };
    }

    // 2. Who assigned / Assigned by / Manager
    if (q.includes("who assigned") || q.includes("assigned by") || q.includes("manager") || q.includes("creator") || q.includes("assigned")) {
      if (tasks.length === 0) {
        return { text: "You currently have no tasks assigned to you." };
      }

      // Group tasks by manager
      const byManager = new Map<string, AssistantTask[]>();
      tasks.forEach((t) => {
        const mgrName = getManagerName(t.userId);
        const list = byManager.get(mgrName) || [];
        list.push(t);
        byManager.set(mgrName, list);
      });

      let reply = `👔 **Tasks by Assigning Manager:**\n\n`;
      byManager.forEach((mgrTasks, mgrName) => {
        reply += `👤 **${mgrName}** assigned **${mgrTasks.length} task(s)**:\n`;
        reply += mgrTasks.map((t) => `  • "${t.title}" (${t.status || "pending"}, Due: ${t.dueDate || "No deadline"})`).join("\n") + "\n\n";
      });

      return {
        text: reply.trim(),
        taskCards: tasks.slice(0, 4),
      };
    }

    // 3. High priority / Priority
    if (q.includes("priority") || q.includes("urgent") || q.includes("high priority")) {
      const highTasks = tasks.filter(
        (t) => (t.priority || "").toLowerCase() === "high" && t.status !== "completed"
      );

      if (highTasks.length === 0) {
        return {
          text: "✨ Great news! You have no high-priority active tasks right now.",
        };
      }

      let reply = `⚡ **High-Priority Active Tasks (${highTasks.length}):**\n\n`;
      reply += highTasks
        .map(
          (t) =>
            `• **${t.title}**\n  Status: ${t.status || "pending"} | Due: ${t.dueDate || "No deadline"} | Assigned by: ${getManagerName(t.userId)}`
        )
        .join("\n\n");

      return {
        text: reply,
        taskCards: highTasks,
      };
    }

    // 4. Completed tasks
    if (q.includes("completed") || q.includes("finished") || q.includes("done")) {
      const completedTasks = tasks.filter((t) => t.status === "completed" || t.completed);
      if (completedTasks.length === 0) {
        return {
          text: "You haven't completed any tasks yet. Keep going!",
        };
      }

      let reply = `✅ **You have completed ${completedTasks.length} task(s):**\n\n`;
      reply += completedTasks.map((t) => `• **${t.title}** (Category: ${t.category || "General"})`).join("\n");
      return {
        text: reply,
        taskCards: completedTasks.slice(0, 3),
      };
    }

    // 5. Pending or in-progress tasks
    if (q.includes("pending") || q.includes("in progress") || q.includes("in-progress") || q.includes("active tasks") || q.includes("tasks do i have") || q.includes("my tasks")) {
      const active = tasks.filter((t) => t.status !== "completed");
      if (active.length === 0) {
        return {
          text: "🎉 All your tasks are completed! Nothing pending on your plate.",
        };
      }

      let reply = `📋 **You have ${active.length} active task(s):**\n\n`;
      reply += active
        .map(
          (t) =>
            `• **${t.title}** [${t.status || "pending"}]\n  Due: ${t.dueDate || "None"} | Priority: ${t.priority || "Medium"} | By: ${getManagerName(t.userId)}`
        )
        .join("\n\n");

      return {
        text: reply,
        taskCards: active.slice(0, 4),
      };
    }

    // 6. Specific task query (matching title)
    const matchedTask = tasks.find((t) => q.includes(t.title.toLowerCase()));
    if (matchedTask) {
      let reply = `🔍 **Details for "${matchedTask.title}":**\n\n`;
      reply += `• **Status:** ${matchedTask.status || "pending"}\n`;
      reply += `• **Priority:** ${matchedTask.priority || "Medium"}\n`;
      reply += `• **Due Date:** ${matchedTask.dueDate || "No deadline"}\n`;
      reply += `• **Category:** ${matchedTask.category || "General"}\n`;
      reply += `• **Assigned By:** ${getManagerName(matchedTask.userId)}\n`;
      if (matchedTask.description) {
        reply += `• **Description:** ${matchedTask.description}\n`;
      }
      return {
        text: reply,
        taskCards: [matchedTask],
      };
    }

    // 7. General summary / Help fallback
    return {
      text: `🤖 I analyzed your **${tasks.length} assigned task(s)**.\n\n` +
        `• **Pending / In Progress:** ${tasks.filter((t) => t.status !== "completed").length}\n` +
        `• **Completed:** ${tasks.filter((t) => t.status === "completed").length}\n` +
        `• **Overdue:** ${tasks.filter((t) => t.dueDate && t.status !== "completed" && new Date(t.dueDate) < now).length}\n\n` +
        `You can ask me questions like:\n` +
        `• *"What are my upcoming due dates?"*\n` +
        `• *"Who assigned my tasks?"*\n` +
        `• *"Show high priority tasks"*\n` +
        `• Or type the title of a specific task!`,
    };
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Realistic bot response delay
    setTimeout(() => {
      const answer = generateAnswer(query);
      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: "bot",
        text: answer.text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        taskCards: answer.taskCards,
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 400);
  };

  return (
    <div className={styles.botWrapper}>
      {/* FLOATING ACTION BUTTON */}
      {!isOpen && (
        <button
          className={styles.fabBtn}
          onClick={() => setIsOpen(true)}
          title="Open Task Assistant Chatbot"
          aria-label="Open Task Assistant Chatbot"
        >
          <span className={styles.fabIcon}>🤖</span>
          <span className={styles.fabBadge}>{tasks.filter((t) => t.status !== "completed").length}</span>
          <span className={styles.fabText}>Task Assistant</span>
        </button>
      )}

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className={styles.chatWindow}>
          {/* HEADER */}
          <div className={styles.chatHeader}>
            <div className={styles.headerInfo}>
              <div className={styles.headerAvatar}>🤖</div>
              <div>
                <h4 className={styles.botTitle}>Task Assistant</h4>
                <span className={styles.botSubtitle}>Online • Instant Answers on Assigned Tasks</span>
              </div>
            </div>
            <button
              className={styles.closeBtn}
              onClick={() => setIsOpen(false)}
              aria-label="Close Assistant"
            >
              ✕
            </button>
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className={styles.quickPrompts}>
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                className={styles.promptChip}
                onClick={() => handleSend(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {/* MESSAGES BODY */}
          <div className={styles.messagesContainer}>
            {messages.map((m) => {
              const isBot = m.sender === "bot";
              return (
                <div
                  key={m.id}
                  className={`${styles.messageRow} ${isBot ? styles.botRow : styles.userRow}`}
                >
                  {isBot && <div className={styles.bubbleAvatar}>🤖</div>}
                  <div className={styles.bubbleContent}>
                    <div
                      className={`${styles.bubble} ${
                        isBot ? styles.botBubble : styles.userBubble
                      }`}
                    >
                      <div className={styles.messageText}>{m.text}</div>

                      {/* Optional Task Mini-Cards */}
                      {m.taskCards && m.taskCards.length > 0 && (
                        <div className={styles.cardList}>
                          {m.taskCards.map((task) => (
                            <div
                              key={task.id}
                              className={styles.miniCard}
                              onClick={() => onSelectTask && onSelectTask(task)}
                              title="Click to view full task details"
                            >
                              <div className={styles.miniCardTitle}>
                                📌 {task.title}
                              </div>
                              <div className={styles.miniCardMeta}>
                                <span>📅 {task.dueDate || "No due date"}</span>
                                <span className={styles.miniCardPriority}>
                                  ● {task.priority || "Medium"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className={styles.timestamp}>{m.timestamp}</span>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className={`${styles.messageRow} ${styles.botRow}`}>
                <div className={styles.bubbleAvatar}>🤖</div>
                <div className={`${styles.bubble} ${styles.botBubble}`}>
                  <div className={styles.typingIndicator}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM */}
          <form
            className={styles.inputArea}
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about due dates, manager, priorities..."
            />
            <button
              type="submit"
              className={styles.sendBtn}
              disabled={!input.trim()}
              title="Send question"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

