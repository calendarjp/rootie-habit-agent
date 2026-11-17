// Orchestrator Agent（統括エージェント）— Harness本体
// タスク分解 → エージェント選択 → 並列実行 → 検証 → 統合 → 介入方針決定 → 実行履歴記録
const { BehaviorAnalysisAgent, KnowledgeGraphAgent, HabitStrategyAgent, PersonalizationAgent, FeedbackEvaluationAgent, QAAgent } = require('./agents');
const { BARRIERS, METHODS } = require('./knowledge');

// チャット発言の反応分類（決定論的キーワード分類。MLではない）
function classifyReaction(text) {
  const t = text || '';
  if (/行った|行ってき|いった|行けた|できた|達成|終わっ|トレーニングした/.test(t)) return { type: 'success', detail: t };
  if (/忙し|仕事が|会議|残業|出張/.test(t)) return { type: 'busy', detail: t };
  if (/疲れ|つかれ|眠い|気力/.test(t)) return { type: 'tired', detail: t };
  if (/また今度|後で|明日から|今度こそ|次回/.test(t)) return { type: 'postpone', detail: t };
  if (/無理|やめ|行きたくない|今日はいい|休み/.test(t)) return { type: 'refuse', detail: t };
  if (/土曜|週末|落ち着いたら|時間があれば/.test(t)) return { type: 'want_cushion', detail: t };
  return { type: 'other', detail: t };
}

class Orchestrator {
  constructor(store, graph) {
    this.store = store;
    this.behavior = new BehaviorAnalysisAgent();
    this.kgAgent = new KnowledgeGraphAgent(graph);
    this.strategy = new HabitStrategyAgent();
    this.personalization = new PersonalizationAgent();
    this.feedback = new FeedbackEvaluationAgent(this.kgAgent);
    this.qa = new QAAgent();
  }

  // タスク分解表（トリガー種別→実行するエージェントと順序）。不要なエージェント実行を抑制する。
  plan(trigger, hasReaction) {
    switch (trigger) {
      case 'chat':
        return ['feedback-evaluation', 'behavior-analysis', 'knowledge-graph', 'habit-strategy', 'personalization', 'qa'];
      case 'morning':
      case 'evening':
      case 'check':
      case 'analyze':
        return ['behavior-analysis', 'knowledge-graph', 'habit-strategy', 'personalization', 'qa'];
      case 'evaluate':
        return hasReaction ? ['feedback-evaluation'] : ['feedback-evaluation'];
      default:
        return ['behavior-analysis', 'habit-strategy', 'personalization', 'qa'];
    }
  }

  async run(input) {
    const { userId, trigger = 'analyze' } = input;
    const user = this.store.user(userId);
    if (!user) throw new Error('user not found: ' + userId);
    const reaction = input.reaction || (input.userText ? classifyReaction(input.userText) : null);
    input.reaction = reaction; // エージェント間で反応分類を共有

    const context = { user, reaction, log: [] };
    const plan = this.plan(trigger, !!reaction);
    const t0 = Date.now();
    // 前回介入のメソッドを評価エージェントへ共有（chat時に並列実行されるため先に渡す）
    const prevPolicy = this.store.runsFor(userId).find(r => r.policy?.methods?.length);
    input.lastMethodId = prevPolicy ? prevPolicy.policy.methods[0].id : null;

    // --- 実行（依存関係に応じて並列化: feedback-evaluation と behavior-analysis は並列可） ---
    const retry = async (agent, i) => {
      try { return await agent.run(input, context); }
      catch (e) {
        context.log.push({ agent: agent.id, ts: Date.now(), detail: { retry: true, error: String(e).slice(0, 120) } });
        try { return await agent.run(input, context); } catch (e2) { throw e2; }
      }
    };
    try {
      const AGENTS = { 'feedback-evaluation': this.feedback, 'behavior-analysis': this.behavior, 'knowledge-graph': this.kgAgent, 'habit-strategy': this.strategy, 'personalization': this.personalization, 'qa': this.qa };
      // 並列化可能な先行タスク（相互依存なし）は並列実行し、以降は依存順に逐次実行
      const parallel = plan.filter(n => n === 'feedback-evaluation' || n === 'behavior-analysis');
      const sequential = plan.filter(n => !parallel.includes(n));
      if (parallel.length > 1) {
        await Promise.all(parallel.map(n => retry(AGENTS[n], 0)));
      } else {
        for (const n of parallel) await retry(AGENTS[n], 0);
      }
      for (const name of sequential) await retry(AGENTS[name], 0);
    } catch (e) {
      context.log.push({ agent: 'orchestrator', ts: Date.now(), detail: { error: 'agent failure, partial results used: ' + String(e).slice(0, 120) } });
    }

    // --- 統合: 最終介入方針の決定 ---
    const override = user.policyOverride; // スタッフが介入方針を変更した場合
    let policy;
    if (override) {
      policy = {
        methods: override.methods.map(m => ({ id: m, ...METHODS[m] })),
        reason: `スタッフによる方針変更を優先（${override.reason || '手動調整'}）`,
        timing: override.timing || 'スタッフ指定',
        maxDailyContacts: override.maxDailyContacts ?? 1,
        overridden: true,
      };
      context.log.push({ agent: 'orchestrator', ts: Date.now(), detail: { task: '方針統合', result: 'スタッフ指定方針をAI判断より優先' } });
    } else {
      policy = {
        methods: context.strategy?.methods || [],
        reason: context.strategy?.reasons || [],
        timing: context.message?.sendAt || '',
        maxDailyContacts: context.strategy?.maxDailyContacts ?? 1,
        nextHint: context.evaluation?.nextHint || '',
        overridden: false,
      };
      context.log.push({ agent: 'orchestrator', ts: Date.now(), detail: { task: '方針統合', result: `介入方針確定: ${policy.methods.map(m => m.name).join(' + ')} / 送信${policy.timing}` } });
    }

    const run = this.store.addRun({
      userId, trigger, reactionType: reaction?.type || null,
      plan, planNote: `トリガー「${trigger}」→ ${plan.length}エージェント実行（並列: feedback-evaluation × behavior-analysis）`,
      logs: context.log,
      policy,
      analysis: context.analysis || null,
      evaluation: context.evaluation || null,
      message: context.message?.text || null,
      qa: context.qa || null,
      durationMs: Date.now() - t0,
      costJPY: 0, // 決定論的エンジンのため外部APIコスト0（opencodeセッションクレジットは別管理）
    });

    // 介入が実行されたらユーザーの介入履歴に追加
    if (context.message && ['morning', 'evening', 'chat', 'check'].includes(trigger)) {
      user.pastInterventions = user.pastInterventions || [];
      user.pastInterventions.push({ method: policy.methods[0]?.id, text: context.message.text, result: reaction ? (reaction.type === 'success' ? 'positive' : reaction.type === 'postpone' ? 'negative' : 'neutral') : 'pending', note: `trigger:${trigger}` });
      this.store.persist();
    }

    return {
      runId: run.id,
      reaction,
      analysis: context.analysis,
      policy,
      message: context.message,
      evaluation: context.evaluation,
      qa: context.qa,
      logs: context.log,
    };
  }
}

module.exports = { Orchestrator, classifyReaction };
