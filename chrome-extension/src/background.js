// Background service worker for Ad Compliance Pro extension

const API_URLS = {
  production: "https://adcompliance-pro-v4.vercel.app",
  development: "http://localhost:3000",
};

// Get the configured API base URL
async function getApiBase() {
  const { apiEnvironment } = await chrome.storage.local.get("apiEnvironment");
  return API_URLS[apiEnvironment] || API_URLS.development;
}

// Get stored auth token
async function getToken() {
  const { authToken } = await chrome.storage.local.get("authToken");
  return authToken || null;
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "API_REQUEST") {
    handleApiRequest(message).then(sendResponse);
    return true; // async response
  }
});

async function handleApiRequest({ method, path, body }) {
  const apiBase = await getApiBase();
  const token = await getToken();

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: method || "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: `Server returned non-JSON response (${res.status})` };
      return { ok: false, status: res.status, data };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}
