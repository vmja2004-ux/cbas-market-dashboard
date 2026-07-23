process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs22.x";

const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const GOODINFO_BASE_URL = "https://goodinfo.tw/tw/StockDetail.asp";
const YAHOO_REVENUE_BASE_URL = "https://tw.stock.yahoo.com/quote";

function getStockId(value) {
  const stockId = String(value || "").replace(/\D/g, "").slice(0, 6);
  return /^\d{4,6}$/.test(stockId) ? stockId : "";
}

async function getExecutablePath() {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  return chromium.executablePath();
}

function browserLaunchArgs() {
  const launchArgs = [
    ...chromium.args,
    "--disable-features=site-per-process",
    "--disable-blink-features=AutomationControlled",
    "--lang=zh-TW,zh",
  ];
  if (process.env.GOODINFO_PROXY_SERVER) {
    launchArgs.push(`--proxy-server=${process.env.GOODINFO_PROXY_SERVER}`);
  }
  return launchArgs;
}

async function newBrowser() {
  return puppeteer.launch({
    args: browserLaunchArgs(),
    defaultViewport: {
      width: 430,
      height: 1800,
      deviceScaleFactor: 2,
      isMobile: true,
    },
    executablePath: await getExecutablePath(),
    headless: chromium.headless,
  });
}

async function captureGoodinfoMonthlyRevenue(stockId) {
  const browser = await newBrowser();
  try {
    const page = await browser.newPage();
    await prepareGoodinfoPage(page);
    const url = `${GOODINFO_BASE_URL}?STOCK_ID=${encodeURIComponent(stockId)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => {});
    await page
      .waitForFunction(() => document.body && document.body.innerText.includes("月營收狀況"), {
        timeout: 20000,
      })
      .catch(() => {});

    const clip = await findMonthlyRevenueClip(page);
    if (!clip) {
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
      throw new Error(`找不到 Goodinfo「月營收狀況」區塊：${bodyText}`);
    }

    const buffer = await page.screenshot({ type: "png", clip });
    if (!buffer || buffer.length < 15000) {
      throw new Error(`截圖內容異常，檔案過小：${buffer ? buffer.length : 0} bytes`);
    }
    return buffer;
  } finally {
    await browser.close();
  }
}

async function prepareGoodinfoPage(page) {
  if (process.env.GOODINFO_PROXY_USERNAME || process.env.GOODINFO_PROXY_PASSWORD) {
    await page.authenticate({
      username: process.env.GOODINFO_PROXY_USERNAME || "",
      password: process.env.GOODINFO_PROXY_PASSWORD || "",
    });
  }
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "languages", { get: () => ["zh-TW", "zh", "en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
  });
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
  });
}

async function findMonthlyRevenueClip(page) {
  return page.evaluate(() => {
    const hasText = (node, text) => (node.textContent || "").replace(/\s+/g, "").includes(text);
    const all = Array.from(document.querySelectorAll("body *"));
    const title = all.find((node) => hasText(node, "月營收狀況"));
    if (!title) return null;

    const titleRect = title.getBoundingClientRect();
    const pageY = window.scrollY || document.documentElement.scrollTop || 0;
    const pageX = window.scrollX || document.documentElement.scrollLeft || 0;
    const titleY = titleRect.top + pageY;
    const titleX = titleRect.left + pageX;

    const nextLabels = ["資產負債", "獲利能力", "現金流量", "財務比率", "股利政策"];
    const nextY = all
      .filter((node) => nextLabels.some((label) => hasText(node, label)))
      .map((node) => node.getBoundingClientRect().top + pageY)
      .filter((y) => y > titleY + 120)
      .sort((a, b) => a - b)[0];

    let left = 0;
    let width = Math.max(document.documentElement.clientWidth, document.body.clientWidth || 0);
    let height = nextY ? nextY - titleY : 1500;

    let table = title.closest("table");
    while (table && table.parentElement && table.parentElement.closest("table")) {
      const parent = table.parentElement.closest("table");
      const parentText = (parent.textContent || "").replace(/\s+/g, "");
      if (!parentText.includes("月營收狀況")) break;
      table = parent;
    }
    if (table) {
      const rect = table.getBoundingClientRect();
      const tableY = rect.top + pageY;
      if (rect.height > 250 && rect.height < height + 260) {
        left = Math.max(0, rect.left + pageX - 4);
        width = Math.min(width, rect.width + 8);
        height = Math.max(height, rect.bottom + pageY - tableY);
        return {
          x: left,
          y: Math.max(0, tableY - 4),
          width: Math.max(320, width),
          height: Math.min(Math.max(520, height + 8), 2200),
        };
      }
    }

    return {
      x: Math.max(0, titleX - 8),
      y: Math.max(0, titleY - 8),
      width: Math.max(320, width),
      height: Math.min(Math.max(520, height + 16), 2200),
    };
  });
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function parseYahooRevenueRows(html) {
  const titleText = stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "");
  const stockTitle = titleText.split("|")[0].replace("財務報表 - 營收表 - Yahoo股市", "").trim();
  const rows = [];
  const rowPattern = /<div class="W\(65px\) Ta\(start\)">(\d{4}\/\d{2})<\/div>([\s\S]*?)(?=<div class="W\(65px\) Ta\(start\)">\d{4}\/\d{2}<\/div>|<\/ul><\/div><\/section>|$)/g;
  let match;
  while ((match = rowPattern.exec(html)) && rows.length < 15) {
    const values = [...match[2].matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)]
      .map((span) => stripTags(span[1]))
      .filter(Boolean);
    if (values.length >= 7) {
      rows.push({
        month: match[1],
        revenue: values[0],
        monthlyGrowth: values[1],
        lastYearRevenue: values[2],
        yearlyGrowth: values[3],
        cumulativeRevenue: values[4],
        lastYearCumulativeRevenue: values[5],
        cumulativeGrowth: values[6],
      });
    }
  }
  return {
    stockTitle,
    rows,
  };
}

async function fetchYahooRevenue(stockId) {
  const url = `${YAHOO_REVENUE_BASE_URL}/${encodeURIComponent(stockId)}/revenue`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`Yahoo 股市營收表讀取失敗：HTTP ${response.status}`);
  const html = await response.text();
  const parsed = parseYahooRevenueRows(html);
  if (!parsed.rows.length) throw new Error("Yahoo 股市營收表解析不到月營收資料。");
  return { ...parsed, url };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signedClass(value) {
  const numeric = Number(String(value || "").replace(/[%+,]/g, ""));
  if (numeric > 0) return "up";
  if (numeric < 0) return "down";
  return "";
}

function buildFallbackHtml(stockId, revenue, goodinfoError) {
  const title = revenue.stockTitle || `${stockId} 月營收`;
  const latest = revenue.rows[0] || {};
  const errorText = String(goodinfoError && goodinfoError.message ? goodinfoError.message : goodinfoError || "").slice(0, 180);
  const rows = revenue.rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.month)}</td>
        <td>${escapeHtml(row.revenue)}</td>
        <td class="${signedClass(row.monthlyGrowth)}">${escapeHtml(row.monthlyGrowth)}</td>
        <td>${escapeHtml(row.lastYearRevenue)}</td>
        <td class="${signedClass(row.yearlyGrowth)}">${escapeHtml(row.yearlyGrowth)}</td>
        <td>${escapeHtml(row.cumulativeRevenue)}</td>
        <td>${escapeHtml(row.lastYearCumulativeRevenue)}</td>
        <td class="${signedClass(row.cumulativeGrowth)}">${escapeHtml(row.cumulativeGrowth)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 900px;
      background: #f4f7fb;
      color: #172033;
      font-family: "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
    }
    .wrap { padding: 28px; }
    .card {
      background: white;
      border: 1px solid #d9e2ef;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.10);
    }
    .header {
      padding: 20px 22px;
      background: linear-gradient(135deg, #102033, #1d4ed8);
      color: white;
    }
    .eyebrow { margin: 0 0 6px; font-size: 13px; opacity: .78; font-weight: 700; }
    h1 { margin: 0; font-size: 28px; }
    .note { margin-top: 10px; line-height: 1.55; color: rgba(255,255,255,.86); font-size: 14px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid #d9e2ef;
    }
    .metric { padding: 14px 18px; border-right: 1px solid #d9e2ef; }
    .metric:last-child { border-right: 0; }
    .metric span { display: block; color: #667085; font-size: 12px; }
    .metric strong { display: block; margin-top: 4px; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid #edf2f7; padding: 10px 12px; text-align: right; white-space: nowrap; }
    th:first-child, td:first-child { text-align: left; }
    th { background: #f8fafc; color: #475467; font-size: 12px; }
    .up { color: #b42318; font-weight: 700; }
    .down { color: #027a48; font-weight: 700; }
    .foot { padding: 12px 18px; color: #667085; font-size: 12px; line-height: 1.55; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="card">
      <div class="header">
        <p class="eyebrow">Monthly Revenue Snapshot</p>
        <h1>${escapeHtml(title)} 月營收狀況</h1>
        <div class="note">Goodinfo 目前回傳安全驗證頁，系統改用 Yahoo 股市營收表產生備援截圖。Goodinfo 錯誤摘要：${escapeHtml(errorText)}</div>
      </div>
      <div class="summary">
        <div class="metric"><span>最新月份</span><strong>${escapeHtml(latest.month || "-")}</strong></div>
        <div class="metric"><span>單月營收（仟元）</span><strong>${escapeHtml(latest.revenue || "-")}</strong></div>
        <div class="metric"><span>月增率</span><strong class="${signedClass(latest.monthlyGrowth)}">${escapeHtml(latest.monthlyGrowth || "-")}</strong></div>
        <div class="metric"><span>年增率</span><strong class="${signedClass(latest.yearlyGrowth)}">${escapeHtml(latest.yearlyGrowth || "-")}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>年度／月份</th>
            <th>當月營收</th>
            <th>月增率</th>
            <th>去年同月</th>
            <th>年增率</th>
            <th>累計營收</th>
            <th>去年累計</th>
            <th>累計年增率</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="foot">資料來源：Yahoo 股市營收表（${escapeHtml(revenue.url)}）。原始 Goodinfo 連結仍為 https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${escapeHtml(stockId)}。</div>
    </section>
  </div>
</body>
</html>`;
}

async function renderFallbackMonthlyRevenue(stockId, goodinfoError) {
  const revenue = await fetchYahooRevenue(stockId);
  const browser = await newBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 2 });
    await page.setContent(buildFallbackHtml(stockId, revenue, goodinfoError), { waitUntil: "load" });
    const card = await page.$(".card");
    if (!card) throw new Error("備援月營收圖產生失敗。");
    const buffer = await card.screenshot({ type: "png" });
    if (!buffer || buffer.length < 15000) throw new Error("備援月營收圖內容異常。");
    return buffer;
  } finally {
    await browser.close();
  }
}

async function captureMonthlyRevenue(stockId) {
  try {
    return await captureGoodinfoMonthlyRevenue(stockId);
  } catch (goodinfoError) {
    console.warn("Goodinfo capture failed; rendering Yahoo revenue fallback", goodinfoError);
    return renderFallbackMonthlyRevenue(stockId, goodinfoError);
  }
}

module.exports = async function handler(req, res) {
  const stockId = getStockId(req.query.stockId || req.query.stock_id);
  if (!stockId) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, message: "股票代號格式錯誤。" }));
    return;
  }

  try {
    const buffer = await captureMonthlyRevenue(stockId);
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
    res.end(buffer);
  } catch (error) {
    console.error("monthly-revenue-image error", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, message: error.message || "月營收截圖失敗。" }));
  }
};
