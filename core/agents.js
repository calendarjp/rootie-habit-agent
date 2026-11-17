// 専門エージェント群。各エージェントは run(input, context) を持ち、
// 共有ワークスペース context（黒板）を通じて情報を共有する。
// Orchestrator が実行順序を制御し、実行ログを残す。
// ※ LLM APIキーが無いため、判断は CALENDARメソッド準拠の決定論的分析エンジンで実装（機械学習ではない）。

const { BARRIERS, STAGES, STRATEGY_MATRIX, METHODS } = require('./knowledge');

// ---------- 共通ロガー ----------
function log(context, agent, detail) {
  context.log.push({ agent, ts: Date.now(), detail });
}

// ---------- ③ Behavior Analysis Agent ----------
// 行動履歴・目標・実行状況・チャット反応から習慣形成状況と継続阻害要因を分析
class BehaviorAnalysisAgent {
  constructor(id = 'behavior-analysis') { this.id = id; }
  async run(input, context) {
    const u = context.user;
    const records = u.records || [];
    const visits = records.filter(r => r.in);
    const spanDays = Math.max(28, ...records.map(r => (r.day || 0) + 1));
    const weeks = spanDays / 7;
    const visitsPerWeek = visits.length / weeks;
    const targetRate = visits.length / Math.max(1, (u.targetDaysPerWeek * weeks));
    const hourCounts = {};
    visits.forEach(v => hourCounts[v.hour] = (hourCounts[v.hour] || 0) + 1);
    const activeHours = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => +x[0]);

    // --- 習慣化成功判定（週1以上 or 目標60%以上） ---
    const achieved = visitsPerWeek >= 1 || targetRate >= 0.6;

    // --- ステージ推定 ---
    let stage = 8, stageBasis = '';
    if (visits.length === 0) { stage = 1; stageBasis = '来館記録なし'; }
    else if (visits.length <= 3) { stage = 4; stageBasis = '来館2〜3回目'; }
    else if (visits.length >= 8 && visitsPerWeek >= 2.5) { stage = 11; stageBasis = `4週間で${visits.length}回来館・週${visitsPerWeek.toFixed(1)}回の安定ペース`; }
    else if (visits.length >= 8 && achieved) { stage = 10; stageBasis = '安定して来館が続いている'; }
    else {
      // 間隔の傾向: 後半の密度が下がっていれば 6/13、回復していれば 7
      const half = Math.floor(spanDays / 2);
      const late = visits.filter(v => v.day >= half).length;
      const early = visits.filter(v => v.day < half).length;
      if (late === 0 && early > 0) { stage = 13; stageBasis = `前半${early}回来館→後半0回（習慣崩れ）`; }
      else if (late < early) { stage = 6; stageBasis = `前半${early}回→後半${late}回とペースが下降`; }
      else if (late > early) { stage = 7; stageBasis = `後半${late}回と来館が回復傾向`; }
      else { stage = 8; stageBasis = '来館は続くが定常ペース未達（過渡期）'; }
    }

    // --- 阻害タイプ推定（複数可・根拠付き） ---
    const barriers = [];
    const barrierEvidence = [];
    const addB = (id, ev) => { if (!barriers.includes(id)) { barriers.push(id); barrierEvidence.push({ type: BARRIERS[id].name, evidence: ev }); } };

    const chatText = (u.chatLogs || []).map(c => c.text).join(' ');
    if (/忙し/.test(chatText)) addB('busy', 'チャットで「忙しい」と複数回発言');
    if (/疲れ|きつい/.test(chatText)) addB('no_motivation', 'チャットで疲労・やる気低下を示唆');
    if (/一人|さみしい|誰か/.test(chatText)) addB('solo', '仲間の存在への言及');
    if (/また今度|後で|明日から/.test(chatText)) addB('postpone', '先延ばしを示す発言');
    if (/忘れ/.test(chatText)) addB('forgetful', '「忘れていた」という発言');

    const firstWeek = visits.filter(v => v.day >= spanDays - 7).length;
    const weeksAgo = visits.filter(v => v.day < 7).length;
    const avgMin = visits.length ? visits.reduce((s, v) => s + (v.min || 0), 0) / visits.length : 0;
    if (weeksAgo >= 3 && firstWeek === 0) addB('three_day', `開始初週${weeksAgo}回→直近0回（初期に集中し急減）`);
    if (u.targetDaysPerWeek >= 6 && targetRate < 0.3) addB('overdoing', `目標週${u.targetDaysPerWeek}回に対し実際は週${visitsPerWeek.toFixed(1)}回（目標過大の兆候）`);
    if (avgMin > 55 && visitsPerWeek < 1) addB('overdoing', `平均${Math.round(avgMin)}分の長時間メニューで頻度が維持できていない`);

    if (barriers.length === 0) {
      if (achieved && visitsPerWeek >= 1) { addB('none', `週${visitsPerWeek.toFixed(1)}回の来館で成功判定を継続中`); }
      else addB('busy', '明示的な阻害記録なし・頻度不足のため忙碌を推定');
    }

    // --- 確信度とデータ不足 ---
    const dataPoints = records.length + (u.chatLogs || []).length;
    const confidence = dataPoints >= 12 ? '高' : dataPoints >= 5 ? '中' : '低';
    const dataInsufficient = dataPoints < 8;
    context.analysis = {
      visitsPerWeek: +visitsPerWeek.toFixed(1),
      targetRate: +(targetRate).toFixed(2),
      achieved,
      stage: { id: stage, name: STAGES[stage - 1].name, basis: stageBasis },
      barriers: barriers.map(b => ({ id: b, name: BARRIERS[b].name, policy: BARRIERS[b].policy })),
      barrierEvidence,
      activeHours,
      confidence,
      dataInsufficient,
      estimated: dataInsufficient || barriers.some(b => ['busy', 'no_motivation'].includes(b) && dataPoints < 10),
      avgMinutes: Math.round(avgMin),
      visitCount: visits.length,
    };
    log(context, this.id, {
      task: '行動分析',
      result: `ステージ${stage}(${STAGES[stage-1].name}) / 阻害: ${barriers.map(b=>BARRIERS[b].name).join('・')} / 確信度${confidence}${dataInsufficient ? '（データ不足→推定）' : ''}`,
      basis: stageBasis,
      achieved,
    });
    return context.analysis;
  }
}

// ---------- ⑥ Knowledge Graph Agent ----------
// 知識・ユーザー特性・介入・結果の関係性を検索・記録（Neo4j代替のJSONグラフ）
class KnowledgeGraphAgent {
  constructor(graph, id = 'knowledge-graph') { this.graph = graph; this.id = id; }
  async run(input, context) {
    const barriers = (input.analysis?.barriers || context.analysis?.barriers || []).map(b => b.id);
    const found = { methods: [], evidence: [] };
    for (const b of barriers) {
      const q = this.graph.query({ barrierId: `barrier:${b}` });
      found.methods.push(...q.methods);
      found.evidence.push(...q.evidence);
    }
    // 過去介入の実績も考慮（Feedback相当）
    const past = context.user.pastInterventions || [];
    for (const p of past) {
      found.methods.push({ methodId: p.method, name: METHODS[p.method]?.name || p.method, positive: p.result === 'positive' ? 1 : 0, negative: p.result === 'negative' ? 1 : 0, fromPast: true, note: p.note });
    }
    found.methods.sort((a, b) => (b.positive - b.negative) - (a.positive - a.negative));
    context.graphFindings = found;
    log(context, this.id, {
      task: '知識グラフ検索',
      result: `阻害[${barriers.join(',')}]に対応するメソッド候補: ${[...new Set(found.methods.map(m=>m.name))].slice(0,5).join('・')}`,
      pastEvidence: past.map(p => `${METHODS[p.method]?.name || p.method}:${p.result}`).join(', ') || 'なし',
    });
    return found;
  }
  recordFeedback(userId, methodId, effect, note) {
    const fid = `feedback:${userId}:${methodId}:${Date.now()}`;
    this.graph.addNode(fid, 'Feedback', { userId, methodId, effect, note });
    this.graph.addEdge('INFORMS', fid, `method:${methodId}`);
    if (effect === 'positive') this.graph.addEdge('USES', `user:${userId}`, `method:${methodId}`);
  }
}

// ---------- ② Habit Strategy Agent ----------
// 分析結果+知識グラフから、その人に適した習慣化メソッドを選択
class HabitStrategyAgent {
  constructor(id = 'habit-strategy') { this.id = id; }
  async run(input, context) {
    const analysis = context.analysis;
    const findings = context.graphFindings || { methods: [] };
    const primary = analysis.barriers[0]?.id || 'none';
    const base = STRATEGY_MATRIX[primary] || STRATEGY_MATRIX.none;
    let methods = [...base.methods];
    const stage = analysis.stage.id;
    const adj = stage >= 10 ? 'late' : stage >= 5 && stage <= 9 ? 'middle' : stage >= 13 ? 'lapse' : 'early';
    for (const m of (require('./knowledge').STAGE_ADJUST[adj] || [])) if (!methods.includes(m)) methods.push(m);
    // 知識グラフの実績順で優先度を入れ替え
    findings.methods.filter(m => m.positive > m.negative).forEach(m => { if (methods.includes(m.methodId)) methods = [m.methodId, ...methods.filter(x => x !== m.methodId)]; });
    const chosen = methods.slice(0, 3);
    const reasons = [
      `阻害タイプ「${BARRIERS[primary].name}」→ 基本方針: ${BARRIERS[primary].policy}`,
      `ステージ${stage}「${analysis.stage.name}」→ ${STAGES[stage-1].name} に適した補正を適用`,
      findings.methods.length ? `知識グラフ検索: 過去に効果のあった「${findings.methods[0].name}」を優先` : '知識グラフに該当実績なし → ドメイン知識のみで選択',
    ];
    context.strategy = {
      barrierId: primary,
      methods: chosen.map(m => ({ id: m, ...METHODS[m] })),
      reasons,
      timingPolicy: base.timing,
      maxDailyContacts: primary === 'forgetful' ? 2 : 1,
    };
    log(context, this.id, {
      task: 'メソッド選択',
      result: chosen.map(m => METHODS[m].name).join(' + '),
      reasons,
    });
    return context.strategy;
  }
}

// ---------- ④ Personalization Agent ----------
// 生活リズム・性格・過去の反応に合わせ、メッセージ内容・タイミングを調整
class PersonalizationAgent {
  constructor(id = 'personalization') { this.id = id; }
  async run(input, context) {
    const u = context.user, a = context.analysis, s = context.strategy;
    const m0 = s.methods[0], m1 = s.methods[1];
    const reaction = input.reaction; // チャット反応（トリガーがchatのとき）
    let text;
    const name = u.name;
    const lastVisit = (u.records.filter(r=>r.in).length);

    if (reaction) {
      if (reaction.type === 'success') {
        text = `${name}、すごい！今日ジムに行けたんですね✨ 「${reaction.detail || 'トレーニング'}」までしっかりやれていて、本当にえらいです。この調子で無理なく続けていきましょう。${m0 && m0.id==='praise_motivate' ? '' : ''}`;
      } else if (reaction.type === 'busy') {
        text = `お忙しい中、返信ありがとうございます。無理のない範囲で大丈夫です。${name}の「${METHODS.mini_goal.name}」方式で、今日は「着替えて10分だけ」を目安にしませんか？1分だけでも成功のうちです🌿`;
      } else if (reaction.type === 'tired') {
        text = `お疲れさまです。今日はゆっくり休んでくださいね。もし気分が少しでも向いたら、ストレッチ1分だけでもOK。「${METHODS.desire_plus.name}」で好きな音楽を聞きながら、どうでしょうか🍀`;
      } else if (reaction.type === 'refuse') {
        text = `了解です！今日は休みとしましょう。運動習慣は「続けたい気持ち」が何より大事です。また行きたくなったらいつでも声かけてくださいね🌱`;
      } else if (reaction.type === 'postpone') {
        text = `「後でやる」気持ち、よくわかります。なら、いま30秒だけ！靴を履いて玄関に立つだけで今日の分は達成です。「${METHODS.mini_goal.name}」始めてみませんか？`;
      } else if (reaction.type === 'want_cushion') {
        text = `そうですね、今日は無理せず ${name} が行きやすい ${a.activeHours[0] ? `${a.activeHours[0]}時台` : '夜'} に合わせて、またご連絡しますね。「${METHODS.chain_planning.name}」で、お仕事帰りのいつものルートにジムをくっつけるイメージでどうでしょう？`;
      } else {
        text = `返信ありがとうございます！${name}のペースを守りながら、一緒に習慣を育てていきましょう。今日のおすすめは「${m0 ? m0.name : '簡単レコード'}」。${m0 ? m0.desc : '今日の分を簡単に記録するだけでもOK'}です🍃`;
      }
    } else if (input.trigger === 'morning') {
      text = `おはようございます、${name}！今日も自分のペースで🌱 ${u.goal}に向けて、今日は「${m0 ? m0.name : '超ミニマムゴール'}」がおすすめ。「${m1 ? m1.desc : '始める前の手間を減らすだけ'}」を意識してみてください。行けたら、あとで教えてくださいね。`;
    } else if (input.trigger === 'evening') {
      text = `こんばんは、${name}。今日ジムに行けましたか？行けたら聞かせてください✨ 忙しかったら、それも大切な情報です。明日の${a.activeHours[0] ? `${a.activeHours[0]}時台` : '夜'}が狙い目かもしれません。`;
    } else if (input.trigger === 'check') {
      text = `${name}の調子どうですか？${a.achieved ? '今のリズムとても良いので、維持を応援しています💪' : `今のステージは「${a.stage.name}」。「${m0 ? m0.name : ''}」で、少しずついきましょう。`} 無理のない範囲で今日のひとことを聞かせてください。`;
    } else {
      text = `${name}、こんにちは！Rootieです🌱 あなたのペースで習慣を育てるお手伝いをします。今日は「${m0 ? m0.name : '簡単レコード'}」から始めてみませんか？`;
    }

    // 頻度・タイミング調整（1日1回原則 / 忘れっぽい人のみ2回）
    context.message = {
      text,
      method: s.methods[0],
      tone: u.prefs.tone,
      sendAt: input.trigger === 'morning' ? `${u.prefs.reminderTime}（本人設定）` : `${a.activeHours[0] ?? 20}時台（来館しやすい時間帯）`,
      dailyContacts: s.maxDailyContacts,
    };
    log(context, this.id, {
      task: 'メッセージ調整',
      result: `トリガー=${input.trigger}${reaction ? '/反応=' + reaction.type : ''} / 送信=${context.message.sendAt} / 頻度上限=${s.maxDailyContacts}回/日`,
      preview: text.slice(0, 50) + '…',
    });
    return context.message;
  }
}

// ---------- ⑤ Feedback & Evaluation Agent ----------
// 介入後の反応を評価し、知識グラフと次回方針改善につなげる
class FeedbackEvaluationAgent {
  constructor(kgAgent, id = 'feedback-evaluation') { this.kg = kgAgent; this.id = id; }
  async run(input, context) {
    const reaction = input.reaction;
    const methodId = context.strategy?.methods[0]?.id || input.lastMethodId || null;
    const label = methodId ? (METHODS[methodId]?.name || methodId) : '直近介入';
    let effect = 'neutral', note = '', nextHint = '';
    if (reaction) {
      if (reaction.type === 'success') { effect = 'positive'; note = '介入後に来館・報告あり'; nextHint = '同じトーンで褒めを継続し、少しずつ目標を引き上げ'; }
      else if (['busy','tired','refuse'].includes(reaction.type)) { effect = 'neutral'; note = `反応あり（${reaction.type}）ただし来館なし`; nextHint = 'ハードルをさらに下げる/時間帯を変える'; }
      else if (reaction.type === 'postpone') { effect = 'negative'; note = '先延ばし反応'; nextHint = 'その場で1分だけ始める提案に切り替え'; }
      else { effect = 'neutral'; note = '会話のみで判断保留'; nextHint = 'データを増やして再評価'; }
    } else if (context.analysis) {
      const a = context.analysis;
      effect = a.achieved ? 'positive' : 'neutral';
      note = a.achieved ? `週${a.visitsPerWeek}回で成功判定` : `週${a.visitsPerWeek}回と目標未達`;
      nextHint = a.achieved ? '過剰介入せず現状維持' : 'メソッドの再選択が必要';
    }
    if (methodId) this.kg.recordFeedback(context.user.id, methodId, effect, note);
    context.evaluation = { effect, note, methodId, nextHint };
    log(context, this.id, { task: '介入評価', result: `${label} → ${effect}（${note}）`, nextHint });
    return context.evaluation;
  }
}

// ---------- ⑧ QA Agent ----------
// 品質検証: 禁止表現・データ整合性・エージェント連携チェーン
class QAAgent {
  constructor(id = 'qa') { this.id = id; }
  async run(input, context) {
    const forbidden = ['できなかったね', '頑張らないと', '怠け', 'だらしない', '反省'];
    const text = context.message?.text || '';
    const violations = forbidden.filter(w => text.includes(w));
    const chain = context.log.map(l => l.agent);
    const checks = {
      noGuiltLanguage: violations.length === 0,
      violations,
      agentsCooperated: chain.length >= 3,
      chain,
      strategyReflectsAnalysis: !!(context.analysis && context.strategy && context.strategy.barrierId === (context.analysis.barriers[0]?.id || 'none')),
      dataIntegrity: !!(context.analysis && context.analysis.stage),
      singleSuggestion: (text.match(/しませんか|始めてみ|やってみ|しません/g) || []).length <= 2,
    };
    context.qa = checks;
    log(context, this.id, { task: '品質検証', result: checks.noGuiltLanguage && checks.agentsCooperated && checks.strategyReflectsAnalysis ? 'PASS' : `要修正: ${JSON.stringify({violations, cooperated: checks.agentsCooperated, reflects: checks.strategyReflectsAnalysis})}` });
    return checks;
  }
}

module.exports = { BehaviorAnalysisAgent, KnowledgeGraphAgent, HabitStrategyAgent, PersonalizationAgent, FeedbackEvaluationAgent, QAAgent };
