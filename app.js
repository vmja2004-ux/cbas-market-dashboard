const data = window.CBAS_DATA || {
  generated_at: "", latest_source_date: "", source_files: [], summary: {}, quotes: [],
};

function unpackDataset(dataset) {
  if (Array.isArray(dataset)) return dataset;
  if (!dataset?.columns || !dataset?.rows) return [];
  return dataset.rows.map((row) => Object.fromEntries(dataset.columns.map((column, index) => [column, row[index]])));
}

const quoteRows = unpackDataset(data.quotes);
const quoteColumns = [
  ["cb_code", "CB 代碼"], ["cb_name", "名稱"], ["premium_per_100", "百元權利金"],
  ["premium_reference", "參考權利金"], ["cb_price", "CB 價"], ["parity", "轉換價值"],
  ["premium_ratio", "折溢價"], ["option_expiration", "選擇權到期"],
  ["put_date", "賣回日"], ["source_id", "來源"],
];

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function sourceName(sourceId) {
  return data.source_files?.[sourceId]?.name || "";
}

function formatValue(value, key = "") {
  if (value === null || value === undefined || value === "") return "";
  if (key === "source_id") return escapeHtml(sourceName(value));
  if (typeof value !== "number") return escapeHtml(value);
  if (key.includes("ratio") || key.includes("rate")) return `${(value * 100).toFixed(1)}%`;
  return value.toLocaleString("zh-TW", { maximumFractionDigits: 3 });
}

function formatDateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("zh-TW", { hour12: false });
}

function renderHeader() {
  $("subtitle").textContent = `最新來源日期 ${data.latest_source_date || "-"}，更新時間 ${formatDateTime(data.generated_at) || "-"}`;
}

function renderMetrics() {
  const quoted = quoteRows.filter((row) => row.premium_per_100 !== null && row.premium_per_100 !== undefined);
  const lowPremium = quoteRows.filter((row) => Number.isFinite(row.premium_ratio) && row.premium_ratio < 0.2);
  const highParity = quoteRows.filter((row) => Number.isFinite(row.parity) && row.parity >= 85);
  const rows = [
    ["報價標的", quoteRows.length],
    ["可拆解報價", quoted.length],
    ["折溢價低於 20%", lowPremium.length],
    ["轉換價值 ≥ 85", highParity.length],
    ["來源日期", data.latest_source_date || "-"],
  ];
  $("metrics").innerHTML = rows.map(([label, value]) =>
    `<div class="metric"><span>${label}</span><strong>${formatValue(value)}</strong></div>`
  ).join("");
}

function scoreQuote(quote) {
  let score = 0;
  if (quote.premium_per_100 !== undefined && quote.premium_per_100 !== null) score += 25;
  if (quote.option_expiration) score += 15;
  if (Number.isFinite(quote.premium_ratio) && quote.premium_ratio < 0.2) score += 20;
  if (Number.isFinite(quote.parity) && quote.parity >= 85) score += 20;
  return Math.min(score, 100);
}

function renderWatchlist() {
  const rows = quoteRows.map((quote) => ({ ...quote, score: scoreQuote(quote) }))
    .sort((a, b) => b.score - a.score || (b.parity || 0) - (a.parity || 0)).slice(0, 12);
  $("watchlistCount").textContent = `${rows.length} 筆`;
  $("watchlistRows").innerHTML = rows.map((row) =>
    `<button class="watch-row" type="button" data-code="${escapeHtml(row.cb_code)}">
      <span class="score">${row.score}</span>
      <span><strong>${escapeHtml(row.cb_code)} ${escapeHtml(row.cb_name || "")}</strong>
      <small>權利金 ${formatValue(row.premium_per_100)}，轉換價值 ${formatValue(row.parity)}</small></span>
    </button>`
  ).join("");
  document.querySelectorAll(".watch-row").forEach((button) => button.addEventListener("click", () => {
    $("searchInput").value = button.dataset.code;
    renderTable();
    document.querySelector(".table-section").scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

function initFilters() {
  const sources = [...new Set((data.source_files || []).filter((file) => file.included).map((file) => file.name))].sort();
  $("sourceSelect").innerHTML = `<option value="">全部來源</option>` +
    sources.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  ["searchInput", "sourceSelect", "sortSelect"].forEach((id) => $(id).addEventListener("input", renderTable));
  $("downloadJson").addEventListener("click", () =>
    downloadFile(`cbas-quotes-${data.latest_source_date || "latest"}.json`, JSON.stringify(quoteRows, null, 2), "application/json")
  );
  $("downloadCsv").addEventListener("click", downloadCsv);
}

function currentRows() {
  const search = $("searchInput").value.trim().toLowerCase();
  const source = $("sourceSelect").value;
  const sort = $("sortSelect").value;
  const rows = quoteRows
    .filter((row) => !source || sourceName(row.source_id) === source)
    .filter((row) => !search || Object.values(row).join(" ").toLowerCase().includes(search));
  rows.sort((a, b) => {
    if (sort === "premium") return (b.premium_per_100 || b.premium_reference || 0) - (a.premium_per_100 || a.premium_reference || 0);
    if (sort === "date") return String(a.option_expiration || "").localeCompare(String(b.option_expiration || ""));
    if (sort === "parity") return (b.parity || 0) - (a.parity || 0);
    return String(a.cb_code || "").localeCompare(String(b.cb_code || ""), "zh-TW", { numeric: true });
  });
  return rows;
}

function renderTable() {
  const rows = currentRows();
  $("rowCount").textContent = `${rows.length} 筆`;
  $("tableHead").innerHTML = `<tr>${quoteColumns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
  $("tableBody").innerHTML = rows.length
    ? rows.map((row) => `<tr>${quoteColumns.map(([key]) => `<td>${formatValue(row[key], key)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${quoteColumns.length}" class="empty">沒有符合條件的報價</td></tr>`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function downloadCsv() {
  const rows = currentRows();
  const csv = [quoteColumns.map(([, label]) => label), ...rows.map((row) => quoteColumns.map(([key]) => row[key] ?? ""))]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  downloadFile(`cbas-quotes-${data.latest_source_date || "latest"}.csv`, "\ufeff" + csv, "text/csv");
}

renderHeader();
renderMetrics();
renderWatchlist();
initFilters();
renderTable();
