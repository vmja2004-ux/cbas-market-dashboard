(function initQuoteUpload(root, factory) {
  const api = factory(
    root.XLSX || (typeof module === "object" && module.exports ? require("@e965/xlsx") : null),
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CBQuoteUpload = api;
}(typeof globalThis !== "undefined" ? globalThis : window, function quoteUploadFactory(XLSX) {
  "use strict";

  const STORAGE_KEY = "cbas-market-dashboard:quote-upload:v1";
  const BROKERS = ["元大", "富邦", "群益"];

  function text(value) {
    return String(value ?? "").replace(/\s+/g, "").trim();
  }

  function number(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number.parseFloat(String(value).replaceAll(",", "").replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function code(value) {
    const valueText = String(value ?? "").trim();
    return valueText.endsWith(".0") ? valueText.slice(0, -2) : valueText;
  }

  function percentage(value, mode = "fraction") {
    const parsed = number(value);
    if (!Number.isFinite(parsed)) return null;
    if (mode === "points") return parsed / 100;
    return Math.abs(parsed) > 2 ? parsed / 100 : parsed;
  }

  function isoDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === "number" && XLSX?.SSF) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    }
    const source = String(value ?? "").trim();
    if (!source || source === "--") return null;
    const roc = source.match(/^(\d{2,3})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
    if (roc && Number(roc[1]) < 1911) {
      return `${Number(roc[1]) + 1911}-${roc[2].padStart(2, "0")}-${roc[3].padStart(2, "0")}`;
    }
    const ad = source.match(/^(\d{4})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
    return ad ? `${ad[1]}-${ad[2].padStart(2, "0")}-${ad[3].padStart(2, "0")}` : null;
  }

  function findHeader(rows, requiredLabels) {
    return rows.findIndex((row) => {
      const labels = row.map(text);
      return requiredLabels.every((required) => labels.some((label) => label.includes(required)));
    });
  }

  function findColumn(header, label) {
    return header.findIndex((cell) => text(cell).includes(label));
  }

  function valueAt(row, header, label) {
    const index = findColumn(header, label);
    return index >= 0 ? row[index] : null;
  }

  function readSheet(workbook, preferredName) {
    const sheetName = workbook.SheetNames.find((name) => text(name).includes(text(preferredName)));
    if (!sheetName) throw new Error(`找不到「${preferredName}」工作表`);
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
  }

  function detectBroker(workbook) {
    const names = workbook.SheetNames.map(text);
    if (names.some((name) => name.includes("CBOP報價表"))) return "富邦";
    if (names.some((name) => name === "報價單")) return "元大";
    if (names.some((name) => name === "報價表")) return "群益";
    throw new Error("無法辨識券商，請確認為元大、富邦或群益的原始報價檔");
  }

  function sourceDateFromRows(rows) {
    for (const row of rows.slice(0, 5)) {
      for (const cell of row) {
        if (typeof cell === "number" && cell > 40000 && cell < 80000) return isoDate(cell);
      }
    }
    return null;
  }

  function baseQuote(row, header, broker, sourceId) {
    let cbName;
    let cbCode;
    let guarantor;
    let premium;
    let premiumReference;
    let cbPrice;
    let parity;
    let premiumRatio;
    let expiration;
    let putDate;

    if (broker === "元大") {
      cbName = valueAt(row, header, "可轉債名稱");
      cbCode = valueAt(row, header, "可轉債代碼");
      guarantor = valueAt(row, header, "擔保銀行/信用評等");
      premium = valueAt(row, header, "權利金(佰元報價)");
      premiumReference = valueAt(row, header, "權利金參考價");
      cbPrice = valueAt(row, header, "CB參考價");
      parity = valueAt(row, header, "CB轉換價值");
      premiumRatio = percentage(valueAt(row, header, "溢(折)價%"), "points");
      expiration = valueAt(row, header, "選擇權到期日");
      putDate = valueAt(row, header, "賣回日期");
    } else if (broker === "富邦") {
      cbName = valueAt(row, header, "債券名稱");
      cbCode = valueAt(row, header, "CB代號");
      guarantor = valueAt(row, header, "擔保/評等");
      premium = valueAt(row, header, "權利金百元報價");
      premiumReference = valueAt(row, header, "權利金(參考價)");
      cbPrice = valueAt(row, header, "CB市價");
      parity = valueAt(row, header, "轉換價值");
      premiumRatio = percentage(valueAt(row, header, "折溢價"));
      expiration = valueAt(row, header, "選擇權到期日");
      putDate = valueAt(row, header, "賣回日");
    } else {
      cbName = valueAt(row, header, "可轉債名稱");
      cbCode = valueAt(row, header, "可轉債代號");
      guarantor = valueAt(row, header, "評等/擔保銀行");
      premium = valueAt(row, header, "權利金百元報價");
      premiumReference = null;
      cbPrice = valueAt(row, header, "可轉債價格");
      const rawParity = number(valueAt(row, header, "parity"));
      parity = Number.isFinite(rawParity) && Math.abs(rawParity) <= 2 ? rawParity * 100 : rawParity;
      premiumRatio = percentage(valueAt(row, header, "溢(折)價率"));
      expiration = valueAt(row, header, "選擇權到期日");
      putDate = valueAt(row, header, "putday");
    }

    const normalizedCode = code(cbCode);
    if (!normalizedCode || !cbName) return null;
    return {
      cb_code: normalizedCode,
      stock_code: normalizedCode.slice(0, 4),
      cb_name: String(cbName).trim(),
      tcri_or_guarantor: String(guarantor ?? "").trim() || null,
      premium_per_100: number(premium),
      premium_reference: number(premiumReference),
      cb_price: number(cbPrice),
      parity: number(parity),
      premium_ratio: premiumRatio,
      balance_ratio: null,
      option_expiration: isoDate(expiration),
      put_date: isoDate(putDate),
      source_id: sourceId,
    };
  }

  function parseWorkbook(workbook, fileName, sourceId) {
    if (!XLSX) throw new Error("Excel 解析元件尚未載入");
    const broker = detectBroker(workbook);
    const rows = readSheet(workbook, broker === "元大" ? "報價單" : broker === "富邦" ? "CBOP報價表" : "報價表");
    const headerIndex = findHeader(rows, broker === "富邦"
      ? ["債券名稱", "CB代號", "權利金百元報價"]
      : ["可轉債名稱", broker === "元大" ? "可轉債代碼" : "可轉債代號", "選擇權到期日"]);
    if (headerIndex < 0) throw new Error(`${broker}檔找不到預期表頭`);
    const header = rows[headerIndex];
    const dataRows = rows.slice(headerIndex + 1);
    const quotes = dataRows
      .map((row) => baseQuote(row, header, broker, sourceId))
      .filter(Boolean);
    if (!quotes.length) throw new Error(`${broker}檔沒有可匯入的報價`);

    const balances = new Map();
    if (broker === "元大") {
      dataRows.forEach((sourceRow) => {
        const cbCode = code(valueAt(sourceRow, header, "可轉債代碼"));
        const ratio = percentage(valueAt(sourceRow, header, "流通餘額占發行總額%"), "points");
        if (cbCode && Number.isFinite(ratio)) balances.set(cbCode, ratio);
      });
    }
    return {
      broker,
      source: { name: fileName, broker, source_date: sourceDateFromRows(rows) },
      quotes,
      balances,
    };
  }

  async function parseFile(file, sourceId) {
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
    return parseWorkbook(workbook, file.name, sourceId);
  }

  async function parseFiles(files) {
    if (!XLSX) throw new Error("Excel 解析元件尚未載入，請重新整理後再試");
    const selected = [...files];
    if (!selected.length) throw new Error("請選擇報價檔");
    if (selected.length > 3) throw new Error("一次最多上傳元大、富邦、群益各一個檔案");
    const parsed = await Promise.all(selected.map((file, index) => parseFile(file, index)));
    const brokers = parsed.map((item) => item.broker);
    if (new Set(brokers).size !== brokers.length) throw new Error("同一家券商請只上傳一個檔案");
    const missing = BROKERS.filter((broker) => !brokers.includes(broker));
    if (missing.length) throw new Error(`尚缺${missing.join("、")}報價檔`);

    parsed.sort((a, b) => BROKERS.indexOf(a.broker) - BROKERS.indexOf(b.broker));
    const sourceFiles = parsed.map((item) => item.source);
    const yuantaBalances = parsed.find((item) => item.broker === "元大").balances;
    const quotes = parsed.flatMap((item, sourceId) => item.quotes.map((quote) => ({
      ...quote,
      source_id: sourceId,
      source_date: sourceFiles[sourceId].source_date,
      balance_ratio: yuantaBalances.get(quote.cb_code) ?? null,
    })));
    const dates = sourceFiles.map((source) => source.source_date).filter(Boolean).sort();
    return {
      schema_version: 1,
      saved_at: new Date().toISOString(),
      latest_source_date: dates.at(-1) || "",
      source_files: sourceFiles,
      quotes,
    };
  }

  function save(payload) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function loadSaved() {
    try {
      const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return payload?.schema_version === 1 && Array.isArray(payload.quotes) ? payload : null;
    } catch {
      return null;
    }
  }

  function clearSaved() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function mount({ onApply, onClear }) {
    const input = document.getElementById("quoteFiles");
    const drop = document.getElementById("quoteDrop");
    const status = document.getElementById("uploadStatus");
    const clearButton = document.getElementById("clearQuoteUpload");
    if (!input || !drop || !status) return;

    function show(message, state = "") {
      status.className = `upload-status ${state}`.trim();
      status.textContent = message;
    }

    async function handle(files) {
      show("正在辨識三家券商檔案並合併資料…", "loading");
      input.disabled = true;
      try {
        const payload = await parseFiles(files);
        save(payload);
        const counts = BROKERS.map((broker) => {
          const sourceId = payload.source_files.findIndex((source) => source.broker === broker);
          return `${broker} ${payload.quotes.filter((row) => row.source_id === sourceId).length} 筆`;
        });
        const balanceCount = new Set(payload.quotes.filter((row) => Number.isFinite(row.balance_ratio)).map((row) => row.cb_code)).size;
        show(`更新完成：${counts.join("、")}；元大餘額比例對應 ${balanceCount} 檔 CB。`, "success");
        clearButton.hidden = false;
        onApply(payload);
      } catch (error) {
        show(error.message || "檔案解析失敗", "error");
      } finally {
        input.disabled = false;
        input.value = "";
      }
    }

    input.addEventListener("change", () => handle(input.files));
    ["dragenter", "dragover"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
      event.preventDefault();
      drop.classList.remove("dragging");
    }));
    drop.addEventListener("drop", (event) => handle(event.dataTransfer.files));
    clearButton.addEventListener("click", () => {
      clearSaved();
      clearButton.hidden = true;
      show("已恢復網站預設報價資料。");
      onClear();
    });
    const saved = loadSaved();
    if (saved) {
      clearButton.hidden = false;
      show(`目前使用 ${saved.latest_source_date || "未標日期"} 上傳資料；可重新上傳三檔覆蓋。`, "success");
    }
  }

  return {
    BROKERS,
    STORAGE_KEY,
    clearSaved,
    detectBroker,
    loadSaved,
    mount,
    parseFiles,
    parseWorkbook,
  };
}));
