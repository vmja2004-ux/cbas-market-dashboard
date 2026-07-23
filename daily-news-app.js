const dailyHistory = window.CB_DAILY_HISTORY || {
  generated_at: "",
  latest_date: "",
  record_count: 0,
  item_count: 0,
  records: [],
  items: [],
};

const state = {
  date: dailyHistory.latest_date || "",
  keyword: "",
  source: "",
  sort: "newest",
};
let renderedItems = [];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-TW", { hour12: false });
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function itemSearchText(item) {
  return [
    item.date,
    item.stock_code,
    String(item.stock_code || "").replace(".TW", ""),
    item.company_name,
    item.category,
    item.source_name,
    item.title,
    item.summary_zh,
    item.hit_reason,
  ]
    .join(" ")
    .toLowerCase();
}

function renderHeader() {
  $("subtitle").textContent = `最新日期：${dailyHistory.latest_date || "-"}，累計 ${dailyHistory.record_count || 0} 個交易日、${dailyHistory.item_count || 0} 則新聞。`;
}

function renderMetrics() {
  const latest = dailyHistory.records.find((record) => record.date === dailyHistory.latest_date) || {};
  const rows = [
    ["最新日期", dailyHistory.latest_date || "-"],
    ["最新命中", `${latest.item_count || 0} 則`],
    ["累計天數", `${dailyHistory.record_count || 0} 日`],
    ["累計新聞", `${dailyHistory.item_count || 0} 則`],
  ];
  $("metrics").innerHTML = rows.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function initFilters() {
  $("dateFilter").innerHTML =
    `<option value="">全部日期</option>` +
    dailyHistory.records.map((record) => `<option value="${escapeHtml(record.date)}">${escapeHtml(record.date)}（${record.item_count}）</option>`).join("");
  $("dateFilter").value = state.date;

  const sources = [...new Set(dailyHistory.items.map((item) => item.source_name).filter(Boolean))].sort();
  $("sourceFilter").innerHTML = `<option value="">全部來源</option>` + sources.map((source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`).join("");

  $("dateFilter").addEventListener("input", () => {
    state.date = $("dateFilter").value;
    renderResults();
  });
  $("keywordInput").addEventListener("input", () => {
    state.keyword = $("keywordInput").value;
    renderResults();
  });
  $("sourceFilter").addEventListener("input", () => {
    state.source = $("sourceFilter").value;
    renderResults();
  });
  $("sortSelect").addEventListener("input", () => {
    state.sort = $("sortSelect").value;
    renderResults();
  });
}

function filteredItems() {
  const keyword = normalize(state.keyword);
  const rows = dailyHistory.items
    .filter((item) => !state.date || item.date === state.date)
    .filter((item) => !state.source || item.source_name === state.source)
    .filter((item) => !keyword || itemSearchText(item).includes(keyword));

  rows.sort((a, b) => {
    if (state.sort === "score") return (Number(b.relevance_score) || 0) - (Number(a.relevance_score) || 0);
    if (state.sort === "code") return String(a.stock_code || "").localeCompare(String(b.stock_code || ""));
    return String(b.published_at || b.date || "").localeCompare(String(a.published_at || a.date || ""));
  });
  return rows;
}

function renderResults() {
  const rows = filteredItems();
  renderedItems = rows;
  $("resultCount").textContent = `${rows.length} 則`;
  $("emptyState").hidden = rows.length > 0;
  $("newsList").innerHTML = rows
    .map((item, index) => {
      const code = item.stock_code || "";
      const shortCode = code.replace(".TW", "");
      const title = item.title || "(無標題)";
      const link = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>` : escapeHtml(title);
      return `<article class="news-card">
        <div class="tags">
          <span class="tag">${escapeHtml(item.date)}</span>
          <span class="tag">${escapeHtml(shortCode || code)}</span>
          <span class="tag">${escapeHtml(item.company_name || "未命名")}</span>
          <span class="tag">${escapeHtml(item.source_name || "未知來源")}</span>
          ${item.needs_review ? `<span class="tag warn">需人工確認</span>` : ""}
        </div>
        <h3>${link}</h3>
        <div class="meta">${escapeHtml(formatDateTime(item.published_at))}｜關聯分數 ${escapeHtml(item.relevance_score)}</div>
        <p class="summary">${escapeHtml(item.summary_zh || "")}</p>
        <div class="reason">${escapeHtml(item.hit_reason || "")}</div>
        <div class="card-actions">
          <button class="notion-capture" type="button" data-capture-index="${index}">新聞＋月營收截圖寫入 Notion</button>
          <span class="capture-status" aria-live="polite"></span>
        </div>
      </article>`;
    })
    .join("");
}

async function captureToNotion(button) {
  const item = renderedItems[Number(button.dataset.captureIndex)];
  if (!item) return;
  let accessKey = sessionStorage.getItem("notionCaptureKey") || "";
  if (!accessKey) {
    accessKey = window.prompt("請輸入 Notion 擷取存取碼：") || "";
    if (!accessKey) return;
    sessionStorage.setItem("notionCaptureKey", accessKey);
  }

  const status = button.parentElement.querySelector(".capture-status");
  status.classList.remove("error");
  status.textContent = "";
  button.disabled = true;
  button.textContent = "處理中……";
  try {
    const response = await fetch("/api/notion-capture", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Capture-Key": accessKey },
      body: JSON.stringify(item),
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) sessionStorage.removeItem("notionCaptureKey");
    if (!response.ok || !result.ok) throw new Error(result.message || `HTTP ${response.status}`);
    button.textContent =
      result.status === "already_exists"
        ? "已收錄"
        : result.status === "backfilled_screenshot"
          ? "已補截圖"
          : "已寫入＋截圖";
    status.innerHTML = result.page_url
      ? `<a href="${escapeHtml(result.page_url)}" target="_blank" rel="noopener noreferrer">開啟 Notion 頁面</a>`
      : "";
  } catch (error) {
    button.disabled = false;
    button.textContent = "重新擷取";
    status.textContent = error.message || "寫入失敗";
    status.classList.add("error");
  }
}

$("newsList").addEventListener("click", (event) => {
  const button = event.target.closest(".notion-capture");
  if (button) captureToNotion(button);
});

function renderArchive() {
  $("archiveRows").innerHTML = dailyHistory.records
    .map((record) => `<tr>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.item_count)}</td>
      <td>${escapeHtml(record.target_count)}</td>
      <td>${escapeHtml(record.warning_count)}</td>
      <td>${escapeHtml(record.subject || "")}</td>
    </tr>`)
    .join("");
}

function renderAll() {
  renderHeader();
  renderMetrics();
  initFilters();
  renderResults();
  renderArchive();
}

renderAll();
