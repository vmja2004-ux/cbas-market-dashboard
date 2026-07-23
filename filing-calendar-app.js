const payload = window.SFB_FILING_CALENDAR || {
  generated_at: "",
  as_of: "",
  window_start: "",
  summary: {},
  records: [],
};

const state = {
  month: "",
};

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

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-TW", { hour12: false });
}

function formatAmount(value, currency) {
  if (value === null || value === undefined || value === "") return "";
  const prefix = currency && currency !== "TWD" ? `${currency} ` : "";
  return `${prefix}${Number(value).toLocaleString("zh-TW", { maximumFractionDigits: 0 })}`;
}

function monthKey(dateValue) {
  return String(dateValue || "").slice(0, 7);
}

function selectedDateField() {
  return $("dateFieldSelect")?.value || "effective_date";
}

function selectedDateLabel() {
  return selectedDateField() === "received_date" ? "收文日期" : "生效日期";
}

function recordDate(record) {
  return record[selectedDateField()] || record.date || "";
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

function availableMonths() {
  const months = new Set(payload.records.map((record) => monthKey(recordDate(record))).filter(Boolean));
  const start = new Date(`${payload.window_start.slice(0, 7)}-01T00:00:00`);
  const end = new Date(`${payload.as_of.slice(0, 7)}-01T00:00:00`);
  for (let cursor = new Date(start); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
    months.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
  }
  return [...months].sort();
}

function filteredRecords(ignoreMonth = false) {
  const search = $("searchInput").value.trim().toLowerCase();
  const type = $("typeSelect").value;
  const month = $("monthSelect").value;
  return payload.records
    .filter((record) => !type || record.type === type)
    .filter((record) => {
      const dateValue = recordDate(record);
      if (!dateValue) return false;
      return ignoreMonth || !month || monthKey(dateValue) === month;
    })
    .filter((record) => {
      if (!search) return true;
      return [record.stock_code, record.company_name, record.underwriter, record.category].join(" ").toLowerCase().includes(search);
    });
}

function renderHeader() {
  $("subtitle").textContent = `資料期間 ${formatDate(payload.window_start)} 至 ${formatDate(payload.as_of)}，目前依 ${selectedDateLabel()} 顯示，更新時間 ${formatDateTime(payload.generated_at)}`;
}

function renderMetrics() {
  const rowsForDate = filteredRecords(true);
  const rows = [
    ["總案件", rowsForDate.length],
    ["轉換公司債", rowsForDate.filter((record) => record.type === "convertible_bond").length],
    ["現金增資", rowsForDate.filter((record) => record.type === "cash_capital_increase").length],
    ["日期欄位", selectedDateLabel()],
  ];
  $("metrics").innerHTML = rows.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function initControls() {
  refreshMonthOptions();
  ["searchInput", "typeSelect", "monthSelect"].forEach((id) => $(id).addEventListener("input", renderAllData));
  $("dateFieldSelect").addEventListener("input", () => {
    refreshMonthOptions();
    renderHeader();
    renderMetrics();
    renderAllData();
  });
  $("prevMonth").addEventListener("click", () => shiftMonth(-1));
  $("nextMonth").addEventListener("click", () => shiftMonth(1));
  $("downloadCsv").addEventListener("click", downloadCsv);
}

function refreshMonthOptions() {
  const months = availableMonths();
  const previous = $("monthSelect").value;
  state.month = months.includes(previous) ? previous : months.at(-1) || monthKey(payload.as_of);
  $("monthSelect").innerHTML = months.map((key) => `<option value="${key}">${monthLabel(key)}</option>`).join("");
  $("monthSelect").value = state.month;
}

function shiftMonth(delta) {
  const months = availableMonths();
  const current = months.indexOf($("monthSelect").value);
  const next = Math.min(Math.max(current + delta, 0), months.length - 1);
  $("monthSelect").value = months[next];
  renderAllData();
}

function renderCalendar() {
  const selected = $("monthSelect").value || monthKey(payload.as_of);
  $("monthTitle").textContent = monthLabel(selected);
  const [year, month] = selected.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const records = filteredRecords(true).filter((record) => monthKey(recordDate(record)) === selected);
  const byDate = Map.groupBy ? Map.groupBy(records, (record) => recordDate(record)) : groupByDate(records);
  const cells = [];
  const today = payload.as_of;
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const dayRecords = byDate.get(key) || [];
    const muted = day.getMonth() !== month - 1 ? " muted" : "";
    const number = key === today ? `<span class="today-mark">${day.getDate()}</span>` : `<span>${day.getDate()}</span>`;
    cells.push(`<div class="day-cell${muted}">
      <div class="day-number">${number}<span>${dayRecords.length ? dayRecords.length : ""}</span></div>
      <div class="event-list">${dayRecords.map(renderEventChip).join("")}</div>
    </div>`);
  }
  $("calendarGrid").innerHTML = cells.join("");
}

function groupByDate(records) {
  const grouped = new Map();
  records.forEach((record) => {
    const key = recordDate(record);
    const rows = grouped.get(key) || [];
    rows.push(record);
    grouped.set(key, rows);
  });
  return grouped;
}

function renderEventChip(record) {
  const quoteLink = record.yahoo_url
    ? `<a href="${escapeHtml(record.yahoo_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.stock_code)} ${escapeHtml(record.company_name)}</a>`
    : `<strong>${escapeHtml(record.stock_code)} ${escapeHtml(record.company_name)}</strong>`;
  return `<div class="event-chip ${escapeHtml(record.type)}">
    <strong>${quoteLink}</strong>
    <span>${escapeHtml(record.type_label)}${record.issue_price ? `，${escapeHtml(record.issue_price)}` : ""}</span>
  </div>`;
}

function renderTable() {
  const rows = filteredRecords(false).sort((a, b) => recordDate(a).localeCompare(recordDate(b)) || a.stock_code.localeCompare(b.stock_code));
  $("rowCount").textContent = `${rows.length} 筆`;
  $("primaryDateHeader").textContent = selectedDateLabel();
  $("tableBody").innerHTML = rows.length
    ? rows
        .map(
          (record) => `<tr>
            <td>${formatDate(recordDate(record))}</td>
            <td><span class="badge ${escapeHtml(record.type)}">${escapeHtml(record.type_label)}</span></td>
            <td>${renderQuoteLink(record, record.stock_code)}</td>
            <td>${renderQuoteLink(record, record.company_name)}</td>
            <td>${escapeHtml(record.company_type)}</td>
            <td>${formatDate(record.effective_date)}</td>
            <td>${formatDate(record.received_date)}</td>
            <td>${escapeHtml(formatAmount(record.amount, record.currency))}</td>
            <td>${escapeHtml(record.issue_price ?? "")}</td>
            <td>${escapeHtml(record.underwriter)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="10" class="empty">目前篩選條件沒有案件</td></tr>`;
}

function renderQuoteLink(record, label) {
  if (!record.yahoo_url) return escapeHtml(label);
  return `<a class="quote-link" href="${escapeHtml(record.yahoo_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

function downloadCsv() {
  const rows = filteredRecords(false);
  const header = ["目前日期欄位", "目前日期", "案件", "證券代號", "公司名稱", "公司型態", "生效日期", "收文日期", "金額", "幣別", "發行價格", "承銷商"];
  const body = rows.map((record) => [
    selectedDateLabel(),
    recordDate(record),
    record.type_label,
    record.stock_code,
    record.company_name,
    record.company_type,
    record.effective_date,
    record.received_date,
    record.amount ?? "",
    record.currency,
    record.issue_price ?? "",
    record.underwriter,
  ]);
  const csv = [header, ...body].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sfb-filing-calendar-${$("monthSelect").value || "latest"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderAllData() {
  renderMetrics();
  renderCalendar();
  renderTable();
}

function init() {
  renderHeader();
  renderMetrics();
  initControls();
  renderAllData();
}

init();
