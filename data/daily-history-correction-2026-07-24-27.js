(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const generatedAt = "2026-07-27T20:20:00+08:00";
  const correctedDates = new Set(["2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27"]);

  const items = [
    {
      date: "2026-07-27",
      stock_code: "5536.TW",
      company_name: "聖暉*",
      category: "可轉債發行",
      source_name: "公開資訊觀測站／中央社",
      title: "聖暉*國內第二次無擔保轉換公司債完成訂價",
      url: "https://tw.stock.yahoo.com/news/%E5%85%AC%E5%91%8A-%E8%81%96%E6%9A%89-%E5%9C%8B%E5%85%A7%E7%AC%AC%E4%BA%8C%E6%AC%A1%E7%84%A1%E6%93%94%E4%BF%9D%E8%BD%89%E6%8F%9B%E5%85%AC%E5%8F%B8%E5%82%B5%E5%AE%8C%E6%88%90%E8%A8%82%E5%83%B9-054630694.html",
      published_at: "2026-07-27T13:34:27+08:00",
      summary_zh: "聖暉*第二次無擔保轉換公司債以7月27日為訂價基準日，轉換價格訂為每股1,178元，轉換溢價率105.18%。",
      relevance_score: 48,
      needs_review: false,
      hit_reason: "當日正式公告；直接影響新券轉換價、理論價值與後續承銷觀察。"
    },
    {
      date: "2026-07-27",
      stock_code: "5291.TW",
      company_name: "邑昇",
      category: "可轉債發行",
      source_name: "公開資訊觀測站",
      title: "邑昇國內第二次無擔保轉換公司債收足債款2億元",
      url: "https://pchome.megatime.com.tw/news/cat1/20260727/9700005291202607271.html",
      published_at: "2026-07-27T14:19:15+08:00",
      summary_zh: "邑昇公告第二次無擔保轉換公司債應募款項共新台幣2億元已全數收足並匯入存儲專戶。",
      relevance_score: 44,
      needs_review: false,
      hit_reason: "當日正式公告；確認發行款項到位與新券發行進度。"
    },
    {
      date: "2026-07-27",
      stock_code: "8021.TW",
      company_name: "尖點",
      category: "可轉債注意交易",
      source_name: "公開資訊觀測站",
      title: "尖點二達注意交易資訊標準：轉換價200.4元、轉債收190元",
      url: "https://pchome.megatime.com.tw/news/cat2/20260727/9700008021202607272.html",
      published_at: "2026-07-27T17:28:07+08:00",
      summary_zh: "尖點二（80212）達注意交易標準；截至7月24日未轉換餘額2.734億元，最新轉換價200.4元，7月27日標的收390.5元、轉債收190元。",
      relevance_score: 52,
      needs_review: false,
      hit_reason: "當日正式公告；轉換價值與CB市價差異明顯，應列高優先觀察。"
    },
    {
      date: "2026-07-26",
      stock_code: "2330.TW",
      company_name: "台積電",
      category: "假日市場風險",
      source_name: "Yahoo股市／三立新聞網",
      title: "AI燒錢疑慮拖累費半跌逾4%，台指夜盤跌445點",
      url: "https://tw.stock.yahoo.com/news/%E5%8F%B0%E8%82%A1%E7%9B%A4%E5%89%8D-ai%E7%87%92%E9%8C%A2%E7%96%91%E6%85%AE%E8%B2%BB%E5%8D%8A%E8%B7%8C%E9%80%BE4-%E5%8F%B0%E6%8C%87%E5%A4%9C%E7%9B%A4%E8%B7%8C445%E9%BB%9E-%E5%8F%B0%E8%82%A1%E4%BB%8A%E6%81%90%E5%BB%B6%E7%BA%8C%E5%BC%B1%E5%8B%A2-220600994.html",
      published_at: "2026-07-26T18:06:00+08:00",
      summary_zh: "費城半導體指數下跌4.25%，台積電ADR下挫，台指夜盤跌445點；半導體與AI供應鏈CB隔日開盤風險升高。",
      relevance_score: 34,
      needs_review: false,
      hit_reason: "假日發布的盤前風險訊號；影響半導體與AI供應鏈可轉債評價。"
    },
    {
      date: "2026-07-26",
      stock_code: "2330.TW",
      company_name: "台積電",
      category: "假日市場觀察",
      source_name: "Yahoo股市／財訊快報",
      title: "台股週一仍有震盪，留意亞股開盤與半導體股走勢",
      url: "https://tw.stock.yahoo.com/news/%E5%8F%B0%E8%82%A1%E9%80%B1-%E4%BB%8D%E6%9C%89%E9%9C%87%E7%9B%AA-%E7%95%99%E6%84%8F%E4%BA%9E%E8%82%A1%E9%96%8B%E7%9B%A4%E8%A1%A8%E7%8F%BE-234231957.html",
      published_at: "2026-07-26T19:42:00+08:00",
      summary_zh: "美國半導體股弱勢、台積電ADR下跌，市場預期週一台股仍將震盪，需留意亞股開盤與電子權值股止跌訊號。",
      relevance_score: 30,
      needs_review: false,
      hit_reason: "假日市場展望；可作為隔日CB部位風險控管參考。"
    },
    {
      date: "2026-07-26",
      stock_code: "2330.TW",
      company_name: "台積電",
      category: "假日市場統計",
      source_name: "Yahoo股市／三立新聞網",
      title: "台股一週上漲983點，電腦週邊最強、綠能環保最弱",
      url: "https://tw.stock.yahoo.com/news/%E5%8F%B0%E8%82%A1-%E9%80%B1%E5%BC%B7%E5%BD%88983%E9%BB%9E-%E5%AE%83%E6%85%98%E8%B7%8C9-%E5%BC%B7%E5%BC%B1%E6%97%8F%E7%BE%A4%E6%9B%9D%E5%85%89-202700212.html",
      published_at: "2026-07-26T16:27:00+08:00",
      summary_zh: "證交所統計7月24日加權指數較前週上漲983.57點；電腦及週邊設備類漲幅最大，綠能環保類跌幅最大。",
      relevance_score: 28,
      needs_review: false,
      hit_reason: "假日產業強弱統計；有助於調整CB產業曝險與watchlist排序。"
    },
    {
      date: "2026-07-25",
      stock_code: "2330.TW",
      company_name: "台積電",
      category: "假日市場風險",
      source_name: "Yahoo股市／三立新聞網",
      title: "台股暴漲又暴跌，下週聚焦三大市場變數",
      url: "https://tw.stock.yahoo.com/news/%E6%9A%B4%E6%BC%B2%E5%8F%88%E6%9A%B4%E8%B7%8C-%E5%8F%B0%E8%82%A1%E4%B8%8B%E9%80%B1%E9%82%84%E6%9C%89%E6%88%B2-3-%E5%A4%A7%E9%87%8D%E9%BB%9E%E8%A6%81%E8%A7%80%E5%AF%9F-021600944.html",
      published_at: "2026-07-25T22:16:00+08:00",
      summary_zh: "7月24日台股重挫1,195.97點，但整週仍上漲983點；後續需觀察國際情勢、科技股財報與籌碼修復。",
      relevance_score: 30,
      needs_review: false,
      hit_reason: "週六發布的市場整理；反映高波動環境下CB風險與折溢價可能快速變化。"
    },
    {
      date: "2026-07-25",
      stock_code: "2330.TW",
      company_name: "台積電",
      category: "假日國際市場",
      source_name: "Yahoo股市／經濟日報",
      title: "Fed會議與美國科技巨頭財報成未來一週主要變數",
      url: "https://tw.stock.yahoo.com/news/fed-%E6%9C%83%E8%AD%B0-%E7%BE%8E%E5%9C%8B%E7%A7%91%E6%8A%80%E5%B7%A8%E9%A0%AD%E8%B2%A1%E5%A0%B1-%E6%9C%AA%E4%BE%86-%E5%91%A8%E7%BE%8E%E8%82%A1%E9%82%84%E6%9C%89%E5%93%AA%E4%BA%9B%E8%AE%8A%E6%95%B8-223314955.html",
      published_at: "2026-07-25T18:33:00+08:00",
      summary_zh: "未來一週市場聚焦FOMC會議、科技巨頭財報、核心PCE與中東局勢；可能影響AI與半導體供應鏈估值。",
      relevance_score: 28,
      needs_review: false,
      hit_reason: "週六國際事件行事曆；作為AI與半導體CB隔週風險因子。"
    },
    {
      date: "2026-07-24",
      stock_code: "2486.TW",
      company_name: "一詮",
      category: "可轉債發行",
      source_name: "公開資訊觀測站／中央社",
      title: "一詮國內第七次無擔保轉換公司債完成中國證監會備案",
      url: "https://tw.stock.yahoo.com/quote/2486.TWO/announcement",
      published_at: "2026-07-24T17:00:00+08:00",
      summary_zh: "一詮因發行國內第七次無擔保轉換公司債，已於7月24日依中國證監會相關規定完成備案。",
      relevance_score: 42,
      needs_review: false,
      hit_reason: "7月24日正式公告；屬新券發行程序的重要進度。"
    },
    {
      date: "2026-07-24",
      stock_code: "4581.TW",
      company_name: "光隆精密-KY",
      category: "可轉債價格調整",
      source_name: "MoneyDJ／公開資訊觀測站",
      title: "光隆精密-KY一轉轉換價格由53.4元調整為50.2元",
      url: "https://m.moneydj.com/f1a.aspx?a=b960d84a-324f-4bd7-827e-a279ba5c3255&c=MB06",
      published_at: "2026-07-24T17:24:00+08:00",
      summary_zh: "光隆精密-KY因除息，自8月18日起將第一次無擔保轉換公司債轉換價格由53.4元調整為50.2元。",
      relevance_score: 44,
      needs_review: false,
      hit_reason: "7月24日正式公告；需同步更新轉換價值及溢價率。"
    },
    {
      date: "2026-07-24",
      stock_code: "2455.TW",
      company_name: "全新",
      category: "注意交易／財務資訊",
      source_name: "公開資訊觀測站／中央社",
      title: "全新達注意交易標準，公告近期財務業務資訊",
      url: "https://tw.stock.yahoo.com/quote/2455.TW/announcement",
      published_at: "2026-07-24T18:00:00+08:00",
      summary_zh: "全新因有價證券達注意交易標準，公告近期營收、獲利與EPS資訊；5月營收年增46.51%，稅後淨利年增逾10倍。",
      relevance_score: 34,
      needs_review: false,
      hit_reason: "7月24日正式公告；標的股波動可能影響相關CB轉換價值。"
    }
  ];

  history.records = history.records.filter((record) => !correctedDates.has(record.date));
  history.items = history.items.filter((item) => !correctedDates.has(item.date));

  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.date)) grouped.set(item.date, []);
    grouped.get(item.date).push(item);
  }

  for (const [date, rows] of grouped.entries()) {
    history.records.push({
      date,
      generated_at: generatedAt,
      item_count: rows.length,
      target_count: 308,
      warning_count: rows.filter((item) => item.needs_review).length,
      subject: `可轉債每日情蒐｜${date}｜核實 ${rows.length} 則${date === "2026-07-25" || date === "2026-07-26" ? "（假日補登）" : ""}`
    });
  }

  history.items.push(...items);
  history.records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  history.items.sort((a, b) => String(b.published_at || b.date).localeCompare(String(a.published_at || a.date)));
  history.generated_at = generatedAt;
  history.latest_date = "2026-07-27";
  history.record_count = history.records.length;
  history.item_count = history.items.length;
})();
