(function initSheetBackend(root) {
  "use strict";

  const config = root.CB_SHEET_BACKEND || {};
  const TOKEN_KEY = "cbas-market-dashboard:sheet-token";

  async function save(payload) {
    if (!config.endpoint) return { status: "not-configured" };
    let token = sessionStorage.getItem(TOKEN_KEY) || "";
    if (!token) {
      token = window.prompt("請輸入 Sheet 同步密碼；密碼只保留到本次瀏覽器分頁關閉。") || "";
      if (!token) return { status: "cancelled" };
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      if (response.status === 401 || /密碼|token/i.test(result.error || "")) sessionStorage.removeItem(TOKEN_KEY);
      throw new Error(result.error || `Sheet 同步失敗（${response.status}）`);
    }
    return { status: "synced", ...result };
  }

  root.CBSheetBackend = {
    configured: Boolean(config.endpoint),
    save,
    spreadsheetUrl: config.spreadsheetUrl || "",
  };
}(typeof globalThis !== "undefined" ? globalThis : window));
