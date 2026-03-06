import { login, logout, getMe, getReference, runCheck, isLoggedIn, getUser } from "./api.js";

// DOM refs
const loginScreen = document.getElementById("login-screen");
const mainScreen = document.getElementById("main-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");

const userName = document.getElementById("user-name");
const creditBalance = document.getElementById("credit-balance");

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

const logoutBtn = document.getElementById("logout-btn");

// State
let referenceData = null;

// Init
async function init() {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    await showMain();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  mainScreen.hidden = true;
}

async function showMain() {
  loginScreen.hidden = true;
  mainScreen.hidden = false;
  resultsSection.hidden = true;

  // Load user info
  const user = await getUser();
  if (user) {
    userName.textContent = user.name || user.email;
  }

  // Fetch fresh data
  const meRes = await getMe();
  if (!meRes.ok) {
    // Token expired
    await logout();
    showLogin();
    return;
  }

  userName.textContent = meRes.data.user.name || meRes.data.user.email;
  const balance = meRes.data.creditBalance ?? 0;
  creditBalance.textContent = `${balance} Checkdits`;
  creditBalance.className = `badge${balance <= 5 ? " low" : ""}`;

  // Load reference data
  if (!referenceData) {
    const refRes = await getReference();
    if (refRes.ok) {
      referenceData = refRes.data;
      populateSelects();
    }
  }
}

function populateSelects() {
  if (!referenceData) return;

  // Platforms
  platformSelect.innerHTML = '<option value="">Select...</option>';
  for (const p of referenceData.platforms) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    platformSelect.appendChild(opt);
  }

  // Countries
  countrySelect.innerHTML = '<option value="">Select...</option>';
  for (const c of referenceData.countries) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    countrySelect.appendChild(opt);
  }

  // Categories
  categorySelect.innerHTML = '<option value="">None</option>';
  for (const c of referenceData.categories) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    categorySelect.appendChild(opt);
  }
}

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await login(email, password);

  if (res.ok) {
    await showMain();
  } else {
    loginError.textContent = res.data?.error || "Login failed";
    loginError.hidden = false;
  }

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign In";
});

// Check
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
    checkError.textContent = "Enter at least a headline or body text.";
    checkError.hidden = false;
    checkBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
    return;
  }

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
    checkError.textContent = res.data?.error || "Check failed. Please try again.";
    checkError.hidden = false;
    return;
  }

  displayResults(res.data);

  // Refresh balance
  const meRes = await getMe();
  if (meRes.ok) {
    const balance = meRes.data.creditBalance ?? 0;
    creditBalance.textContent = `${balance} Checkdits`;
    creditBalance.className = `badge${balance <= 5 ? " low" : ""}`;
  }
});

function displayResults(data) {
  resultsSection.hidden = false;

  // Status badge
  const status = data.overallStatus || "PENDING";
  resultsStatus.textContent = status === "CLEAN" ? "Clean" : status === "WARNINGS" ? "Warnings" : "Violations";
  resultsStatus.className = `status-badge ${status.toLowerCase()}`;

  // Link to full report
  const { apiEnvironment } = chrome.storage.local.get("apiEnvironment");
  const base = apiEnvironment === "development" ? "http://localhost:3000" : "https://adcompliance-pro-v4.vercel.app";
  resultsLink.href = `${base}/app/check/results/${data.checkId}`;

  // Summary
  resultsSummary.textContent = data.summary || "";

  // Issues
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
    more.style.cssText = "font-size:11px;color:#64748b;padding:4px 0;";
    more.textContent = `+ ${issues.length - 10} more issues (view full report)`;
    issuesList.appendChild(more);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Logout
logoutBtn.addEventListener("click", async () => {
  await logout();
  showLogin();
});

// Listen for content script messages (auto-fill from detected ads)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "FILL_AD_CONTENT") {
    if (message.headline) document.getElementById("headline").value = message.headline;
    if (message.body) document.getElementById("body-text").value = message.body;
    if (message.cta) document.getElementById("cta").value = message.cta;
  }
});

init();
