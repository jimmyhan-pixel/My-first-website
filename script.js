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
