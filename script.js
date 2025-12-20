// =============================
// GLOBAL SAFE HELPERS
// =============================
const $ = (id) => document.getElementById(id);

// EmailJS configuration — fill these with your real IDs to enable email delivery.
// Leave empty to disable EmailJS and avoid runtime errors.
const EMAILJS_SERVICE_ID = "service_cy9g64j"; // e.g. 'service_xxx'
const EMAILJS_TEMPLATE_ID = "template_yoh85zc"; // e.g. 'template_xxx'

// =============================
// TIME-BASED GREETING (DOM-safe)
// =============================
(function initGreeting() {
  const el = $("greeting");
  if (!el) return;

  const hour = new Date().getHours();
  el.textContent =
    hour < 12 ? "Good morning! ☀️" :
    hour < 18 ? "Good afternoon! 🌤️" :
    "Good evening! 🌙";
})();

// =============================
// LIVE CLOCK (DOM-safe)
// =============================
(function initClock() {
  const clock = $("clock");
  if (!clock) return;

  function update() {
    clock.textContent = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }
  update();
  setInterval(update, 1000);
})();

// =============================
// CHAT WIDGET (FIXED & STABLE)
// =============================
(function initChatWidget() {
  const widget = $("chat-widget");
  const toggle = $("chatToggle");
  const closeBtn = $("chatClose");
  const form = $("chatForm");
  const input = $("chatInput");
  const messages = $("chatMessages");
  const status = $("chatStatus");
  const userNameEl = $("Jimmy");
  const userEmailEl = $("y1722202@gmail.com");

  if (!widget || !toggle) return; // prevents silent JS crashes

  let ws = null;
  let connected = false;
  const WS_URL = "wss://example.com/chat"; // replace later

  // -----------------------------
  // STATE HELPERS
  // -----------------------------
  function setStatus(isOnline) {
    connected = isOnline;
    if (!status) return;
    status.className = "chat-status " + (isOnline ? "online" : "offline");
  }

  function addMessage(text, from = "user") {
    if (!messages) return;
    const msg = document.createElement("div");
    msg.className = `msg ${from}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  // -----------------------------
  // OPEN / CLOSE (ROBUST)
  // -----------------------------
  function openChat() {
    widget.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    setTimeout(() => input && input.focus(), 200);
  }

  function closeChat() {
    widget.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    widget.classList.contains("open") ? closeChat() : openChat();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeChat();
  });

  // Click outside → close
  document.addEventListener("pointerdown", (e) => {
    if (!widget.classList.contains("open")) return;
    if (!widget.contains(e.target) && e.target !== toggle) {
      closeChat();
    }
  });

  // -----------------------------
  // FORM SUBMIT
  // -----------------------------
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    input.value = "";

    // Attempt to send via WebSocket when available
    if (connected && ws?.readyState === WebSocket.OPEN) {
      ws.send(text);
    } else {
      setTimeout(() => {
        addMessage("I’m currently offline, but I’ll reply as soon as I’m available.", "owner");
      }, 400);
    }

    // If EmailJS is configured and available, send an email copy of the chat message.
    try {
      if (typeof emailjs !== "undefined" && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID) {
        const params = {
          from_name: (userNameEl && userNameEl.value) || "Anonymous",
          from_email: (userEmailEl && userEmailEl.value) || "",
          message: text,
        };
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
          .then(() => {
            // optional: confirm by appending a small notice in chat
            addMessage("(Your message was submitted via email.)", "owner");
          })
          .catch((err) => {
            console.error("EmailJS send error:", err);
            addMessage("(Failed to send email copy.)", "owner");
          });
      }
    } catch (err) {
      console.error("EmailJS integration error:", err);
    }
  });

  // -----------------------------
  // WEBSOCKET (SAFE)
  // -----------------------------
  function connectWS() {
    if (connected) return;
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setStatus(true);
      ws.onclose = () => setStatus(false);
      ws.onerror = () => setStatus(false);
      ws.onmessage = (e) => addMessage(e.data, "owner");
    } catch {
      setStatus(false);
    }
  }

  connectWS();
  setInterval(connectWS, 5000);
})();



// Remove standalone sendBtn handler; EmailJS usage is handled from the chat submit handler above
