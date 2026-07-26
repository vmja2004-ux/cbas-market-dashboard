(function initPrimaryUpload(root, factory) {
  const api = factory(
    root.XLSX || (typeof module === "object" && module.exports ? require("@e965/xlsx") : null),
    root,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CBPrimaryUpload = api;
}(typeof globalThis !== "undefined" ? globalThis : window, function primaryUploadFactory(XLSX, root) {
  "use strict";

  const STORAGE_KEY = "cbas-market-dashboard:primary-upload:v1";
  const HISTORY_KEY = "cbas-market-dashboard:primary-upload-history:v1";
  const ISSUE_COLUMNS = [
    "cb_code", "stock_code", "cb_name", "issue_type", "years", "issue_amount_100m",
    "tcri_or_guarantor", "lead_underwriter", "bookbuilding_period", "listing_date",
    "op_effective_date", "conversion_price", "submitted_date", "premium_rate",
    "option_available_date", "underwriting_price", "put_terms", "capital_100m",
    "stock_price", "volatility_60d", "note", "source_date",
  ];
  const BOARD_COLUMNS = [
    "cb_code", "stock_code", "cb_name", "issue_type", "years", "issue_amount_100m",
    "tcri_or_guarantor", "lead_underwriter", "board_date", "capital_100m", "note", "source_date",
  ];

  const clean = (value) => String(value ?? "").replace(/\s+/g, "").trim();
  const code = (value) => String(value ?? "").trim().replace(/\.0$/, "");
  const number = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const parsed = Number.parseFloat(String(value ?? "").replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

  function isoDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && XLSX?.SSF) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
    const source = String(value ?? "").trim();
    if (!source || /未定|無額度|額度有限/.test(source)) return null;
    const roc = source.match(/^(\d{2,3})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
    if (roc && Number(roc[1]) < 1911) {
      return `${Number(roc[1]) + 1911}-${roc[2].padStart(2, "0")}-${roc[3].padStart(2, "0")}`;
    }
    const ad = source.match(/^(\d{4})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
    return ad ? `${ad[1]}-${ad[2].padStart(2, "0")}-${ad[3].padStart(2, "0")}` : null;
  }

  function sourceDateFromName(fileName) {
    const match = String(fileName || "").match(/(?:^|\D)(\d{3})(\d{2})(\d{2})(?:\D|$)/);
    return match ? `${Number(match[1]) + 1911}-${match[2]}-${match[3]}` : "";
  }

  function readRows(workbook) {
    const sheetName = workbook.SheetNames.find((name) => clean(name) === "發行案件");
    if (!sheetName) throw new Error("找不到「發行案件」工作表");
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, raw: true, defval: null, blankrows: true,
    });
  }

  function headerIndex(rows, labels) {
    return rows.findIndex((row) => {
      const values = row.map(clean);
      return labels.every((label) => values.some((value) => value.includes(label)));
    });
  }

  function columnIndex(header, labels) {
    const list = Array.isArray(labels) ? labels : [labels];
    return header.findIndex((cell) => list.some((label) => clean(cell).includes(label)));
  }

  function valueAt(row, header, labels) {
    const index = columnIndex(header, labels);
    return index >= 0 ? row[index] : null;
  }

  function valueAtLast(row, header, label) {
    let index = -1;
    header.forEach((cell, cellIndex) => {
      if (clean(cell).includes(label)) index = cellIndex;
    });
    return index >= 0 ? row[index] : null;
  }

  function validCbCode(value) {
    return /^\d{5,6}$/.test(code(value));
  }

  function parseWorkbook(workbook, fileName) {
    if (!XLSX) throw new Error("Excel 解析元件尚未載入");
    const rows = readRows(workbook);
    const issueHeaderIndex = headerIndex(rows, ["標的代號", "發行標的", "詢圈/投標期間"]);
    const boardHeaderIndex = headerIndex(rows, ["CB代碼", "發行標的", "董事會通過"]);
    if (issueHeaderIndex < 0) throw new Error("找不到「元大證債券部CB初級案件彙整表」表頭");
    if (boardHeaderIndex < 0) throw new Error("找不到「董事會決議公告」表頭");

    const sourceDate = sourceDateFromName(fileName);
    const issueHeader = rows[issueHeaderIndex];
    const issueRows = rows.slice(issueHeaderIndex + 1, boardHeaderIndex - 1)
      .filter((row) => validCbCode(valueAt(row, issueHeader, "標的代號")))
      .map((row) => {
        const cbCode = code(valueAt(row, issueHeader, "標的代號"));
        return {
          cb_code: cbCode,
          stock_code: cbCode.slice(0, 4),
          cb_name: String(valueAt(row, issueHeader, "發行標的") ?? "").trim(),
          issue_type: String(valueAt(row, issueHeader, "詢圈/競拍") ?? "").trim(),
          years: String(valueAt(row, issueHeader, "年期") ?? "").trim() || null,
          issue_amount_100m: number(valueAt(row, issueHeader, "發行量")),
          tcri_or_guarantor: String(valueAt(row, issueHeader, "TCRI/擔保") ?? "").trim() || null,
          lead_underwriter: String(valueAt(row, issueHeader, "主辦券商") ?? "").trim() || null,
          bookbuilding_period: String(valueAt(row, issueHeader, "詢圈/投標期間") ?? "").trim() || null,
          listing_date: isoDate(valueAt(row, issueHeader, "掛牌日")),
          op_effective_date: isoDate(valueAt(row, issueHeader, "生效日")),
          conversion_price: number(valueAt(row, issueHeader, "轉換價")),
          submitted_date: isoDate(valueAt(row, issueHeader, "送件日")),
          premium_rate: valueAt(row, issueHeader, "溢價率"),
          option_available_date: isoDate(valueAt(row, issueHeader, "可拆解選擇權日")),
          underwriting_price: valueAt(row, issueHeader, "承銷價格"),
          put_terms: String(valueAt(row, issueHeader, "賣回條件") ?? "").trim() || null,
          capital_100m: number(valueAt(row, issueHeader, "股本")),
          stock_price: number(valueAt(row, issueHeader, "股價")),
          volatility_60d: number(valueAt(row, issueHeader, "60天波動率")),
          note: String(valueAt(row, issueHeader, "備註") ?? "").trim() || null,
          source_date: sourceDate,
        };
      });

    const boardHeader = rows[boardHeaderIndex];
    const boardRows = rows.slice(boardHeaderIndex + 1)
      .filter((row) => validCbCode(valueAtLast(row, boardHeader, "CB代碼")))
      .map((row) => {
        const cbCode = code(valueAtLast(row, boardHeader, "CB代碼"));
        return {
          cb_code: cbCode,
          stock_code: cbCode.slice(0, 4),
          cb_name: String(valueAt(row, boardHeader, "發行標的") ?? "").trim(),
          issue_type: String(valueAt(row, boardHeader, ["詢圈/競價", "詢圈/競拍"]) ?? "").trim(),
          years: String(valueAt(row, boardHeader, ["到期日", "年期"]) ?? "").trim() || null,
          issue_amount_100m: number(valueAt(row, boardHeader, "發行量")),
          tcri_or_guarantor: String(valueAt(row, boardHeader, "TCRI/擔保") ?? "").trim() || null,
          lead_underwriter: String(valueAt(row, boardHeader, "主辦券商") ?? "").trim() || null,
          board_date: isoDate(valueAt(row, boardHeader, "董事會通過")),
          capital_100m: number(valueAt(row, boardHeader, "股本")),
          note: String(valueAt(row, boardHeader, "備註") ?? "").trim() || null,
          source_date: sourceDate,
        };
      });

    if (!issueRows.length && !boardRows.length) throw new Error("檔案內沒有可匯入的初級市場資料");
    return {
      schema_version: 1,
      saved_at: new Date().toISOString(),
      source_file: fileName,
      source_date: sourceDate,
      primary_market: issueRows,
      board_resolutions: boardRows,
    };
  }

  async function parseFile(file) {
    const bytes = await file.arrayBuffer();
    return parseWorkbook(XLSX.read(bytes, { type: "array", cellDates: false }), file.name);
  }

  function loadSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return value?.schema_version === 1 && Array.isArray(value.primary_market) ? value : null;
    } catch {
      return null;
    }
  }

  function loadHistory() {
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function save(payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const history = [{
      saved_at: payload.saved_at,
      source_date: payload.source_date,
      source_file: payload.source_file,
      issue_count: payload.primary_market.length,
      board_count: payload.board_resolutions.length,
    }, ...loadHistory()].slice(0, 20);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function applySavedToData(payload) {
    if (!payload || !root.CBAS_DATA) return;
    root.CBAS_DATA.latest_source_date = payload.source_date || root.CBAS_DATA.latest_source_date;
    root.CBAS_DATA.primary_market = {
      columns: ISSUE_COLUMNS,
      rows: payload.primary_market.map((row) => ISSUE_COLUMNS.map((column) => row[column] ?? null)),
    };
  }

  const savedAtStartup = typeof localStorage !== "undefined" ? loadSaved() : null;
  applySavedToData(savedAtStartup);

  function formatDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.replaceAll("-", "/") : "—";
  }

  function monthKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.slice(0, 7) : "";
  }

  function monthLabel(value) {
    if (!/^\d{4}-\d{2}$/.test(value || "")) return "沒有日期";
    const [year, month] = value.split("-");
    return `${year} 年 ${Number(month)} 月`;
  }

  function renderBoard(payload) {
    const rows = payload?.board_resolutions || [];
    const search = document.getElementById("boardSearchInput");
    const typeSelect = document.getElementById("boardTypeSelect");
    const monthSelect = document.getElementById("boardMonthSelect");
    const types = [...new Set(rows.map((row) => row.issue_type).filter(Boolean))].sort();
    const months = [...new Set(rows.map((row) => monthKey(row.board_date)).filter(Boolean))].sort();
    typeSelect.innerHTML = `<option value="">全部類型</option>${types.map((value) => `<option>${escapeHtml(value)}</option>`).join("")}`;
    monthSelect.innerHTML = `<option value="">全部月份</option>${months.map((value) => `<option value="${value}">${monthLabel(value)}</option>`).join("")}`;
    let selectedMonth = months.at(-1) || "";
    monthSelect.value = selectedMonth;

    const filtered = (ignoreMonth = false) => rows.filter((row) => {
      const keyword = search.value.trim().toLowerCase();
      if (typeSelect.value && row.issue_type !== typeSelect.value) return false;
      if (!ignoreMonth && selectedMonth && monthKey(row.board_date) !== selectedMonth) return false;
      return !keyword || [row.cb_code, row.cb_name, row.lead_underwriter, row.tcri_or_guarantor]
        .join(" ").toLowerCase().includes(keyword);
    });

    function renderMetrics() {
      const all = filtered(true);
      const amount = all.reduce((sum, row) => sum + (Number.isFinite(row.issue_amount_100m) ? row.issue_amount_100m : 0), 0);
      const missingLead = all.filter((row) => !row.lead_underwriter || row.lead_underwriter === "未定").length;
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const recent = all.filter((row) => {
        if (!row.board_date) return false;
        const days = Math.round((now - new Date(`${row.board_date}T00:00:00`)) / 86400000);
        return days >= 0 && days <= 30;
      }).length;
      document.getElementById("boardMetrics").innerHTML = [
        ["董事會決議", all.length, "潛在發行案件"],
        ["潛在發行總額", `${amount.toLocaleString("zh-TW")} 億`, "依已填發行量加總"],
        ["近 30 日新增", recent, "依董事會通過日"],
        ["主辦券商未定", missingLead, "待後續公告補齊"],
      ].map(([label, value, note]) => `<article class="metric"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
    }

    function renderCalendar() {
      document.getElementById("boardMonthTitle").textContent = selectedMonth ? `${monthLabel(selectedMonth)} · 董事會通過日` : "全部月份";
      if (!selectedMonth) {
        document.getElementById("boardCalendarGrid").innerHTML = `<div class="empty">請選擇月份查看行事曆</div>`;
        return;
      }
      const [year, month] = selectedMonth.split("-").map(Number);
      const first = new Date(year, month - 1, 1);
      const start = new Date(first); start.setDate(1 - first.getDay());
      const grouped = new Map();
      filtered(true).filter((row) => monthKey(row.board_date) === selectedMonth).forEach((row) => {
        grouped.set(row.board_date, [...(grouped.get(row.board_date) || []), row]);
      });
      const cells = [];
      for (let index = 0; index < 42; index += 1) {
        const date = new Date(start); date.setDate(start.getDate() + index);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const items = grouped.get(key) || [];
        cells.push(`<article class="day-cell${date.getMonth() !== month - 1 ? " muted" : ""}">
          <div class="day-number"><span>${date.getDate()}</span><span class="day-count">${items.length ? `${items.length} 件` : ""}</span></div>
          <div class="calendar-events">${items.slice(0, 3).map((row) =>
            `<div class="calendar-event board" title="${escapeHtml(`${row.cb_code} ${row.cb_name}`)}">${escapeHtml(`${row.cb_code} ${row.cb_name}`)}</div>`
          ).join("")}${items.length > 3 ? `<span class="calendar-more">另有 ${items.length - 3} 件</span>` : ""}</div>
        </article>`);
      }
      document.getElementById("boardCalendarGrid").innerHTML = cells.join("");
    }

    function renderTable() {
      const result = filtered(false).sort((a, b) => String(b.board_date || "").localeCompare(String(a.board_date || "")));
      document.getElementById("boardRowCount").textContent = `${result.length} 筆`;
      document.getElementById("boardTableHead").innerHTML = `<tr><th>CB 案件</th><th>方式</th><th>發行量（億）</th><th>TCRI／擔保</th><th>主辦券商</th><th>年期</th><th>董事會通過</th><th>備註</th></tr>`;
      document.getElementById("boardTableBody").innerHTML = result.length ? result.map((row) => `<tr>
        <td class="align-left"><div class="code-cell"><strong>${escapeHtml(`${row.cb_code} ${row.cb_name}`)}</strong><span>股票 ${escapeHtml(row.stock_code)}</span></div></td>
        <td><span class="status-badge">${escapeHtml(row.issue_type || "—")}</span></td>
        <td>${Number.isFinite(row.issue_amount_100m) ? row.issue_amount_100m : "—"}</td>
        <td>${escapeHtml(row.tcri_or_guarantor || "—")}</td><td>${escapeHtml(row.lead_underwriter || "—")}</td>
        <td>${escapeHtml(row.years || "—")}</td><td>${formatDate(row.board_date)}</td><td>${escapeHtml(row.note || "—")}</td>
      </tr>`).join("") : `<tr><td colspan="8" class="empty">目前沒有符合條件的資料</td></tr>`;
    }

    const render = () => { renderMetrics(); renderCalendar(); renderTable(); };
    search.addEventListener("input", render);
    typeSelect.addEventListener("change", render);
    monthSelect.addEventListener("change", () => { selectedMonth = monthSelect.value; render(); });
    document.getElementById("resetBoardFilters").addEventListener("click", () => {
      search.value = ""; typeSelect.value = ""; selectedMonth = months.at(-1) || ""; monthSelect.value = selectedMonth; render();
    });
    document.getElementById("boardPrevMonth").addEventListener("click", () => {
      const index = months.indexOf(selectedMonth); if (index > 0) { selectedMonth = months[index - 1]; monthSelect.value = selectedMonth; render(); }
    });
    document.getElementById("boardNextMonth").addEventListener("click", () => {
      const index = months.indexOf(selectedMonth); if (index >= 0 && index < months.length - 1) { selectedMonth = months[index + 1]; monthSelect.value = selectedMonth; render(); }
    });
    render();
  }

  function renderHistory() {
    const history = loadHistory();
    document.getElementById("primaryHistoryBody").innerHTML = history.length ? history.map((row) => `<tr>
      <td>${escapeHtml(new Date(row.saved_at).toLocaleString("zh-TW"))}</td><td>${formatDate(row.source_date)}</td>
      <td class="align-left">${escapeHtml(row.source_file)}</td><td>${row.issue_count}</td><td>${row.board_count}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty">尚無匯入紀錄</td></tr>`;
  }

  function csvDownload(filename, rows) {
    const columns = BOARD_COLUMNS;
    const csv = [columns, ...rows.map((row) => columns.map((key) => row[key] ?? ""))]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }

  function mount() {
    const input = document.getElementById("primaryFile");
    if (!input) return;
    const drop = document.getElementById("primaryDrop");
    const status = document.getElementById("primaryUploadStatus");
    const clearButton = document.getElementById("clearPrimaryUpload");
    const payload = loadSaved() || { primary_market: [], board_resolutions: [] };
    let activeTab = "issues";

    const show = (message, state = "") => {
      status.className = `upload-status ${state}`.trim();
      status.textContent = message;
    };
    const updateCounts = (value) => {
      document.getElementById("issueTabCount").textContent = value.primary_market?.length ? `(${value.primary_market.length})` : "";
      document.getElementById("boardTabCount").textContent = value.board_resolutions?.length ? `(${value.board_resolutions.length})` : "";
    };
    const switchTab = (tab) => {
      activeTab = tab;
      document.querySelectorAll("[data-primary-tab]").forEach((button) => button.classList.toggle("active", button.dataset.primaryTab === tab));
      document.getElementById("primaryIssueView").hidden = tab !== "issues";
      document.getElementById("primaryBoardView").hidden = tab !== "board";
      document.getElementById("primaryHistoryView").hidden = tab !== "history";
      document.getElementById("downloadCsv").textContent = tab === "history" ? "匯入紀錄" : "匯出目前結果";
    };
    document.querySelectorAll("[data-primary-tab]").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.primaryTab)));
    document.getElementById("downloadCsv").addEventListener("click", (event) => {
      if (activeTab === "board") {
        event.stopImmediatePropagation();
        csvDownload(`cb-board-${payload.source_date || "latest"}.csv`, payload.board_resolutions || []);
      } else if (activeTab === "history") {
        event.stopImmediatePropagation();
        switchTab("history");
      }
    });

    async function handle(fileList) {
      const file = [...fileList][0];
      if (!file) return;
      input.disabled = true;
      show("正在辨識發行案件與董事會決議兩個區塊…", "loading");
      try {
        const value = await parseFile(file);
        save(value);
        show(`匯入完成：發行案件 ${value.primary_market.length} 筆、董事會決議 ${value.board_resolutions.length} 筆；資料日 ${value.source_date || "未辨識"}。`, "success");
        window.setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        show(error.message || "檔案解析失敗", "error");
      } finally {
        input.disabled = false;
        input.value = "";
      }
    }
    input.addEventListener("change", () => handle(input.files));
    ["dragenter", "dragover"].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault(); drop.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault(); drop.classList.remove("dragging");
    }));
    drop.addEventListener("drop", (event) => handle(event.dataTransfer.files));
    clearButton.addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    });

    if (savedAtStartup) {
      clearButton.hidden = false;
      show(`目前使用 ${savedAtStartup.source_date || "未標日期"} 的上傳資料：發行案件 ${savedAtStartup.primary_market.length} 筆、董事會決議 ${savedAtStartup.board_resolutions.length} 筆。`, "success");
    }
    updateCounts(payload);
    renderBoard(payload);
    renderHistory();
    switchTab("issues");
  }

  if (typeof document !== "undefined") mount();
  return { BOARD_COLUMNS, HISTORY_KEY, ISSUE_COLUMNS, STORAGE_KEY, isoDate, parseFile, parseWorkbook, sourceDateFromName };
}));
