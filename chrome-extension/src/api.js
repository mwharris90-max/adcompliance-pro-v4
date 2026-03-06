// API helper — sends requests through the background service worker

export function apiRequest(method, path, body) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "API_REQUEST", method, path, body },
      (response) => resolve(response)
    );
  });
}

export async function login(loginValue, password) {
  const isEmail = loginValue.includes("@");
  const body = isEmail ? { email: loginValue, password } : { username: loginValue, password };
  const res = await apiRequest("POST", "/api/extension/token", body);
  if (res.ok) {
    await chrome.storage.local.set({ authToken: res.data.token, user: res.data.user });
  }
  return res;
}

export async function logout() {
  await chrome.storage.local.remove(["authToken", "user"]);
}

export async function getMe() {
  return apiRequest("GET", "/api/extension/me");
}

export async function getReference() {
  return apiRequest("GET", "/api/extension/reference");
}

export async function runCheck(payload) {
  return apiRequest("POST", "/api/extension/check", payload);
}

export async function getHistory() {
  return apiRequest("GET", "/api/extension/history");
}

export async function isLoggedIn() {
  const { authToken } = await chrome.storage.local.get("authToken");
  return !!authToken;
}

export async function getUser() {
  const { user } = await chrome.storage.local.get("user");
  return user || null;
}
