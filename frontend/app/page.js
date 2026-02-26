"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = "http://localhost:5000";

const SUGGESTIONS = [
  "What are my rights as a tenant?",
  "How to file a consumer complaint?",
  "What is the process for divorce in India?",
  "Explain FIR registration process",
];

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const router = useRouter();

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (!token || !savedUser) {
      router.push("/login");
      return;
    }
    setUser(JSON.parse(savedUser));
    fetchConversations(token);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const getToken = () => localStorage.getItem("token");

  const fetchConversations = async (token) => {
    try {
      const res = await fetch(`${API}/api/conversations`, {
        headers: { Authorization: `Bearer ${token || getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  const createNewConversation = async () => {
    try {
      const res = await fetch(`${API}/api/conversations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (res.ok) {
        const conv = await res.json();
        setActiveConvId(conv._id);
        return conv._id;
      }
    } catch (err) {
      console.error("Error creating conversation:", err);
    }
    return null;
  };

  const loadConversation = async (id) => {
    try {
      const res = await fetch(`${API}/api/conversations/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const conv = await res.json();
        setActiveConvId(conv._id);
        // Convert assistant -> bot for display
        setMessages(
          conv.messages.map((m) => ({
            role: m.role === "assistant" ? "bot" : m.role,
            content: m.content,
          }))
        );
      }
    } catch (err) {
      console.error("Error loading conversation:", err);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    try {
      await fetch(`${API}/api/conversations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
      }
      fetchConversations();
    } catch (err) {
      console.error("Error deleting conversation:", err);
    }
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "48px";

    // Create a new conversation FIRST if none is active
    let convId = activeConvId;
    if (!convId) {
      convId = await createNewConversation();
    }

    const userMsg = { role: "user", content: question };

    // Build history from current messages + the new user message
    const history = [...messages, userMsg].map((m) => ({
      role: m.role === "bot" ? "assistant" : m.role,
      content: m.content,
    }));

    // Add user message + empty bot message for streaming to UI
    setMessages((prev) => [...prev, userMsg, { role: "bot", content: "" }]);

    try {
      const res = await fetch(`${API}/legal-advice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ history, conversationId: convId }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastBot = updated[updated.length - 1];
                  if (lastBot && lastBot.role === "bot") {
                    updated[updated.length - 1] = {
                      ...lastBot,
                      content: lastBot.content + parsed.content,
                    };
                  }
                  return updated;
                });
              }
              if (parsed.error) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "bot",
                    content: "⚠️ " + parsed.error,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      // Refresh sidebar to show updated title
      fetchConversations();
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "bot",
          content: "Unable to reach the server. Please make sure the backend is running.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "48px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-[#e8e8f0]">
      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"} flex flex-col bg-[#12122a] border-r border-[#2a2a4a] transition-all duration-300 overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#2a2a4a]">
          {sidebarOpen && (
            <span className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider">
              Chats
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#a0a0b8] hover:text-white transition-colors text-lg"
            title={sidebarOpen ? "Collapse" : "Expand"}
          >
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* New Chat Button */}
            <div className="px-3 py-3">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2 bg-[#6c63ff] hover:bg-[#5a52d9] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all duration-200"
              >
                <span className="text-lg">+</span> New Chat
              </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2">
              {conversations.map((conv) => (
                <div
                  key={conv._id}
                  onClick={() => loadConversation(conv._id)}
                  className={`group flex items-center justify-between px-3 py-2.5 mx-1 mb-1 rounded-lg cursor-pointer transition-all duration-150 ${
                    activeConvId === conv._id
                      ? "bg-[#6c63ff]/20 border border-[#6c63ff]/30"
                      : "hover:bg-[#1e1e3a] border border-transparent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate text-[#e8e8f0]">
                      {conv.title}
                    </p>
                    <p className="text-[11px] text-[#666] mt-0.5">
                      {formatDate(conv.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(conv._id, e)}
                    className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-red-400 text-sm ml-2 transition-all"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-center text-[#555] text-xs mt-8">
                  No conversations yet
                </p>
              )}
            </div>

            {/* User Info */}
            <div className="px-3 py-3 border-t border-[#2a2a4a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#6c63ff] flex items-center justify-center text-xs font-bold text-white">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="text-sm text-[#a0a0b8] truncate">
                    {user.name}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs text-[#666] hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  ↪ Out
                </button>
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3.5 px-6 py-4 border-b border-[#2a2a4a] bg-[#1a1a2e]">
          <div className="w-10 h-10 bg-gradient-to-br from-[#6c63ff] to-[#a855f7] rounded-xl flex items-center justify-center text-[20px]">
            ⚖️
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Legal Advisor Bot</h1>
            <p className="text-xs text-[#a0a0b8] mt-0.5">AI-powered legal guidance</p>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scroll-smooth">
          {messages.length === 0 && !loading ? (
            <div className="m-auto text-center px-5 py-10">
              <div className="text-5xl mb-4">⚖️</div>
              <h2 className="text-xl font-bold mb-2">Welcome to Legal Advisor</h2>
              <p className="text-[#a0a0b8] text-sm max-w-[400px] mx-auto mb-6 leading-relaxed">
                Ask any legal question and get AI-powered guidance. This is for
                informational purposes only and not a substitute for
                professional legal advice.
              </p>
              <div className="flex flex-wrap gap-2.5 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="bg-[#16213e] border border-[#2a2a4a] text-[#e8e8f0] px-4 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all duration-200 hover:bg-[#6c63ff] hover:border-[#6c63ff] hover:-translate-y-0.5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 max-w-[80%] animate-[fadeIn_0.3s_ease] ${
                    msg.role === "user" ? "self-end flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`w-[34px] h-[34px] min-w-[34px] rounded-full flex items-center justify-center text-base font-semibold mt-1 ${
                      msg.role === "bot"
                        ? "bg-gradient-to-br from-[#6c63ff] to-[#a855f7]"
                        : "bg-[#2d3748]"
                    }`}
                  >
                    {msg.role === "bot" ? "⚖️" : "👤"}
                  </div>
                  <div
                    className={`px-[18px] py-3.5 rounded-2xl leading-relaxed text-[0.92rem] ${
                      msg.role === "bot"
                        ? "bg-[#1e2a4a] rounded-bl-sm"
                        : "bg-[#6c63ff] rounded-br-sm"
                    }`}
                  >
                    {msg.role === "bot" ? (
                      <div className="markdown-body">
                        {loading &&
                        i === messages.length - 1 &&
                        !msg.content ? (
                          <div className="flex items-center gap-2 py-1">
                            <span className="text-sm text-[#a0a0b8]">
                              Thinking
                            </span>
                            <span className="flex gap-[3px]">
                              <span className="loading-dot" />
                              <span className="loading-dot" />
                              <span className="loading-dot" />
                            </span>
                          </div>
                        ) : (
                          <>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                            {loading && i === messages.length - 1 && (
                              <span className="inline-block w-[3px] h-[18px] bg-[#6c63ff] ml-1 animate-blink rounded-full align-middle" />
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-[#2a2a4a] bg-[#1a1a2e]">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask a legal question..."
              rows={1}
              className="flex-1 bg-[#0f0f1a] border border-[#2a2a4a] rounded-[14px] px-[18px] py-3.5 text-[#e8e8f0] text-[0.92rem] resize-none outline-none min-h-[48px] max-h-[120px] transition-colors duration-200 focus:border-[#6c63ff] placeholder:text-[#a0a0b8] leading-snug"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-12 h-12 min-w-[48px] bg-[#6c63ff] border-none rounded-[14px] text-white text-xl cursor-pointer transition-all duration-200 flex items-center justify-center hover:bg-[#5a52d9] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              ➤
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
