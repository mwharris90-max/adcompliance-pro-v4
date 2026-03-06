import { login, logout, getMe, getReference, runCheck, getHistory, isLoggedIn, getUser } from "./api.js";

// ─── DOM Refs ───
const loginScreen = document.getElementById("login-screen");
const loadingScreen = document.getElementById("loading-screen");
const mainScreen = document.getElementById("main-screen");

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");

const creditBalance = document.getElementById("credit-balance");
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const settingsClose = document.getElementById("settings-close");
const settingsUser = document.getElementById("settings-user");
const logoutBtn = document.getElementById("logout-btn");

const tabs = document.querySelectorAll(".tab");
const tabCheck = document.getElementById("tab-check");
const tabHistory = document.getElementById("tab-history");

const checkForm = document.getElementById("check-form");
const checkError = document.getElementById("check-error");
const checkBtn = document.getElementById("check-btn");
const btnText = checkBtn.querySelector(".btn-text");
const btnLoading = checkBtn.querySelector(".btn-loading");

const platformSelect = document.getElementById("platform-select");
const countrySelect = document.getElementById("country-select");
const categorySelect = document.getElementById("category-select");

const resultsSection = document.getElementById("results-section");
const resultsStatus = document.getElementById("results-status");
const resultsLink = document.getElementById("results-link");
const resultsSummary = document.getElementById("results-summary");
const issuesList = document.getElementById("issues-list");

const historyLoading = document.getElementById("history-loading");
const historyEmpty = document.getElementById("history-empty");
const historyList = document.getElementById("history-list");

// ─── State ───
let referenceData = null;
let currentUser = null;
let historyLoaded = false;

// ─── Init ───
async function init() {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    showScreen("loading");
    await showMain();
  } else {
    showScreen("login");
  }
}

function showScreen(name) {
  loginScreen.hidden = name !== "login";
  loadingScreen.hidden = name !== "loading";
  mainScreen.hidden = name !== "main";
}

async function showMain() {
  // Fetch user data
  const meRes = await getMe();
  if (!meRes.ok) {
    await logout();
    showScreen("login");
    return;
  }

  currentUser = meRes.data.user;
  updateBalance(meRes.data.creditBalance ?? 0);
  updateSettingsUser();

  // Load reference data
  if (!referenceData) {
    const refRes = await getReference();
    if (refRes.ok) {
      referenceData = refRes.data;
      populateSelects();
      restoreSelections();
    }
  }

  // Load API environment setting
  const { apiEnvironment } = await chrome.storage.local.get("apiEnvironment");
  const envRadio = document.querySelector(`input[name="api-env"][value="${apiEnvironment || "development"}"]`);
  if (envRadio) envRadio.checked = true;

  showScreen("main");
}

function updateBalance(balance) {
  creditBalance.textContent = `${balance} Checkdits`;
  creditBalance.className = `badge${balance <= 5 ? " low" : ""}`;
}

function updateSettingsUser() {
  if (!currentUser) return;
  settingsUser.innerHTML = `
    <div class="name">${escapeHtml(currentUser.name || currentUser.email || "User")}</div>
    <div class="email">${escapeHtml(currentUser.email || "")}</div>
  `;
}

function populateSelects() {
  if (!referenceData) return;

  platformSelect.innerHTML = '<option value="">Select...</option>';
  for (const p of referenceData.platforms) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    platformSelect.appendChild(opt);
  }

  countrySelect.innerHTML = '<option value="">Select...</option>';
  for (const c of referenceData.countries) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    countrySelect.appendChild(opt);
  }

  categorySelect.innerHTML = '<option value="">None</option>';
  for (const c of referenceData.categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    categorySelect.appendChild(opt);
  }
}

// Remember last-used selections
function saveSelections() {
  chrome.storage.local.set({
    lastPlatform: platformSelect.value,
    lastCountry: countrySelect.value,
    lastCategory: categorySelect.value,
  });
}

async function restoreSelections() {
  const { lastPlatform, lastCountry, lastCategory } = await chrome.storage.local.get([
    "lastPlatform", "lastCountry", "lastCategory"
  ]);
  if (lastPlatform) platformSelect.value = lastPlatform;
  if (lastCountry) countrySelect.value = lastCountry;
  if (lastCategory) categorySelect.value = lastCategory;
}

// ─── Tabs ───
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab;
    tabCheck.hidden = target !== "check";
    tabHistory.hidden = target !== "history";

    if (target === "history" && !historyLoaded) {
      loadHistory();
    }
  });
});

// ─── Login ───
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  const loginValue = document.getElementById("login").value;
  const password = document.getElementById("password").value;

  const res = await login(loginValue, password);

  if (res.ok) {
    showScreen("loading");
    await showMain();
  } else {
    loginError.textContent = res.data?.error || "Login failed";
    loginError.hidden = false;
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign In";
});

// ─── Check ───
checkForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  checkError.hidden = true;
  resultsSection.hidden = true;
  checkBtn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;

  const headline = document.getElementById("headline").value.trim();
  const body = document.getElementById("body-text").value.trim();
  const cta = document.getElementById("cta").value.trim();
  const platformId = platformSelect.value;
  const countryId = countrySelect.value;
  const categoryId = categorySelect.value;

  if (!headline && !body) {
    showCheckError("Enter at least a headline or body text.");
    return;
  }

  saveSelections();

  const payload = {
    platformIds: [platformId],
    countryIds: [countryId],
    categoryIds: categoryId ? [categoryId] : [],
    assetUrls: [],
  };
  if (headline) payload.headline = headline;
  if (body) payload.body = body;
  if (cta) payload.callToAction = cta;

  const res = await runCheck(payload);

  checkBtn.disabled = false;
  btnText.hidden = false;
  btnLoading.hidden = true;

  if (!res.ok) {
    showCheckError(res.data?.error || "Check failed. Please try again.");
    return;
  }

  displayResults(res.data);
  historyLoaded = false; // Force refresh on next tab switch

  // Refresh balance
  const meRes = await getMe();
  if (meRes.ok) {
    updateBalance(meRes.data.creditBalance ?? 0);
  }
});

function showCheckError(msg) {
  checkError.textContent = msg;
  checkError.hidden = false;
  checkBtn.disabled = false;
  btnText.hidden = false;
  btnLoading.hidden = true;
}

async function getApiBase() {
  const { apiEnvironment } = await chrome.storage.local.get("apiEnvironment");
  return apiEnvironment === "production"
    ? "https://adcompliance-pro-v4.vercel.app"
    : "http://localhost:3000";
}

function displayResults(data) {
  resultsSection.hidden = false;

  const status = data.overallStatus || "PENDING";
  const statusLabel = {
    CLEAN: "Clean",
    WARNINGS: "Warnings",
    VIOLATIONS: "Violations",
    RUNNING: "Running",
    PENDING: "Pending",
  }[status] || status;

  resultsStatus.textContent = statusLabel;
  resultsStatus.className = `status-badge ${status.toLowerCase()}`;

  getApiBase().then((base) => {
    resultsLink.href = `${base}/app/check/results/${data.checkId}`;
  });

  resultsSummary.textContent = data.summary || "";

  issuesList.innerHTML = "";
  const issues = data.issues || [];
  if (issues.length === 0 && status === "CLEAN") {
    issuesList.innerHTML = '<div style="font-size:12px;color:#16a34a;padding:4px 0;">No issues found.</div>';
    return;
  }

  for (const issue of issues.slice(0, 10)) {
    const div = document.createElement("div");
    const severity = issue.severity === "FAIL" ? "fail" : "warning";
    div.className = `issue-item ${severity}`;
    div.innerHTML = `
      <span class="issue-icon">${severity === "fail" ? "&#10060;" : "&#9888;"}</span>
      <span>${escapeHtml(issue.title || issue.message || "Issue detected")}</span>
    `;
    issuesList.appendChild(div);
  }

  if (issues.length > 10) {
    const more = document.createElement("div");
    more.style.cssText = "font-size:11px;color:#64748b;padding:4px 0;text-align:center;";
    more.textContent = `+ ${issues.length - 10} more issues`;
    issuesList.appendChild(more);
  }
}

// ─── History ───
async function loadHistory() {
  historyLoading.hidden = false;
  historyEmpty.hidden = true;
  historyList.innerHTML = "";

  const res = await getHistory();
  historyLoading.hidden = true;

  if (!res.ok) {
    historyEmpty.hidden = false;
    historyEmpty.querySelector("p").textContent = "Failed to load history.";
    return;
  }

  const checks = res.data.checks || [];
  if (checks.length === 0) {
    historyEmpty.hidden = false;
    return;
  }

  const apiBase = await getApiBase();

  for (const check of checks) {
    const a = document.createElement("a");
    a.className = "history-item";
    a.href = `${apiBase}/app/check/results/${check.id}`;
    a.target = "_blank";

    const statusKey = (check.status || "pending").toLowerCase();
    const date = new Date(check.createdAt);
    const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const sourceLabel = check.source === "EXTENSION" ? "Extension" : "Web";

    a.innerHTML = `
      <span class="history-dot ${statusKey}"></span>
      <div class="history-info">
        <div class="history-headline">${escapeHtml(check.headline || check.body || "(No content)")}</div>
        <div class="history-meta">
          <span>${dateStr} ${timeStr}</span>
          <span>${sourceLabel}</span>
        </div>
      </div>
      <span class="history-status ${statusKey}">${capitalize(statusKey)}</span>
    `;

    historyList.appendChild(a);
  }

  historyLoaded = true;
}

// ─── Settings ───
settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = false;
});

settingsClose.addEventListener("click", () => {
  settingsPanel.hidden = true;
});

// API environment radios
document.querySelectorAll('input[name="api-env"]').forEach((radio) => {
  radio.addEventListener("change", async (e) => {
    const env = e.target.value;
    await chrome.storage.local.set({ apiEnvironment: env });
    // Reset state — user needs to re-login for new environment
    referenceData = null;
    historyLoaded = false;
  });
});

logoutBtn.addEventListener("click", async () => {
  await logout();
  settingsPanel.hidden = true;
  showScreen("login");
});

// ─── Content script listener ───
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "FILL_AD_CONTENT") {
    // Switch to check tab
    tabs.forEach((t) => t.classList.remove("active"));
    document.querySelector('[data-tab="check"]').classList.add("active");
    tabCheck.hidden = false;
    tabHistory.hidden = true;

    if (message.headline) document.getElementById("headline").value = message.headline;
    if (message.body) document.getElementById("body-text").value = message.body;
    if (message.cta) document.getElementById("cta").value = message.cta;
  }
});

// ─── Utils ───
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Start ───
init();
