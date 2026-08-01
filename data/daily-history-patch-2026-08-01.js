(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const date = "2026-08-01";
  const generatedAt = "2026-08-01T19:30:00+08:00";
  const items = [
    {
      date,
      stock_code: "8050.TWO",
      company_name: "廣積",
      category: "轉換價格調整",
      source_name: "櫃買中心公告／鉅亨網",
      title: "廣積六轉換價格8/1起由63.3元調整為60.9元",
      url: "https://news.cnyes.com/news/id/6528524",
      published_at: "2026-08-01T00:00:00+08:00",
      summary_zh: "廣積因現金股利除息，國內第六次無擔保轉換公司債（80506）自8月1日起將轉換價格由63.3元調整為60.9元。應立即更新轉換價值、溢價率與Delta參數；公告顯示現行流通餘額為0，交易端需同步確認是否仍保留觀察標記。",
      relevance_score: 46,
      needs_review: true,
      hit_reason: "轉換價格於今日正式生效，會直接改變CB評價基準；同時需核對流通餘額狀態。"
    },
    {
      date,
      stock_code: "2338.TW",
      company_name: "台灣光罩",
      category: "到期風險行事曆",
      source_name: "櫃買中心公告／MoneyDJ",
      title: "8月CB到期潮啟動：光罩三8/3到期，安集三8/4接續到期",
      url: "https://m.moneydj.com/f1a.aspx?a=ACEF7322-3663-4167-9162-D573CC3E30D6",
      published_at: "2026-08-01T09:00:00+08:00",
      summary_zh: "櫃買中心公告8月共有10檔轉（交）換公司債陸續到期下櫃，最先為光罩三（23383）8月3日到期、安集三（64773）8月4日到期，後續包含系統電五、朋程一、良得電四、樺漢五、晉弘一、艾訊二、和勤四及和勤五。月初應建立部位結案、最後交易日、停止轉換與還本入帳核對清單。",
      relevance_score: 40,
      needs_review: true,
      hit_reason: "8月到期CB密集，月初即需啟動生命週期監控，避免持倉跨越最後交易與轉換期限。"
    }
  ];

  history.records = history.records.filter((record) => record.date !== date);
  history.items = history.items.filter((item) => item.date !== date);
  history.records.unshift({
    date,
    generated_at: generatedAt,
    item_count: items.length,
    target_count: 308,
    warning_count: items.filter((item) => item.needs_review).length,
    subject: `可轉債每日情蒐｜${date}｜重點 ${items.length} 則`
  });
  history.items.unshift(...items);
  history.records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  history.items.sort((a, b) => String(b.published_at || b.date).localeCompare(String(a.published_at || a.date)));
  history.generated_at = generatedAt;
  history.latest_date = date;
  history.record_count = history.records.length;
  history.item_count = history.items.length;
})();