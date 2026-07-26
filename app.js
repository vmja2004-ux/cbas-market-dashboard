"use strict";

const data = window.CBAS_DATA || {
  generated_at: "", latest_source_date: "", source_files: [], quotes: [], primary_market: [], events: [], warnings: [],
};

const page = document.body.dataset.page;
const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 2 });
const today = new Date();
today.setHours(0, 0, 0, 0);

function unpack(dataset) {
  if (Array.isArray(dataset)) return dataset;
  if (!dataset?.columns || !Array.isArray(dataset.rows)) return [];
  return dataset.rows.map((row) => Object.fromEntries(dataset.columns.map((column, index) => [column, row[index]])));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function parseDate(value) {
  if (!isDate(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysFromToday(value) {
  const date = parseDate(value);
  return date ? Math.round((date - today) / 86400000) : null;
}

function formatDate(value) {
  if (!isDate(value)) return value || "—";
  const [year, month, day] = value.split("-");
  return `${year}/${month}/${day}`;
}

function formatNumber(value, fallback = "—") {
  return Number.isFinite(value) ? nf.format(value) : fallback;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${nf.format(value * 100)}%` : "—";
}

function sourceName(sourceId) {
  return data.source_files?.[sourceId]?.name || "";
}

function brokerName(sourceId) {
  const source = data.source_files?.[sourceId] || {};
  if (["元大", "富邦", "群益"].includes(source.broker)) return source.broker;
  const name = source.name || "";
  if (name.includes("元大")) return "元大";
  if (name.includes("富邦")) return "富邦";
  if (name.includes("群益")) return "群益";
  return "其他";
}

function renderFreshness() {
  const sourceDate = parseDate(data.latest_source_date);
  const staleDays = sourceDate ? Math.max(0, Math.round((today - sourceDate) / 86400000)) : null;
  const staleClass = staleDays !== null && staleDays > 7 ? "stale" : "";
  $("freshness").innerHTML = `<strong class="${staleClass}">資料日 ${escapeHtml(data.latest_source_date || "未提供")}</strong>
    <span>${staleDays === null ? "無法判斷新鮮度" : staleDays === 0 ? "今日資料" : `距今 ${staleDays} 日`}</span>`;
}

function renderMetricCards(items) {
  $("metrics").innerHTML = items.map((item) => `<article class="metric ${item.className || ""}">
    <span>${escapeHtml(item.label)}</span>
    <strong>${escapeHtml(item.value)}</strong>
    ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ""}
  </article>`).join("");
}

function csvDownload(filename, columns, rows) {
  const csv = [columns.map(([, label]) => label), ...rows.map((row) => columns.map(([key]) => row[key] ?? ""))]
    .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function emptyRow(columnCount, message = "目前沒有符合條件的資料") {
  return `<tr><td colspan="${columnCount}" class="empty">${escapeHtml(message)}</td></tr>`;
}

function initQuotes() {
  const defaultPayload = {
    latest_source_date: data.latest_source_date,
    source_files: data.source_files,
    quotes: data.quotes,
  };
  const savedPayload = window.CBQuoteUpload?.loadSaved();
  if (savedPayload) {
    data.latest_source_date = savedPayload.latest_source_date;
    data.source_files = savedPayload.source_files;
    data.quotes = savedPayload.quotes;
  }
  const brokerOrder = ["元大", "富邦", "群益"];
  const buildRawRows = () => unpack(data.quotes)
    .map((row, index) => ({ ...row, broker: brokerName(row.source_id), row_id: `${row.source_id}-${index}` }))
    .filter((row) => ["元大", "富邦", "群益"].includes(row.broker));
  const finiteValues = (values) => values.filter(Number.isFinite);
  const buildMergedRows = (sourceRows) => {
    const groups = new Map();
    sourceRows.forEach((row) => groups.set(row.cb_code, [...(groups.get(row.cb_code) || []), row]));
    return [...groups.entries()].map(([cbCode, quotes]) => {
      quotes.sort((a, b) => brokerOrder.indexOf(a.broker) - brokerOrder.indexOf(b.broker));
      const preferred = quotes.find((quote) => quote.broker === "元大") || quotes[0];
      const premiums = finiteValues(quotes.map((quote) => quote.premium_per_100));
      const parities = finiteValues(quotes.map((quote) => quote.parity));
      const ratios = finiteValues(quotes.map((quote) => quote.premium_ratio));
      const expiries = quotes.map((quote) => quote.option_expiration).filter(isDate).sort();
      return {
        cb_code: cbCode,
        stock_code: preferred.stock_code,
        cb_name: preferred.cb_name,
        quotes,
        brokers: quotes.map((quote) => quote.broker),
        broker_count: new Set(quotes.map((quote) => quote.broker)).size,
        balance_ratio: quotes.find((quote) => Number.isFinite(quote.balance_ratio))?.balance_ratio ?? null,
        min_premium: premiums.length ? Math.min(...premiums) : null,
        parity_min: parities.length ? Math.min(...parities) : null,
        parity_max: parities.length ? Math.max(...parities) : null,
        premium_ratio_min: ratios.length ? Math.min(...ratios) : null,
        premium_ratio_max: ratios.length ? Math.max(...ratios) : null,
        nearest_expiry: expiries[0] || null,
      };
    });
  };
  let rawRows = buildRawRows();
  let rows = buildMergedRows(rawRows);
  let balanceAvailable = rows.some((row) => Number.isFinite(row.balance_ratio));
  let usingUploadedData = Boolean(savedPayload);
  const columns = [
    ["cb", "CB 標的"], ["balance_ratio", "餘額比例"], ["quotes", "券商報價比較"],
    ["min_premium", "最低權利金"], ["parity_range", "轉換價值"],
    ["premium_ratio_range", "折溢價"], ["nearest_expiry", "最近到期"],
  ];
  const exportColumns = [
    ["cb_code", "CB 代碼"], ["cb_name", "CB 名稱"], ["stock_code", "股票代碼"],
    ["balance_ratio_text", "餘額比例"], ["broker_count", "券商數"],
    ["yuanta_premium", "元大百元權利金"], ["fubon_premium", "富邦百元權利金"], ["capital_premium", "群益百元權利金"],
    ["min_premium", "最低百元權利金"], ["parity_min", "轉換價值最低"], ["parity_max", "轉換價值最高"],
    ["premium_ratio_min_text", "折溢價最低"], ["premium_ratio_max_text", "折溢價最高"], ["nearest_expiry", "最近選擇權到期"],
  ];
  let quickFilter = "all";

  $("brokerSelect").innerHTML = `<option value="">全部券商</option>` +
    ["元大", "富邦", "群益"].map((broker) => `<option value="${broker}">${broker}</option>`).join("");
  if (balanceAvailable) {
    $("minBalance").disabled = false;
    $("minBalance").placeholder = "例如 30";
  }

  function renderDataNotice(message = "") {
    $("dataNotice").textContent = message || (balanceAvailable
      ? `餘額比例取自元大報價單「流通餘額占發行總額%」${usingUploadedData ? "，並已按 CB 代碼套用至三家報價" : ""}；策略條件採嚴格大於 85 與 30%。`
      : "目前資料沒有元大「流通餘額占發行總額%」可對應值；上傳三家最新報價後即可使用餘額篩選。");
  }
  renderDataNotice();

  function filtered() {
    const keyword = $("searchInput").value.trim().toLowerCase();
    const broker = $("brokerSelect").value;
    const minParity = Number.parseFloat($("minParity").value);
    const minBalance = Number.parseFloat($("minBalance").value);
    const result = rows.filter((row) => {
      const matchesSearch = !keyword || [row.cb_code, row.cb_name, row.stock_code].join(" ").toLowerCase().includes(keyword);
      const matchesBroker = !broker || row.brokers.includes(broker);
      const matchesParity = !Number.isFinite(minParity) || (Number.isFinite(row.parity_max) && row.parity_max >= minParity);
      const matchesBalance = !Number.isFinite(minBalance) || (Number.isFinite(row.balance_ratio) && row.balance_ratio * 100 >= minBalance);
      if (!matchesSearch || !matchesBroker || !matchesParity || !matchesBalance) return false;
      if (quickFilter === "strategy") {
        return Number.isFinite(row.parity_max) && row.parity_max > 85 &&
          Number.isFinite(row.balance_ratio) && row.balance_ratio > 0.3;
      }
      if (quickFilter === "low-premium") return Number.isFinite(row.premium_ratio_min) && row.premium_ratio_min < 0.2;
      if (quickFilter === "valid") return Number.isFinite(row.min_premium);
      return true;
    });
    const sort = $("sortSelect").value;
    result.sort((a, b) => {
      if (sort === "parity-desc") return (b.parity_max ?? -Infinity) - (a.parity_max ?? -Infinity);
      if (sort === "premium-asc") return (a.min_premium ?? Infinity) - (b.min_premium ?? Infinity);
      if (sort === "ratio-asc") return (a.premium_ratio_min ?? Infinity) - (b.premium_ratio_min ?? Infinity);
      if (sort === "expiry-asc") return String(a.nearest_expiry || "9999").localeCompare(String(b.nearest_expiry || "9999"));
      return String(a.cb_code || "").localeCompare(String(b.cb_code || ""), "zh-TW", { numeric: true });
    });
    return result;
  }

  function rangeText(minimum, maximum, formatter = formatNumber) {
    if (!Number.isFinite(minimum)) return "—";
    if (!Number.isFinite(maximum) || Math.abs(maximum - minimum) < 0.000001) return formatter(minimum);
    return `${formatter(minimum)}–${formatter(maximum)}`;
  }

  function quoteComparison(row) {
    return `<div class="quote-comparison">${row.quotes.map((quote) => `<div class="broker-quote">
      <span class="broker-badge">${escapeHtml(quote.broker)}</span>
      <strong>${Number.isFinite(quote.premium_per_100) ? `權利金 ${formatNumber(quote.premium_per_100)}` : "未報權利金"}</strong>
      <small>CB ${formatNumber(quote.cb_price)} · 轉換 ${formatNumber(quote.parity)}</small>
    </div>`).join("")}</div>`;
  }

  function render() {
    const result = filtered();
    const multiBroker = rows.filter((row) => row.broker_count > 1).length;
    const strategic = rows.filter((row) => row.parity_max > 85 && (!balanceAvailable || row.balance_ratio > 0.3)).length;
    renderMetricCards([
      { label: "CB 標的數", value: rows.length, note: "同標的合併為一筆" },
      { label: "原始報價筆數", value: rawRows.length, note: "保留三家券商明細" },
      { label: "多家可比較", value: multiBroker, note: "至少兩家券商報價" },
      { label: balanceAvailable ? "符合策略條件" : "轉換價值 > 85", value: strategic, note: balanceAvailable ? "且餘額比例 > 30%" : "待補餘額資料", className: "accent" },
    ]);
    $("rowCount").textContent = `${result.length} 檔`;
    $("tableHead").innerHTML = `<tr>${columns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
    $("tableBody").innerHTML = result.length ? result.map((row) => `<tr>
      <td data-label="CB 標的" class="code-cell"><strong>${escapeHtml(row.cb_code || "—")} ${escapeHtml(row.cb_name || "")}</strong><span>股票 ${escapeHtml(row.stock_code || "—")} · ${row.broker_count} 家報價</span></td>
      <td data-label="餘額比例" class="balance-cell">${formatPercent(row.balance_ratio)}</td>
      <td data-label="券商報價比較" class="quote-cell">${quoteComparison(row)}</td>
      <td data-label="最低權利金" class="number-good">${formatNumber(row.min_premium)}</td>
      <td data-label="轉換價值" class="${row.parity_max > 85 ? "number-good" : ""}">${rangeText(row.parity_min, row.parity_max)}</td>
      <td data-label="折溢價" class="${Number.isFinite(row.premium_ratio_min) && row.premium_ratio_min < 0.2 ? "number-good" : ""}">${rangeText(row.premium_ratio_min, row.premium_ratio_max, formatPercent)}</td>
      <td data-label="最近到期">${formatDate(row.nearest_expiry)}</td>
    </tr>`).join("") : emptyRow(columns.length);
  }

  ["searchInput", "brokerSelect", "sortSelect", "minParity", "minBalance"].forEach((id) => $(id).addEventListener("input", render));
  document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => {
    quickFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
    render();
  }));
  $("resetFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("brokerSelect").value = "";
    $("sortSelect").value = "code";
    $("minParity").value = "";
    $("minBalance").value = "";
    quickFilter = "all";
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
    render();
  });
  $("downloadCsv").addEventListener("click", () => {
    const exportRows = filtered().map((row) => {
      const byBroker = Object.fromEntries(row.quotes.map((quote) => [quote.broker, quote]));
      return {
        ...row,
        balance_ratio_text: formatPercent(row.balance_ratio),
        premium_ratio_min_text: formatPercent(row.premium_ratio_min),
        premium_ratio_max_text: formatPercent(row.premium_ratio_max),
        yuanta_premium: byBroker["元大"]?.premium_per_100 ?? "",
        fubon_premium: byBroker["富邦"]?.premium_per_100 ?? "",
        capital_premium: byBroker["群益"]?.premium_per_100 ?? "",
      };
    });
    csvDownload(`cbas-quotes-merged-${data.latest_source_date || "latest"}.csv`, exportColumns, exportRows);
  });

  function applyPayload(payload, uploaded) {
    data.latest_source_date = payload.latest_source_date;
    data.source_files = payload.source_files;
    data.quotes = payload.quotes;
    rawRows = buildRawRows();
    rows = buildMergedRows(rawRows);
    usingUploadedData = uploaded;
    balanceAvailable = rows.some((row) => Number.isFinite(row.balance_ratio));
    $("minBalance").disabled = !balanceAvailable;
    $("minBalance").placeholder = balanceAvailable ? "例如 30" : "沒有可用資料";
    renderFreshness();
    renderDataNotice();
    render();
  }

  window.CBQuoteUpload?.mount({
    onApply: (payload) => applyPayload(payload, true),
    onClear: () => applyPayload(defaultPayload, false),
  });
  applyPayload({
    latest_source_date: data.latest_source_date,
    source_files: data.source_files,
    quotes: data.quotes,
  }, usingUploadedData);
}

function eventDateKey(row, dateField) {
  return isDate(row[dateField]) ? row[dateField] : "";
}

function monthKey(value) {
  return isDate(value) ? value.slice(0, 7) : "";
}

function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return "無日期";
  const [year, month] = value.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function dedupeEvents(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = [
      row.cb_code || row.stock_code || row.name,
      row.event_type,
      row.redeem_date,
      row.maturity_date,
    ].join("|");
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return [...groups.values()].map((group) => {
    const newest = [...group].sort((a, b) =>
      String(b.source_date || "").localeCompare(String(a.source_date || ""))
    )[0];
    const merged = { ...newest };
    const putDates = [...new Set(group.map((row) => row.next_put_date).filter(isDate))].sort();
    const eligiblePutDates = merged.redeem_date
      ? putDates.filter((value) => value >= merged.redeem_date)
      : putDates;
    merged.next_put_date = (eligiblePutDates.length ? eligiblePutDates : putDates)[0] || null;
    return merged;
  });
}

function initSchedule() {
  const isPrimary = page === "primary";
  const rows = isPrimary ? unpack(data.primary_market) : dedupeEvents(unpack(data.events));
  const config = isPrimary ? {
    dateFields: [["listing_date", "掛牌日"], ["op_effective_date", "OP 生效日"]],
    typeKey: "issue_type",
    searchKeys: ["cb_code", "stock_code", "cb_name", "lead_underwriter", "tcri_or_guarantor"],
    columns: [
      ["cb", "CB 案件"], ["issue_type", "方式"], ["issue_amount_100m", "發行量（億）"],
      ["tcri_or_guarantor", "TCRI／擔保"], ["lead_underwriter", "主辦券商"],
      ["bookbuilding_period", "詢圈／投標"], ["listing_date", "掛牌日"],
      ["op_effective_date", "OP 生效日"], ["conversion_price", "轉換價"],
    ],
  } : {
    dateFields: [["redeem_date", "贖回／終止日"], ["next_put_date", "賣回日"], ["maturity_date", "到期日"]],
    typeKey: "event_type",
    searchKeys: ["cb_code", "stock_code", "name", "event_type"],
    columns: [
      ["cb", "CB 標的"], ["event_type", "事件類型"], ["redeem_date", "贖回／終止日"],
      ["next_put_date", "賣回日"], ["maturity_date", "到期日"], ["countdown", "事件倒數"],
    ],
  };

  let selectedMonth = "";
  $("dateFieldSelect").innerHTML = config.dateFields.map(([key, label]) => `<option value="${key}">${label}</option>`).join("");
  const types = [...new Set(rows.map((row) => row[config.typeKey]).filter(Boolean))].sort();
  $("typeSelect").innerHTML = `<option value="">全部類型</option>${types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}`;

  function dateField() {
    return $("dateFieldSelect").value || config.dateFields[0][0];
  }

  function availableMonths() {
    return [...new Set(rows.map((row) => monthKey(row[dateField()])).filter(Boolean))].sort();
  }

  function chooseMonth(preferred = "") {
    const months = availableMonths();
    if (!months.length) {
      selectedMonth = "";
      $("monthSelect").innerHTML = `<option value="">沒有日期</option>`;
      return;
    }
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    selectedMonth = months.includes(preferred) ? preferred :
      months.find((month) => month >= currentMonth) || months.at(-1);
    $("monthSelect").innerHTML = months.map((month) => `<option value="${month}">${monthLabel(month)}</option>`).join("");
    $("monthSelect").value = selectedMonth;
  }

  function filtered(ignoreMonth = false) {
    const keyword = $("searchInput").value.trim().toLowerCase();
    const type = $("typeSelect").value;
    return rows.filter((row) => {
      if (type && row[config.typeKey] !== type) return false;
      if (!ignoreMonth && selectedMonth && monthKey(row[dateField()]) !== selectedMonth) return false;
      return !keyword || config.searchKeys.some((key) => String(row[key] || "").toLowerCase().includes(keyword));
    });
  }

  function eventTitle(row) {
    return isPrimary
      ? `${row.cb_code || ""} ${row.cb_name || ""}`.trim()
      : `${row.cb_code || row.stock_code || ""} ${row.name || ""}`.trim();
  }

  function renderCalendar() {
    $("monthTitle").textContent = selectedMonth ? `${monthLabel(selectedMonth)} · ${$("dateFieldSelect").selectedOptions[0]?.textContent || ""}` : "沒有可用日期";
    if (!selectedMonth) {
      $("calendarGrid").innerHTML = `<div class="empty">沒有可呈現的日期資料</div>`;
      return;
    }
    const [year, month] = selectedMonth.split("-").map(Number);
    const first = new Date(year, month - 1, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const grouped = new Map();
    filtered(true).filter((row) => monthKey(row[dateField()]) === selectedMonth).forEach((row) => {
      const key = row[dateField()];
      grouped.set(key, [...(grouped.get(key) || []), row]);
    });
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const items = grouped.get(key) || [];
      cells.push(`<article class="day-cell${date.getMonth() !== month - 1 ? " muted" : ""}${key === todayKey ? " today" : ""}">
        <div class="day-number"><span>${date.getDate()}</span><span class="day-count">${items.length ? `${items.length} 件` : ""}</span></div>
        <div class="calendar-events">
          ${items.slice(0, 3).map((row) => `<div class="calendar-event${isPrimary ? "" : " red"}" title="${escapeHtml(eventTitle(row))}">${escapeHtml(eventTitle(row))}</div>`).join("")}
          ${items.length > 3 ? `<span class="calendar-more">另有 ${items.length - 3} 件</span>` : ""}
        </div>
      </article>`);
    }
    $("calendarGrid").innerHTML = cells.join("");
  }

  function countdownText(row) {
    const value = row[dateField()];
    const days = daysFromToday(value);
    if (days === null) return "—";
    if (days < 0) return `已過 ${Math.abs(days)} 日`;
    if (days === 0) return "今日";
    return `剩 ${days} 日`;
  }

  function eventBadgeClass(type) {
    if (String(type).includes("賣回")) return "put";
    if (String(type).includes("到期")) return "maturity";
    return "";
  }

  function displayCell(row, key) {
    if (key === "cb") return `<div class="code-cell"><strong>${escapeHtml(eventTitle(row))}</strong><span>股票 ${escapeHtml(row.stock_code || "—")}</span></div>`;
    if (key === "issue_type") return `<span class="status-badge">${escapeHtml(row[key] || "—")}</span>`;
    if (key === "event_type") return `<span class="event-badge ${eventBadgeClass(row[key])}">${escapeHtml(row[key] || "—")}</span>`;
    if (key === "countdown") {
      const days = daysFromToday(row[dateField()]);
      return `<span class="${days !== null && days >= 0 && days <= 30 ? "number-risk" : ""}">${escapeHtml(countdownText(row))}</span>`;
    }
    if (["listing_date", "op_effective_date", "redeem_date", "next_put_date", "maturity_date"].includes(key)) return formatDate(row[key]);
    return escapeHtml(formatNumber(row[key], row[key] || "—"));
  }

  function renderTable() {
    const result = filtered(false).sort((a, b) => String(a[dateField()] || "9999").localeCompare(String(b[dateField()] || "9999")));
    $("rowCount").textContent = `${result.length} 筆`;
    $("tableHead").innerHTML = `<tr>${config.columns.map(([, label]) => `<th>${label}</th>`).join("")}</tr>`;
    $("tableBody").innerHTML = result.length
      ? result.map((row) => `<tr>${config.columns.map(([key]) => `<td class="${key === "cb" ? "align-left" : ""}">${displayCell(row, key)}</td>`).join("")}</tr>`).join("")
      : emptyRow(config.columns.length);
  }

  function renderMetrics() {
    const all = filtered(true);
    const dated = all.filter((row) => isDate(row[dateField()]));
    if (isPrimary) {
      const issueAmount = all.reduce((sum, row) => sum + (Number.isFinite(row.issue_amount_100m) ? row.issue_amount_100m : 0), 0);
      const upcoming = all.filter((row) => {
        const days = daysFromToday(row[dateField()]);
        return days !== null && days >= 0 && days <= 30;
      }).length;
      renderMetricCards([
        { label: "初級市場案件", value: all.length, note: "搜尋條件下全部案件" },
        { label: "發行總額", value: `${formatNumber(issueAmount)} 億`, note: "已提供金額者加總" },
        { label: "未來 30 日", value: upcoming, note: $("dateFieldSelect").selectedOptions[0]?.textContent || "" , className: "accent" },
        { label: "已有日期", value: dated.length, note: `共 ${all.length - dated.length} 件仍未定` },
      ]);
    } else {
      const within30 = all.filter((row) => {
        const days = daysFromToday(row[dateField()]);
        return days !== null && days >= 0 && days <= 30;
      }).length;
      const withinYear = all.filter((row) => {
        const days = daysFromToday(row.maturity_date);
        return days !== null && days >= 0 && days < 365;
      }).length;
      renderMetricCards([
        { label: "去重後事件", value: all.length, note: `原始 ${unpack(data.events).length} 筆` },
        { label: "未來 30 日", value: within30, note: $("dateFieldSelect").selectedOptions[0]?.textContent || "", className: "alert" },
        { label: "到期剩不到 1 年", value: withinYear, note: "依到期日計算", className: "accent" },
        { label: "事件類型", value: new Set(all.map((row) => row.event_type).filter(Boolean)).size, note: "強制贖回／賣回／到期等" },
      ]);
    }
  }

  function renderAll() {
    renderMetrics();
    renderCalendar();
    renderTable();
  }

  $("searchInput").addEventListener("input", renderAll);
  $("typeSelect").addEventListener("change", renderAll);
  $("monthSelect").addEventListener("change", () => {
    selectedMonth = $("monthSelect").value;
    renderAll();
  });
  $("dateFieldSelect").addEventListener("change", () => {
    chooseMonth(selectedMonth);
    renderAll();
  });
  $("prevMonth").addEventListener("click", () => {
    const months = availableMonths();
    const index = months.indexOf(selectedMonth);
    if (index > 0) {
      selectedMonth = months[index - 1];
      $("monthSelect").value = selectedMonth;
      renderAll();
    }
  });
  $("nextMonth").addEventListener("click", () => {
    const months = availableMonths();
    const index = months.indexOf(selectedMonth);
    if (index >= 0 && index < months.length - 1) {
      selectedMonth = months[index + 1];
      $("monthSelect").value = selectedMonth;
      renderAll();
    }
  });
  $("resetFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("typeSelect").value = "";
    $("dateFieldSelect").selectedIndex = 0;
    chooseMonth();
    renderAll();
  });
  $("downloadCsv").addEventListener("click", () => {
    const exportRows = filtered(false).map((row) => ({
      ...row,
      cb: eventTitle(row),
      countdown: countdownText(row),
    }));
    csvDownload(`${isPrimary ? "cb-primary" : "cb-redemption"}-${selectedMonth || "all"}.csv`, config.columns, exportRows);
  });

  chooseMonth();
  renderAll();
}

renderFreshness();
if (page === "quotes") initQuotes();
else initSchedule();
