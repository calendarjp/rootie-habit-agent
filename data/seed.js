// デモ用ユーザー3名（架空データであることを明示）
// records: 過去28日分のジム入退館データ。in:true=来館。hour=入館時刻。
// chatLogs: 過去のチャット反応（分析に利用）
// pastInterventions: 過去の介入とその結果（知識グラフFeedbackノードの材料）

const day = (n) => n; // 0=28日前, 27=昨日 として扱う

const SEED = [
  {
    id: 'user_a', name: 'Aさん', demo: true, goal: '週2回ジムで筋トレ', targetDaysPerWeek: 2,
    prefs: { reminderTime: '07:30', activeHours: [21, 22], tone: '丁寧+シンプル', likes: '短時間で終わるメニュー' },
    records: [
      { day: 2, date: '2026-10-22', in: true, hour: 21, min: 18 },
      { day: 9, date: '2026-10-29', in: true, hour: 22, min: 40 },
      { day: 14, date: '2026-11-03', in: false },
      { day: 21, date: '2026-11-10', in: true, hour: 21, min: 15 },
      { day: 24, date: '2026-11-13', in: false },
    ],
    visitNotes: ['予定が不規則で平日夜間のみ', 'リマインド後に来館した実績あり'],
    chatLogs: [
      { role: 'user', text: '仕事が忙しくてなかなか行けない…', ts: '2026-11-10' },
      { role: 'user', text: '行きたい気持ちはあるんですが', ts: '2026-11-12' },
    ],
    pastInterventions: [
      { method: 'mini_goal', text: '「今日は10分だけストレッチ」でOKにしませんか？', result: 'positive', note: '翌日22時に15分来館' },
      { method: 'concrete_goal', text: '週2回、火曜と土曜の20時に来ましょう', result: 'neutral', note: '反応なし' },
    ],
  },
  {
    id: 'user_b', name: 'Bさん', demo: true, goal: '毎日ジムで1時間トレーニング', targetDaysPerWeek: 7,
    prefs: { reminderTime: '07:00', activeHours: [19, 20], tone: '元気+ほめ中心', likes: '達成感を記録すること' },
    records: [
      { day: 24, date: '2026-10-25', in: true, hour: 19, min: 70 },
      { day: 25, date: '2026-10-26', in: true, hour: 19, min: 65 },
      { day: 26, date: '2026-10-27', in: true, hour: 20, min: 60 },
      { day: 27, date: '2026-10-28', in: true, hour: 19, min: 75 },
      { day: 0,  date: '2026-11-16', in: true, hour: 20, min: 20 },
    ],
    visitNotes: ['開始1週間は高頻度・長時間', 'その後約3週間中断', '昨日久しぶりに短時間来館'],
    chatLogs: [
      { role: 'user', text: '最初は毎日1時間やると決めたのに続かない…', ts: '2026-11-15' },
    ],
    pastInterventions: [
      { method: 'everyday_habit', text: '毎日1時間続けましょう！', result: 'negative', note: '1週間で中断' },
      { method: 'mini_goal', text: '今日は5分だけでもOK', result: 'positive', note: '翌日20分来館' },
    ],
  },
  {
    id: 'user_c', name: 'Cさん', demo: true, goal: '週3回ジムでランニング', targetDaysPerWeek: 3,
    prefs: { reminderTime: '07:00', activeHours: [7, 18], tone: '静かで効率的', likes: '進捗の可視化' },
    records: [
      { day: 0, date: '2026-11-16', in: true, hour: 7,  min: 45 },
      { day: 2, date: '2026-11-14', in: true, hour: 18, min: 50 },
      { day: 4, date: '2026-11-12', in: true, hour: 7,  min: 45 },
      { day: 7, date: '2026-11-09', in: true, hour: 18, min: 55 },
      { day: 9, date: '2026-11-07', in: true, hour: 7,  min: 40 },
      { day: 11, date: '2026-11-05', in: true, hour: 18, min: 50 },
      { day: 14, date: '2026-11-02', in: true, hour: 7,  min: 45 },
      { day: 16, date: '2026-10-31', in: true, hour: 18, min: 50 },
      { day: 18, date: '2026-10-29', in: true, hour: 7,  min: 40 },
      { day: 21, date: '2026-10-26', in: true, hour: 18, min: 55 },
      { day: 23, date: '2026-10-24', in: true, hour: 7,  min: 45 },
    ],
    visitNotes: ['4週間連続で安定した頻度', '朝と夕方で固定傾向'],
    chatLogs: [
      { role: 'user', text: '今のペースを維持したいです', ts: '2026-11-11' },
    ],
    pastInterventions: [
      { method: 'daily_progress', text: '今週の進捗を共有します', result: 'positive', note: '継続中' },
    ],
  },
];

module.exports = SEED;
