(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const date = "2026-07-29";
  const generatedAt = "2026-07-29T19:04:00+08:00";
  const items = [
    {
      date,
      stock_code: "3088.TWO",
      company_name: "艾訊",
      category: "財報行事曆",
      source_name: "公開資訊觀測站／Yahoo股市",
      title: "艾訊董事會於7/29審議115年第2季財務報告",
      url: "https://tw.stock.yahoo.com/quote/3088.TWO/announcement",
      published_at: "2026-07-29T18:30:00+08:00",
      summary_zh: "艾訊原公告董事會預定於115年7月29日審議第二季財務報告。公司6月合併營收8.05億元、年增48.37%，上半年累計營收46.13億元、年增41.75%；財報結果與毛利率變化將影響艾訊二的轉換價值與溢價率評估。",
      relevance_score: 34,
      needs_review: true,
      hit_reason: "CB標的公司於當日進入季報審議節點，營收高成長後的獲利與毛利率為可轉債估值關鍵。"
    },
    {
      date,
      stock_code: "6182.TWO",
      company_name: "合晶",
      category: "可轉債事件",
      source_name: "櫃買中心／MoneyDJ",
      title: "合晶七到期下櫃後，合晶八高轉換價值交易風險續列觀察",
      url: "https://www.moneydj.com/KMDJ/search/list.aspx?_QueryType_=NW&_Query_=%E5%90%88%E6%99%B6%E7%A7%91%E6%8A%80%E8%82%A1%E4%BB%BD%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8",
      published_at: "2026-07-29T17:30:00+08:00",
      summary_zh: "合晶七已於7月27日到期並自7月28日起終止上櫃；市場焦點轉向合晶八。依7月22日公告，合晶八轉換價格33.10元、CB參考價413元，標的股當日收129元，屬高轉換價值且波動顯著標的，應持續監控溢價率、成交量與處置資訊。",
      relevance_score: 42,
      needs_review: true,
      hit_reason: "同公司舊券到期下櫃後，存續券的高轉換價值與價格波動成為主要風險監控項目。"
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
