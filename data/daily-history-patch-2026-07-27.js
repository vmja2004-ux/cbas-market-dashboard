(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const date = "2026-07-27";
  const generatedAt = "2026-07-27T19:48:00+08:00";
  const items = [
    {
      date,
      stock_code: "8476.TW",
      company_name: "台境*",
      category: "可轉債事件",
      source_name: "MoneyDJ",
      title: "台境*二轉換普通股882,046股自7/27起上市買賣",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=54472974-e597-4406-86db-a27ae042e36d",
      published_at: "2026-07-27T09:00:00+08:00",
      summary_zh: "台境*國內第二次無擔保轉換公司債債權人申請轉換882,046股，轉換普通股自7月27日起與原有普通股合併上市買賣。",
      relevance_score: 40,
      needs_review: false,
      hit_reason: "直接命中可轉債轉換普通股上市事件，需追蹤股本稀釋與後續籌碼變化。"
    },
    {
      date,
      stock_code: "3702.TW",
      company_name: "大聯大",
      category: "可轉債事件",
      source_name: "MoneyDJ",
      title: "大聯大三7/27終止櫃檯買賣，贖回價100%",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=f02e00a4-1405-4039-a21e-42aec60b524f",
      published_at: "2026-07-27T08:30:00+08:00",
      summary_zh: "大聯大三（37023）完成發行公司提前贖回程序，7月27日起終止櫃檯買賣，收回價款預計7月31日發放。",
      relevance_score: 42,
      needs_review: false,
      hit_reason: "直接命中可轉債提前贖回及下櫃事件，應自交易與到期監控清單移除。"
    },
    {
      date,
      stock_code: "8466.TW",
      company_name: "美吉吉-KY",
      category: "可轉債事件",
      source_name: "MoneyDJ",
      title: "美吉吉-KY二到期還本，7/27起終止上櫃買賣",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=680e700c-e27d-4c63-99e9-1c490cdf97b7",
      published_at: "2026-07-27T08:20:00+08:00",
      summary_zh: "美吉吉-KY第二次無擔保轉換公司債於7月26日到期，7月27日起終止上櫃買賣，未轉換債券依面額現金償還。",
      relevance_score: 40,
      needs_review: false,
      hit_reason: "直接命中可轉債到期還本與終止交易事件。"
    },
    {
      date,
      stock_code: "5230.TW",
      company_name: "雷笛克光學",
      category: "可轉債事件",
      source_name: "MoneyDJ",
      title: "雷笛克光學三到期，7/27起終止上櫃買賣",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=e8ff1fe3-760f-4bac-81b2-d87c0710dd7d",
      published_at: "2026-07-27T08:10:00+08:00",
      summary_zh: "雷笛克光學第三次有擔保轉換公司債於7月24日到期，7月27日起終止櫃檯買賣，未轉換債券依面額現金償還。",
      relevance_score: 40,
      needs_review: false,
      hit_reason: "直接命中可轉債到期還本與終止交易事件。"
    },
    {
      date,
      stock_code: "6182.TW",
      company_name: "合晶",
      category: "可轉債事件",
      source_name: "MoneyDJ",
      title: "合晶七7/27到期，7/28起終止上櫃買賣",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=974d981e-4598-4052-b0b7-4f8ebe4f6d0a",
      published_at: "2026-07-27T10:00:00+08:00",
      summary_zh: "合晶七於7月27日到期，7月28日起終止上櫃買賣；到期償還價格為債券面額102.016%，預計8月14日支付。",
      relevance_score: 44,
      needs_review: false,
      hit_reason: "直接命中可轉債到期與次日下櫃事件，包含到期償還溢價資訊。"
    },
    {
      date,
      stock_code: "6719.TW",
      company_name: "力智",
      category: "可轉債事件",
      source_name: "MoneyDJ",
      title: "力智私募可轉債轉換價自7/27調整為239.4元",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=f49e1b92-791e-4954-8c37-11b9a569645a",
      published_at: "2026-07-27T09:30:00+08:00",
      summary_zh: "力智因除息調整國內第一次私募無擔保轉換公司債轉換價格，自7月27日起由243.2元調整為239.4元。",
      relevance_score: 38,
      needs_review: false,
      hit_reason: "直接命中可轉債轉換價格調整，需同步更新轉換價值與溢價率計算。"
    },
    {
      date,
      stock_code: "6182.TW",
      company_name: "合晶",
      category: "籌碼消息",
      source_name: "Yahoo股市",
      title: "合晶7/27成交量放大至24,039張，股價連9跌",
      url: "https://tw.stock.yahoo.com/quote/6182/announcement",
      published_at: "2026-07-27T13:30:00+08:00",
      summary_zh: "合晶7月27日收116元、上漲1.75%，成交量24,039張；此前累計連9跌，合晶七到期與合晶八高溢價交易同時值得觀察。",
      relevance_score: 31,
      needs_review: true,
      hit_reason: "標的股價與成交量出現顯著波動，且同公司多檔可轉債事件集中。"
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
    subject: `可轉債每日情蒐｜${date}｜命中 ${items.length} 則`
  });
  history.items.unshift(...items);
  history.records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  history.items.sort((a, b) => String(b.published_at || b.date).localeCompare(String(a.published_at || a.date)));
  history.generated_at = generatedAt;
  history.latest_date = date;
  history.record_count = history.records.length;
  history.item_count = history.items.length;
})();
