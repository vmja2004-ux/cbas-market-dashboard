(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const date = "2026-07-30";
  const generatedAt = "2026-07-30T19:09:00+08:00";
  const items = [
    {
      date,
      stock_code: "6683.TWO",
      company_name: "雍智科技",
      category: "新券競拍",
      source_name: "證券商業同業公會競價拍賣公告",
      title: "雍智科技一7/30開標，無擔保可轉債底標102元",
      url: "https://auction.3x.com.tw/auc_none.php",
      published_at: "2026-07-30T10:00:00+08:00",
      summary_zh: "雍智科技一（66831）於7月30日辦理競價拍賣開標，競拍數量12,750張、最低投標價102元，預計8月10日撥券。開標結果將形成新券掛牌前的成本基準，應持續追蹤得標加權價格、承銷溢價及掛牌後流動性。",
      relevance_score: 48,
      needs_review: true,
      hit_reason: "新發行CB於當日開標，直接影響初始持有成本、掛牌參考價與後續套利空間。"
    },
    {
      date,
      stock_code: "3081.TWO",
      company_name: "聯亞",
      category: "新券競拍",
      source_name: "證券商業同業公會競價拍賣公告",
      title: "聯亞一7/30競拍截止，8/3開標、底標105元",
      url: "https://auction.3x.com.tw/auc_none.php",
      published_at: "2026-07-30T14:00:00+08:00",
      summary_zh: "聯亞一（30811）有擔保轉換公司債競價拍賣於7月30日截止投標，競拍數量10,788張、最低投標價105元，預計8月3日開標、8月12日撥券。應關注投標倍數與得標均價，評估市場對高速光通訊題材與轉換權價值的定價。",
      relevance_score: 46,
      needs_review: true,
      hit_reason: "競拍截止日是新券定價的重要節點，投標熱度可反映市場風險偏好與掛牌溢價預期。"
    },
    {
      date,
      stock_code: "2233.TWO",
      company_name: "宇隆",
      category: "除權息／停止轉換",
      source_name: "公開資訊觀測站／Goodinfo",
      title: "宇隆7/30除息，宇隆一停止轉換至8/5",
      url: "https://goodinfo.tw/tw/StockAnnounceDetail.asp?CLAIM_TIME=2026%2F06%2F23+15%3A26%3A26&STOCK_ID=2233",
      published_at: "2026-07-30T09:00:00+08:00",
      summary_zh: "宇隆於7月30日除息，每股現金股利4元；宇隆一自7月13日至8月5日停止轉換。除息後應核對轉換價格調整公告，重新計算轉換價值與溢價率，避免沿用除息前參數。",
      relevance_score: 36,
      needs_review: true,
      hit_reason: "除息與停止轉換會影響轉換價值計算及短期套利執行時點。"
    },
    {
      date,
      stock_code: "1514.TW",
      company_name: "亞力",
      category: "除權息／停止轉換",
      source_name: "公開資訊觀測站／MoneyDJ",
      title: "亞力7/30除權息，亞力二停止轉換至8/5",
      url: "https://www.moneydj.com/kmdj/news/newsviewer.aspx?a=813eda79-68c9-42a9-9bb0-96918bfba1c8",
      published_at: "2026-07-30T09:00:00+08:00",
      summary_zh: "亞力於7月30日除權息，配發每股現金股利2元及股票股利0.2元；亞力二自7月13日至8月5日停止轉換。需等待並核對新轉換價格，更新CB轉換價值、溢價率及Delta曝險。",
      relevance_score: 40,
      needs_review: true,
      hit_reason: "同時除權與除息對轉換價格調整幅度較大，需即時更新估值參數。"
    },
    {
      date,
      stock_code: "5457.TWO",
      company_name: "宣德",
      category: "除息／停止轉換",
      source_name: "公開資訊觀測站／Goodinfo",
      title: "宣德7/30除息，宣德三停止轉換至8/5",
      url: "https://goodinfo.tw/tw/StockAnnounceDetail.asp?CLAIM_TIME=2026%2F06%2F30+11%3A32%3A37&STOCK_ID=5457",
      published_at: "2026-07-30T09:00:00+08:00",
      summary_zh: "宣德於7月30日除息，每股現金股利1.5元；宣德三（54573）自7月13日至8月5日停止轉換。應於轉換價格調整生效後重算轉換價值，並留意停止轉換期間的CB與現股價差擴大風險。",
      relevance_score: 35,
      needs_review: true,
      hit_reason: "除息及停止轉換同步發生，對短期套利可執行性與溢價率判讀有直接影響。"
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