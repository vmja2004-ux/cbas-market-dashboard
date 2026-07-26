(() => {
  const data = window.CB_BANK_ANNOUNCEMENTS || { rows: [] };
  const rows = data.rows || [];
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
  const formatDate = (date) => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${date}T00:00:00`));
  const monthKey = (date) => date.slice(0, 7);
  const availableMonths = [...new Set(rows.map((row) => monthKey(row.announcement_date)))].sort().reverse();
  let activeMonth = availableMonths[0] || new Date().toISOString().slice(0, 7);

  const monthSelect = $("monthSelect");
  availableMonths.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month.replace("-", " 年 ") + " 月";
    monthSelect.appendChild(option);
  });
  monthSelect.value = activeMonth;
  $("freshness").textContent = `更新：${data.generated_at.slice(0, 10)}`;

  function filteredRows() {
    const keyword = $("searchInput").value.trim().toLowerCase();
    const guarantee = $("guaranteeSelect").value;
    return rows.filter((row) => {
      const haystack = Object.values(row).join(" ").toLowerCase();
      return monthKey(row.announcement_date) === activeMonth &&
        (!keyword || haystack.includes(keyword)) &&
        (!guarantee || row.guarantee === guarantee);
    });
  }

  function renderMetrics(current) {
    const companies = new Set(current.map((row) => row.company_code)).size;
    const secured = current.filter((row) => row.guarantee === "有擔保").length;
    $("metrics").innerHTML = [
      ["本月公告", `${current.length} 筆`],
      ["發行公司", `${companies} 家`],
      ["有擔保", `${secured} 筆`],
      ["無擔保", `${current.length - secured} 筆`]
    ].map(([label, value]) => `<article><span>${label}</span><strong>${value}</strong></article>`).join("");
  }

  function renderCalendar(current) {
    const [year, month] = activeMonth.split("-").map(Number);
    $("monthTitle").textContent = `${year} 年 ${month} 月`;
    const first = new Date(year, month - 1, 1);
    const start = new Date(year, month - 1, 1 - first.getDay());
    const byDate = Object.groupBy ? Object.groupBy(current, (row) => row.announcement_date) : current.reduce((map, row) => {
      (map[row.announcement_date] ||= []).push(row);
      return map;
    }, {});
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const events = byDate[key] || [];
      const isMuted = date.getMonth() !== month - 1;
      cells.push(`<div class="day-cell${isMuted ? " muted" : ""}">
        <div class="day-number"><span>${date.getDate()}</span>${events.length ? `<span class="day-count">${events.length} 筆</span>` : ""}</div>
        <div class="calendar-events">${events.slice(0, 4).map((row) =>
          `<a class="calendar-event${row.guarantee === "有擔保" ? " red" : ""}" href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener">${escapeHtml(row.company_code)} ${escapeHtml(row.company_name)}${escapeHtml(row.issue_no)}</a>`
        ).join("")}${events.length > 4 ? `<span class="calendar-more">另有 ${events.length - 4} 筆</span>` : ""}</div>
      </div>`);
    }
    $("calendarGrid").innerHTML = cells.join("");
  }

  function renderTable(current) {
    $("rowCount").textContent = `${current.length} 筆`;
    $("tableBody").innerHTML = current.map((row) => `<tr>
      <td>${formatDate(row.announcement_date)}</td>
      <td class="code-cell"><strong>${escapeHtml(row.company_code)}</strong><span>${escapeHtml(row.company_name)}</span></td>
      <td class="align-left">${escapeHtml(row.issue_name)}</td>
      <td><span class="status-badge">${escapeHtml(row.guarantee)}</span></td>
      <td class="align-left">${escapeHtml(row.collection_bank)}</td>
      <td class="align-left">${escapeHtml(row.deposit_bank)}</td>
      <td><a href="${escapeHtml(row.source_url)}" target="_blank" rel="noopener">查看公告</a></td>
    </tr>`).join("");
  }

  function render() {
    const current = filteredRows();
    renderMetrics(current);
    renderCalendar(current);
    renderTable(current);
  }

  function moveMonth(delta) {
    const [year, month] = activeMonth.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    activeMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    if (![...monthSelect.options].some((option) => option.value === activeMonth)) {
      const option = document.createElement("option");
      option.value = activeMonth;
      option.textContent = activeMonth.replace("-", " 年 ") + " 月";
      monthSelect.appendChild(option);
    }
    monthSelect.value = activeMonth;
    render();
  }

  $("searchInput").addEventListener("input", render);
  $("guaranteeSelect").addEventListener("change", render);
  monthSelect.addEventListener("change", () => { activeMonth = monthSelect.value; render(); });
  $("prevMonth").addEventListener("click", () => moveMonth(-1));
  $("nextMonth").addEventListener("click", () => moveMonth(1));
  $("resetFilters").addEventListener("click", () => {
    $("searchInput").value = "";
    $("guaranteeSelect").value = "";
    activeMonth = availableMonths[0] || activeMonth;
    monthSelect.value = activeMonth;
    render();
  });
  $("downloadCsv").addEventListener("click", () => {
    const header = ["公告日", "公司代碼", "公司名稱", "發行次別", "發行標的", "擔保情形", "代收價款行庫", "存儲專戶行庫", "原始公告網址"];
    const csvRows = filteredRows().map((row) => [
      row.announcement_date, row.company_code, row.company_name, row.issue_no, row.issue_name,
      row.guarantee, row.collection_bank, row.deposit_bank, row.source_url
    ]);
    const csv = [header, ...csvRows].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = `cb-bank-announcements-${activeMonth}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  render();
})();
