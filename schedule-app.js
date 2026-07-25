const data = window.CBAS_DATA || { generated_at: "", latest_source_date: "", primary_market: [], events: [] };

function unpackDataset(dataset) {
  if (Array.isArray(dataset)) return dataset;
  if (!dataset?.columns || !dataset?.rows) return [];
  return dataset.rows.map((row) => Object.fromEntries(dataset.columns.map((column, index) => [column, row[index]])));
}

function eventIdentity(row) {
  return [
    row.cb_code || "",
    row.stock_code || "",
    row.name || "",
    row.event_type || "",
    row.redeem_date || "",
    row.maturity_date || "",
  ].join("|");
}

function pickDate(values, { after = "", latest = false } = {}) {
  const dates = [...new Set(values.filter(validDate))].sort();
  if (!dates.length) return "";
  const eligible = after ? dates.filter((value) => value >= after) : dates;
  const candidates = eligible.length ? eligible : dates;
  return latest ? candidates[candidates.length - 1] : candidates[0];
}

function consolidateEvents(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = eventIdentity(row);
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return [...groups.values()].map((group) => {
    const merged = { ...group[0] };
    const values = (key) => group.map((row) => row[key]).filter((value) => value !== null && value !== undefined && value !== "");

    merged.next_put_date = pickDate(values("next_put_date"), { after: merged.redeem_date || "" });
    merged.maturity_date = pickDate(values("maturity_date"), { after: merged.redeem_date || "", latest: true });
    merged.source_date = pickDate(values("source_date"), { latest: true });
    merged._merged_count = group.length;
    return merged;
  });
}

const page = document.body.dataset.page;
const config = page === "primary"
  ? {
      title: "初級市場",
      rows: unpackDataset(data.primary_market),
      dateFields: [["listing_date", "掛牌日"], ["op_effective_date", "OP 生效日"]],
      typeKey: "issue_type",
      searchKeys: ["cb_code", "stock_code", "cb_name", "lead_underwriter", "tcri_or_guarantor"],
      columns: [
        ["cb_code", "CB 代碼"], ["cb_name", "名稱"], ["issue_type", "類型"],
        ["issue_amount_100m", "發行量（億）"], ["tcri_or_guarantor", "TCRI／擔保"],
        ["lead_underwriter", "主辦券商"], ["bookbuilding_period", "詢圈／投標"],
        ["listing_date", "掛牌日"], ["op_effective_date", "OP 生效日"],
      ],
    }
  : {
      title: "到期贖回",
      rows: consolidateEvents(unpackDataset(data.events)),
      dateFields: [["redeem_date", "贖回／終止日"], ["next_put_date", "賣回日"], ["maturity_date", "到期日"]],
      typeKey: "event_type",
      searchKeys: ["stock_code", "cb_code", "name", "event_type"],
      columns: [
        ["stock_code", "股票代碼"], ["cb_code", "CB 代碼"], ["name", "名稱"],
        ["event_type", "狀態"], ["redeem_date", "贖回／終止日"],
        ["next_put_date", "賣回日"], ["maturity_date", "到期日"],
      ],
    };

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function dateField() {
  return $("dateFieldSelect").value || config.dateFields[0][0];
}

function dateLabel() {
  return config.dateFields.find(([key]) => key === dateField())?.[1] || "日期";
}

function monthKey(value) {
  return validDate(value) ? value.slice(0, 7) : "";
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return `${year} 年 ${month} 月`;
}

function monthSerial(key) {
  const [year, month] = key.split("-").map(Number);
  return year * 12 + month;
}

function availableMonths() {
  return [...new Set(config.rows.map((row) => monthKey(row[dateField()])).filter(Boolean))].sort();
}

function closestMonth(months) {
  if (!months.length) return "";
  const now = new Date();
  const current = now.getFullYear() * 12 + now.getMonth() + 1;
  return months.reduce((best, month) =>
    Math.abs(monthSerial(month) - current) < Math.abs(monthSerial(best) - current) ? month : best
  , months[0]);
}

function refreshMonthOptions() {
  const months = availableMonths();
  const previous = $("monthSelect").value;
  const sourceMonth = data.latest_source_date?.slice(0, 7);
  const selected = months.includes(previous) ? previous : (months.includes(sourceMonth) ? sourceMonth : closestMonth(months));
  $("monthSelect").innerHTML = months.map((key) => `<option value="${key}">${monthLabel(key)}</option>`).join("");
  $("monthSelect").value = selected;
}

function filteredRows(ignoreMonth = false) {
  const search = $("searchInput").value.trim().toLowerCase();
  const type = $("typeSelect").value;
  const month = $("monthSelect").value;
  return config.rows
    .filter((row) => !type || String(row[config.typeKey] || "") === type)
    .filter((row) => ignoreMonth || !month || monthKey(row[dateField()]) === month)
    .filter((row) => !search || config.searchKeys.some((key) => String(row[key] || "").toLowerCase().includes(search)));
}

function renderHeader() {
  const updated = data.generated_at ? new Date(data.generated_at).toLocaleString("zh-TW", { hour12: false }) : "-";
  const consolidation = page === "redemption" ? "，同一檔 CB 的相同事件已整合" : "";
  $("subtitle").textContent = `依 ${dateLabel()} 顯示，資料來源日 ${data.latest_source_date || "-"}，更新時間 ${updated}${consolidation}`;
}

function renderMetrics() {
  const all = filteredRows(true);
  const dated = all.filter((row) => validDate(row[dateField()]));
  const types = new Set(all.map((row) => row[config.typeKey]).filter(Boolean));
  const monthRows = filteredRows(false);
  const rows = [
    [page === "redemption" ? "整合後事件" : "全部資料", all.length],
    ["有日期資料", dated.length],
    ["事件／案件類型", types.size],
    ["目前月份", monthRows.length],
  ];
  $("metrics").innerHTML = rows.map(([label, value]) =>
    `<div class="metric"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`
  ).join("");
}

function renderCalendar() {
  const selected = $("monthSelect").value;
  $("monthTitle").textContent = selected ? `${monthLabel(selected)}｜${dateLabel()}` : "沒有可用日期";
  if (!selected) {
    $("calendarGrid").innerHTML = `<div class="empty">目前沒有可呈現的日期資料</div>`;
    return;
  }
  const [year, month] = selected.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const records = filteredRows(true).filter((row) => monthKey(row[dateField()]) === selected);
  const grouped = new Map();
  records.forEach((row) => {
    const key = row[dateField()];
    grouped.set(key, [...(grouped.get(key) || []), row]);
  });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const cells = [];
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const items = grouped.get(key) || [];
    cells.push(`<div class="day-cell${day.getMonth() !== month - 1 ? " muted" : ""}">
      <div class="day-number">${key === todayKey ? `<span class="today-mark">${day.getDate()}</span>` : `<span>${day.getDate()}</span>`}<span>${items.length || ""}</span></div>
      <div class="event-list">${items.map(renderChip).join("")}</div>
    </div>`);
  }
  $("calendarGrid").innerHTML = cells.join("");
}

function renderChip(row) {
  const name = page === "primary"
    ? `${row.cb_code || ""} ${row.cb_name || ""}`
    : `${row.cb_code || row.stock_code || ""} ${row.name || ""}`;
  const detail = page === "primary" ? `${row.issue_type || ""}｜${row.lead_underwriter || ""}` : row.event_type || "";
  const className = page === "primary" ? "primary" : eventClass(row.event_type);
  return `<div class="event-chip ${className}"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(detail)}</span></div>`;
}

function eventClass(type) {
  if (String(type).includes("贖回")) return "redeem";
  if (String(type).includes("賣回")) return "put";
  if (String(type).includes("到期")) return "maturity";
  return "";
}

function renderTable() {
  const rows = filteredRows(false).sort((a, b) =>
    String(a[dateField()] || "").localeCompare(String(b[dateField()] || "")) ||
    String(a.cb_code || a.stock_code || "").localeCompare(String(b.cb_code || b.stock_code || ""), "zh-TW", { numeric: true })
  );
  const visibleColumns = config.columns.filter(([key]) => key !== dateField());
  $("tableTitle").textContent = `${config.title}清單｜${dateLabel()}`;
  $("rowCount").textContent = `${rows.length} 筆`;
  $("tableHead").innerHTML = `<tr><th>${dateLabel()}</th>${visibleColumns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
  $("tableBody").innerHTML = rows.length
    ? rows.map((row) => `<tr><td>${escapeHtml(row[dateField()] || "")}</td>${visibleColumns.map(([key]) =>
        `<td>${key === config.typeKey ? `<span class="badge">${escapeHtml(row[key] || "")}</span>` : escapeHtml(row[key] ?? "")}</td>`
      ).join("")}</tr>`).join("")
    : `<tr><td colspan="${visibleColumns.length + 1}" class="empty">目前篩選條件沒有資料</td></tr>`;
}

function downloadCsv() {
  const rows = filteredRows(false);
  const columns = [[dateField(), dateLabel()], ...config.columns.filter(([key]) => key !== dateField())];
  const csv = [
    columns.map(([, label]) => label),
    ...rows.map((row) => columns.map(([key]) => row[key] ?? "")),
  ].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cbas-${page}-${$("monthSelect").value || "latest"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderHeader();
  renderMetrics();
  renderCalendar();
  renderTable();
}

function shiftMonth(delta) {
  const options = [...$("monthSelect").options];
  if (!options.length) return;
  const next = Math.max(0, Math.min($("monthSelect").selectedIndex + delta, options.length - 1));
  $("monthSelect").selectedIndex = next;
  renderAll();
}

function init() {
  $("dateFieldSelect").innerHTML = config.dateFields.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  const types = [...new Set(config.rows.map((row) => row[config.typeKey]).filter(Boolean))].sort();
  $("typeSelect").innerHTML = `<option value="">全部</option>` +
    types.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  refreshMonthOptions();
  ["searchInput", "typeSelect", "monthSelect"].forEach((id) => $(id).addEventListener("input", renderAll));
  $("dateFieldSelect").addEventListener("input", () => { refreshMonthOptions(); renderAll(); });
  $("prevMonth").addEventListener("click", () => shiftMonth(-1));
  $("nextMonth").addEventListener("click", () => shiftMonth(1));
  $("downloadCsv").addEventListener("click", downloadCsv);
  renderAll();
}

init();
