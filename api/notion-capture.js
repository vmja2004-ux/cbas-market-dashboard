const crypto = require("crypto");

const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function getEnv(...names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return "";
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("請求內容不是有效的 JSON。"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeStockId(item) {
  return String(item.stockId || item.stock_id || item.stock_code || "")
    .replace(/\.TW$/i, "")
    .replace(/\D/g, "")
    .slice(0, 6);
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function textRich(text, href) {
  return {
    type: "text",
    text: {
      content: String(text || "").slice(0, 1800),
      ...(href ? { link: { url: href } } : {}),
    },
  };
}

function recordKeyFor(item, stockId) {
  return crypto
    .createHash("sha256")
    .update([stockId, item.url || item.newsUrl || "", item.date || "", item.title || ""].join("|"))
    .digest("hex")
    .slice(0, 16);
}

async function notionFetch(path, options = {}) {
  const token = getEnv("NOTION_TOKEN");
  if (!token) throw new Error("伺服器尚未設定 NOTION_TOKEN。");
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Notion API ${response.status}`);
  }
  return data;
}

async function queryStockPage(databaseId, titleProperty, stockId) {
  const result = await notionFetch(`/databases/${databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 10,
      filter: {
        property: titleProperty,
        title: {
          contains: stockId,
        },
      },
    }),
  });
  return (result.results || [])[0] || null;
}

async function createStockPage(databaseId, titleProperty, stockName, stockId) {
  const title = `${stockName || "未命名"}${stockId}`;
  return notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: {
        [titleProperty]: {
          title: [textRich(title)],
        },
      },
    }),
  });
}

async function listPageText(pageId) {
  let cursor;
  const parts = [];
  do {
    const query = cursor ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}` : "?page_size=100";
    const data = await notionFetch(`/blocks/${pageId}/children${query}`, { method: "GET" });
    for (const block of data.results || []) {
      const richText = block[block.type]?.rich_text || [];
      for (const part of richText) parts.push(part.plain_text || "");
      if (block.type === "image") parts.push("[image]");
    }
    cursor = data.has_more ? data.next_cursor : "";
  } while (cursor);
  return parts.join("\n");
}

function buildBlocks(item, stockId, stockName, recordKey, imageUrl) {
  const title = item.title || item.newsTitle || "(無標題)";
  const newsUrl = item.url || item.newsUrl || "";
  const newsDate = item.date || item.newsDate || "";
  const source = item.source_name || item.sourceName || "";
  const capturedAt = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
  const goodinfoUrl = `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${stockId}`;

  return [
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [textRich(`${newsDate || "今日"} ${stockName}${stockId} 月營收狀況`)],
      },
    },
    {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: { url: imageUrl },
        caption: [textRich(`Goodinfo 月營收狀況截圖，擷取時間：${capturedAt}`)],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [textRich(`月營收截圖紀錄碼：${recordKey}`)],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [textRich(`觸發新聞：${title}`, newsUrl || undefined)],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [textRich(`新聞日期：${newsDate || "-"}`)],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [textRich(`新聞來源：${source || "-"}`)],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [textRich(`Goodinfo：${goodinfoUrl}`, goodinfoUrl)],
      },
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [textRich(`紀錄碼：${recordKey}`)],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [textRich((item.summary_zh || item.summary || "").slice(0, 1800))],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [textRich(item.hit_reason || "")],
      },
    },
  ];
}

async function appendBlocks(pageId, blocks) {
  return notionFetch(`/blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({ children: blocks }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { ok: false, message: "只接受 POST。" });
    return;
  }

  const captureKey = getEnv("CAPTURE_KEY", "NOTION_CAPTURE_KEY");
  if (captureKey && req.headers["x-capture-key"] !== captureKey) {
    json(res, 401, { ok: false, message: "Notion 擷取存取碼錯誤。" });
    return;
  }

  try {
    const item = await readJson(req);
    const stockId = normalizeStockId(item);
    const stockName = String(item.stockName || item.stock_name || item.company_name || "").trim();
    if (!stockId || !/^\d{4,6}$/.test(stockId)) throw new Error("新聞資料缺少有效股票代號。");
    if (!stockName) throw new Error("新聞資料缺少公司名稱。");

    const databaseId = getEnv("NOTION_STOCK_DATABASE_ID", "NOTION_DATABASE_ID", "STOCK_DATABASE_ID");
    if (!databaseId) throw new Error("伺服器尚未設定 NOTION_STOCK_DATABASE_ID。");
    const titleProperty = getEnv("NOTION_TITLE_PROPERTY", "NOTION_STOCK_TITLE_PROPERTY") || "Name";

    let page = await queryStockPage(databaseId, titleProperty, stockId);
    let status = "updated";
    if (!page) {
      page = await createStockPage(databaseId, titleProperty, stockName, stockId);
      status = "created";
    }

    const recordKey = recordKeyFor(item, stockId);
    const pageText = await listPageText(page.id);
    const newsUrl = item.url || item.newsUrl || "";
    const hasNews = pageText.includes(recordKey) || (newsUrl && pageText.includes(newsUrl));
    const hasScreenshot = pageText.includes(`月營收截圖紀錄碼：${recordKey}`);

    if (hasNews && hasScreenshot) {
      json(res, 200, {
        ok: true,
        status: "already_exists",
        stock_id: stockId,
        page_id: page.id,
        page_url: page.url,
        message: "此新聞與月營收截圖已收錄。",
      });
      return;
    }

    const imageUrl = `${getOrigin(req)}/api/monthly-revenue-image?stockId=${encodeURIComponent(stockId)}&v=${encodeURIComponent(
      new Date().toISOString().slice(0, 10)
    )}`;
    await appendBlocks(page.id, buildBlocks(item, stockId, stockName, recordKey, imageUrl));

    if (hasNews && !hasScreenshot) status = "backfilled_screenshot";

    json(res, 200, {
      ok: true,
      status,
      stock_id: stockId,
      page_id: page.id,
      page_url: page.url,
      image_url: imageUrl,
      message: status === "backfilled_screenshot" ? "已為既有新聞補上月營收截圖。" : "已寫入新聞與月營收截圖。",
    });
  } catch (error) {
    console.error("notion-capture error", error);
    json(res, 500, { ok: false, message: error.message || "Notion 寫入失敗。" });
  }
};
