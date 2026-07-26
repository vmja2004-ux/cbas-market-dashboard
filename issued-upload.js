(function initIssuedPage(root) {
  "use strict";

  const STORAGE_KEY = "cbas-market-dashboard:issued-upload:v1";
  const IMPORTS_KEY = "cbas-market-dashboard:issued-imports:v1";
  const INITIAL = root.CB_ISSUED_DATA || { records: [], source_date: "", source_file: "" };
  const state = {
    data: loadSaved() || INITIAL,
    tab: "recent",
    search: "",
    year: "2026",
    guarantee: "all",
    broker: "all",
    month: "2026-07",
    selected: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const clean = (value) => String(value ?? "").trim();
  const code = (value) => clean(value).replace(/\.0$/, "");
  const number = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const parsed = Number.parseFloat(clean(value).replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const escapeHtml = (value) => clean(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const dateText = (value) => value ? String(value).replaceAll("-", "/") : "—";

  function isoDate(value) {
    if (typeof value === "number" && root.XLSX?.SSF) {
      const parsed = root.XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
    const match = clean(value).match(/^(\d{4})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
    return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : null;
  }

  function sourceDateFromName(fileName) {
    const match = clean(fileName).match(/(?:^|\D)(\d{3})(\d{2})(\d{2})(?:\D|$)/);
    return match ? `${Number(match[1]) + 1911}-${match[2]}-${match[3]}` : new Date().toISOString().slice(0, 10);
  }

  function hashRecord(record) {
    const source = Object.entries(record).filter(([key]) => !["source_file", "content_hash"].includes(key));
    let hash = 2166136261;
    JSON.stringify(Object.fromEntries(source)).split("").forEach((character) => {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    });
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function parseWorkbook(workbook, fileName) {
    const sheetName = workbook.SheetNames.find((name) => clean(name) === "已發行");
    if (!sheetName) throw new Error("找不到「已發行」工作表");
    const rows = root.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null });
    const header = rows[0].map(clean);
    const at = (row, label) => row[header.indexOf(label)];
    const sourceDate = sourceDateFromName(fileName);
    const records = rows.slice(1).map((row, index) => ({ row, sourceRow: index + 2 }))
      .filter(({ row }) => /^\d{4,6}$/.test(code(row[0])))
      .map(({ row, sourceRow }) => {
        const rawCode = code(at(row, "代碼"));
        const listingDate = isoDate(at(row, "掛牌日期"));
        const record = {
          record_key: rawCode.length >= 5 ? rawCode : `ECB-${rawCode}-${listingDate || sourceRow}`,
          cb_code: rawCode,
          stock_code: rawCode.slice(0, 4),
          cb_name: clean(at(row, "發行標的")) || null,
          tcri_or_guarantor: clean(at(row, "TCRI/擔保")) || null,
          issue_amount_100m: number(at(row, "額度(億元)")),
          lead_underwriter: clean(at(row, "主辦券商")) || null,
          submitted_date: isoDate(at(row, "送件日")),
          effective_date: isoDate(at(row, "生效日")),
          bookbuilding_period: clean(at(row, "詢圈期間")) || null,
          premium_rate: number(at(row, "溢價率")),
          conversion_price: number(at(row, "轉換價格")),
          listing_date: listingDate,
          option_available_date: isoDate(at(row, "可拆解日")),
          underwriting_price: number(at(row, "承銷價格")),
          years: clean(at(row, "年期")) || null,
          put_terms: clean(at(row, "賣回條件")) || null,
          source_date: sourceDate,
          source_file: fileName,
        };
        record.content_hash = hashRecord(record);
        return record;
      });
    if (!records.length) throw new Error("「已發行」工作表沒有可匯入資料");
    return { source_date: sourceDate, source_file: fileName, records };
  }

  async function parseFile(file) {
    const bytes = await file.arrayBuffer();
    return parseWorkbook(root.XLSX.read(bytes, { type: "array", cellDates: false }), file.name);
  }

  function loadSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Array.isArray(saved?.records) ? saved : null;
    } catch {
      return null;
    }
  }

  function loadImports() {
    try {
      const value = JSON.parse(localStorage.getItem(IMPORTS_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function filteredRecords() {
    const recentCutoff = "2025-01-01";
    return state.data.records.filter((record) => {
      if (state.tab === "recent" && (!record.listing_date || record.listing_date < recentCutoff)) return false;
      if (state.year !== "all" && record.listing_date?.slice(0, 4) !== state.year) return false;
      if (state.guarantee !== "all") {
        const isTcri = clean(record.tcri_or_guarantor).includes("TCRI");
        if (state.guarantee === "tcri" && !isTcri) return false;
        if (state.guarantee === "guaranteed" && isTcri) return false;
      }
      if (state.broker !== "all" && record.lead_underwriter !== state.broker) return false;
      const haystack = [record.cb_code, record.cb_name, record.lead_underwriter, record.tcri_or_guarantor].join(" ").toLowerCase();
      return !state.search || haystack.includes(state.search.toLowerCase());
    }).sort((a, b) => clean(b.listing_date).localeCompare(clean(a.listing_date)));
  }

  function setOptions(selector, entries, selected) {
    const element = $(selector);
    element.innerHTML = entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
    element.value = selected;
  }

  function renderFilters() {
    const records = state.data.records;
    const years = [...new Set(records.map((row) => row.listing_date?.slice(0, 4)).filter(Boolean))].sort().reverse();
    const brokers = [...new Set(records.map((row) => row.lead_underwriter).filter(Boolean))].sort();
    setOptions("#issuedYear", [["all", "全部年度"], ...years.map((year) => [year, `${year} 年`])], state.year);
    setOptions("#issuedGuarantee", [["all", "全部"], ["tcri", "TCRI／無擔保"], ["guaranteed", "銀行擔保"]], state.guarantee);
    setOptions("#issuedBroker", [["all", "全部券商"], ...brokers.map((broker) => [broker, broker])], state.broker);
  }

  function renderMetrics() {
    const rows = filteredRecords();
    const amount = rows.reduce((sum, row) => sum + (row.issue_amount_100m || 0), 0);
    const currentYear = rows.filter((row) => row.listing_date?.startsWith("2026")).length;
    const guaranteed = rows.filter((row) => row.tcri_or_guarantor && !row.tcri_or_guarantor.includes("TCRI")).length;
    $("#issuedMetrics").innerHTML = [
      ["符合條件", rows.length.toLocaleString("zh-TW"), `全部 ${state.data.records.length.toLocaleString("zh-TW")} 筆`],
      ["發行總額", `${amount.toLocaleString("zh-TW", { maximumFractionDigits: 1 })} 億`, "依已填額度加總"],
      ["2026 年掛牌", currentYear.toLocaleString("zh-TW"), "今年新掛牌"],
      ["銀行擔保", guaranteed.toLocaleString("zh-TW"), "非 TCRI 欄位"],
    ].map(([label, value, note]) => `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
    $("#issuedFreshness").innerHTML = `<strong>資料日 ${dateText(state.data.source_date)}</strong><span>${state.data.records.length} 筆已發行資料</span>`;
  }

  function renderTable() {
    const rows = filteredRecords();
    $("#issuedTableTitle").textContent = state.tab === "history" ? "已發行資料庫" : "近期掛牌";
    $("#issuedRowCount").textContent = `${rows.length.toLocaleString("zh-TW")} 筆`;
    $("#issuedTableHead").innerHTML = "<tr><th>CB 標的</th><th>額度（億）</th><th>TCRI／擔保</th><th>主辦券商</th><th>掛牌日</th><th>可拆解日</th><th>轉換價</th><th>承銷價</th><th>年期</th></tr>";
    $("#issuedTableBody").innerHTML = rows.length ? rows.map((row) => `
      <tr data-issued-key="${escapeHtml(row.record_key)}">
        <td><button class="issued-row-button" type="button" data-issued-key="${escapeHtml(row.record_key)}"><strong>${escapeHtml(row.cb_code)} ${escapeHtml(row.cb_name)}</strong><small>股票 ${escapeHtml(row.stock_code)}</small></button></td>
        <td>${row.issue_amount_100m ?? "—"}</td><td>${escapeHtml(row.tcri_or_guarantor || "—")}</td>
        <td>${escapeHtml(row.lead_underwriter || "—")}</td><td>${dateText(row.listing_date)}</td>
        <td>${dateText(row.option_available_date)}</td><td>${row.conversion_price ?? "—"}</td>
        <td>${row.underwriting_price ?? "—"}</td><td>${escapeHtml(row.years || "—")}</td>
      </tr>`).join("") : '<tr><td colspan="9" class="empty-state">目前沒有符合條件的資料</td></tr>';
    document.querySelectorAll(".issued-row-button").forEach((button) => button.addEventListener("click", () => {
      state.selected = state.data.records.find((row) => row.record_key === button.dataset.issuedKey);
      switchTab("detail");
    }));
  }

  function renderCalendar() {
    const [year, month] = state.month.split("-").map(Number);
    $("#issuedMonthTitle").textContent = `${year} 年 ${month} 月 · 掛牌日`;
    const firstDay = new Date(year, month - 1, 1);
    const days = new Date(year, month, 0).getDate();
    const cells = [];
    for (let offset = 0; offset < firstDay.getDay(); offset += 1) cells.push('<article class="day-cell muted"></article>');
    for (let day = 1; day <= days; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const events = filteredRecords().filter((row) => row.listing_date === date);
      cells.push(`<article class="day-cell"><span>${day}</span><div class="calendar-events">${events.map((row) =>
        `<button class="calendar-event" type="button" data-issued-key="${escapeHtml(row.record_key)}">${escapeHtml(row.cb_code)} ${escapeHtml(row.cb_name)}</button>`).join("")}</div></article>`);
    }
    $("#issuedCalendar").innerHTML = cells.join("");
    document.querySelectorAll("#issuedCalendar .calendar-event").forEach((button) => button.addEventListener("click", () => {
      state.selected = state.data.records.find((row) => row.record_key === button.dataset.issuedKey);
      switchTab("detail");
    }));
  }

  function renderDetail() {
    const row = state.selected || filteredRecords()[0];
    if (!row) {
      $("#issuedDetailTitle").textContent = "請從表格選擇一檔 CB";
      $("#issuedTimeline").innerHTML = "";
      return;
    }
    $("#issuedDetailTitle").textContent = `${row.cb_code} ${row.cb_name}`;
    $("#issuedTimeline").innerHTML = [
      ["送件", row.submitted_date], ["生效", row.effective_date],
      ["掛牌", row.listing_date], ["可拆解", row.option_available_date],
    ].map(([label, date]) => `<article><span>${label}</span><strong>${dateText(date)}</strong></article>`).join("") +
      `<div class="issued-terms"><strong>發行條件</strong><span>額度 ${row.issue_amount_100m ?? "—"} 億</span><span>轉換價 ${row.conversion_price ?? "—"}</span><span>承銷價 ${row.underwriting_price ?? "—"}</span><span>${escapeHtml(row.put_terms || "無賣回條件資料")}</span></div>`;
  }

  function renderImports() {
    const imports = loadImports();
    $("#issuedImportsBody").innerHTML = imports.length ? imports.map((item) => `<tr>
      <td>${new Date(item.uploaded_at).toLocaleString("zh-TW")}</td><td>${dateText(item.source_date)}</td>
      <td>${escapeHtml(item.source_file)}</td><td>${item.total}</td><td>${item.added}</td><td>${item.updated}</td><td>${item.unchanged}</td>
    </tr>`).join("") : '<tr><td colspan="7" class="empty-state">尚無本機匯入紀錄</td></tr>';
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll("[data-issued-tab]").forEach((button) => button.classList.toggle("active", button.dataset.issuedTab === tab));
    $("#issuedRecentView").hidden = tab !== "recent";
    $("#issuedDetailView").hidden = tab !== "detail";
    $("#issuedImportsView").hidden = tab !== "imports";
    $("#issuedTableCard").hidden = tab === "detail" || tab === "imports";
    if (tab === "history") state.year = "all";
    if (tab === "recent" && state.year === "all") state.year = "2026";
    renderFilters();
    render();
  }

  function render() {
    renderMetrics();
    if (state.tab === "recent") renderCalendar();
    if (state.tab === "recent" || state.tab === "history") renderTable();
    if (state.tab === "detail") renderDetail();
    if (state.tab === "imports") renderImports();
  }

  async function importFile(file) {
    const status = $("#issuedUploadStatus");
    status.textContent = `正在解析 ${file.name}…`;
    try {
      const payload = await parseFile(file);
      const previous = new Map(state.data.records.map((row) => [row.record_key, row.content_hash]));
      const added = payload.records.filter((row) => !previous.has(row.record_key)).length;
      const updated = payload.records.filter((row) => previous.has(row.record_key) && previous.get(row.record_key) !== row.content_hash).length;
      const unchanged = payload.records.length - added - updated;
      const entry = { uploaded_at: new Date().toISOString(), source_date: payload.source_date, source_file: payload.source_file, total: payload.records.length, added, updated, unchanged };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(IMPORTS_KEY, JSON.stringify([entry, ...loadImports()].slice(0, 30)));
      state.data = payload;
      renderFilters();
      render();
      status.textContent = `解析完成：${payload.records.length} 筆；新增 ${added}、更新 ${updated}、未變更 ${unchanged}。`;
      if (root.CBSheetBackend?.configured) {
        status.textContent += " 正在同步 Sheet…";
        const result = await root.CBSheetBackend.save({ kind: "issued", ...payload });
        status.textContent = `Sheet 同步完成：新增 ${result.added ?? added}、更新 ${result.updated ?? updated}、未變更 ${result.unchanged ?? unchanged}。`;
      } else {
        status.textContent += " 網站已更新；Sheet 同步端點待啟用。";
      }
    } catch (error) {
      status.textContent = `匯入失敗：${error.message}`;
    }
  }

  function downloadCsv() {
    const fields = ["cb_code", "cb_name", "issue_amount_100m", "tcri_or_guarantor", "lead_underwriter", "listing_date", "option_available_date", "conversion_price", "underwriting_price", "years", "put_terms"];
    const labels = ["CB代碼", "發行標的", "額度(億元)", "TCRI/擔保", "主辦券商", "掛牌日", "可拆解日", "轉換價格", "承銷價格", "年期", "賣回條件"];
    const quote = (value) => `"${clean(value).replaceAll('"', '""')}"`;
    const csv = "\ufeff" + [labels, ...filteredRecords().map((row) => fields.map((field) => row[field] ?? ""))]
      .map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `cb-issued-${state.data.source_date || "latest"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  document.querySelectorAll("[data-issued-tab]").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.issuedTab)));
  $("#issuedSearch").addEventListener("input", (event) => { state.search = event.target.value.trim(); render(); });
  $("#issuedYear").addEventListener("change", (event) => { state.year = event.target.value; render(); });
  $("#issuedGuarantee").addEventListener("change", (event) => { state.guarantee = event.target.value; render(); });
  $("#issuedBroker").addEventListener("change", (event) => { state.broker = event.target.value; render(); });
  $("#issuedResetFilters").addEventListener("click", () => {
    state.search = ""; state.year = state.tab === "recent" ? "2026" : "all"; state.guarantee = "all"; state.broker = "all";
    $("#issuedSearch").value = ""; renderFilters(); render();
  });
  $("#issuedPrevMonth").addEventListener("click", () => {
    const date = new Date(`${state.month}-01T00:00:00`); date.setMonth(date.getMonth() - 1); state.month = date.toISOString().slice(0, 7); renderCalendar();
  });
  $("#issuedNextMonth").addEventListener("click", () => {
    const date = new Date(`${state.month}-01T00:00:00`); date.setMonth(date.getMonth() + 1); state.month = date.toISOString().slice(0, 7); renderCalendar();
  });
  $("#issuedDownloadCsv").addEventListener("click", downloadCsv);
  $("#issuedFile").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0]));
  ["dragenter", "dragover"].forEach((name) => $("#issuedDrop").addEventListener(name, (event) => { event.preventDefault(); $("#issuedDrop").classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((name) => $("#issuedDrop").addEventListener(name, (event) => { event.preventDefault(); $("#issuedDrop").classList.remove("dragging"); }));
  $("#issuedDrop").addEventListener("drop", (event) => event.dataTransfer.files[0] && importFile(event.dataTransfer.files[0]));

  root.CBIssuedUpload = { parseWorkbook };
  renderFilters();
  render();
}(typeof globalThis !== "undefined" ? globalThis : window));
