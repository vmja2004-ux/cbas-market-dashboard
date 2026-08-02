(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const date = "2026-08-02";
  const generatedAt = "2026-08-02T19:45:00+08:00";
  const items = [
    {
      date,
      stock_code: "2338.TW",
      company_name: "台灣光罩",
      category: "到期還本／終止上櫃",
      source_name: "公開資訊觀測站／MoneyDJ",
      title: "光罩三8/3到期、8/4終止上櫃，流通餘額已為0",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=f25ed05d-299f-4758-99a5-05b4de183fd0&c=MB06",
      published_at: "2026-08-02T09:00:00+08:00",
      summary_zh: "光罩三（23383）將於8月3日屆滿五年到期，8月4日起終止上櫃買賣，債券依面額現金一次償還，預計8月17日支付到期款。公告資料顯示流通餘額為0；交易與帳務端仍應確認持倉、未交割紀錄及監控清單是否已完成結案。",
      relevance_score: 44,
      needs_review: true,
      hit_reason: "到期日為下一交易日，涉及標的下櫃、部位結案與現金流核對。"
    },
    {
      date,
      stock_code: "6477.TWO",
      company_name: "安集",
      category: "到期還本／最後轉換期限",
      source_name: "公開資訊觀測站／MoneyDJ",
      title: "安集三8/4到期，最遲8/4申請轉換、8/5終止上櫃",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=5fdfc9c9-86c0-4688-b5ac-42f542b860ef",
      published_at: "2026-08-02T09:05:00+08:00",
      summary_zh: "安集三（64773）將於8月4日到期，並於8月5日終止上櫃；債券持有人如擬轉換，最遲須於8月4日向券商提出申請。未轉換債券將按面額102.53%一次償還，預計8月18日支付。應於週一開盤前確認CB市價、轉換價值與到期還本價的相對優劣。",
      relevance_score: 48,
      needs_review: true,
      hit_reason: "最後轉換期限與到期日接近，直接影響持有人應採轉換、賣出或持有至還本的決策。"
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