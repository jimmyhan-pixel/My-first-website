// =============================
// GLOBAL SAFE HELPERS
// =============================
const $ = (id) => document.getElementById(id);

// ✅ ADD THIS HERE (ONCE)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
// =============================
// EmailJS CONFIG ✅ 必须完整
// =============================
const EMAILJS_PUBLIC_KEY = "rBCzi8gk95ZNi_AbF"; // ← 必填
const EMAILJS_SERVICE_ID = "service_cy9g64j";
const EMAILJS_TEMPLATE_ID = "template_7z3kejw";

// 初始化 EmailJS（✅ 核心修复）
(function initEmailJS() {
  if (typeof emailjs === "undefined") {
    console.warn("EmailJS not loaded");
    return;
  }
  emailjs.init(EMAILJS_PUBLIC_KEY);
})();

// =============================
// TIME-BASED GREETING
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
// LIVE CLOCK
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
// RESUME DOWNLOAD LOGIC
// =============================
(function initResumeDownload() {
  const form = document.getElementById("downloadForm");
  const orgInput = document.getElementById("orgInput");
  const titleInput = document.getElementById("titleInput");
  const message = document.getElementById("downloadMessage");
  const link = document.getElementById("resumeLink");

  if (!form || !link) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const org = orgInput.value.trim();
    const title = titleInput.value.trim();

    if (!org || !title) {
      message.textContent = "Please fill out both fields.";
      return;
    }

    message.textContent = "Thank you! Preparing your download...";

    // Try to prompt the native save-file picker first (preserving user gesture),
    // then fetch and write the file. If picker is not available or fails, fall back
    // to a standard blob download. This ordering prevents the picker being blocked
    // on deployed sites where async work breaks the user gesture.
    (async () => {
      try {
        if (window.showSaveFilePicker) {
          // Prompt picker immediately while still in the user gesture
          let handle;
          try {
            handle = await window.showSaveFilePicker({
              suggestedName: 'Jimmy-Han-Resume.pdf',
              types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
            });
          } catch (pickerErr) {
            // user cancelled the picker or it's blocked — fallback to standard download flow
            console.warn('Save picker cancelled or blocked:', pickerErr);
            handle = null;
          }

          // Now fetch the resume
          const res = await fetch(link.getAttribute('href'));
          if (!res.ok) throw new Error('Failed to fetch resume');

          if (handle) {
            try {
              const writable = await handle.createWritable();
              // write response body as stream if available for efficiency
              if (res.body && writable.write) {
                // If WritableStream supports single-write of ReadableStream, pipe
                // Otherwise fall back to arrayBuffer
                try {
                  // Some environments allow piping directly
                  const reader = res.body.getReader();
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                  }
                  await writable.close();
                } catch (streamErr) {
                  // Fallback: read full blob and write once
                  const blob = await res.blob();
                  await writable.write(blob);
                  await writable.close();
                }
              } else {
                const blob = await res.blob();
                await writable.write(blob);
                await writable.close();
              }
              message.textContent = 'Saved to chosen location. Thank you!';
            } catch (fsErr) {
              console.error('Error writing to file handle:', fsErr);
              // If writing fails, fall back to blob download
              const blob = await res.blob();
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = 'Jimmy-Han-Resume.pdf';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(blobUrl);
              message.textContent = 'Download started. Thank you!';
            }
          } else {
            // No handle selected: just perform a normal download
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'Jimmy-Han-Resume.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
            message.textContent = 'Download started. Thank you!';
          }
        } else {
          // Standard download fallback for browsers without the API
          const res = await fetch(link.getAttribute('href'));
          if (!res.ok) throw new Error('Failed to fetch resume');
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = 'Jimmy-Han-Resume.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(blobUrl);
          message.textContent = 'Download started. Thank you!';
        }
      } catch (err) {
        console.error(err);
        // fallback to the original anchor if fetch fails
        message.innerHTML = 'Download failed — you can <a href="' + link.getAttribute('href') + '" download>click here</a> to try manually.';
        link.style.display = 'inline-block';
      } finally {
        form.reset();
      }
    })();
  });
})();


// =============================
// CHAT WIDGET + EMAILJS (✅ 稳定版)
// =============================
(function initChatWidget() {
  const widget = $("chat-widget");
  const toggle = $("chatToggle");
  const closeBtn = $("chatClose");
  const form = $("chatForm");
  const input = $("chatInput");
  const messages = $("chatMessages");
  const status = $("chatStatus");

  const userNameEl = $("userName");
  const userEmailEl = $("userEmail");

  if (!widget || !toggle || !form || !input || !messages) return;

  let sending = false;

  function setStatus(isOnline) {
    if (!status) return;
    status.className = "chat-status " + (isOnline ? "online" : "offline");
  }

  setStatus(true); // 当前为 Email 模式，默认 online

  function addMessage(text, from = "user") {
    const msg = document.createElement("div");
    msg.className = `msg ${from}`;
    msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function openChat() {
    widget.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    setTimeout(() => input.focus(), 150);
  }

  function closeChat() {
    widget.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    widget.classList.contains("open") ? closeChat() : openChat();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeChat();
  });

  // =============================
  // FORM SUBMIT → EMAILJS
  // =============================
  let ownerName = "Jimmy";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;

    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    input.value = "";
    sending = true;

    if (typeof emailjs === "undefined") {
      addMessage("❌ Email service not available. "+ ownerName, "owner");
      sending = false;
      return;
    }

    const fileInput = document.getElementById("chatFile");
    const file = fileInput?.files?.[0];

    if (file) {
      addMessage("❌ File uploads are not supported yet. Please email your file directly to me.", "owner");
      fileInput.value = "";
      sending = false;
      return;
    }

    const params = {
      name: userNameEl?.value?.trim() || "Anonymous",
      email: userEmailEl?.value?.trim() || "Not provided",
      message: text,
    };

    emailjs
      .send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
      .then(() => {
        addMessage("✅ Message sent. I’ll send email to you soon! "+ ownerName, "owner");
      })
      .catch((err) => {
        console.error("EmailJS error:", err);
        addMessage("❌ Failed to send message. Please try again later. "+ ownerName, "owner");
      })
      .finally(() => {
        sending = false;
      });
  });
})();
