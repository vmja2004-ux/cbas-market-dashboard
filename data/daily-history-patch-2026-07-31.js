(() => {
  const history = window.CB_DAILY_HISTORY;
  if (!history || !Array.isArray(history.records) || !Array.isArray(history.items)) return;

  const date = "2026-07-31";
  const generatedAt = "2026-07-31T12:00:00+08:00";
  const items = [
    {
      date,
      stock_code: "9958.TW",
      company_name: "世紀鋼",
      category: "轉換價格調整",
      source_name: "公開資訊觀測站／MoneyDJ",
      title: "世紀鋼七轉換價格7/31起由241.7元調整為232.5元",
      url: "https://m.moneydj.com/f1a.aspx?a=159139a4-c68e-434f-b5c0-ff861394d195",
      published_at: "2026-07-31T09:00:00+08:00",
      summary_zh: "世紀鋼因配發現金股利，國內第七次無擔保轉換公司債自7月31日起將轉換價格由241.7元調整為232.5元。應同步更新轉換價值、溢價率與Delta估算，避免沿用除息前參數。",
      relevance_score: 44,
      needs_review: true,
      hit_reason: "轉換價格調整今日生效，直接改變CB內含轉換權價值與套利評價基準。"
    },
    {
      date,
      stock_code: "1436.TW",
      company_name: "華友聯",
      category: "轉換價格調整",
      source_name: "公開資訊觀測站／MoneyDJ",
      title: "華友聯三轉換價格7/31起由128.7元調整為114.3元",
      url: "https://m.moneydj.com/f1a.aspx?a=c2f3358f-e137-4d98-88d7-cc9ec2fb54fe",
      published_at: "2026-07-31T09:00:00+08:00",
      summary_zh: "華友聯辦理除息，國內第三次無擔保轉換公司債自7月31日起轉換價格由128.7元調整為114.3元。調整幅度明顯，需重新核算轉換價值、溢價率及價內程度，並留意除息後現股波動。",
      relevance_score: 46,
      needs_review: true,
      hit_reason: "轉換價大幅下修今日生效，會顯著影響CB價值與交易訊號。"
    },
    {
      date,
      stock_code: "5009.TWO",
      company_name: "榮剛",
      category: "到期還本／終止上櫃",
      source_name: "公開資訊觀測站／MoneyDJ",
      title: "榮剛七7/31到期，8/3終止上櫃並按101.51%還本",
      url: "https://m.moneydj.com/f1a.aspx?a=4097a1d7-29c0-4d14-876c-e1218304c99f&c=MB06",
      published_at: "2026-07-31T17:00:00+08:00",
      summary_zh: "榮剛七（50097）於7月31日到期，將於8月3日終止上櫃買賣，依發行辦法按面額101.51%以現金一次償還，預計8月7日支付。現行流通餘額已為零，後續自追蹤清單移除或標記結案。",
      relevance_score: 42,
      needs_review: true,
      hit_reason: "CB到期與下櫃屬生命週期終點，需停止交易監控並完成標的結案。"
    },
    {
      date,
      stock_code: "3702.TW",
      company_name: "大聯大",
      category: "提前贖回款發放",
      source_name: "櫃買中心公告／PChome股市",
      title: "大聯大三提前贖回款7/31發放",
      url: "https://pchome.megatime.com.tw/news/cat2/20260610/9700003702202606101.html",
      published_at: "2026-07-31T10:00:00+08:00",
      summary_zh: "大聯大三（37023）已於7月27日終止櫃檯買賣，提前贖回價款於7月31日發放。未於期限內完成轉換者將按面額以現金收回；持有人應核對款項入帳及相關費用扣除。",
      relevance_score: 34,
      needs_review: false,
      hit_reason: "提前贖回流程今日完成付款，屬持有人現金流與部位結案事件。"
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