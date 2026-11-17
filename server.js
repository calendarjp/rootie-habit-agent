// Rootie API サーバー（依存ゼロ・素のNode http）
const http = require('http');
const fs = require('fs');
const path = require('path');
const SEED = require('./data/seed');
const { Store } = require('./core/store');
const { buildGraph } = require('./core/graph');
const { Orchestrator } = require('./core/orchestrator');
const { BARRIERS, STAGES, METHODS } = require('./core/knowledge');

const store = new Store(SEED.map(s => JSON.parse(JSON.stringify(s))));
const graph = buildGraph(store.users);
const orchestrator = new Orchestrator(store, graph);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); }); }

async function ensureAnalysis(user) {
  const past = store.runsFor(user.id).find(r => r.analysis);
  if (past) return past.analysis;
  const out = await orchestrator.run({ userId: user.id, trigger: 'analyze' });
  return out.analysis;
}

function userSummary(user, analysis) {
  const lastPolicy = store.runsFor(user.id).find(r => r.policy)?.policy;
  const ov = user.policyOverride;
  const methods = ov ? ov.methods : (lastPolicy ? lastPolicy.methods.map(m => m.id) : []);
  return {
    id: user.id, name: user.name, goal: user.goal, demo: !!user.demo,
    targetDaysPerWeek: user.targetDaysPerWeek,
    stage: analysis.stage, barriers: analysis.barriers,
    visitsPerWeek: analysis.visitsPerWeek, targetRate: analysis.targetRate,
    achieved: analysis.achieved, confidence: analysis.confidence,
    dataInsufficient: analysis.dataInsufficient,
    methods, overridden: !!ov,
    policyOverride: !!ov,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    // ---- static ----
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return res.end(fs.readFileSync(path.join(__dirname, 'public/index.html')));
    if (req.method === 'GET' && (p === '/admin' || p.startsWith('/admin'))) return res.end(fs.readFileSync(path.join(__dirname, 'public/admin.html')));
    if (req.method === 'GET' && p.startsWith('/api/')) { /* fallthrough */ }

    // ---- API ----
    if (p === '/api/users' && req.method === 'GET') {
      const users = [];
      for (const u of store.users) users.push(userSummary(u, await ensureAnalysis(u)));
      return json(res, 200, { users, meta: { knowledge: { principles: 7, methods: 15, stages: 14, barrierTypes: 8 }, note: 'デモユーザー3名は架空データ（demo:true）。分析は決定論的ルールエンジンによる。' } });
    }
    const mDetail = p.match(/^\/api\/users\/([\w]+)$/);
    if (mDetail && req.method === 'GET') {
      const u = store.user(mDetail[1]); if (!u) return json(res, 404, { error: 'not found' });
      const analysis = await ensureAnalysis(u);
      const lastPolicy = store.runsFor(u.id).find(r => r.policy)?.policy;
      return json(res, 200, {
        user: { id: u.id, name: u.name, goal: u.goal, demo: !!u.demo, targetDaysPerWeek: u.targetDaysPerWeek, prefs: u.prefs, records: u.records, chatLogs: u.chatLogs, pastInterventions: (u.pastInterventions || []).slice(-8), policyOverride: u.policyOverride || null },
        analysis,
        policy: u.policyOverride || lastPolicy || null,
        messages: store.getMessages(u.id),
        runs: store.runsFor(u.id).slice(0, 12).map(r => ({ id: r.id, trigger: r.trigger, reactionType: r.reactionType, plan: r.plan, planNote: r.planNote, logs: r.logs, policy: r.policy, evaluation: r.evaluation, qa: r.qa, message: r.message || null, durationMs: r.durationMs, ts: r.id })),
      });
    }
    if (p === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.userId || !body.text) return json(res, 400, { error: 'userId and text required' });
      const u = store.user(body.userId); if (!u) return json(res, 404, { error: 'not found' });
      store.addMessage(body.userId, { role: 'user', text: body.text });
      const out = await orchestrator.run({ userId: body.userId, trigger: 'chat', userText: body.text });
      const reply = out.message?.text || '（応答生成に失敗しました）';
      store.addMessage(body.userId, { role: 'rootie', text: reply, runId: out.runId, method: out.policy?.methods?.[0]?.name });
      return json(res, 200, { reply, runId: out.runId, reaction: out.reaction, analysis: out.analysis, policy: out.policy, evaluation: out.evaluation, qa: out.qa });
    }
    if (p === '/api/trigger' && req.method === 'POST') {
      const body = await readBody(req);
      const u = store.user(body.userId); if (!u) return json(res, 404, { error: 'not found' });
      const out = await orchestrator.run({ userId: body.userId, trigger: body.trigger || 'morning' });
      const reply = out.message?.text || '';
      store.addMessage(body.userId, { role: 'rootie', text: reply, runId: out.runId, method: out.policy?.methods?.[0]?.name });
      return json(res, 200, { reply, runId: out.runId, analysis: out.analysis, policy: out.policy, qa: out.qa, logs: out.logs });
    }
    if (p === '/api/admin/users/:id/policy'.replace(':id', url.searchParams.get('id') || '') === p && req.method === 'POST') {}
    const mPol = p.match(/^\/api\/users\/([\w]+)\/policy$/);
    if (mPol && req.method === 'POST') {
      const body = await readBody(req);
      const u = store.user(mPol[1]); if (!u) return json(res, 404, { error: 'not found' });
      if (body.clear) { delete u.policyOverride; }
      else {
        if (!Array.isArray(body.methods) || !body.methods.length) return json(res, 400, { error: 'methods required' });
        u.policyOverride = { methods: body.methods, timing: body.timing, reason: body.reason, maxDailyContacts: body.maxDailyContacts ?? 1, by: body.by || 'スタッフ', at: new Date().toISOString() };
      }
      store.persist();
      return json(res, 200, { ok: true, policyOverride: u.policyOverride || null, note: '変更は次回以降のAI判断（Orchestrator統合フェーズ）で優先されます' });
    }
    if (p === '/api/runs' && req.method === 'GET') {
      const uid = url.searchParams.get('userId');
      const runs = (uid ? store.runsFor(uid) : store.runs.slice(-60).reverse());
      return json(res, 200, { runs: runs.slice(0, 60) });
    }
    if (p === '/api/reset' && req.method === 'POST') {
      store.reset(SEED.map(s => JSON.parse(JSON.stringify(s))));
      return json(res, 200, { ok: true });
    }
    if (p === '/api/knowledge' && req.method === 'GET') {
      return json(res, 200, { BARRIERS, STAGES, METHODS });
    }
    if (p === '/api/graph' && req.method === 'GET') {
      return json(res, 200, { nodes: [...graph.nodes.values()], edges: graph.edges, note: 'Neo4j未導入のためJSON知識グラフで代替' });
    }
    if (p === '/api/qa' && req.method === 'POST') {
      // QA Agent: 全ユーザーで整合性検証（禁止表現・連携・方針反映）
      const results = [];
      for (const u of store.users) {
        const out = await orchestrator.run({ userId: u.id, trigger: 'check' });
        results.push({ userId: u.id, name: u.name, qa: out.qa, policy: out.policy });
      }
      return json(res, 200, { results, allPass: results.every(r => r.qa.noGuiltLanguage && r.qa.agentsCooperated) });
    }
    return json(res, 404, { error: 'no route' });
  } catch (e) {
    return json(res, 500, { error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Rootie running →  Chat: http://localhost:${PORT}/  Admin: http://localhost:${PORT}/admin`));
