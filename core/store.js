// JSONデータストア（実データ/デモデータを明確に区別）
// Neo4j未導入のため、永続化はJSONファイル。デモデータには demo:true を付与。
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function load(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  } catch { return fallback; }
}
function save(name, obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(obj, null, 2));
}

class Store {
  constructor(seed) {
    this.users = load('users.json', seed);
    this.runs = load('runs.json', []);        // エージェント実行履歴（全エージェント分）
    this.messages = load('messages.json', {}); // userId -> [{role,text,ts,meta}]
    this.persist();
  }
  persist() {
    save('users.json', this.users);
    save('runs.json', this.runs);
    save('messages.json', this.messages);
  }
  user(id) { return this.users.find(u => u.id === id); }
  addMessage(userId, msg) {
    (this.messages[userId] = this.messages[userId] || []).push({ ts: Date.now(), ...msg });
    this.persist();
  }
  getMessages(userId) { return this.messages[userId] || []; }
  addRun(run) {
    run.id = 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    this.runs.push(run);
    if (this.runs.length > 400) this.runs = this.runs.slice(-400);
    this.persist();
    return run;
  }
  runsFor(userId) { return this.runs.filter(r => r.userId === userId).slice(-50).reverse(); }
  reset(seed) {
    this.users = JSON.parse(JSON.stringify(seed));
    this.runs = []; this.messages = {};
    this.persist();
  }
}

module.exports = { Store };
