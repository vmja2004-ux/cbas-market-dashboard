const SPREADSHEET_ID = "1GNyCLNmqPBfrPAuS2HKxIAdORF3EUTLQZ7hYEXJ5oD4";
const HISTORY_SHEET = "CBAS報價歷史";
const LATEST_SHEET = "CBAS最新合併";
const LOG_SHEET = "CBAS上傳紀錄";
const ISSUED_MASTER_SHEET = "CB已發行主檔";
const ISSUED_HISTORY_SHEET = "CB已發行版本歷史";
const ISSUED_LOG_SHEET = "CB已發行匯入紀錄";
const BROKERS = ["元大", "富邦", "群益"];

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(event) {
  const dataset = event && event.parameter && event.parameter.dataset;
  const sheetName = dataset === "issued" ? ISSUED_MASTER_SHEET : LATEST_SHEET;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: true, rows: [] });
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonResponse({ ok: true, rows: [] });
  const headers = values.shift();
  return jsonResponse({
    ok: true,
    rows: values.filter((row) => row[1]).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]]))),
  });
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const request = JSON.parse(event.postData.contents || "{}");
    const expectedToken = PropertiesService.getScriptProperties().getProperty("UPLOAD_TOKEN");
    if (!expectedToken || request.token !== expectedToken) {
      return jsonResponse({ ok: false, error: "Sheet 同步密碼錯誤" });
    }
    const payload = request.payload || {};
    if (payload.kind === "issued") {
      return jsonResponse(syncIssued(payload));
    }
    if (!Array.isArray(payload.quotes) || !Array.isArray(payload.source_files)) {
      return jsonResponse({ ok: false, error: "報價資料格式不正確" });
    }
    if (payload.quotes.length > 2000) {
      return jsonResponse({ ok: false, error: "單次報價筆數超過上限" });
    }

    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const history = spreadsheet.getSheetByName(HISTORY_SHEET);
    const latest = spreadsheet.getSheetByName(LATEST_SHEET);
    const log = spreadsheet.getSheetByName(LOG_SHEET);
    const uploadedAt = new Date();
    const snapshotId = `${payload.latest_source_date || "undated"}-${Utilities.formatDate(uploadedAt, "Asia/Taipei", "HHmmss")}`;
    const sources = payload.source_files;
    const brokerFor = (quote) => sources[quote.source_id] || {};

    const historyHeader = [
      "snapshot_id", "uploaded_at", "source_date", "broker", "cb_code", "stock_code",
      "cb_name", "guarantor", "premium_per_100", "premium_reference", "cb_price",
      "parity", "premium_ratio", "balance_ratio", "option_expiration", "put_date", "source_file",
    ];
    if (history.getLastRow() === 0) history.appendRow(historyHeader);
    const historyRows = payload.quotes.map((quote) => {
      const source = brokerFor(quote);
      return [
        snapshotId, uploadedAt, quote.source_date || source.source_date || "", source.broker || "",
        quote.cb_code || "", quote.stock_code || "", quote.cb_name || "", quote.tcri_or_guarantor || "",
        quote.premium_per_100 ?? "", quote.premium_reference ?? "", quote.cb_price ?? "",
        quote.parity ?? "", quote.premium_ratio ?? "", quote.balance_ratio ?? "",
        quote.option_expiration || "", quote.put_date || "", source.name || "",
      ];
    });
    if (historyRows.length) {
      history.getRange(history.getLastRow() + 1, 1, historyRows.length, historyHeader.length).setValues(historyRows);
    }

    const merged = mergeQuotes(payload.quotes, sources, payload.latest_source_date);
    const latestHeader = [
      "source_date", "cb_code", "stock_code", "cb_name", "balance_ratio", "broker_count",
      "brokers", "min_premium", "parity_min", "parity_max", "premium_ratio_min",
      "expiry_nearest", "yuanta_premium", "fubon_premium", "capital_premium", "updated_at",
    ];
    latest.clearContents();
    latest.getRange(1, 1, 1, latestHeader.length).setValues([latestHeader]);
    if (merged.length) latest.getRange(2, 1, merged.length, latestHeader.length).setValues(merged);

    const fileByBroker = Object.fromEntries(sources.map((source) => [source.broker, source.name]));
    if (log.getLastRow() === 0) {
      log.appendRow(["snapshot_id", "uploaded_at", "latest_source_date", "yuanta_file", "fubon_file", "capital_file", "raw_quote_count", "merged_cb_count"]);
    }
    log.appendRow([
      snapshotId, uploadedAt, payload.latest_source_date || "", fileByBroker["元大"] || "",
      fileByBroker["富邦"] || "", fileByBroker["群益"] || "", payload.quotes.length, merged.length,
    ]);
    return jsonResponse({ ok: true, snapshot_id: snapshotId, raw_count: payload.quotes.length, merged_count: merged.length });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function syncIssued(payload) {
  if (!Array.isArray(payload.records)) {
    return { ok: false, error: "已發行資料格式不正確" };
  }
  if (payload.records.length > 2000) {
    return { ok: false, error: "單次已發行筆數超過上限" };
  }
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const master = getOrCreateSheet(spreadsheet, ISSUED_MASTER_SHEET);
  const history = getOrCreateSheet(spreadsheet, ISSUED_HISTORY_SHEET);
  const log = getOrCreateSheet(spreadsheet, ISSUED_LOG_SHEET);
  const now = new Date();
  const fields = [
    "record_key", "cb_code", "stock_code", "cb_name", "tcri_or_guarantor",
    "issue_amount_100m", "lead_underwriter", "submitted_date", "effective_date",
    "bookbuilding_period", "premium_rate", "conversion_price", "listing_date",
    "option_available_date", "underwriting_price", "years", "put_terms",
    "source_date", "source_file", "content_hash",
  ];
  const masterHeader = fields.concat(["first_imported_at", "last_updated_at"]);
  const historyHeader = ["version_id", "version_at"].concat(fields);
  ensureHeader(master, masterHeader);
  ensureHeader(history, historyHeader);
  ensureHeader(log, ["upload_id", "uploaded_at", "source_date", "source_file", "total_count", "added_count", "updated_count", "unchanged_count"]);

  const currentValues = master.getDataRange().getValues();
  const current = {};
  currentValues.slice(1).forEach((row, index) => {
    if (row[0]) current[String(row[0])] = { rowNumber: index + 2, row: row };
  });

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const rowsToAdd = [];
  const historyRows = [];
  payload.records.forEach((record) => {
    const key = String(record.record_key || record.cb_code || "");
    if (!key) return;
    const values = fields.map((field) => record[field] == null ? "" : record[field]);
    const existing = current[key];
    if (!existing) {
      added += 1;
      rowsToAdd.push(values.concat([now, now]));
      historyRows.push([`${key}-${Utilities.getUuid()}`, now].concat(values));
      return;
    }
    const previousHash = String(existing.row[fields.indexOf("content_hash")] || "");
    if (previousHash === String(record.content_hash || "")) {
      unchanged += 1;
      return;
    }
    updated += 1;
    const firstImportedAt = existing.row[fields.length] || now;
    master.getRange(existing.rowNumber, 1, 1, masterHeader.length).setValues([values.concat([firstImportedAt, now])]);
    historyRows.push([`${key}-${Utilities.getUuid()}`, now].concat(values));
  });

  if (rowsToAdd.length) master.getRange(master.getLastRow() + 1, 1, rowsToAdd.length, masterHeader.length).setValues(rowsToAdd);
  if (historyRows.length) history.getRange(history.getLastRow() + 1, 1, historyRows.length, historyHeader.length).setValues(historyRows);
  const uploadId = `${payload.source_date || "undated"}-${Utilities.formatDate(now, "Asia/Taipei", "HHmmss")}`;
  log.appendRow([uploadId, now, payload.source_date || "", payload.source_file || "", payload.records.length, added, updated, unchanged]);
  return { ok: true, upload_id: uploadId, total: payload.records.length, added: added, updated: updated, unchanged: unchanged };
}

function getOrCreateSheet(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeader(sheet, header) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }
}

function mergeQuotes(quotes, sources, sourceDate) {
  const groups = {};
  quotes.forEach((quote) => {
    const broker = (sources[quote.source_id] || {}).broker || "";
    (groups[quote.cb_code] ||= []).push({ ...quote, broker });
  });
  return Object.keys(groups).sort().map((cbCode) => {
    const rows = groups[cbCode];
    const preferred = rows.find((row) => row.broker === "元大") || rows[0];
    const finite = (values) => values.filter((value) => typeof value === "number" && isFinite(value));
    const minimum = (values) => values.length ? Math.min.apply(null, values) : "";
    const maximum = (values) => values.length ? Math.max.apply(null, values) : "";
    const premiums = finite(rows.map((row) => row.premium_per_100));
    const parities = finite(rows.map((row) => row.parity));
    const ratios = finite(rows.map((row) => row.premium_ratio));
    const expiries = rows.map((row) => row.option_expiration).filter(Boolean).sort();
    const byBroker = Object.fromEntries(BROKERS.map((broker) => [broker, rows.find((row) => row.broker === broker)]));
    return [
      sourceDate || "", cbCode, preferred.stock_code || "", preferred.cb_name || "",
      rows.find((row) => typeof row.balance_ratio === "number")?.balance_ratio ?? "",
      new Set(rows.map((row) => row.broker)).size, [...new Set(rows.map((row) => row.broker))].join("、"),
      minimum(premiums), minimum(parities), maximum(parities), minimum(ratios), expiries[0] || "",
      byBroker["元大"]?.premium_per_100 ?? "", byBroker["富邦"]?.premium_per_100 ?? "",
      byBroker["群益"]?.premium_per_100 ?? "", new Date(),
    ];
  });
}
