// CALENDAR 独自習慣化メソッド知識ベース
// 7原則 / 15メソッド / 14ステージ / 8阻害タイプ

const PRINCIPLES = [
  { id: 'P1', text: '「〇〇したら□□する」のセットで考える' },
  { id: 'P2', text: '欲求を高める' },
  { id: 'P3', text: 'スタートしやすくする' },
  { id: 'P4', text: 'しなければならない状況をつくる' },
  { id: 'P5', text: 'みんなの力を使う' },
  { id: 'P6', text: '親切にしてあげる' },
  { id: 'P7', text: 'ごほうびをあげる' },
];

const METHODS = {
  chain_planning:     { no: 1,  name: 'チェーンプランニング',       category: '準備',   principle: 'P1', desc: '既存の習慣の前後に新しい行動をつなげる' },
  concrete_goal:       { no: 2,  name: '具体ゴールセッティング',     category: '準備',   principle: 'P1', desc: '抽象的な目標ではなく、具体的な行動目標を設定する' },
  easy_start:         { no: 3,  name: '簡単スタートセッティング',   category: '準備',   principle: 'P3', desc: '行動を始める前の手間を減らす' },
  noise_removal:      { no: 4,  name: 'アクションノイズ除去',       category: '準備',   principle: 'P3', desc: '行動を妨げる要素を取り除く' },
  desire_plus:        { no: 5,  name: '欲求プラス',                 category: 'きっかけ', principle: 'P2', desc: '楽しいことや魅力的なことと行動を組み合わせる' },
  visual_trigger:     { no: 6,  name: 'ポジティブ視覚トリガー',     category: 'きっかけ', principle: 'P2', desc: '行動したくなる視覚的なきっかけを目に入る場所に置く' },
  reward_reminder:    { no: 7,  name: 'ごほうびリマインダー',       category: 'きっかけ', principle: 'P7', desc: '行動後の報酬を事前に想起させる' },
  community:          { no: 8,  name: '同目標コミュニティー',       category: 'きっかけ', principle: 'P5', desc: '同じ目標を持つ人と一緒に取り組む' },
  mini_goal:          { no: 9,  name: '超ミニマムゴール',           category: '行動',   principle: 'P3', desc: '1分でも始めれば成功。最低限の目標は引き上げない' },
  everyday_habit:     { no: 10, name: 'エブリデイハビット',         category: '行動',   principle: 'P1', desc: 'できるだけ毎日行い、日常の標準にする' },
  share_action:        { no: 11, name: '習慣アクションシェア',       category: '行動',   principle: 'P5', desc: '目標や進捗を他者に共有する' },
  easy_record:        { no: 12, name: '簡単レコード',               category: '報酬',   principle: 'P7', desc: '行動記録を簡単に残す' },
  instant_reward:      { no: 13, name: 'すぐさまごほうび',           category: '報酬',   principle: 'P7', desc: '行動直後に報酬を与える' },
  praise_motivate:    { no: 14, name: 'ほめちぎりモチベート',       category: '報酬',   principle: 'P6', desc: '行動の前・途中・後に積極的に褒める' },
  daily_progress:     { no: 15, name: 'デイリー進歩チェック',       category: '報酬',   principle: 'P7', desc: '日々の進歩を可視化する' },
};

const STAGES = [
  { id: 1,  name: '開始前' },
  { id: 2,  name: 'はじめての着手' },
  { id: 3,  name: '気持ちが向かない時期' },
  { id: 4,  name: '2〜3回目' },
  { id: 5,  name: '間が開く' },
  { id: 6,  name: 'ペース崩れ始め時期' },
  { id: 7,  name: '間が空いての復活' },
  { id: 8,  name: '習慣化過渡期' },
  { id: 9,  name: '飽きる時期' },
  { id: 10, name: '自然にできるようになる時期' },
  { id: 11, name: '定着期' },
  { id: 12, name: 'やらないと気持ち悪くなるくらい習慣になっている時期' },
  { id: 13, name: '習慣崩れ期' },
  { id: 14, name: '完全離脱期' },
];

const BARRIERS = {
  overdoing:  { id: 'overdoing',  name: 'がんばりすぎ',     policy: 'ハードルを上げすぎず、少しずつ取り組む' },
  three_day:  { id: 'three_day',  name: '三日坊主',         policy: '最初から頑張りすぎず、タイミングを決め、間を空けない' },
  busy:       { id: 'busy',       name: '忙しくてできない', policy: '少しで成功とし、安定して時間が取れるタイミングを探す' },
  postpone:   { id: 'postpone',   name: '先延ばし',         policy: 'あとでしっかりやるより、今少しだけ取り組む' },
  forgetful:  { id: 'forgetful',  name: 'つい忘れる',       policy: 'リマインドとタイミングを最適化する' },
  solo:       { id: 'solo',       name: '一人じゃ続かない', policy: '目標宣言、仲間、予約などを活用する' },
  no_motivation: { id: 'no_motivation', name: 'やる気が起きない', policy: '好きなこととの組み合わせ、ごほうび、少しだけ始める' },
  none:       { id: 'none',       name: '習慣化問題なし',   policy: '過剰介入しない' },
};

// 阻害タイプ×ステージ → 推奨メソッド（Habit Strategy Agent の選択基準）
const STRATEGY_MATRIX = {
  busy:         { methods: ['mini_goal', 'chain_planning', 'easy_start'], timing: '安定して時間が取れそうな時間帯を探る' },
  overdoing:    { methods: ['easy_start', 'mini_goal', 'praise_motivate'], timing: '頻度を意図的に抑え、成功体験を褒める' },
  three_day:    { methods: ['chain_planning', 'concrete_goal', 'mini_goal'], timing: '間が空く前に声をかける' },
  postpone:     { methods: ['mini_goal', 'noise_removal', 'visual_trigger'], timing: '先延ばし宣言があった直後に少しだけ提案' },
  forgetful:    { methods: ['reward_reminder', 'visual_trigger', 'chain_planning'], timing: '本人が決めた時間+必要に応じ最大2回' },
  solo:         { methods: ['community', 'share_action', 'easy_record'], timing: 'レッスンや仲間と重なる日を狙う' },
  no_motivation:{ methods: ['desire_plus', 'instant_reward', 'mini_goal'], timing: 'やる気の波を前提に、ごほうびと組み合わせる' },
  none:         { methods: ['daily_progress', 'easy_record', 'praise_motivate'], timing: '1日1回、過剰介入しない' },
};

// ステージ補正: 深いステージほど維持系、浅いステージほど開始系
const STAGE_ADJUST = {
  early:  ['easy_start', 'mini_goal', 'chain_planning'],
  middle: ['concrete_goal', 'reward_reminder', 'community'],
  late:   ['daily_progress', 'easy_record', 'praise_motivate', 'everyday_habit'],
  lapse:  ['mini_goal', 'desire_plus', 'share_action'],
};

module.exports = { PRINCIPLES, METHODS, STAGES, BARRIERS, STRATEGY_MATRIX, STAGE_ADJUST };
