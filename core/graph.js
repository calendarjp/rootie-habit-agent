// Knowledge Graph Agent 用のJSON知識グラフ（Neo4j代替実装）
// ノード: User / Habit / HabitStage / BarrierType / HabitMethod / Intervention / BehaviorRecord / Feedback
// リレーション: HAS_HABIT / IN_STAGE / HAS_BARRIER / ADDRESSED_BY / USES / RECEIVED / GENERATED / INFORMS / TRIGGERED_BY
// ※ Neo4j接続情報が無かったため、同一スキーマをインメモリJSONグラフで実装しCypher風クエリAPIを提供する。

class KnowledgeGraph {
  constructor() {
    this.nodes = new Map(); // id -> {label, props}
    this.edges = [];        // {type, from, to}
  }
  addNode(id, label, props = {}) {
    this.nodes.set(id, { label, props: { id, ...props } });
    return id;
  }
  addEdge(type, from, to) { this.edges.push({ type, from, to }); }

  neighbors(id, { type, dir = 'out' } = {}) {
    return this.edges
      .filter(e => (dir === 'out' ? e.from === id : e.to === id) && (!type || e.type === type))
      .map(e => ({ edge: e.type, node: this.nodes.get(dir === 'out' ? e.to : e.from) }))
      .filter(x => x.node);
  }

  // 例: 「このユーザーの阻害要因に対して、過去の介入で効果があったメソッド」を検索
  query({ userId, barrierId }) {
    const result = { methods: [], evidence: [] };
    const barriers = userId ? this.neighbors(userId, { type: 'HAS_BARRIER' }).map(n => n.node) : [];
    const target = barrierId ? [this.nodes.get(barrierId)] : barriers;
    for (const b of target) {
      if (!b) continue;
      for (const { node: method } of this.neighbors(b.props.id, { type: 'ADDRESSED_BY' })) {
        const feedbacks = this.neighbors(method.props.id, { type: 'INFORMS', dir: 'in' })
          .map(f => f.node).filter(f => f.label === 'Feedback');
        const good = feedbacks.filter(f => f.props.effect === 'positive').length;
        const bad = feedbacks.filter(f => f.props.effect === 'negative').length;
        result.methods.push({ methodId: method.props.id, name: method.props.name, positive: good, negative: bad });
      }
      result.evidence.push(...target.map(t => t.props.name));
    }
    result.methods.sort((a, b) => (b.positive - b.negative) - (a.positive - a.negative));
    return result;
  }
}

const { BARRIERS, METHODS } = require('./knowledge');

function buildGraph(seed) {
  const g = new KnowledgeGraph();
  // --- 習慣化ドメイン知識 ---
  g.addNode('habit:gym', 'Habit', { name: 'ジム通い' });
  for (const s of [1,2,3,4,5,6,7,8,9,10,11,12,13,14]) g.addNode(`stage:${s}`, 'HabitStage', { stage: s });
  for (const b of Object.values(BARRIERS)) {
    g.addNode(`barrier:${b.id}`, 'BarrierType', { name: b.name, policy: b.policy });
    g.addEdge('ADDRESSED_BY', `barrier:${b.id}`, `habit:gym`);
  }
  for (const m of Object.entries(METHODS)) {
    g.addNode(`method:${m[0]}`, 'HabitMethod', { name: m[1].name, category: m[1].category });
  }
  // 阻害→メソッドの初期推奨（ドメイン知識）
  const INIT_LINKS = {
    busy: ['mini_goal', 'chain_planning', 'easy_start'],
    overdoing: ['easy_start', 'mini_goal', 'praise_motivate'],
    three_day: ['chain_planning', 'concrete_goal'],
    postpone: ['mini_goal', 'noise_removal'],
    forgetful: ['reward_reminder', 'visual_trigger'],
    solo: ['community', 'share_action'],
    no_motivation: ['desire_plus', 'instant_reward'],
    none: ['daily_progress', 'easy_record'],
  };
  for (const [b, ms] of Object.entries(INIT_LINKS)) for (const m of ms) g.addEdge('ADDRESSED_BY', `barrier:${b}`, `method:${m}`);

  // --- ユーザー（デモデータに基づく。デモデータであることを明示） ---
  for (const u of seed) {
    g.addNode(`user:${u.id}`, 'User', { name: u.name, demo: true });
    g.addEdge('HAS_HABIT', `user:${u.id}`, 'habit:gym');
  }
  return g;
}

module.exports = { KnowledgeGraph, buildGraph };
