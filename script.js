// Time-based greeting
const hour = new Date().getHours();
let greeting;

if (hour < 12) {
  greeting = "Good morning! ☀️";
} else if (hour < 18) {
  greeting = "Good afternoon! 🌤️";
} else {
  greeting = "Good evening! 🌙";
}

// Set greeting
document.getElementById("greeting").textContent = greeting;

// Image upload functionality with drag & drop
// Download-after-question functionality
const downloadForm = document.getElementById("downloadForm");
const orgInput = document.getElementById("orgInput");
const titleInput = document.getElementById("titleInput");
const resumeLink = document.getElementById("resumeLink");
const downloadMessage = document.getElementById("downloadMessage");

if (downloadForm) {
  downloadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const org = orgInput.value.trim();
    const title = titleInput.value.trim();
    if (!org || !title) {
      downloadMessage.textContent = "Please enter both organization and title.";
      downloadMessage.style.color = "#ef4444";
      return;
    }

    downloadMessage.textContent = "Thanks! Preparing your download...";
    downloadMessage.style.color = "#2c3e50";

    // Trigger download (hidden anchor) after a small delay for UX
    setTimeout(() => {
      if (resumeLink) resumeLink.click();
      downloadMessage.innerHTML = 'If the download didn\'t start, <a href="resume.pdf" download>click here</a>.';
    }, 300);
  });
}

// Live clock with better formatting
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  document.getElementById("clock").textContent = timeString;
}

// Update clock every second
setInterval(updateClock, 1000);
updateClock();

// Smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  });
});

// Add intersection observer for fade-in animations on scroll
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// Observe all sections
document.querySelectorAll("section").forEach(section => {
  section.style.opacity = "0";
  section.style.transform = "translateY(20px)";
  section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  observer.observe(section);
});

// Chat widget logic (WebSocket if available, otherwise offline auto-reply)
(function(){
  const chatToggle = document.getElementById('chatToggle');
  const chatWindow = document.getElementById('chatWindow');
  const chatClose = document.getElementById('chatClose');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  const chatStatus = document.getElementById('chatStatus');

  let ws;
  let connected = false;
  const WS_URL = 'wss://example.com/chat'; // replace with your WebSocket server URL

  function addMessage(text, from='user') {
    if (!chatMessages) return;
    const el = document.createElement('div');
    el.className = 'msg ' + (from === 'owner' ? 'owner' : 'user');
    el.textContent = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function setStatus(isOnline) {
    connected = isOnline;
    if (!chatStatus) return;
    chatStatus.className = 'chat-status ' + (isOnline ? 'online' : 'offline');
    chatStatus.title = isOnline ? 'Owner is online' : 'Owner is offline';
  }

  function connect() {
    try {
      ws = new WebSocket(WS_URL);
      ws.addEventListener('open', () => setStatus(true));
      ws.addEventListener('close', () => setStatus(false));
      ws.addEventListener('error', () => setStatus(false));
      ws.addEventListener('message', (ev) => {
        let data = ev.data;
        addMessage(data, 'owner');
      });
    } catch (e) {
      setStatus(false);
    }
  }

  // Try to connect (harmless if no server exists yet)
  connect();

  if (chatToggle) {
    chatToggle.addEventListener('click', () => {
      const widget = document.getElementById('chat-widget');
      const opening = !widget.classList.contains('open');
      if (opening) {
        widget.classList.add('open');
        chatToggle.setAttribute('aria-expanded', 'true');
        setTimeout(() => { if (chatInput) chatInput.focus(); }, 320);
      } else {
        widget.classList.remove('open');
        chatToggle.setAttribute('aria-expanded', 'false');
        chatToggle.focus();
      }
    });
  }
  if (chatClose) chatClose.addEventListener('click', () => {
    const widget = document.getElementById('chat-widget');
    widget.classList.remove('open');
    if (chatToggle) chatToggle.setAttribute('aria-expanded', 'false');
    if (chatToggle) chatToggle.focus();
  });

  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      chatInput.value = '';
      if (connected && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(text);
      } else {
        // Immediate auto-reply when owner is offline
        setTimeout(() => {
          addMessage("When I am available, I will get back to you as soon as possible.", 'owner');
        }, 400);
      }
    });
  }

  // Periodically attempt to reconnect while page is open
  setInterval(() => {
    if (!connected) connect();
  }, 5000);
})();
