const authStatus = document.getElementById("authStatus");
const authLabel = authStatus.querySelector(".auth-status__label");
const signOutBtn = document.getElementById("signOutBtn");
const signInForm = document.getElementById("signInForm");
const signUpForm = document.getElementById("signUpForm");
const chatPanel = document.getElementById("chatPanel");
const authPanel = document.getElementById("authPanel");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const promptField = document.getElementById("prompt");
const sendBtn = document.getElementById("sendBtn");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const budgetModeToggle = document.getElementById("budgetMode");
const messageTemplate = document.getElementById("messageTemplate");

const STORAGE_KEYS = {
  users: "aurora_users",
  session: "aurora_session",
  chats: "aurora_chats",
};

const state = {
  currentUser: null,
  chats: [],
};

const loadJson = (key, fallback) => {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : fallback;
};

const saveJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getUsers = () => loadJson(STORAGE_KEYS.users, []);
const saveUsers = (users) => saveJson(STORAGE_KEYS.users, users);
const getChats = () => loadJson(STORAGE_KEYS.chats, {});
const saveChats = (chats) => saveJson(STORAGE_KEYS.chats, chats);

const setSession = (email) => {
  saveJson(STORAGE_KEYS.session, { email, signedInAt: new Date().toISOString() });
};

const clearSession = () => {
  localStorage.removeItem(STORAGE_KEYS.session);
};

const hydrateSession = () => {
  const session = loadJson(STORAGE_KEYS.session, null);
  if (!session) return;
  const users = getUsers();
  const matched = users.find((user) => user.email === session.email);
  if (matched) {
    state.currentUser = matched;
  }
};

const renderAuth = () => {
  if (state.currentUser) {
    authLabel.textContent = `Signed in as ${state.currentUser.email}`;
    signOutBtn.disabled = false;
    chatPanel.classList.remove("is-disabled");
    authPanel.classList.add("is-hidden");
    sendBtn.disabled = false;
    exportBtn.disabled = false;
    clearBtn.disabled = false;
  } else {
    authLabel.textContent = "Not signed in";
    signOutBtn.disabled = true;
    authPanel.classList.remove("is-hidden");
    sendBtn.disabled = true;
    exportBtn.disabled = true;
    clearBtn.disabled = true;
  }
};

const renderChats = () => {
  chatWindow.innerHTML = "";
  if (!state.currentUser) {
    chatWindow.innerHTML = "<p class=\"muted\">Sign in to start chatting.</p>";
    return;
  }
  state.chats.forEach((message) => {
    const node = messageTemplate.content.cloneNode(true);
    const messageEl = node.querySelector(".message");
    messageEl.classList.toggle("user", message.role === "user");
    node.querySelector(".message__meta").textContent = `${message.role} • ${new Date(
      message.timestamp
    ).toLocaleString()}`;
    node.querySelector(".message__body").textContent = message.text;
    chatWindow.appendChild(node);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
};

const loadChatsForUser = () => {
  if (!state.currentUser) {
    state.chats = [];
    return;
  }
  const allChats = getChats();
  state.chats = allChats[state.currentUser.email] || [];
};

const persistChats = () => {
  if (!state.currentUser) return;
  const allChats = getChats();
  allChats[state.currentUser.email] = state.chats;
  saveChats(allChats);
};

const addMessage = (role, text) => {
  state.chats.push({
    role,
    text,
    timestamp: new Date().toISOString(),
  });
  persistChats();
  renderChats();
};

const generateGeminiReply = (prompt) => {
  const budgetMode = budgetModeToggle.checked;
  const canned = [
    "Got it. Here's a quick, budget-friendly response.",
    "Thanks for asking. Here's the concise Gemini reply.",
    "Understood! Here's a fast summary based on your prompt.",
  ];
  const detail = [
    "I can help you outline next steps, key risks, and quick wins.",
    "Want a draft? I can produce a checklist, timeline, or spec.",
    "If you need more detail, toggle off budget mode for longer replies.",
  ];
  const response = `${canned[Math.floor(Math.random() * canned.length)]}\n\nPrompt: ${prompt}`;
  if (budgetMode) {
    return response;
  }
  return `${response}\n\n${detail[Math.floor(Math.random() * detail.length)]}`;
};

const exportChats = () => {
  if (!state.currentUser || state.chats.length === 0) return;
  const rows = [
    ["email", "role", "message", "timestamp"],
    ...state.chats.map((message) => [
      state.currentUser.email,
      message.role,
      message.text.replace(/\n/g, " "),
      message.timestamp,
    ]),
  ];
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/\"/g, "\"\"")}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aurora-chat-${state.currentUser.email}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const handleAuth = (email, password, mode) => {
  const users = getUsers();
  if (mode === "signup") {
    if (users.some((user) => user.email === email)) {
      alert("Account already exists. Please sign in.");
      return;
    }
    users.push({ email, password, createdAt: new Date().toISOString() });
    saveUsers(users);
  }

  const matched = users.find((user) => user.email === email && user.password === password);
  if (!matched) {
    alert("Invalid credentials. Try again.");
    return;
  }
  state.currentUser = matched;
  setSession(email);
  loadChatsForUser();
  renderAuth();
  renderChats();
};

signInForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(signInForm);
  handleAuth(formData.get("email"), formData.get("password"), "signin");
  signInForm.reset();
});

signUpForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(signUpForm);
  handleAuth(formData.get("email"), formData.get("password"), "signup");
  signUpForm.reset();
});

signOutBtn.addEventListener("click", () => {
  state.currentUser = null;
  state.chats = [];
  clearSession();
  renderAuth();
  renderChats();
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const prompt = promptField.value.trim();
  if (!prompt) return;
  addMessage("user", prompt);
  promptField.value = "";
  const reply = generateGeminiReply(prompt);
  setTimeout(() => addMessage("assistant", reply), 450);
});

exportBtn.addEventListener("click", exportChats);

clearBtn.addEventListener("click", () => {
  if (!state.currentUser) return;
  if (!confirm("Clear this chat history?")) return;
  state.chats = [];
  persistChats();
  renderChats();
});

hydrateSession();
loadChatsForUser();
renderAuth();
renderChats();
