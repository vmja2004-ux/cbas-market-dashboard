const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const GOODINFO_BASE_URL = "https://goodinfo.tw/tw/StockDetail.asp";

function getStockId(value) {
  const stockId = String(value || "").replace(/\D/g, "").slice(0, 6);
  return /^\d{4,6}$/.test(stockId) ? stockId : "";
}

async function getExecutablePath() {
  if (process.env.CHROME_EXECUTABLE_PATH) return process.env.CHROME_EXECUTABLE_PATH;
  return chromium.executablePath();
}

async function captureMonthlyRevenue(stockId) {
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--disable-features=site-per-process",
      "--lang=zh-TW,zh",
    ],
    defaultViewport: {
      width: 430,
      height: 1800,
      deviceScaleFactor: 2,
      isMobile: true,
    },
    executablePath: await getExecutablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    });

    const url = `${GOODINFO_BASE_URL}?STOCK_ID=${encodeURIComponent(stockId)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const clip = await page.evaluate(() => {
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
