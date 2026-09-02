// v0.2.1 半绑定修复的执行验证: 给 obsidian 打桩, 真的跑一遍状态机。
// 跑法: node tests/bindtest.js (只需要 Node, 无依赖)
const Module = require("module");
const path = require("path");

// ── 环境桩 ────────────────────────────────────────────────────────────────
global.window = {
  setTimeout: (...a) => setTimeout(...a),
  clearTimeout: (...a) => clearTimeout(...a),
  setInterval: (...a) => setInterval(...a),
  clearInterval: (...a) => clearInterval(...a),
};
global.btoa = (s) => Buffer.from(String(s), "binary").toString("base64");

const notices = [];
class Notice { constructor(msg) { notices.push(String(msg)); } }

class Plugin {
  constructor(app) { this.app = app; }
  async loadData() { return this._stored || null; }
  async saveData(d) { this._stored = JSON.parse(JSON.stringify(d)); }
  addCommand() {}
  addSettingTab() {}
  addStatusBarItem() { return { setText() {} }; }
  registerInterval() {}
  registerMarkdownPostProcessor() {}
  register() {}
}
class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; } }
class Modal {
  constructor(app) {
    this.app = app;
    this.titleEl = { setText() {} };
    this.contentEl = { createEl() { return {}; }, empty() {} };
  }
  open() { opened.push(this); }
  close() {}
}
const opened = [];
const chain = new Proxy({}, { get: () => () => chain });
class Setting { constructor() { return chain; } }
class AbstractInputSuggest {}

// #15: 迷你 moment(只认日期令牌与 [..] 字面量, 白名单外的字母输出 ?——让"Assets 不括起来"在测试里也炸)
const MOMENT_STUB_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MOMENT_STUB_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// [..] 字面量 | 白名单令牌(同一字母长的在前 = 贪心) | 其它英文字母 | 任意单字符
const MOMENT_STUB_RE = /(\[[^\[]*\])|(YYYY|YY|MMMM|MMM|MM|M|DDDD|DDD|DD|D|dddd|ddd|dd|d|E|e|ww|w|Q|HH|H|mm|m|ss|s)|([A-Za-z])|([\s\S])/g;

function momentStub(input, fmt) {
  let y, mo, d, h = 0, mi = 0, sec = 0;
  if (input instanceof Date) {
    y = input.getFullYear(); mo = input.getMonth() + 1; d = input.getDate();
    h = input.getHours(); mi = input.getMinutes(); sec = input.getSeconds();
  } else if (input == null) {
    return momentStub(new Date());
  } else {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(input));
    if (!m) throw new Error("momentStub: 不认识的输入 " + String(input));
    y = +m[1]; mo = +m[2]; d = +m[3];
  }
  const dow = new Date(y, mo - 1, d).getDay();
  const doy = Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const jan1Dow = new Date(y, 0, 1).getDay();
  const week = Math.floor((doy - 1 + jan1Dow) / 7) + 1;   // en 地区: 周日起, 含 1 月 1 日的那周为第 1 周
  const pad = (n, w) => String(n).padStart(w, "0");
  const token = (t) => {
    switch (t) {
      case "YYYY": return pad(y, 4);
      case "YY": return pad(y % 100, 2);
      case "M": return String(mo);
      case "MM": return pad(mo, 2);
      case "MMM": return MOMENT_STUB_MONTHS[mo - 1].slice(0, 3);
      case "MMMM": return MOMENT_STUB_MONTHS[mo - 1];
      case "D": return String(d);
      case "DD": return pad(d, 2);
      case "DDD": return String(doy);
      case "DDDD": return pad(doy, 3);
      case "d": return String(dow);
      case "dd": return MOMENT_STUB_DAYS[dow].slice(0, 2);
      case "ddd": return MOMENT_STUB_DAYS[dow].slice(0, 3);
      case "dddd": return MOMENT_STUB_DAYS[dow];
      case "E": return String(dow === 0 ? 7 : dow);
      case "e": return String(dow);
      case "w": return String(week);
      case "ww": return pad(week, 2);
      case "Q": return String(Math.floor((mo - 1) / 3) + 1);
      case "HH": return pad(h, 2);
      case "H": return String(h);
      case "mm": return pad(mi, 2);
      case "m": return String(mi);
      case "ss": return pad(sec, 2);
      case "s": return String(sec);
    }
    return "?";
  };
  return {
    isValid: () => true,
    format(f) {
      const fs = f == null ? "YYYY-MM-DD[T]HH:mm:ss" : String(f);
      return fs.replace(MOMENT_STUB_RE, (m, lit, tok, letter, other) => {
        if (lit) return lit.slice(1, -1);
        if (tok) return token(tok);
        if (letter) return "?";
        return other;
      });
    },
  };
}

const stub = {
  Plugin, PluginSettingTab, Setting, Modal, Notice, AbstractInputSuggest,
  moment: momentStub,
  normalizePath: (p) => p,
  requestUrl: async () => ({}),
  Platform: { isDesktop: true },
};

const orig = Module._load;
Module._load = function (req, ...rest) {
  if (req === "obsidian") return stub;
  return orig.call(this, req, ...rest);
};

const WechatDiaryPlugin = require(path.join(__dirname, "..", "main.js"));

// ── 假 app: secretStorage 是进程级的(模拟"卸载插件不删 secret") ──────────────
function makeApp(secrets) {
  return {
    secretStorage: {
      getSecret: (k) => (k in secrets ? secrets[k] : null),
      setSecret: (k, v) => { secrets[k] = v; },
    },
    workspace: { onLayoutReady: (cb) => { pendingLayout.push(cb); } },
    vault: { getAbstractFileByPath: () => null },
  };
}
let pendingLayout = [];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
}

async function newPlugin(secrets, storedData) {
  pendingLayout = [];
  const p = new WechatDiaryPlugin(makeApp(secrets));
  p._stored = storedData ? JSON.parse(JSON.stringify(storedData)) : null;
  p.startPipeline = function () { this._startedPipeline = true; };  // 不联网
  await p.onload();
  return p;
}

(async () => {
  const SECRET_TOKEN = "wechat-diary-ilink-bot-token";
  const SECRET_ID = "wechat-diary-bind-identity";

  console.log("\n【1】全新安装: 什么都没有");
  const s1 = {};
  let p = await newPlugin(s1, null);
  check("bindState() === none", p.bindState() === "none", p.bindState());
  pendingLayout.forEach((cb) => cb());
  check("不启动管道", !p._startedPipeline);

  console.log("\n【2】扫码绑定成功");
  await p.onLoginConfirmed({ botToken: "TOK1", botId: "B1", userId: "U1", baseUrl: "https://x.example" });
  check("bindState() === bound", p.bindState() === "bound", p.bindState());
  check("token 进了 secretStorage", s1[SECRET_TOKEN] === "TOK1");
  check("身份也进了 secretStorage", !!s1[SECRET_ID], JSON.stringify(s1[SECRET_ID]));
  check("身份内容正确", (p.getBindIdentity() || {}).userId === "U1");
  const dataAfterBind = p._stored;

  console.log("\n【3】卸载重装: data.json 没了, secret 还在 ← 就是线上那个故障");
  p = await newPlugin(s1, null);
  check("userId 从 secret 恢复了", p.data.ilink.userId === "U1", p.data.ilink.userId);
  check("bindState() === bound (不是 half)", p.bindState() === "bound", p.bindState());
  check("baseUrl 也恢复了", p.data.ilink.baseUrl === "https://x.example");
  check("置了 skipBacklog(防积压重放)", p._skipBacklog === true);
  check("skipBacklog 已落盘(跨重启有效)", p._stored.ilink.skipBacklog === true);
  pendingLayout.forEach((cb) => cb());
  check("管道启动了", p._startedPipeline === true);

  console.log("\n【4】skipBacklog 期间不落笔, 但要能解除");
  p.writer = { write: async () => { throw new Error("不该写!"); } };
  await p._handleIncoming({ from_user_id: "U1", seq: "1", item_list: [{ type: 1, text_item: { text: "旧消息" } }] });
  check("积压消息被跳过(没写)", true);
  check("计数 +1", p._skippedCount === 1, String(p._skippedCount));
  await p._clearSkipBacklog();
  check("解除后 _skipBacklog=false", p._skipBacklog === false);
  check("解除后落盘也翻了", p._stored.ilink.skipBacklog === false);
  check("提示了用户", notices.some((n) => n.includes("已跳过离线期间的 1 条")), JSON.stringify(notices.slice(-2)));

  console.log("\n【5】v0.1.3 老用户升上来: data.json 没了, secret 里【没有】身份副本");
  const s5 = { [SECRET_TOKEN]: "TOK1" };   // 老版本只存过 token
  p = await newPlugin(s5, null);
  check("bindState() === half", p.bindState() === "half", p.bindState());
  check("没有伪造 skipBacklog", p._skipBacklog === false);
  pendingLayout.forEach((cb) => cb());
  check("管道照样启动(v0.1.3 会卡死在这)", p._startedPipeline === true);

  console.log("\n【6】待认领: 陌生人不能自动成为主人");
  const before = opened.length;
  p._handleIncoming({ from_user_id: "STRANGER", seq: "9", item_list: [{ type: 1, text_item: { text: "hi" } }] });
  check("弹了确认框, 没有自动认领", opened.length === before + 1 && !p.data.ilink.userId);
  const modal = opened[opened.length - 1];
  check("_claiming 上锁", p._claiming === true);
  p._handleIncoming({ from_user_id: "STRANGER2", seq: "10", item_list: [{ type: 1, text_item: { text: "hi" } }] });
  check("上锁期间不叠弹窗", opened.length === before + 1);

  console.log("\n【7】叉掉弹窗 ≠ 明确拒绝");
  modal.onClose();
  check("_claiming 放开了", p._claiming === false);
  check("没被拉黑(下次还会问)", !p._declinedClaims.has("STRANGER"));

  console.log("\n【8】点「是我」→ 认领");
  await p.adoptOwner("U1");
  check("userId 认回来了", p.data.ilink.userId === "U1");
  check("bindState() === bound", p.bindState() === "bound", p.bindState());
  check("身份补写进了 secret", (p.getBindIdentity() || {}).userId === "U1");
  check("认领后进入 skipBacklog(防积压落笔)", p._skipBacklog === true && p._stored.ilink.skipBacklog === true);
  await p._clearSkipBacklog();
  check("一次空轮询即解除", p._skipBacklog === false);
  await p.adoptOwner("HACKER");
  check("已有主人后不能被顶替", p.data.ilink.userId === "U1", p.data.ilink.userId);

  console.log("\n【9】解绑两档: 只清身份 vs 彻底解除");
  await p.unbind(true);
  check("keepToken: token 还在", p.getBotToken() === "TOK1", p.getBotToken());
  check("keepToken: 回到 half", p.bindState() === "half", p.bindState());
  check("keepToken: 身份副本清了", p.getBindIdentity() === null);
  await p.unbind(false);
  check("彻底解除: token 清了", p.getBotToken() === "");
  check("彻底解除: bindState === none", p.bindState() === "none", p.bindState());

  console.log("\n【10】没有 secretStorage 的宿主(botTokenFallback 路径)");
  pendingLayout = [];
  const app10 = makeApp({});
  app10.secretStorage = null;
  const p10 = new WechatDiaryPlugin(app10);
  p10._stored = null;
  p10.startPipeline = function () { this._startedPipeline = true; };
  await p10.onload();
  await p10.onLoginConfirmed({ botToken: "TOK2", botId: "B2", userId: "U2", baseUrl: "" });
  check("token 落在 data.json 兜底字段", p10.data.ilink.botTokenFallback === "TOK2");
  check("bindState() === bound", p10.bindState() === "bound", p10.bindState());
  await p10.unbind(true);
  check("keepToken 在兜底路径上也保住了 token", p10.getBotToken() === "TOK2", p10.getBotToken());
  await p10.unbind(false);
  check("彻底解除清干净", p10.getBotToken() === "");

  // ══ v0.3.0 单模式路由 ═══════════════════════════════════════════════════

  const BOUND_DATA = () => ({
    settings: { diaryFolder: "日记", timezone: "Asia/Shanghai", aiApiUrl: "", aiModel: "", dayStartHour: 4 },
    ilink: { botId: "B1", userId: "U1", baseUrl: "", buf: "", contextTokens: {}, recentSeqs: [], pauseUntil: 0, lastAliveTs: 0, loginTime: "x", botTokenFallback: "", skipBacklog: false },
    profile: { state: "active", name: null },
    session: { mode: "chat", entered_date: "", chat_count_today: 0, last_activity_ts: 0, cost_reminder_shown_date: "" },
  });

  const I = WechatDiaryPlugin.__internals;
  // 桩掉 writer 的落盘方法(agent.writer 与 plugin.writer 同引用, 原地换方法即可)
  // finalizeDay 桩按真函数的三态语义: 第一次有内容 → sealed, 之后 → already(afterSeal=封存后新写的条数), 没内容 → empty
  function stubWriter(p) {
    const calls = { writes: [], finalized: [], sealedAt: {} };
    p.writer.write = async (text) => {
      calls.writes.push(text);
      const n = calls.writes.length;
      let reply = "记下来啦~ 今天第 " + n + " 段 ✍️";
      if (n === 1) reply = I.texts.FIRST_OF_DAY_PREFIX + reply + I.texts.FIRST_OF_DAY_TIPS; // 与真 write 同构(开页前缀+tips)
      return { reply, n, sealed: "today" in calls.sealedAt };
    };
    p.writer.finalizeDay = async (d) => {
      const key = d || "today"; calls.finalized.push(key);
      const n = calls.writes.length;
      if (!n) return { status: "empty", n: 0, afterSeal: 0 };
      if (key in calls.sealedAt) return { status: "already", n, afterSeal: n - calls.sealedAt[key] };
      calls.sealedAt[key] = n; return { status: "sealed", n, afterSeal: 0 };
    };
    p.writer.undoLastBlock = async () => (calls.writes.length ? { ok: true, removed: calls.writes.pop() } : { ok: false, removed: null });
    p.writer.countDay = async () => calls.writes.length;
    return calls;
  }

  console.log("\n【11】单模式: 发什么记什么, 探活/命令是唯一例外");
  let sd = { [SECRET_TOKEN]: "TOK1" };
  p = await newPlugin(sd, BOUND_DATA());
  let calls = stubWriter(p);
  let r = await p.agent._dispatch("今天试了新的手冲豆子", false, []);
  check("普通内容 → 记", calls.writes.length === 1 && r.includes("记下来"), r);
  r = await p.agent._dispatch("在吗在吗", false, []);
  check("「在吗在吗」→ 状态回复, 不落库", calls.writes.length === 1 && r.includes("在的") && r.includes("已记 1 段"), r);
  r = await p.agent._dispatch("开始记日记", false, []);
  check("「开始记日记」→ 告知不用了, 不落库", calls.writes.length === 1 && r.includes("不用特意开始"), r);
  r = await p.agent._dispatch("帮助", false, []);
  check("「帮助」→ 指南, 不落库", calls.writes.length === 1 && r.includes("使用指南"), r);

  console.log("\n【12】「结束」是仪式不是开关: 封存后继续发照样记");
  r = await p.agent._dispatch("结束", false, []);
  check("「结束」→ 封存", calls.finalized.length === 1 && !r.includes("不用特意"), r);
  r = await p.agent._dispatch("又想起一件事", false, []);
  check("封存后再发 → 照记(v0.2.1 会掉进闲聊丢掉)", calls.writes.length === 2, JSON.stringify(calls.writes));

  console.log("\n【13】撤回与改称呼");
  r = await p.agent._dispatch("撤回", false, []);
  check("「撤回」→ 删最后一条且带预览", calls.writes.length === 1 && r.includes("撤掉了「又想起一件事」"), r);
  r = await p.agent._dispatch("叫我小明", false, []);
  check("「叫我小明」短句 → 改称呼不落库", p.data.profile.name === "小明" && calls.writes.length === 1, r);
  r = await p.agent._dispatch("叫我妈过来吃饭的时候记得提醒我带上钥匙", false, []);
  check("「叫我」开头的长句是内容 → 照记", calls.writes.length === 2 && p.data.profile.name === "小明", r);
  r = await p.agent._dispatch("叫我妈过来吃饭", false, []);
  check("「叫我妈过来吃饭」短句(>4字候选) → 也是内容照记, 称呼不变", calls.writes.length === 3 && p.data.profile.name === "小明", r);
  r = await p.agent._dispatch("叫我小可爱", false, []);
  check("「叫我小可爱」(≤4字) → 改称呼", p.data.profile.name === "小可爱" && calls.writes.length === 3, r);

  console.log("\n【14】首次见面(D11: 不再问名字): 内容优先, 欢迎语跟上, 第二句照常记");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "unknown", name: null }; return d; })());
  calls = stubWriter(p);
  r = await p.agent._dispatch("帮我记一下明天要给妈妈买降压药", false, []);
  check("第一句是内容 → 先记再欢迎", calls.writes.length === 1 && r.includes("随手记 Agent"), r);
  check("欢迎语不再问名字", !r.includes("叫你什么名字") && !r.includes("跳过"), r);
  r = await p.agent._dispatch("谷雨", false, []);
  check("第二句短句 → 照记, 不再被当名字(D11 顺带消掉取名吞内容 bug)", p.data.profile.name === null && calls.writes.length === 2, r);
  r = await p.agent._dispatch("叫我小谷", false, []);
  check("「叫我XX」后门仍在", p.data.profile.name === "小谷" && calls.writes.length === 2, r);

  console.log("\n【15】首次见面发「在吗」: 欢迎语即回答; 之后长短句全照记");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "unknown", name: null }; return d; })());
  calls = stubWriter(p);
  r = await p.agent._dispatch("在吗", false, []);
  check("第一句探活 → 欢迎语, 不落库", calls.writes.length === 0 && r.includes("随手记 Agent"), r);
  r = await p.agent._dispatch("今天跟医生确认了下周复查的时间安排", false, []);
  check("第二句内容 → 照记, 无取名纠缠", calls.writes.length === 1 && !r.includes("称呼"), r);
  check("state 已 active", p.data.profile.state === "active");
  check("老 data.json 滞留 awaiting_name → 迁移 active", (await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "awaiting_name", name: null }; return d; })())).data.profile.state === "active");

  console.log("\n【16】跨天: 宽限期外自动封存昨天, 新内容记到今天");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => {
    const d = BOUND_DATA();
    const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    d.session = { mode: "diary", entered_date: y, chat_count_today: 0, last_activity_ts: Date.now() - 3 * 3600000, cost_reminder_shown_date: "" };
    return d;
  })());
  calls = stubWriter(p);
  calls.writes.push("昨天的旧段落");   // 让 finalizeDay 有东西可封
  r = await p.agent._dispatch("新一天的第一条", false, []);
  check("昨天被自动封存", calls.finalized.length === 1 && calls.finalized[0] !== "today", JSON.stringify(calls.finalized));
  check("带告知 + 新内容照记", r.includes("自动收尾") && calls.writes.length === 2, r);

  console.log("\n【17】换 bot 吞消息修复: 游标与去重表按 bot 判, 不按微信号");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  p.data.ilink.buf = "OLD_CURSOR"; p.data.ilink.recentSeqs = ["s1", "s2"];
  await p.onLoginConfirmed({ botToken: "TOK1", botId: "B1", userId: "U1", baseUrl: "" });
  check("同人同 bot 重登 → 游标保留", p.data.ilink.buf === "OLD_CURSOR" && p.data.ilink.recentSeqs.length === 2);
  await p.onLoginConfirmed({ botToken: "TOK2", botId: "B2", userId: "U1", baseUrl: "" });
  check("同人换 bot → 游标/去重表清零(否则新 bot 前 N 条被吞)", p.data.ilink.buf === "" && p.data.ilink.recentSeqs.length === 0);
  check("换 bot 不清称呼(还是同一个人)", p.data.profile.state === "active");

  console.log("\n【18】逻辑日边界(契约 v1.2): 凌晨 4 点前算前一天");
  I.setTimezone("Asia/Shanghai");
  I.setDayStartHour(4);
  check("凌晨 2:30 → 前一天", I.logicalTodayStr(new Date("2026-08-16T02:30:00+08:00")) === "2026-08-15", I.logicalTodayStr(new Date("2026-08-16T02:30:00+08:00")));
  check("凌晨 3:59 → 前一天", I.logicalTodayStr(new Date("2026-08-16T03:59:00+08:00")) === "2026-08-15");
  check("凌晨 4:00 → 当天", I.logicalTodayStr(new Date("2026-08-16T04:00:00+08:00")) === "2026-08-16");
  check("白天 → 当天", I.logicalTodayStr(new Date("2026-08-16T15:00:00+08:00")) === "2026-08-16");
  check("边界收口: 非法值回落 4", (I.setDayStartHour(99), I.logicalTodayStr(new Date("2026-08-16T03:00:00+08:00")) === "2026-08-15"));

  console.log("\n【19】收尾语分时段");
  check("21:30 → 夜", I.isNightNow(new Date("2026-08-16T21:30:00+08:00")) === true);
  check("凌晨 2 点 → 夜(还没过边界)", I.isNightNow(new Date("2026-08-16T02:00:00+08:00")) === true);
  check("14:00 → 日", I.isNightNow(new Date("2026-08-16T14:00:00+08:00")) === false);

  console.log("\n【20】撤回预览与欢迎语(纯函数)");
  check("文本截 12 字带省略", I.undoOkReply("今天试了新的手冲豆子花香很明显很满意") === "好的, 撤掉了「今天试了新的手冲豆子花香…」", I.undoOkReply("今天试了新的手冲豆子花香很明显很满意"));
  check("语音 🎤 前缀剥掉", I.undoOkReply("🎤 早上开会说的三件事") === "好的, 撤掉了「早上开会说的三件事」");
  check("图片块 → 说撤图", I.undoOkReply("![[日记/attachments/2026/x.jpg]]") === "好的, 撤掉了刚才那张图片");
  check("欢迎语动态填文件夹", I.welcomeText("PersonalGuyu/Diary").includes("「PersonalGuyu/Diary」文件夹"));
  check("欢迎语教在哪改", I.welcomeText("日记").includes("第三方插件 → WeChat Diary"));

  console.log("\n【21】封存后同分钟续写另起段头(019 e2e 抓出, 两侧同修)");
  const sealed = "# 2026-08-16\n\n**22:04**\n\n封存前\n\n---\n_(今日封存于 22:04)_\n";
  check("封存线在最后段头之后 → 不并入", I.canMergeIntoLastHeader(sealed, "22:04") === false);
  check("不同分钟 → 不并入", I.canMergeIntoLastHeader("**22:04**\n\nx\n", "22:05") === false);
  check("同分钟且未封存 → 并入", I.canMergeIntoLastHeader("**22:04**\n\nx\n", "22:04") === true);
  check("封存后又开了同分钟新段头 → 可并入", I.canMergeIntoLastHeader(sealed + "\n\n**22:04**\n\n封存后\n", "22:04") === true);

  // ══ 2026-08-19 「一天的句号」: 人话式结束 + 夜间收尾提示 + 三个旧 bug ══════════

  console.log("\n【22】识别层: 剥壳/告别语/复读/emoji——正例(命令)与负例(内容)");
  const D = (t) => I.detectIntent(t);
  const FIN = [ "好，结束", "好 结束", "好的结束", "好结束", "嗯结束", "那结束吧", "OK 结束", "ok，结束", "好啦，收工", "结束了", "记完了", "记完啦", "今天记完了", "今天结束", "结束结束", "结束。。", "「结束」", "嗯嗯 结束了",
    "好的好的结束", "好好好结束", "行行行结束", "好啊结束", "好的呀，结束", "结束！！！！！！！！！！！！！！", "✅结束", "【结束】", "结束 结束", "结束咯" ];
  for (const t of FIN) check("FINALIZE ← " + JSON.stringify(t), D(t).intent === I.INTENT.FINALIZE && !D(t).signoff, D(t).intent);
  const SO = [ "晚安", "晚安🌙", "晚安啦", "晚安晚安", "我睡了", "我去睡了", "去睡了", "睡觉去了", "我要睡了", "今天就到这", "今天就到这里", "今天先到这儿吧", "明天见", "好，晚安", "嗯 明天见", "那晚安啦",
    "我睡啦", "去睡啦", "睡觉去啦", "我去睡觉啦", "我先睡了", "我该睡了", "我睡觉了", "晚安了", "晚安咯", "晚安呢", "🌙晚安", "👋明天见", "😴我睡了", "晚安🌙🌙🌙🌙🌙🌙🌙🌙🌙🌙🌙🌙🌙🌙",
    "好的好的晚安", "那好晚安", "好哦，晚安", "嗯呐晚安", "晚安 晚安", "晚安，晚安", "晚安。晚安。", "晚安，明天见", "晚安 明天见", "晚安明天见", "结束 晚安", "好了，晚安，明天见", "我睡了晚安", "那我睡啦", "好，我睡啦" ];
  for (const t of SO) check("告别语 ← " + JSON.stringify(t), D(t).intent === I.INTENT.FINALIZE && D(t).signoff === true, JSON.stringify(D(t)));
  check("晚安 → 睡觉类(晚安池)", D("晚安").bedtime === true);
  check("明天见 → 非睡觉类", D("明天见").bedtime === false);
  const UND = [ "嗯 撤回", "好的，撤回", "撤回撤回撤回这一段", "撤回一下", "撤销掉", "撤回❌", "❌撤回", "撤回！！！！！！！！！！！！！！",
    "好的撤回上一条", "嗯撤回一下", "那撤销一下", "撤回上面那条", "撤回那个", "撤回刚才", "撤回刚才发的", "删掉刚才那条", "删掉最后一条", "撤回吧撤回吧" ];
  for (const t of UND) check("UNDO ← " + JSON.stringify(t), D(t).intent === I.INTENT.UNDO, D(t).intent);
  check("「好，在吗」→ 探活(有分隔符)", D("好，在吗").intent === I.INTENT.CHAT);
  check("「在嘛」「来啦」探活词自带语气字也认(旧 bug)", D("在嘛").intent === I.INTENT.CHAT && D("来啦").intent === I.INTENT.CHAT && D("在嘛在嘛").intent === I.INTENT.CHAT);
  check("「嗯 帮助」→ 帮助", D("嗯 帮助").intent === I.INTENT.HELP);
  check("「在吗在吗」复读仍是探活", D("在吗在吗").intent === I.INTENT.CHAT);
  // 负例: 全部必须是内容——备忘录/病历/待办用户的回归防线
  const CONTENT = [ "睡了", "睡觉了", "醒了", "吃药了", "写完了", "先这样", "就这样吧", "今天就这样", "到此为止", "走了", "88", "完事", "拜拜", "再见",
    "好早", "好早啊", "那完了", "好完了", "那开始", "那记一下", "好的撤销了订单", "那撤回来了", "撤回申请", "撤销订阅", "撤回来了",
    "好的，报销 386", "嗯 妈血压 135/85", "好的在吗", "行了", "那天结束得很晚", "今天就到这里明天继续写方案吧我先去吃饭了",
    "完了", "完了完了", "完了！", "完了😭", "完了……", "那完了", "《晚安》", "《结束》", "#标签", "✅ 买菜", "晚安 宝贝", "好好学习", "好好休息", "好啊今天吃火锅", "那好的", "好好好", "嗯好",
    "睡啦", "睡觉啦", "醒啦", "吃药啦", "写完啦", "走啦", "下班啦", "我睡", "去睡", "删掉了一些旧照片", "删除那个账号", "撤回来了", "今天 结束", "结束 宝贝" ];
  for (const t of CONTENT) check("DIARY ← " + JSON.stringify(t), D(t).intent === I.INTENT.DIARY, JSON.stringify(D(t)));
  check("光杆「好」不是命令", D("好").intent === I.INTENT.DIARY);
  check("光杆「嗯」不是命令", D("嗯").intent === I.INTENT.DIARY);
  check("isUndoPhrase 只放行复读/指代尾巴", I.isUndoPhrase("撤回撤回这一段") && I.isUndoPhrase("撤销一下") && !I.isUndoPhrase("撤回申请") && !I.isUndoPhrase("撤回来了"));

  console.log("\n【23】「记：」逃生口: 任何词都能原样记下");
  check("「记：晚安」→ DIARY + forced", D("记：晚安").intent === I.INTENT.DIARY && D("记：晚安").forced === true);
  check("半角冒号也认", D("记: 结束了").forced === true);
  check("「记一下明天开会」不是逃生口(没冒号)", !D("记一下明天开会").forced);

  console.log("\n【23.5】「继续记录」是宣告不是内容(谷雨 8/19 实测反馈)");
  for (const t of ["继续记录", "继续", "继续记", "接着记", "继续写", "继续记录吧", "继续记录。"])
    check("宣告 ← " + JSON.stringify(t), D(t).intent === I.INTENT.START_DIARY && D(t).cont === true, JSON.stringify(D(t)));
  for (const t of ["明天继续记录血压", "继续加油", "继续吃药", "继续观察", "工作继续"])
    check("内容 ← " + JSON.stringify(t), D(t).intent === I.INTENT.DIARY, JSON.stringify(D(t)));
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  await p.agent._dispatch("先记一条", false, []);
  await p.agent._dispatch("结束", false, []);
  r = await p.agent._dispatch("继续记录", false, []);
  check("「结束」后发「继续记录」→ 告知直接发, 不落库", calls.writes.length === 1 && r.includes("直接发就行") && r.includes("收尾标记"), r);
  r = await p.agent._dispatch("然后真的记一条", false, []);
  check("之后的内容照记", calls.writes.length === 2, r);
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  r = await p.agent._dispatch("记：晚安", false, []);
  check("落库的是剥掉前缀的「晚安」, 没封存", calls.writes.length === 1 && calls.writes[0] === "晚安" && calls.finalized.length === 0, JSON.stringify(calls));
  r = await p.agent._dispatch("记：叫我小明", false, []);
  check("「记：叫我小明」照记, 不改称呼", calls.writes[1] === "叫我小明" && p.data.profile.name === null, JSON.stringify(calls.writes));
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "awaiting_name", name: null }; return d; })());
  calls = stubWriter(p);
  r = await p.agent._dispatch("记：谷雨", false, []);
  check("取名轮里「记：谷雨」→ 当内容记, 不当名字", calls.writes[0] === "谷雨" && p.data.profile.name === null && p.data.profile.state === "active", JSON.stringify([calls.writes, p.data.profile]));

  console.log("\n【24】告别语流程: 晚安 → 补一条 → 再晚安; 空日子只道别; 「好，结束」也封存");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  r = await p.agent._dispatch("晚安", false, []);
  check("空日子「晚安」→ 只道别, 不封、不催记", calls.finalized.length === 1 && r.includes("晚安") && !r.includes("想记什么直接发") && !r.includes("段"), r);
  check("空日子说了收尾词也算手动收尾(说明会用了, 提示永久闭嘴)", p.data.profile.finalize_count === 1, String(p.data.profile.finalize_count));
  await p.agent._dispatch("今天生病了去医院", false, []);
  await p.agent._dispatch("先去检查再说", false, []);
  r = await p.agent._dispatch("晚安", false, []);
  check("有内容「晚安」→ 封存 + 回以同类(带段数)", calls.finalized.length === 2 && /晚安|好梦/.test(r) && r.includes("2 段都收好了"), r);
  check("不走「结束」仪式池", !r.includes("归档完毕") && !r.includes("小册子") && !r.includes("打卡完成") && !r.includes("下次见~"));
  check("finalize_count = 2", p.data.profile.finalize_count === 2, String(p.data.profile.finalize_count));
  r = await p.agent._dispatch("晚安", false, []);
  check("紧接着再说晚安(没补记)→ 短句只道别", r === "晚安 🌙 明天见", r);
  await p.agent._dispatch("想起来还要买药", false, []);
  r = await p.agent._dispatch("我睡了", false, []);
  check("补一条后再告别 → 「补的也收好了」", r.includes("补的也收好了") && r.includes("晚安"), r);
  check("每次手动收尾都计数", p.data.profile.finalize_count === 4, String(p.data.profile.finalize_count));
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  await p.agent._dispatch("今天记一条", false, []);
  r = await p.agent._dispatch("好，结束", false, []);
  check("「好，结束」→ 封存, 不再被当内容", calls.writes.length === 1 && calls.finalized.length === 1 && !r.includes("记下来"), r);
  r = await p.agent._dispatch("结束", false, []);
  check("「结束」保留仪式池(有收尾+告别两段)", r.includes("\n\n"), r);
  r = await p.agent._dispatch("好，帮助", false, []);
  check("「好，帮助」→ 指南, 且帮助里教了「晚安」和「记：」", r.includes("使用指南") && r.includes("晚安 / 结束") && r.includes("记：xx"), r.slice(0, 60));

  console.log("\n【25】signoffReply 纯函数: 白天/夜里/名字");
  const dayT = new Date("2026-08-16T14:00:00+08:00"), nightT = new Date("2026-08-16T23:00:00+08:00");
  check("白天「今天就到这」→ 白天版, 带段数", I.signoffReply({ signoff: true, bedtime: false }, { status: "sealed", n: 5, afterSeal: 0 }, null, dayT).includes("5 段都收好了 📖"));
  check("白天「晚安」→ 仍走晚安池(bedtime 强制)", /晚安|好梦/.test(I.signoffReply({ signoff: true, bedtime: true }, { status: "sealed", n: 5, afterSeal: 0 }, null, dayT)));
  check("夜里「明天见」→ 夜版", /晚安|好梦/.test(I.signoffReply({ signoff: true, bedtime: false }, { status: "sealed", n: 5, afterSeal: 0 }, null, nightT)));
  check("写入失败 → 响亮", I.signoffReply({ signoff: true }, { status: "error" }, null, nightT) === I.texts.FINALIZE_FAIL_REPLY);
  const one = I.signoffReply({ signoff: true, bedtime: true }, { status: "sealed", n: 1, afterSeal: 0 }, null, nightT);
  check("只有 1 段 → 「这一段收好了」", one.includes("这一段收好了") && !one.includes("1 段"), one);
  let sawName = false;
  for (let i = 0; i < 60; i++) if (I.signoffReply({ signoff: true, bedtime: true }, { status: "sealed", n: 3, afterSeal: 0 }, "谷雨", nightT).includes("谷雨")) sawName = true;
  check("有称呼时偶尔带名字", sawName);

  console.log("\n【26】夜间收尾提示决策(纯函数, 表驱动)");
  I.setNudgeNightHour(22);
  const N = (o) => I.nightSignoffTip(Object.assign({ n: 3, sealed: false, now: nightT, nudgedDate: "", nudgeCount: 0, finalizeCount: 0 }, o));
  check("23:00 第一条深夜消息 → 提示", N({}) === I.texts.NIGHT_SIGNOFF_TIP);
  check("凌晨 1 点(边界前)也算深夜", N({ now: new Date("2026-08-17T01:00:00+08:00") }) === I.texts.NIGHT_SIGNOFF_TIP);
  check("21:30 → 不提示(22 点起)", N({ now: new Date("2026-08-16T21:30:00+08:00") }) === null);
  check("14:00 → 不提示", N({ now: dayT }) === null);
  check("今天已提示过 → 不再提示", N({ nudgedDate: I.logicalTodayStr(nightT) }) === null);
  check("昨天提示过 → 今天可以", N({ nudgedDate: "2026-08-15" }) === I.texts.NIGHT_SIGNOFF_TIP);
  check("终身 3 次到顶 → 永久闭嘴", N({ nudgeCount: 3 }) === null);
  check("手动收尾过 1 次 → 永久闭嘴", N({ finalizeCount: 1 }) === null);
  check("今天已封存 → 不提示", N({ sealed: true }) === null);
  check("写入失败(n=0) → 不提示", N({ n: 0 }) === null);
  check("非法阈值回落 22", (I.setNudgeNightHour(3), N({ now: new Date("2026-08-16T21:30:00+08:00") }) === null));
  I.setNudgeNightHour(22);
  check("isLateNight 22:00 起", I.isLateNight(new Date("2026-08-16T22:00:00+08:00")) === true && I.isLateNight(new Date("2026-08-16T21:59:00+08:00")) === false);

  console.log("\n【27】夜间提示挂在回执上: 一天一次、开页并成一句、命令回执不挂、老用户手动收尾后闭嘴");
  // agent 级路径的 now 取自 new Date(), 不能注入; 用阈值把"现在"强制成深夜/白天两种情况都跑到:
  // isLateNight = h >= nudgeNightHour || h < dayStartHour —— h≥12 时把 nudge 拉到 h, h<12 时把 dayStart 抬到 12
  const hNow = Number(I.hhmmStr(new Date()).slice(0, 2));
  const forceLate = () => (hNow >= 12 ? (I.setDayStartHour(4), I.setNudgeNightHour(hNow)) : (I.setDayStartHour(12), I.setNudgeNightHour(23)));
  const forceDay = () => (hNow < 4 ? (I.setDayStartHour(0), I.setNudgeNightHour(23)) : (I.setDayStartHour(4), I.setNudgeNightHour(23)));
  const canForceDay = hNow !== 23; // 23 点无法用合法阈值变成"白天"
  forceLate();
  check("(强制深夜)isLateNight 为真", I.isLateNight(new Date()) === true);
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  forceLate(); // onload 会按 settings 重设阈值, 再压一次
  calls = stubWriter(p);
  r = await p.agent._dispatch("第一条", false, []);
  check("开页回执: 提示并进 tips, 一条回执一个括号", r.includes("睡前跟我说声「晚安」") && !r.includes(I.texts.FIRST_OF_DAY_TIPS) && r.split("(").length === 2, r);
  check("发送前不记账(回执发不出去不烧额度)", !p.data.session.nudged_date && !p.data.profile.nudge_count && !!p.agent._pendingNudge);
  check("commitNudge 落账", p.agent.commitNudge() === true && p.data.session.nudged_date === I.logicalTodayStr(new Date()) && p.data.profile.nudge_count === 1, JSON.stringify([p.data.session.nudged_date, p.data.profile.nudge_count]));
  check("重复 commit 无效", p.agent.commitNudge() === false && p.data.profile.nudge_count === 1);
  r = await p.agent._dispatch("第二条", false, []);
  check("同一天第二条不再提示", !r.includes("睡前"), r);
  r = await p.agent._dispatch("在吗", false, []);
  check("命令回执从不挂提示", !r.includes("睡前"), r);
  r = await p.agent._dispatch("撤回", false, []);
  check("撤回回执也不挂", !r.includes("睡前"), r);
  // 非开页的深夜第一条(白天开的页, 夜里回来接着写——谷雨 8/18 的路径): 单独追加一句
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  forceLate();
  calls = stubWriter(p);
  calls.writes.push("白天记的"); // 让今天不是第一条
  r = await p.agent._dispatch("夜里回来写的", false, []);
  check("非开页深夜第一条 → 单独附一句提示", r.includes("\n\n" + I.texts.NIGHT_SIGNOFF_TIP) && r.includes("第 2 段"), r);
  p.agent.commitNudge();
  r = await p.agent._dispatch("再写一条", false, []);
  check("落账后同晚不再提示", !r.includes("睡前"), r);
  r = await p.agent._dispatch("晚安", false, []);
  check("说了晚安 → finalize_count=1", p.data.profile.finalize_count === 1);
  // 终身上限: 提示过 3 次的账号再深夜也不提示
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "active", name: null, finalize_count: 0, nudge_count: 3 }; return d; })());
  forceLate();
  calls = stubWriter(p);
  r = await p.agent._dispatch("第四晚", false, []);
  check("终身 3 次到顶 → 深夜也不提示", !r.includes("睡前"), r);
  // 手动收尾过的老用户
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "active", name: null, finalize_count: 2, nudge_count: 0 }; return d; })());
  forceLate();
  calls = stubWriter(p);
  r = await p.agent._dispatch("老用户的一条", false, []);
  check("手动收尾过的用户: 深夜也不提示", !r.includes("睡前"), r);
  // 首次见面那条不挂(欢迎语已经够长)
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "unknown", name: null }; return d; })());
  forceLate();
  calls = stubWriter(p);
  r = await p.agent._dispatch("第一次来记一条", false, []);
  check("首次见面不挂夜间提示", r.includes("随手记 Agent") && !r.includes("睡前"), r);
  if (canForceDay) {
    forceDay();
    check("(强制白天)isLateNight 为假", I.isLateNight(new Date()) === false);
    p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
    forceDay();
    calls = stubWriter(p);
    r = await p.agent._dispatch("白天第一条", false, []);
    check("白天开页: tips 原样, 不带夜间提示", r.includes(I.texts.FIRST_OF_DAY_TIPS) && !r.includes("睡前"), r);
    check("白天 nudge_count 不动", !p.data.profile.nudge_count && !p.data.session.nudged_date);
  } else {
    console.log("  (本机 23 点整, 跳过强制白天分支)");
  }
  // 跨天告知那条不挂夜间提示(顺延到下一条)
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.session.entered_date = "2026-01-01"; return d; })());
  forceLate();
  calls = stubWriter(p);
  calls.writes.push("昨天的"); // 昨天有内容且未手动封存 → 自动封存 → 告知
  r = await p.agent._dispatch("今晚第一条", false, []);
  check("带跨天告知的回执不挂夜间提示", r.includes("自动收尾") && !r.includes("睡前") && !p.agent._pendingNudge, r);
  r = await p.agent._dispatch("今晚第二条", false, []);
  check("提示顺延到下一条", r.includes("睡前"), r);
  I.setDayStartHour(4); I.setNudgeNightHour(22);
  check("老 data.json 缺字段 → 默认补零", (await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA())).data.profile.nudge_count === 0);
  // 「晚安」+图片同条: 图先落库再收尾
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._client = { downloadImage: async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]) };
  p.writer.writeImage = async () => { calls.writes.push("[img]"); return { n: calls.writes.length, diskFull: false, sealed: false }; };
  await p.agent._dispatch("先记一条", false, []);
  r = await p.agent._dispatch("晚安", false, [{ fake: 1 }]);
  check("图先记(第 2 段)再封存(2 段都收好了), 顺序与数字一致", r.indexOf("图片收好啦") < r.indexOf("2 段都收好了") && calls.finalized.length === 1, r);

  console.log("\n【28】跨天告知只给真自动封存的: 昨晚自己说了晚安, 今早不再说「已自动收尾」(旧 bug)");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => {
    const d = BOUND_DATA();
    d.session = { mode: "diary", entered_date: "2026-01-01", chat_count_today: 0, last_activity_ts: 0, cost_reminder_shown_date: "" };
    return d;
  })());
  calls = stubWriter(p);
  calls.writes.push("昨晚的段落"); calls.sealedAt["2026-01-01"] = 1;   // 昨晚已手动封存
  r = await p.agent._dispatch("新一天的第一条", false, []);
  check("finalizeDay 走了但返回 already", calls.finalized[0] === "2026-01-01");
  check("回执不带「自动收尾」(桩不分日, 段数续算), 新内容照记", !r.includes("自动收尾") && r.includes("记下来") && calls.writes.length === 2, r);
  check("对照【16】: 真自动封存的才带告知", true);

  console.log("\n【29】真 DiaryWriter 落盘: finalizeDay 三态 + 撤回保住封存行(假 vault)");
  function fakeVault(files) {
    const v = {
      files,
      getFileByPath: (path) => (path in files ? { path } : null),
      getAbstractFileByPath: (path) => (path in files ? { path } : null),
      getFolderByPath: () => ({}),
      createFolder: async () => {},
      create: async (path, c) => { files[path] = c; },
      process: async (f, fn) => { files[f.path] = fn(files[f.path]); return files[f.path]; },
      cachedRead: async (f) => files[f.path],
    };
    return v;
  }
  const files = {};
  const wp = { app: { vault: fakeVault(files) }, settings: { diaryFolder: "日记" } };
  const W = new I.DiaryWriter(wp, null);
  const DAY = "2026-08-18";
  let fr = await W.finalizeDay(DAY);
  check("没有文件 → empty", fr.status === "empty" && fr.n === 0);
  await W.write("第一段", false, DAY);
  await W.write("第二段", false, DAY);
  fr = await W.finalizeDay(DAY);
  check("有内容 → sealed, n=2", fr.status === "sealed" && fr.n === 2, JSON.stringify(fr));
  const path = W.diaryPath(DAY);
  check("文件里有封存行", files[path].includes(I.texts.CLOSING_MARKER));
  fr = await W.finalizeDay(DAY);
  check("再封 → already, afterSeal=0, 不重复写", fr.status === "already" && fr.afterSeal === 0 && files[path].split(I.texts.CLOSING_MARKER).length === 2, JSON.stringify(fr));
  const w3 = await W.write("封存后补的", false, DAY);
  check("write 报告 sealed=true", w3.sealed === true && w3.n === 3);
  fr = await W.finalizeDay(DAY);
  check("补记后再封 → already, afterSeal=1", fr.status === "already" && fr.afterSeal === 1 && fr.n === 3, JSON.stringify(fr));
  let u = await W.undoLastBlock(DAY);
  check("撤回封存后补的那条", u.ok && u.removed === "封存后补的");
  check("封存行还在, 且孤儿段头清掉了", files[path].includes(I.texts.CLOSING_MARKER) && (files[path].match(/\*\*\d\d:\d\d\*\*/g) || []).length === 1, JSON.stringify(files[path]));
  u = await W.undoLastBlock(DAY);
  check("再撤(封存线之前的「第二段」)", u.ok && u.removed === "第二段");
  check("封存行仍保住(旧 bug: 会连封存行一起删)", files[path].includes(I.texts.CLOSING_MARKER) && files[path].includes("第一段"), JSON.stringify(files[path]));
  check("封存行位置正确: 在内容之后、文件末尾", files[path].trim().endsWith(")_"), JSON.stringify(files[path]));
  u = await W.undoLastBlock(DAY);
  fr = await W.finalizeDay(DAY);
  check("全撤光后再封 → empty(只剩标题不封)", u.ok && fr.status === "empty" && fr.n === 0, JSON.stringify(fr));
  const emptyPath = W.diaryPath("2026-08-19");
  files[emptyPath] = "";
  check("空字符串文件 → empty", (await W.finalizeDay("2026-08-19")).status === "empty");
  const before29 = files[path];
  const wr = await W.write("再来一条", false, DAY);
  check("光标题文件续写正常, sealed=false", wr.n === 1 && wr.sealed === false && files[path] !== before29);


  // ══ D10 (2026-08-19 谷雨拍板): 每日提醒 + 语音兜底 + 文件/视频接收 ══════════

  console.log("\n【30】每日提醒: reminderDue 纯函数(表驱动)");
  I.setDayStartHour(4);
  const RD = (o) => I.reminderDue(Object.assign({ enabled: true, timeStr: "21:30", now: new Date("2026-08-16T21:35:00+08:00"), countToday: 0, remindedDate: "", streak: 0 }, o));
  check("到点+没记+没提醒过 → 发", RD({}) === true);
  check("还没到点(21:29) → 不发", RD({ now: new Date("2026-08-16T21:29:00+08:00") }) === false);
  check("今天记过了 → 不发", RD({ countToday: 2 }) === false);
  check("今天提醒过了 → 不发", RD({ remindedDate: "2026-08-16" }) === false);
  check("窗口开到凌晨: 01:00 仍是同一逻辑日 → 已提醒不重发", RD({ now: new Date("2026-08-17T01:00:00+08:00"), remindedDate: "2026-08-16" }) === false);
  check("昨天提醒的 → 今天照发", RD({ remindedDate: "2026-08-15" }) === true);
  check("连续 3 天没写 → 闭嘴", RD({ streak: 3 }) === false);
  check("关掉 → 不发", RD({ enabled: false }) === false);
  check("时间格式错 → 不发", RD({ timeStr: "乱写" }) === false && RD({ timeStr: "25:00" }) === false);
  check("夜猫子设 01:00: 23:00 还没到", RD({ timeStr: "01:00", now: new Date("2026-08-16T23:00:00+08:00") }) === false);
  check("夜猫子设 01:00: 01:30 到了(逻辑日还是 16 号)", RD({ timeStr: "01:00", now: new Date("2026-08-17T01:30:00+08:00") }) === true);
  check("文案轮流不重样", I.reminderText(0) !== I.reminderText(1) && I.reminderText(0) === I.reminderText(I.texts2.REMINDER_LINES.length));
  const TRE = I.texts2.REMINDER_TIME_RE;
  check("时间正则: 合法", TRE.test("21:30") && TRE.test("8:05") && TRE.test("04:00") && TRE.test("23:59") && TRE.test("0:00"));
  check("时间正则: 越界/半截拒收(设置页与 reminderDue 同规则)", !TRE.test("24:30") && !TRE.test("25:00") && !TRE.test("21:75") && !TRE.test("8:5") && !TRE.test("21:"));

  console.log("\n【31】每日提醒: _reminderTick 全链路(桩 client)");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  const sentReminders = [];
  p._running = true;
  p._pollSettledTs = Date.now();
  p._client = { sendText: async (to, text) => { sentReminders.push(text); } };
  p.settings.reminderTime = I.hhmmStr(); // 设成"现在", 保证到点
  I.setDayStartHour(4);
  await p._reminderTick();
  check("发出提醒", sentReminders.length === 1, JSON.stringify(sentReminders));
  check("提醒文案来自轮换池", I.texts2.REMINDER_LINES.includes(sentReminders[0]), sentReminders[0]);
  check("记账: reminded_date/streak/idx/last_result", p.data.session.reminded_date === I.logicalTodayStr(new Date()) && p.data.session.reminder_streak === 1 && p.data.session.reminder_idx === 1 && p.data.session.reminder_last_result.startsWith("ok"), JSON.stringify(p.data.session));
  await p._reminderTick();
  check("同一天不再发", sentReminders.length === 1);
  await p.agent._dispatch("回来记一条", false, []);
  check("用户一写东西 streak 清零", p.data.session.reminder_streak === 0);
  await p._reminderTick();
  check("记过之后当天也不会再发(countToday>0)", sentReminders.length === 1);
  // 发送失败: 当天不重试, streak 不涨
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._running = true; p._pollSettledTs = Date.now();
  p._client = { sendText: async () => { const e = new Error("发送失败 ret=-99"); e.ilinkCode = -99; throw e; } };
  p.settings.reminderTime = I.hhmmStr();
  await p._reminderTick();
  check("失败也记账(一天只试一次), streak 不涨", p.data.session.reminded_date === I.logicalTodayStr(new Date()) && p.data.session.reminder_streak === 0 && p.data.session.reminder_last_result.startsWith("fail"), p.data.session.reminder_last_result);
  await p._reminderTick();
  check("失败后当天不重试", p.data.session.reminder_last_result.split(" ")[0] === "fail");
  // 各路闸门
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  const sent2 = [];
  p._running = true; p._client = { sendText: async (t2, x) => sent2.push(x) };
  p.settings.reminderTime = I.hhmmStr();
  p._pollSettledTs = Date.now() - 10 * 60 * 1000;
  await p._reminderTick();
  check("拉取不新鲜(刚唤醒) → 不发", sent2.length === 0);
  p._pollSettledTs = Date.now();
  p.data.session.reminder_streak = 3;
  await p._reminderTick();
  check("streak=3 → 闭嘴", sent2.length === 0);
  p.data.session.reminder_streak = 0;
  p.settings.reminderEnabled = false;
  await p._reminderTick();
  check("开关关掉 → 不发", sent2.length === 0);
  p.settings.reminderEnabled = true;
  p._skipBacklog = true;
  await p._reminderTick();
  check("skipBacklog 恢复期 → 不发", sent2.length === 0);
  p._skipBacklog = false;
  await p._reminderTick();
  check("闸门全开 → 发", sent2.length === 1);
  check("老 data.json 缺提醒字段 → 默认补齐", (await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA())).data.session.reminder_streak === 0);
  // 竞态: 提醒在途时用户消息插队写入 → streak 不能被反手写回(审稿轮抓出)
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._running = true; p._pollSettledTs = Date.now();
  p.settings.reminderTime = I.hhmmStr();
  p._client = { sendText: async () => { await p.agent._dispatch("提醒在途时插队的消息", false, []); } };
  await p._reminderTick();
  check("在途写入 → streak 保持 0(写入即清零不被覆盖)", p.data.session.reminder_streak === 0 && p.data.session.reminder_last_result.startsWith("ok"), JSON.stringify(p.data.session));
  // 空日子说「晚安」→ 当天提醒也压掉(审稿轮抓出: 刚道晚安半小时又被催很荒唐)
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._running = true; p._pollSettledTs = Date.now();
  const sent3 = [];
  p._client = { sendText: async (to, x) => sent3.push(x) };
  p.settings.reminderTime = I.hhmmStr();
  await p.agent._dispatch("晚安", false, []);
  check("道别后 reminded_date 落在今天", p.data.session.reminded_date === I.logicalTodayStr(new Date()));
  await p._reminderTick();
  check("道过晚安的空日子不再催记", sent3.length === 0);
  // 重新扫码换管道 → _pollSettledTs 归零, 新 loop 完成一轮前不发(审稿轮抓出)
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._pollSettledTs = Date.now() - 30000; // 旧管道留下的"新鲜"值
  p.startPipeline = Object.getPrototypeOf(p).startPipeline; // 用真方法验证归零
  try { p.startPipeline(); } catch (e) {}
  check("startPipeline 先归零 _pollSettledTs", p._pollSettledTs === 0, String(p._pollSettledTs));

  console.log("\n【32】语音兜底: 转写失败存原音频");
  check("SILK 嗅探", I.sniffAudioExt(Buffer.from("\x02#!SILK_V3xxxxxxxxxx", "binary")) === "silk");
  check("mp3 嗅探", I.sniffAudioExt(Buffer.from("ID3xxxxxxxxxxxxx")) === "mp3");
  check("认不出按 encode_type 兜底", I.sniffAudioExt(Buffer.from("????????????????"), 7) === "mp3" && I.sniffAudioExt(Buffer.alloc(4), 99) === "bin");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._client = { downloadMedia: async () => Buffer.from("\x02#!SILK_V3" + "x".repeat(20), "binary") };
  p.writer.attachmentPathNamed = (day, name) => "日记/attachments/2026/" + day + "-" + name;
  p.writer.writeAttachment = async (buf, path, day, marker) => { calls.writes.push((marker ? marker + " " : "") + "![[" + path + "]]"); return { n: calls.writes.length, sealed: false, diskFull: false, path }; };
  r = await p.agent._dispatch("", true, [], { voices: [{ encode_type: 6, media: { aes_key: "k" } }], files: [], videos: [] });
  check("原音频落库(🎤 前缀块)", calls.writes.length === 1 && calls.writes[0].startsWith("🎤 ![[") && calls.writes[0].includes(".silk"), JSON.stringify(calls.writes));
  check("回执讲清楚: 没转出文字+已存+可重说", r.includes("没转出文字") && r.includes("存下") && r.includes("再说一遍"), r);
  p._client = { downloadMedia: async () => { throw new Error("网络挂了"); } };
  r = await p.agent._dispatch("", true, [], { voices: [{ encode_type: 6, media: { aes_key: "k" } }], files: [], videos: [] });
  check("下载失败 → 响亮, 请重说", r === I.texts2.VOICE_FALLBACK_FAIL_REPLY, r);

  console.log("\n【33】文件/视频接收: md5 校验、重复复用(#193)、大小上限");
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p.app.vault.getAbstractFileByPath = (path) => (String(path).includes("attachments") ? {} : null);
  const fileBuf = Buffer.from("PDF 假内容 " + "x".repeat(100));
  const fileMd5 = I.md5Hex(fileBuf);
  let downloads = 0;
  let nextBuf = fileBuf;
  p._client = { downloadMedia: async () => { downloads++; return nextBuf; } };
  p.writer.attachmentPathNamed = (day, name) => "日记/attachments/2026/" + day + "-" + name;
  p.writer.writeAttachment = async (buf, path, day, marker) => { calls.writes.push("![[" + path + "]]"); return { n: calls.writes.length, sealed: false, diskFull: false, path }; };
  p.writer.appendLinkBlock = async (path, day) => { calls.writes.push("reuse:![[" + path + "]]"); return { n: calls.writes.length, sealed: false }; };
  const FI = { file_name: "检查报告.pdf", md5: fileMd5, len: String(fileBuf.length), media: { aes_key: "k" } };
  r = await p.agent._dispatch("", false, [], { voices: [], files: [FI], videos: [] });
  check("文件落库, 回执带原名和段数", r.includes("「检查报告.pdf」收好啦") && calls.writes.length === 1 && downloads === 1, r);
  check("md5 登记", p.data.ilink.fileMd5s.length === 1 && p.data.ilink.fileMd5s[0].md5 === fileMd5);
  r = await p.agent._dispatch("", false, [], { voices: [], files: [FI], videos: [] });
  check("同 md5 再发 → 不下载, 直接引用(绕 #193)", downloads === 1 && calls.writes[1].startsWith("reuse:") && r.includes("之前收过"), r);
  r = await p.agent._dispatch("", false, [], { voices: [], files: [{ file_name: "另一份.pdf", md5: "0".repeat(32), len: "10", media: { aes_key: "k" } }], videos: [] });
  check("md5 对不上 → 判为重复文件解密坑, 响亮+教改名", r === I.texts2.FILE_DUP_KEY_REPLY && calls.writes.length === 2 && downloads === 2, r);
  r = await p.agent._dispatch("", false, [], { voices: [], files: [{ file_name: "大.zip", md5: "1".repeat(32), len: String(200 * 1024 * 1024), media: { aes_key: "k" } }], videos: [] });
  check("超 100MB → 不下载直接拒", r === I.texts2.FILE_TOO_BIG_REPLY && downloads === 2, r);
  r = await p.agent._dispatch("", false, [], { voices: [], files: [], videos: [{ video_md5: "2".repeat(32), video_size: String(200 * 1024 * 1024), media: { aes_key: "k" } }] });
  check("超大视频 → 🎬 文案(不说文件)", r === I.texts2.VIDEO_TOO_BIG_REPLY, r);
  const vidBuf = Buffer.from("视频假内容" + "y".repeat(50));
  nextBuf = vidBuf;
  r = await p.agent._dispatch("", false, [], { voices: [], files: [], videos: [{ video_md5: I.md5Hex(vidBuf), video_size: String(vidBuf.length), media: { aes_key: "k" } }] });
  check("视频照收", downloads === 3 && r.includes("🎬 视频收好啦"), r);
  nextBuf = Buffer.from("不是那段视频");
  r = await p.agent._dispatch("", false, [], { voices: [], files: [], videos: [{ video_md5: "4".repeat(32), video_size: "10", media: { aes_key: "k" } }] });
  check("视频 md5 不符 → 🎬 文案, 不教改名", r === I.texts2.VIDEO_DUP_KEY_REPLY && !r.includes("改个名"), r);
  nextBuf = fileBuf;
  // 晚安+文件同条: 文件先落库再收尾, 数字一致
  const buf3 = Buffer.from("z".repeat(30));
  nextBuf = buf3;
  r = await p.agent._dispatch("晚安", false, [], { voices: [], files: [{ file_name: "睡前.pdf", md5: I.md5Hex(buf3), len: "30", media: { aes_key: "k" } }], videos: [] });
  check("「晚安」+文件同条: 文件在前、收尾在后、数字一致", r.indexOf("睡前.pdf") < r.indexOf("段都收好了") && calls.finalized.length === 1, r);
  // 撤回文案分型
  check("撤回文件的文案", I.undoOkReply("![[日记/attachments/2026/a.pdf]]") === "好的, 撤掉了刚才那个文件");
  check("撤回视频的文案", I.undoOkReply("![[日记/attachments/2026/a.mp4]]") === "好的, 撤掉了刚才那个视频");
  check("撤回语音的文案", I.undoOkReply("🎤 ![[日记/attachments/2026/a.silk]]") === "好的, 撤掉了刚才那条语音");
  check("撤回图片文案不变", I.undoOkReply("![[日记/attachments/2026/a.jpg]]") === "好的, 撤掉了刚才那张图片");
  // attachmentPathNamed 消毒(真 writer)
  const pw = (await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA())).writer;
  const sane = pw.attachmentPathNamed("2026-08-19", '我的:报告|v1[f]#2.pdf');
  check("原名消毒: 去毒字符保扩展名", sane.endsWith(".pdf") && !/[:|#\[\]]/.test(sane) && sane.includes("我的报告"), sane);
  check("路径穿越只留 basename", !pw.attachmentPathNamed("2026-08-19", "../../evil.sh").includes(".."));
  check("空名兜底 file.bin", pw.attachmentPathNamed("2026-08-19", "").endsWith("file.bin"));
  check("毒字符吃掉 base 只剩扩展名 → 仍以 .pdf 结尾", pw.attachmentPathNamed("2026-08-19", "???.pdf").endsWith(".pdf"), pw.attachmentPathNamed("2026-08-19", "???.pdf"));
  const longExt = pw.attachmentPathNamed("2026-08-19", "a." + "x".repeat(300));
  check("超长假扩展名 → 整名压到文件系统限内", Buffer.byteLength(longExt.split("/").pop(), "utf8") < 200, String(Buffer.byteLength(longExt.split("/").pop(), "utf8")));
  const longCjk = pw.attachmentPathNamed("2026-08-19", "报".repeat(120) + ".pdf");
  check("超长中文名 → 压字节数且保扩展名", Buffer.byteLength(longCjk.split("/").pop(), "utf8") < 200 && longCjk.endsWith(".pdf"));
  // 取名轮(awaiting_name)「晚安」+文件同条: 文件也要落在封存线之前(审稿轮抓出)
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "awaiting_name", name: null }; return d; })());
  calls = stubWriter(p);
  const seq = [];
  p._client = { downloadMedia: async () => fileBuf };
  p.writer.attachmentPathNamed = (day, name) => "x/" + name;
  p.writer.writeAttachment = async (buf, path) => { seq.push("write"); calls.writes.push(path); return { n: calls.writes.length, sealed: false, diskFull: false, path }; };
  const origFinalize = p.writer.finalizeDay;
  p.writer.finalizeDay = async (d) => { seq.push("seal"); return origFinalize(d); };
  calls.writes.push("白天的一段");
  r = await p.agent._dispatch("晚安", false, [], { voices: [], files: [{ file_name: "g.pdf", md5: fileMd5, len: "10", media: { aes_key: "k" } }], videos: [] });
  check("取名轮「晚安」+文件: 先写文件再封存", seq.join(",") === "write,seal", seq.join(","));
  // 磁盘满文案分型
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  p._client = { downloadMedia: async () => fileBuf };
  p.writer.attachmentPathNamed = (day, name) => "x/" + name;
  p.writer.writeAttachment = async () => ({ n: 0, sealed: false, diskFull: true, path: "" });
  r = await p.agent._dispatch("", false, [], { voices: [], files: [{ file_name: "f.pdf", md5: fileMd5, len: "10", media: { aes_key: "k" } }], videos: [] });
  check("文件磁盘满 → 「存附件失败」不说图片", r === I.texts2.ATTACH_DISK_FULL_REPLY, r);


  console.log("\n【34】D12 语音原声: SILK→WAV、原声+文字同块、命令不存音频、失败降级");
  const silkLib = I.getSilkLib();
  check("内嵌 SILK 解码器可用", !!silkLib && typeof silkLib.decode === "function");
  // pcmToWav 头部
  const wavHdr = I.pcmToWav(Buffer.alloc(4800), 24000);
  check("WAV 头: RIFF/WAVE/PCM/mono/24k/16bit", wavHdr.slice(0,4).toString()==="RIFF" && wavHdr.slice(8,12).toString()==="WAVE" && wavHdr.readUInt16LE(20)===1 && wavHdr.readUInt16LE(22)===1 && wavHdr.readUInt32LE(24)===24000 && wavHdr.readUInt16LE(34)===16 && wavHdr.length===44+4800);
  // 往返: encode → silkToWav
  const pcmIn = Buffer.alloc(24000*2);
  for (let i=0;i<24000;i++) pcmIn.writeInt16LE(Math.round(Math.sin(i/24000*440*2*Math.PI)*12000), i*2);
  const encOut = await silkLib.encode(pcmIn, 24000);
  const silkBuf = Buffer.from(encOut.data);
  const wavOut = await I.silkToWav(silkBuf);
  check("SILK 往返解码成合法 WAV", !!wavOut && wavOut.slice(0,4).toString()==="RIFF" && wavOut.length > 40000, wavOut && String(wavOut.length));
  check("encode 输出自带 0x02 前缀(微信同款形态), 原样可解", silkBuf[0] === 2 && !!wavOut);
  const naked = silkBuf[0] === 2 ? silkBuf.slice(1) : silkBuf;
  const wavOut2 = await I.silkToWav(naked);
  check("裸 #!SILK(无前缀)自动补 0x02 后可解", !!wavOut2 && wavOut2.length === wavOut.length, wavOut2 && String(wavOut2.length));
  check("非 SILK(mp3) → null 不硬解", (await I.silkToWav(Buffer.from("ID3xxxxxxxxxxxxxxxxx"))) === null);
  check("仅魔数的垃圾 SILK → null(解出的 40ms 噪声不算成功, 兜底保原始字节)", (await I.silkToWav(Buffer.from("\x02#!SILK_V3", "binary"))) === null);
  // writeAttachment + textAfter: 真 DiaryWriter + 假 vault
  const vFiles = {};
  const vWp = { app: { vault: {
    getFileByPath: (x) => (x in vFiles ? { path: x } : null),
    getAbstractFileByPath: (x) => (x in vFiles ? { path: x } : null),
    getFolderByPath: () => ({}), createFolder: async () => {},
    create: async (x, c) => { vFiles[x] = c; },
    createBinary: async (x, b) => { vFiles[x] = b; },
    process: async (f, fn) => { vFiles[f.path] = fn(vFiles[f.path]); return vFiles[f.path]; },
    cachedRead: async (f) => vFiles[f.path],
  } }, settings: { diaryFolder: "日记" } };
  const VW = new I.DiaryWriter(vWp, null);
  const vres = await VW.writeAttachment(wavOut, "日记/attachments/2026/2026-08-20-1030-语音.wav", "2026-08-20", "🎤", "今天试了新的手冲豆子\n\n\n花香很明显");
  const dayFile = vFiles[VW.diaryPath("2026-08-20")];
  check("语音块 = 🎤 链接 + 换行 + 清洗后的文字, 计 1 条", vres.n === 1 && dayFile.includes("🎤 ![[日记/attachments/2026/2026-08-20-1030-语音.wav]]\n今天试了新的手冲豆子\n花香很明显"), dayFile);
  await VW.write("第二条", false, "2026-08-20");
  let vu = await VW.undoLastBlock("2026-08-20");
  vu = await VW.undoLastBlock("2026-08-20");
  check("撤回语音块 = 音频链接+文字整块一起撤", vu.ok && vu.removed.startsWith("🎤 ![[") && vu.removed.includes("手冲豆子") && !vFiles[VW.diaryPath("2026-08-20")].includes("🎤"), JSON.stringify(vu));
  // agent 全链路: 开关开 → 原声+文字; 命令 → 不存音频; 失败 → 降级纯文字
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  let attachCalls = [];
  p._client = { downloadMedia: async () => silkBuf };
  p.writer.attachmentPathNamed = (day, name) => "日记/attachments/x/" + day + "-" + name;
  p.writer.writeAttachment = async (buf, path, day, marker, textAfter) => {
    attachCalls.push({ path, marker, textAfter, riff: buf.slice(0,4).toString() });
    calls.writes.push(marker + "![[" + path + "]]" + (textAfter ? "\n" + textAfter : ""));
    return { n: calls.writes.length, sealed: false, diskFull: false, path };
  };
  const VA = { text: "有转写", media: { aes_key: "k" }, encode_type: 6 };
  r = await p.agent._dispatch("今天喝了一杯咖啡", true, [], { voices: [], files: [], videos: [], voiceAudio: VA });
  check("开关开+语音记录 → 原声 wav+文字同块", attachCalls.length === 1 && attachCalls[0].riff === "RIFF" && attachCalls[0].marker === "🎤" && attachCalls[0].textAfter === "今天喝了一杯咖啡" && r.includes("🎤 记下来啦"), JSON.stringify(attachCalls));
  r = await p.agent._dispatch("结束", true, [], { voices: [], files: [], videos: [], voiceAudio: VA });
  check("语音说「结束」→ 封存, 不存音频", calls.finalized.length === 1 && attachCalls.length === 1, r);
  p._client = { downloadMedia: async () => { throw new Error("网络挂了"); } };
  r = await p.agent._dispatch("降级这条", true, [], { voices: [], files: [], videos: [], voiceAudio: VA });
  check("下载失败 → 静默降级纯文字, 内容不丢", calls.writes.some((w) => w === "降级这条") && r.includes("记下来啦"), r);
  r = await p.agent._dispatch("普通语音", true, [], { voices: [], files: [], videos: [], voiceAudio: null });
  check("开关关(voiceAudio 空) → 现状纯文字", calls.writes.some((w) => w === "普通语音"), r);
  p._client = { downloadMedia: async () => silkBuf };
  r = await p.agent._dispatch("打字加语音混合", false, [], { voices: [], files: [], videos: [], voiceAudio: VA });
  check("文字+语音混合条 → 原声也存(不再看 isVoice)", attachCalls.some((c) => c && c.textAfter === "打字加语音混合"), JSON.stringify(attachCalls));
  // _handleIncoming 层: 开关决定 voiceAudio 是否收集
  p = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
  calls = stubWriter(p);
  attachCalls = [];
  p.settings.saveVoiceAudio = true;
  p._client = { downloadMedia: async () => silkBuf, sendText: async () => {} };
  p.writer.attachmentPathNamed = (day, name) => "x/" + name;
  p.writer.writeAttachment = async (buf, path, day, marker, textAfter) => { attachCalls.push(textAfter); calls.writes.push(textAfter || path); return { n: calls.writes.length, sealed: false, diskFull: false, path }; };
  await p._handleIncoming({ from_user_id: "U1", seq: "901", item_list: [{ type: 3, voice_item: { text: "语音转写内容", media: { aes_key: "k" }, encode_type: 6 } }] });
  check("入站链路: 开关开 → 原声块落库", attachCalls.length === 1 && attachCalls[0] === "语音转写内容", JSON.stringify(attachCalls));
  p.settings.saveVoiceAudio = false;
  await p._handleIncoming({ from_user_id: "U1", seq: "902", item_list: [{ type: 3, voice_item: { text: "第二条语音", media: { aes_key: "k" }, encode_type: 6 } }] });
  check("入站链路: 开关关 → 纯文字(现状)", attachCalls.length === 1 && calls.writes.includes("第二条语音"), JSON.stringify(calls.writes));


  // ══ 【G】黄金文件回归(0.3.1 字面基线, 路径层改动的零影响证据) ═══════════════════
  // 目的: 之后改路径层/写入器时, 任何输出字节的变化都让这里的断言失败。期望值全是硬编码字面量,
  // 绝不用被测代码算。时间: 临时把 global.Date 换成"停表"(无参 new Date() / Date.now() 返回固定时刻,
  // 有参构造原样透传); 随机: Math.random 换成周期 16 的确定序列 floor(r*16)=0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,…
  // (randHex 与 randomChoice 都可预测)。走真 DiaryWriter + 更完整的 fakeVault2(createBinary 校验 ArrayBuffer,
  // 记录所有创建路径)。章节结束时恢复 Date / Math.random / 阈值。
  console.log("\n【G】黄金文件回归(0.3.1 字面基线, 路径层改动的零影响证据)");
  const RealDate = Date, realRandom = Math.random;
  let gNow = 0, gRand = 0;
  class FrozenDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(gNow); }
    static now() { return gNow; }
  }
  const setNow = (iso) => { gNow = RealDate.parse(iso); };
  const resetRand = () => { gRand = 0; };
  function gDiff(a, b) {
    a = String(a); b = String(b);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return "第 " + i + " 字符起不同(长度 " + a.length + " vs " + b.length + "): got=" + JSON.stringify(a.slice(Math.max(0, i - 24), i + 48)) + " want=" + JSON.stringify(b.slice(Math.max(0, i - 24), i + 48));
  }
  const eq = (name, got, want) => check(name, got === want, got === want ? "" : gDiff(got, want));
  function fakeVault2() {
    const files = {}, folders = new Set(), created = [];
    return {
      files, created,
      getFileByPath: (x) => (x in files ? { path: x } : null),
      getAbstractFileByPath: (x) => (x in files || folders.has(x) ? { path: x } : null),
      getFolderByPath: (x) => (folders.has(x) ? { path: x } : null),
      createFolder: async (x) => { folders.add(x); created.push(x + "/"); },
      create: async (x, c) => { if (x in files) throw new Error("exists: " + x); files[x] = c; created.push(x); },
      createBinary: async (x, ab) => {
        if (!(ab instanceof ArrayBuffer)) throw new Error("createBinary 收到的不是 ArrayBuffer: " + x);
        if (x in files) throw new Error("exists: " + x);
        files[x] = Buffer.from(ab); created.push(x);
      },
      process: async (f, fn) => { files[f.path] = fn(files[f.path]); return files[f.path]; },
      cachedRead: async (f) => files[f.path],
    };
  }
  global.Date = FrozenDate;
  Math.random = () => (((gRand++ * 7) % 16) + 0.5) / 16;
  try {
    setNow("2026-08-20T14:30:00+08:00");
    const gp = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
    const gv = fakeVault2();
    gp.app.vault = gv;
    const GW = gp.writer, GD = "2026-08-20";
    const gJpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0\x01\x01", "binary"), Buffer.alloc(24, 0x5a)]);
    const gPdf = Buffer.from("%PDF-1.4 黄金文件回归假 PDF 内容\n%%EOF");
    const gMd5 = require("crypto").createHash("md5").update(gPdf).digest("hex");   // 用 node 自己算, 不用被测代码
    const gPcm = Buffer.alloc(24000 * 2);
    for (let i = 0; i < 24000; i++) gPcm.writeInt16LE(Math.round(Math.sin(i / 24000 * 440 * 2 * Math.PI) * 12000), i * 2);
    const gSilk = Buffer.from((await I.getSilkLib().encode(gPcm, 24000)).data);
    gp._client = { downloadImage: async () => gJpg, downloadMedia: async (item) => (item && item.file_name ? gPdf : gSilk) };

    // ── 路径层 4 个返回值(14:30, 随机序列从头开始 → 07e5) ──
    resetRand();
    eq("diaryPath(day)", GW.diaryPath(GD), "日记/2026/2026-08-20.md");
    eq("attachmentPath(day, jpg)", GW.attachmentPath(GD, "jpg"), "日记/attachments/2026/2026-08-20-1430-07e5.jpg");
    eq("attachmentPathNamed(day, 检查报告.pdf)", GW.attachmentPathNamed(GD, "检查报告.pdf"), "日记/attachments/2026/2026-08-20-1430-检查报告.pdf");
    eq("attachmentPathNamed(day, 语音.wav)", GW.attachmentPathNamed(GD, "语音.wav"), "日记/attachments/2026/2026-08-20-1430-语音.wav");

    // ── 一天脚本(随机序列接着上面 4 次 randHex 之后走: 图片 randHex → c3a1, 「晚安」randomChoice → 池[1]) ──
    const P1 = "日记/2026/2026-08-20.md";
    const H1 = "---\ndate: 2026-08-20\nweekday: 周四\nsource: wechat-diary\n---\n\n# 2026-08-20\n";
    const F1 = H1 + "\n\n**14:30**\n\n今天试了新的手冲豆子, 花香很明显\n";
    const F2 = F1 + "\n今天要做的事\n## 计划\n";
    const F3 = F2 + "\n\n**14:31**\n\n\\# 标题开头的一条\n";
    const F4 = F3 + "\n🎤 语音说的一句话\n";
    const F5 = F4 + "\n\n**14:32**\n\n![[日记/attachments/2026/2026-08-20-1432-c3a1.jpg]]\n";
    const F6 = F5 + "\n\n**14:33**\n\n![[日记/attachments/2026/2026-08-20-1433-检查报告.pdf]]\n";
    const F7 = F6 + "\n🎤 ![[日记/attachments/2026/2026-08-20-1433-语音.wav]]\n语音说的第一行\n## x\n";
    const F8 = F6;
    const F9 = F8 + "\n\n---\n_(今日封存于 14:35)_\n";
    const F10 = F9 + "\n\n**14:35**\n\n封存后又想起一件事\n";
    const TIPS = "\n(说错了发「撤回」, 随时发「帮助」看全部用法)";
    const FIRST = "今天的第一条记录, 已经记录在新开的文件里啦 📖\n";

    let gr = await gp.agent._dispatch("今天试了新的手冲豆子, 花香很明显", false, []);
    eq("1 普通文字: 回执", gr, FIRST + "记下来啦~ 今天第 1 段 ✍️" + TIPS);
    eq("1 普通文字: 文件", gv.files[P1], F1);
    gr = await gp.agent._dispatch("今天要做的事\n## 计划", false, []);
    eq("2 两行且第二行 ## 计划(同分钟并段): 回执", gr, "记下来啦~ 今天第 2 段 ✍️");
    eq("2 两行且第二行 ## 计划(同分钟并段): 文件", gv.files[P1], F2);
    setNow("2026-08-20T14:31:00+08:00");
    gr = await gp.agent._dispatch("# 标题开头的一条", false, []);
    eq("3 首行 # 开头(反斜杠转义, 新段头): 回执", gr, "记下来啦~ 今天第 3 段 ✍️");
    eq("3 首行 # 开头(反斜杠转义, 新段头): 文件", gv.files[P1], F3);
    gr = await gp.agent._dispatch("语音说的一句话", true, []);
    eq("4 语音文字 isVoice: 回执", gr, "🎤 记下来啦~ 今天第 4 段 ✍️");
    eq("4 语音文字 isVoice: 文件", gv.files[P1], F4);
    setNow("2026-08-20T14:32:00+08:00");
    gr = await gp.agent._dispatch("", false, [{ fake: 1 }]);
    eq("5 图片(writeImage): 回执", gr, "📷 图片收好啦~ 今天第 5 段 ✍️");
    eq("5 图片(writeImage): 文件", gv.files[P1], F5);
    check("5 图片: createBinary 落的字节与源 Buffer 一致", Buffer.isBuffer(gv.files["日记/attachments/2026/2026-08-20-1432-c3a1.jpg"]) && Buffer.compare(gv.files["日记/attachments/2026/2026-08-20-1432-c3a1.jpg"], gJpg) === 0);
    setNow("2026-08-20T14:33:00+08:00");
    gr = await gp.agent._dispatch("", false, [], { voices: [], files: [{ file_name: "检查报告.pdf", md5: gMd5, len: String(gPdf.length), media: { aes_key: "k" } }], videos: [] });
    eq("6 带原名附件(attachmentPathNamed + writeAttachment): 回执", gr, "📎 「检查报告.pdf」收好啦~ 今天第 6 段 ✍️");
    eq("6 带原名附件(attachmentPathNamed + writeAttachment): 文件", gv.files[P1], F6);
    check("6 附件: createBinary 落的字节与源 Buffer 一致", Buffer.compare(gv.files["日记/attachments/2026/2026-08-20-1433-检查报告.pdf"], gPdf) === 0);
    eq("6 附件: md5 登记的路径", JSON.stringify(gp.data.ilink.fileMd5s), JSON.stringify([{ md5: gMd5, path: "日记/attachments/2026/2026-08-20-1433-检查报告.pdf" }]));
    gr = await gp.agent._dispatch("语音说的第一行\n## x", true, [], { voices: [], files: [], videos: [], voiceAudio: { text: "语音说的第一行\n## x", media: { aes_key: "k" }, encode_type: 6 } });
    eq("7 语音原声块(🎤 + textAfter 两行, 第二行 ## x, 同分钟并段): 回执", gr, "🎤 记下来啦~ 今天第 7 段 ✍️");
    eq("7 语音原声块(🎤 + textAfter 两行, 第二行 ## x, 同分钟并段): 文件", gv.files[P1], F7);
    const gWav = gv.files["日记/attachments/2026/2026-08-20-1433-语音.wav"];
    check("7 语音原声: 落盘的是 WAV(RIFF 头, 44+48000 字节)", Buffer.isBuffer(gWav) && gWav.slice(0, 4).toString() === "RIFF" && gWav.length === 48044, gWav && String(gWav.length));
    setNow("2026-08-20T14:34:00+08:00");
    gr = await gp.agent._dispatch("撤回", false, []);
    eq("8 撤回(整块含 ## x 一起撤, 文件回到第 6 步): 回执", gr, "好的, 撤掉了刚才那条语音");
    eq("8 撤回(整块含 ## x 一起撤, 文件回到第 6 步): 文件", gv.files[P1], F8);
    setNow("2026-08-20T14:35:00+08:00");
    gr = await gp.agent._dispatch("晚安", false, []);
    eq("9 「晚安」封存: 回执", gr, "好梦 🌙 今天的 6 段都收好了, 明天见");
    eq("9 「晚安」封存: 文件", gv.files[P1], F9);
    gr = await gp.agent._dispatch("封存后又想起一件事", false, []);
    eq("10 封存线下同分钟追加(另起段头): 回执", gr, "记下来啦~ 今天第 7 段 ✍️");
    eq("10 封存线下同分钟追加(另起段头): 文件", gv.files[P1], F10);
    check("10 countDay = 7", (await GW.countDay(GD)) === 7, String(await GW.countDay(GD)));

    // ── 跨天: 第二天(昨天已手动封存 → already, 不告知) ──
    setNow("2026-08-21T09:15:00+08:00");
    const P2 = "日记/2026/2026-08-21.md";
    const D2 = "---\ndate: 2026-08-21\nweekday: 周五\nsource: wechat-diary\n---\n\n# 2026-08-21\n" + "\n\n**09:15**\n\n第二天早上的第一条\n";
    gr = await gp.agent._dispatch("第二天早上的第一条", false, []);
    eq("11 跨天(昨天已封存): 回执不带「自动收尾」", gr, FIRST + "记下来啦~ 今天第 1 段 ✍️" + TIPS);
    eq("11 跨天: 新文件", gv.files[P2], D2);
    eq("11 跨天: 昨天的文件一字不动", gv.files[P1], F10);
    // ── 第三天(前一天没手动封存 → 真自动封存 + 告知; 封存行时间戳是跨天那一刻的 hhmm) ──
    setNow("2026-08-22T08:00:00+08:00");
    const P3 = "日记/2026/2026-08-22.md";
    const D3 = "---\ndate: 2026-08-22\nweekday: 周六\nsource: wechat-diary\n---\n\n# 2026-08-22\n" + "\n\n**08:00**\n\n第三天的第一条\n";
    gr = await gp.agent._dispatch("第三天的第一条", false, []);
    eq("12 跨天(前一天未封存 → 自动封存): 回执带告知且去掉开页前缀", gr, "(昨天的已自动收尾, 翻开新的一页 📖)\n\n记下来啦~ 今天第 1 段 ✍️" + TIPS);
    eq("12 跨天: 前一天文件补了封存行", gv.files[P2], D2 + "\n\n---\n_(今日封存于 08:00)_\n");
    eq("12 跨天: 第三天新文件", gv.files[P3], D3);
    eq("12 跨天: 第一天仍一字不动", gv.files[P1], F10);

    eq("fakeVault 里所有创建的路径(顺序、文件夹带 /)", JSON.stringify(gv.created), JSON.stringify([
      "日记/", "日记/2026/", "日记/2026/2026-08-20.md",
      "日记/attachments/", "日记/attachments/2026/",
      "日记/attachments/2026/2026-08-20-1432-c3a1.jpg",
      "日记/attachments/2026/2026-08-20-1433-检查报告.pdf",
      "日记/attachments/2026/2026-08-20-1433-语音.wav",
      "日记/2026/2026-08-21.md", "日记/2026/2026-08-22.md",
    ]));
  } finally {
    global.Date = RealDate; Math.random = realRandom;
    I.setDayStartHour(4); I.setNudgeNightHour(22);
  }

  // ══ 【H】#15 路径可配置 + 共用文件模式(docs/15 终稿 §2/§3/§4, 清单 = §6「测试」) ═══════════
  // 复用【G】的停表 Date / 固定 Math.random / fakeVault2 / eq。共用模式建文件后的 1.5s 复核走 window.setTimeout,
  // 这里把它换成"只记录回调、返回 id"的桩(B11 手动触发, 其余用例不真等); 章节结束在 finally 里全部恢复。
  console.log("\n【H】#15 路径可配置 + 共用文件模式");
  const realWinSetTimeout = global.window.setTimeout, realWinClearTimeout = global.window.clearTimeout;
  const hTimers = [];
  global.Date = FrozenDate;
  Math.random = () => (((gRand++ * 7) % 16) + 0.5) / 16;
  // 桩: 回调原样入队(id = 下标+1), 记录延时; clearTimeout 只打 cancelled 标记, 不再触发的责任在用例(只调最后一个未取消的)
  global.window.setTimeout = (cb, ms) => { cb.ms = ms; hTimers.push(cb); return hTimers.length; };
  global.window.clearTimeout = (id) => { if (hTimers[id - 1]) hTimers[id - 1].cancelled = true; };
  try {
    const M = momentStub;
    const HD = "2026-08-20", HP = "日记/2026/2026-08-20.md";
    const SHARED_FIRST = "今天的第一条记录, 记进 2026-08-20 的每日笔记「微信随手记」一节了 📖\n";
    const H_TIPS = "\n(说错了发「撤回」, 随时发「帮助」看全部用法)";
    setNow("2026-08-20T10:30:00+08:00");
    resetRand();
    I.setTimezone("Asia/Shanghai"); I.setDayStartHour(4); I.setNudgeNightHour(22);
    const countOf = (s, sub) => String(s).split(sub).length - 1;
    // 真 writer 工厂: settings 只给三个字段, 缺省字段(pathFormat/attachmentMode…)靠路径函数自己兜底
    function mkW(settings, files) {
      const v = fakeVault2();
      if (files) for (const k of Object.keys(files)) v.files[k] = files[k];
      const wp = { app: { vault: v }, settings: Object.assign({ diaryFolder: "日记", sharedDailyNote: true, sectionHeading: "微信随手记" }, settings || {}) };
      return { v, wp, W: new I.DiaryWriter(wp, null) };
    }

    // ── A. 纯函数冒烟(走 __internals; 表驱动全集在 scratch, 这里只挑关键项) ──
    console.log("  — A 纯函数冒烟");
    let vp = I.validatePathFormat("[Assets]/YYYY/MM", { momentLib: M });
    check("A1 [Assets]/YYYY/MM 合法", vp.ok === true && vp.value === "[Assets]/YYYY/MM", JSON.stringify(vp));
    vp = I.validatePathFormat("Assets/YYYY", { momentLib: M });
    check("A2 Assets/YYYY(没括起来)拒, 文案教用方括号", vp.ok === false && vp.error === "英文字母会被当成日期代码, 文件夹名请放在方括号里, 如 [Assets]", JSON.stringify(vp));
    vp = I.validatePathFormat("YYYY/MD", { requireDaily: true, momentLib: M });
    check("A3 YYYY/MD 按天不唯一(01-12 与 11-02 同文件) → requireDaily 拒", vp.ok === false && String(vp.error).includes("两天会写进同一个文件"), JSON.stringify(vp));
    vp = I.validatePathFormat(" /YYYY/MM/YYYY-MM-DD.md/ ", { requireDaily: true, momentLib: M });
    check("A4 YYYY/MM/YYYY-MM-DD 合法(首尾 / 与尾 .md 洗掉)", vp.ok === true && vp.value === "YYYY/MM/YYYY-MM-DD", JSON.stringify(vp));
    eq("A5 renderPath: [daily] 字面量 + 令牌", I.renderPath("[daily]/YYYY/MM/YYYY-MM-DD", HD, M), "daily/2026/08/2026-08-20");
    eq("A5 diaryPath: 日记文件夹 / = 库根目录, 不拼前缀", mkW({ diaryFolder: "/" }).W.diaryPath(HD), "2026/2026-08-20.md");
    eq("A5 diaryPath: 根目录 + 自定义格式", mkW({ diaryFolder: "/", pathFormat: "[daily]/YYYY/MM/YYYY-MM-DD" }).W.diaryPath(HD), "daily/2026/08/2026-08-20.md");
    eq("A5 diaryPath: settings 缺 pathFormat → 兜底成 0.3.1 布局", mkW({}).W.diaryPath(HD), "日记/2026/2026-08-20.md");
    const secA = "# 2026-08-20\n\n## 微信随手记\n**10:00**\n\na\n\n### 备注\n用户\n\n## 复盘\n";
    let loc = I.locateSection(secA, "微信随手记");
    check("A6 locateSection: 三级标题也截断节", !!loc && loc.headingStart === secA.indexOf("## 微信随手记") && loc.bodyEnd === secA.indexOf("### 备注"), JSON.stringify(loc));
    const secB = "## 微信随手记\n**10:00**\n\na\n\n```\n# 代码块里的井号\n## 也不是标题\n```\n\nb\n";
    loc = I.locateSection(secB, "微信随手记");
    check("A7 locateSection: 代码块内的 `# ` 不截断", !!loc && loc.bodyEnd === secB.length, JSON.stringify(loc));
    const secC = "# 2026-08-20\r\n\r\n## 微信随手记\r\n**10:00**\r\n\r\na\r\n\r\n## 复盘\r\nz\r\n";
    loc = I.locateSection(secC, "微信随手记");
    check("A8 locateSection: CRLF 文件(标题行尾带 \\r)能定位, 到下一标题截断", !!loc && loc.headingStart === secC.indexOf("## 微信随手记") && loc.bodyEnd === secC.indexOf("## 复盘"), JSON.stringify(loc));
    check("A8b locateSection: frontmatter 里的 # 不算标题; 无节 → null", I.locateSection("---\ntitle: # x\n---\n# 日记\n\n内容\n", "微信随手记") === null);
    eq("A9 escapeHeadingLines: #hashtag 不动, 1–6 级标题行加反斜杠, 7 个 # 不是标题", I.escapeHeadingLines("#hashtag\n## 计划\n###### 六级\n####### 七个\n# 首行"), "#hashtag\n\\## 计划\n\\###### 六级\n####### 七个\n\\# 首行");
    const tplNow = new Date(2026, 7, 20, 14, 5, 0);   // 走停表 Date 有参构造(桩 moment 用 instanceof Date 判, 且用 getHours(), 不受机器时区影响)
    eq("A10 renderTemplate: {{title}} {{date}} {{date:FMT}} {{time}} {{time:HH:mm}}(冒号只切第一个), 未知占位符原样", I.renderTemplate("# {{title}} {{date}} {{date:YYYY/MM}} {{time}} {{time:HH:mm}} {{unknown}}", { dateStr: HD, now: tplNow, title: "2026-08-20", momentLib: M }), "# 2026-08-20 2026-08-20 2026/08 14:05 14:05 {{unknown}}");
    check("A11 isForeignFile 四种: 空 / 无 frontmatter / 有 frontmatter 无 source / 有 source", I.isForeignFile("") === false && I.isForeignFile("# 我的一天\n\n内容\n") === true && I.isForeignFile("---\ntags: [daily]\n---\n# x\n") === true && I.isForeignFile("---\ndate: 2026-08-20\nsource: wechat-diary\n---\n# 2026-08-20\n") === false);

    // ── B. 真 DiaryWriter + fakeVault2(共用模式; 时间停在 10:30) ──
    console.log("  — B 真 DiaryWriter + fakeVault(共用模式)");
    // B1 文件不存在、无模板
    let h = mkW();
    let hr = await h.W.write("第一条", false, HD);
    eq("B1 文件 = 标题行 + 正文, 没有 frontmatter / # 日期", h.v.files[HP], "## 微信随手记\n**10:30**\n\n第一条\n");
    check("B1 n===1, 回执带共用模式开页前缀(逻辑日 + 节名)", hr.n === 1 && hr.reply.startsWith(SHARED_FIRST) && hr.reply.includes("记进 2026-08-20 的每日笔记「微信随手记」一节"), hr.reply);
    check("B1 firstPrefix(day) 就是这句", h.W.firstPrefix(HD) === SHARED_FIRST, h.W.firstPrefix(HD));
    eq("B1 创建顺序: 父目录 + 一次 create", JSON.stringify(h.v.created), JSON.stringify(["日记/", "日记/2026/", HP]));
    hr = await h.W.write("第二条", false, HD);
    eq("B1 同分钟第二条并段", h.v.files[HP], "## 微信随手记\n**10:30**\n\n第一条\n\n第二条\n");
    check("B1 n===2, 回执无开页前缀", hr.n === 2 && !hr.reply.includes("记进"), hr.reply);

    // B2 文件不存在、有模板
    const TPL_PATH = "模板/每日.md";
    const TPL_A = "# {{date}}\n\n## 今日待办\n- [ ] 喝水\n\n## 日志\n";
    const TPL_A_R = "# 2026-08-20\n\n## 今日待办\n- [ ] 喝水\n\n## 日志\n";
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hr = await h.W.write("第一条", false, HD);
    eq("B2 有模板: 模板已渲染({{date}}), 我们的节在末尾", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n第一条\n");
    check("B2 只 create 一次、只有一个节标题、n===1", h.v.created.filter((x) => x === HP).length === 1 && countOf(h.v.files[HP], "## 微信随手记") === 1 && hr.n === 1, JSON.stringify(h.v.created));
    check("B2 模板文件本身没被动", h.v.files[TPL_PATH] === TPL_A);

    // B3 模板本身已含节标题(在中间, 后面还有 ## 复盘)
    const TPL_B = "# {{date}}\n\n## 日志\n\n## 微信随手记\n\n## 复盘\n- 今天学到\n";
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_B });
    hr = await h.W.write("第一条", false, HD);
    eq("B3 模板自带节标题: 消息填在它下面, 后面的 ## 复盘 逐字节不动", h.v.files[HP], "# 2026-08-20\n\n## 日志\n\n## 微信随手记\n**10:30**\n\n第一条\n\n## 复盘\n- 今天学到\n");
    check("B3 只有一个标题, n===1, 一次 create", countOf(h.v.files[HP], "## 微信随手记") === 1 && hr.n === 1 && h.v.created.filter((x) => x === HP).length === 1);
    // B3b TOCTOU: create 抛「已存在」→ 对现有内容 process, 模板不进 process, 仍只有一个标题
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    const origCreate = h.v.create;
    h.v.create = async (x) => { h.v.create = origCreate; h.v.files[x] = "# 别的插件刚建的\n"; throw new Error("exists: " + x); };
    hr = await h.W.write("第一条", false, HD);
    eq("B3b create 抛已存在 → 转 process 追加节, 不套模板", h.v.files[HP], "# 别的插件刚建的\n\n## 微信随手记\n**10:30**\n\n第一条\n");
    check("B3b 只有一个标题, n===1", countOf(h.v.files[HP], "## 微信随手记") === 1 && hr.n === 1, hr.reply);

    // B4 文件存在、无节、有用户内容(无尾换行)
    const USER4 = "# 我的一天\n\n早上跑步 5 公里\n- 买菜";
    h = mkW({}, { [HP]: USER4 });
    hr = await h.W.write("第一条", false, HD);
    eq("B4 存在无节: 追加到末尾, 用户内容逐字节不变, 标题前一个空行", h.v.files[HP], USER4 + "\n\n## 微信随手记\n**10:30**\n\n第一条\n");
    check("B4 不 create, n===1(用户段落不算)", h.v.created.length === 0 && hr.n === 1, JSON.stringify(h.v.created));

    // B5 文件存在但内容为空: 按"存在无节"处理, 不套模板
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A, [HP]: "" });
    hr = await h.W.write("第一条", false, HD);
    eq("B5 存在但为空: 不套模板(设了 templatePath 也不套), 只追加节", h.v.files[HP], "## 微信随手记\n**10:30**\n\n第一条\n");
    check("B5 没走 create, n===1", h.v.created.length === 0 && hr.n === 1);

    // B6 节在中间(后接 ### 备注 + 用户文字, 再接 ## 复盘)
    const TAIL6 = "### 备注\n用户写的备注\n\n## 复盘\n复盘内容\n";
    const MID6 = "# 2026-08-20\n\n## 微信随手记\n**09:00**\n\n第一条\n\n" + TAIL6;
    h = mkW({}, { [HP]: MID6 });
    hr = await h.W.write("第二条", false, HD);
    eq("B6 节在中间: 第二条进节里(另起段头), ### 备注 起逐字节不动", h.v.files[HP], "# 2026-08-20\n\n## 微信随手记\n**09:00**\n\n第一条\n\n\n**10:30**\n\n第二条\n\n" + TAIL6);
    check("B6 n===2, countDay===2(不数用户段落)", hr.n === 2 && (await h.W.countDay(HD)) === 2, String(hr.n));
    const USER6 = "# 2026-08-20\n\n早上\n\n中午\n\n晚上\n\n## 待办\n- 买菜\n";
    h = mkW({}, { [HP]: USER6 });
    hr = await h.W.write("第一条", false, HD);
    check("B6b 文件里先有 3 段用户内容 + 用户标题: 第一条 n===1 且回执带开页前缀, countDay===1", hr.n === 1 && hr.reply.startsWith(SHARED_FIRST) && (await h.W.countDay(HD)) === 1, hr.reply);
    eq("B6b 用户内容逐字节不变, 节追加在末尾", h.v.files[HP], USER6 + "\n## 微信随手记\n**10:30**\n\n第一条\n");

    // B7 撤回
    h = mkW({}, { [HP]: MID6 });
    await h.W.write("第二条", false, HD);
    let hu = await h.W.undoLastBlock(HD);
    eq("B7 撤回只删节内最后一条(含孤儿段头), 节后用户内容逐字节保留", h.v.files[HP], MID6);
    check("B7 removed = 第二条", hu.ok === true && hu.removed === "第二条", JSON.stringify(hu));
    hu = await h.W.undoLastBlock(HD);
    eq("B7 撤到空: 只剩标题行, 前后用户内容不变", h.v.files[HP], "# 2026-08-20\n\n## 微信随手记\n\n" + TAIL6);
    check("B7 removed = 第一条", hu.ok === true && hu.removed === "第一条", JSON.stringify(hu));
    const before7 = h.v.files[HP];
    hu = await h.W.undoLastBlock(HD);
    check("B7 再撤 → ok:false, 文件不动", hu.ok === false && h.v.files[HP] === before7, JSON.stringify(hu));
    check("B7 空节 countDay === 0", (await h.W.countDay(HD)) === 0);

    // B8 封存
    h = mkW({}, { [HP]: MID6 });
    let hf = await h.W.finalizeDay(HD);
    eq("B8 封存行在节内(下一个用户标题之前), 不在文件末尾", h.v.files[HP], "# 2026-08-20\n\n## 微信随手记\n**09:00**\n\n第一条\n\n\n---\n_(今日封存于 10:30)_\n\n" + TAIL6);
    check("B8 status sealed, n===1", hf.status === "sealed" && hf.n === 1, JSON.stringify(hf));
    hf = await h.W.finalizeDay(HD);
    check("B8 再封 → already, 不重复写", hf.status === "already" && countOf(h.v.files[HP], I.texts.CLOSING_MARKER) === 1, JSON.stringify(hf));
    hr = await h.W.write("封存后补的", false, HD);
    check("B8 封存后续写: sealed=true, n===2, 仍在节内", hr.sealed === true && hr.n === 2 && h.v.files[HP].endsWith("封存后补的\n\n" + TAIL6), h.v.files[HP]);
    const EMPTY8 = "# 2026-08-20\n\n## 微信随手记\n\n## 复盘\n复盘内容\n";
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A, [HP]: EMPTY8 });
    check("B8 空节: finalize → empty, 文件字节不变", (await h.W.finalizeDay(HD)).status === "empty" && h.v.files[HP] === EMPTY8, JSON.stringify(h.v.files[HP]));
    check("B8 空节: undo → ok:false, countDay 0, 文件字节不变", (await h.W.undoLastBlock(HD)).ok === false && (await h.W.countDay(HD)) === 0 && h.v.files[HP] === EMPTY8);
    const NOSEC8 = "# 2026-08-20\n\n早上\n\n中午\n\n## 待办\n- x\n";
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A, [HP]: NOSEC8 });
    hu = await h.W.undoLastBlock(HD); hf = await h.W.finalizeDay(HD);
    check("B8 有用户内容无节: undo/finalize/countDay → ok:false / empty / 0, 文件字节不变、不建节", hu.ok === false && hf.status === "empty" && (await h.W.countDay(HD)) === 0 && h.v.files[HP] === NOSEC8 && h.v.created.length === 0, JSON.stringify([hu, hf, h.v.files[HP]]));
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hu = await h.W.undoLastBlock(HD); hf = await h.W.finalizeDay(HD);
    check("B8 文件不存在: undo/finalize/countDay → ok:false / empty / 0, 仍不建文件(不套模板)", hu.ok === false && hf.status === "empty" && (await h.W.countDay(HD)) === 0 && !(HP in h.v.files) && h.v.created.length === 0, JSON.stringify(h.v.created));

    // B9 转义(只在共用模式)
    h = mkW();
    hr = await h.W.write("今天要做的事\n## 计划", false, HD);
    eq("B9 两行消息第二行 ## 计划 → 存成 \\## 计划", h.v.files[HP], "## 微信随手记\n**10:30**\n\n今天要做的事\n\\## 计划\n");
    check("B9 节没被截断: n===1, 节到文件末尾", hr.n === 1 && I.locateSection(h.v.files[HP], "微信随手记").bodyEnd === h.v.files[HP].length, hr.reply);
    hr = await h.W.write("第二条", false, HD);
    check("B9 再写一条 n===2(第一条仍在节内)", hr.n === 2 && (await h.W.countDay(HD)) === 2, String(hr.n));
    const hWav = Buffer.from("RIFF0000WAVEfake");
    let ha = await h.W.writeAttachment(hWav, "日记/attachments/2026/2026-08-20-1030-语音.wav", HD, "🎤", "语音说的第一行\n## x");
    check("B9 writeAttachment textAfter 第二行 ## x → 同样转义, 节没被截断, n===3", ha.n === 3 && h.v.files[HP].includes("🎤 ![[日记/attachments/2026/2026-08-20-1030-语音.wav]]\n语音说的第一行\n\\## x\n") && I.locateSection(h.v.files[HP], "微信随手记").bodyEnd === h.v.files[HP].length && (await h.W.countDay(HD)) === 3, h.v.files[HP]);
    const hI = mkW({ sharedDailyNote: false });
    hr = await hI.W.write("今天要做的事\n## 计划", false, HD);
    check("B9 独立模式同样两行消息 → 不转义(与 0.3.1 相同)", hr.n === 1 && hI.v.files[HP].endsWith("今天要做的事\n## 计划\n") && !hI.v.files[HP].includes("\\##"), hI.v.files[HP]);

    // B10 CRLF: 用户文件全 CRLF 且节正文 CRLF
    const CRLF10 = "# 2026-08-20\r\n\r\n## 微信随手记\r\n**09:00**\r\n\r\n第一条\r\n\r\n## 复盘\r\n复盘内容\r\n";
    h = mkW({}, { [HP]: CRLF10 });
    hr = await h.W.write("第二条", false, HD);
    check("B10 全 CRLF 文件: 节内已有 1 条 + 写 1 条 → n===2", hr.n === 2 && (await h.W.countDay(HD)) === 2, String(hr.n));
    eq("B10 写回: 节内 LF, 节外(前后)仍是 CRLF 逐字节不变", h.v.files[HP], "# 2026-08-20\r\n\r\n## 微信随手记\n**09:00**\n\n第一条\n\n\n**10:30**\n\n第二条\n\n## 复盘\r\n复盘内容\r\n");
    hu = await h.W.undoLastBlock(HD);
    eq("B10 撤回只删一条(不是整节), 节外仍 CRLF", h.v.files[HP], "# 2026-08-20\r\n\r\n## 微信随手记\n**09:00**\n\n第一条\n\n## 复盘\r\n复盘内容\r\n");
    check("B10 removed = 第二条, countDay===1", hu.removed === "第二条" && (await h.W.countDay(HD)) === 1, JSON.stringify(hu));

    // B11 Templater 竞态: 建文件后被整篇 modify 成只有模板 → 复核补回; 窗口内撤回过 → 作废
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hTimers.length = 0;
    hr = await h.W.write("第一条", false, HD);
    check("B11 建文件后登记了一次复核回调", hTimers.length === 1 && hr.n === 1, String(hTimers.length));
    h.v.files[HP] = TPL_A_R;   // 模拟 Templater: read → modify 整篇写回成只有模板(我们的节没了)
    await hTimers[0]();
    eq("B11 复核发现节没了 → 补回, 内容正确", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n第一条\n");
    check("B11 补回走 process, 没有第二次 create", h.v.created.filter((x) => x === HP).length === 1, JSON.stringify(h.v.created));
    await hTimers[0]();
    eq("B11 节还在 → 复核幂等, 不重复补", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n第一条\n");
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hTimers.length = 0;
    await h.W.write("第一条", false, HD);
    hu = await h.W.undoLastBlock(HD);
    h.v.files[HP] = TPL_A_R;
    await hTimers[0]();
    check("B11 反例: 建文件后先撤回再触发复核 → 不补回(撤掉的块已移出复核清单)", hu.ok === true && hTimers.length === 1 && h.v.files[HP] === TPL_A_R, JSON.stringify(h.v.files[HP]));

    // B12 外来文件护栏(独立模式 sharedDailyNote:false): 没有 source: wechat-diary 的文件只认我们第一个段头之后的块——
    // 有块照常撤/封(用户段头之前的内容逐字节不动), 没块才拒(不删用户内容、不塞封存行)
    const USER12 = "# 我的一天\n\n早上跑步\n\n中午吃饭\n";
    h = mkW({ sharedDailyNote: false }, { [HP]: USER12 });
    hr = await h.W.write("第一条", false, HD);
    check("B12a 独立模式指向用户每日笔记(无 frontmatter): 写入照常追加, 回执「今天第 1 段」(用户段落不算)", hr.n === 1 && hr.reply.includes("今天第 1 段") && h.v.files[HP] === USER12 + "\n\n**10:30**\n\n第一条\n", h.v.files[HP]);
    check("B12a countDay 只数我们段头之后的块 = 1", (await h.W.countDay(HD)) === 1, String(await h.W.countDay(HD)));
    hu = await h.W.undoLastBlock(HD);
    eq("B12a 段头之后有块 → 照常撤(块 + 孤儿段头): 文件回到用户原文, 字节相等", h.v.files[HP], USER12);
    check("B12a 撤回结果 ok, removed = 第一条, 不带 foreign", hu.ok === true && hu.removed === "第一条" && !hu.foreign, JSON.stringify(hu));
    hu = await h.W.undoLastBlock(HD);
    check("B12a 再撤(段头之后已无块) → {ok:false, foreign:true}, 文件字节不变", hu.ok === false && hu.foreign === true && h.v.files[HP] === USER12, JSON.stringify([hu, h.v.files[HP]]));
    check("B12a 无块的外来文件 countDay === 0", (await h.W.countDay(HD)) === 0, String(await h.W.countDay(HD)));
    h = mkW({ sharedDailyNote: false }, { [HP]: "---\ntags: [daily]\n---\n" + USER12 });
    hu = await h.W.undoLastBlock(HD);
    check("B12a 有 frontmatter 但无 source、无我们的段头 → 也是外来文件, 拒撤", hu.foreign === true && hu.ok === false, JSON.stringify(hu));
    // (b) 0.3.1「打开今天的日记」建的空文件被用户敲了个回车: 内容只有 "\n"
    h = mkW({ sharedDailyNote: false }, { [HP]: "\n" });
    hr = await h.W.write("第一条", false, HD);
    check("B12b 预置内容仅 \\n: 写入后文件无 frontmatter(非空文件不补头), n===1", hr.n === 1 && !h.v.files[HP].startsWith("---") && I.isForeignFile(h.v.files[HP]) === true && h.v.files[HP].endsWith("**10:30**\n\n第一条\n"), JSON.stringify(h.v.files[HP]));
    hu = await h.W.undoLastBlock(HD);
    check("B12b 撤回成功(段头之后有块), 块与孤儿段头都清掉", hu.ok === true && hu.removed === "第一条" && !hu.foreign && !h.v.files[HP].includes("第一条") && !h.v.files[HP].includes("**10:30**"), JSON.stringify([hu, h.v.files[HP]]));
    // (c) finalizeDay 在外来文件上
    h = mkW({ sharedDailyNote: false }, { [HP]: USER12 });
    hf = await h.W.finalizeDay(HD);
    check("B12c 无块的用户文件 finalize → empty, 文件字节不变", hf.status === "empty" && hf.n === 0 && h.v.files[HP] === USER12, JSON.stringify([hf, h.v.files[HP]]));
    await h.W.write("第一条", false, HD);
    hf = await h.W.finalizeDay(HD);
    eq("B12c 有 1 块 → sealed, 封存行追加在文件末尾", h.v.files[HP], USER12 + "\n\n**10:30**\n\n第一条\n\n\n---\n_(今日封存于 10:30)_\n");
    check("B12c status sealed 且 n===1(只数段头之后)", hf.status === "sealed" && hf.n === 1 && hf.afterSeal === 0, JSON.stringify(hf));
    const OURS12 = "---\ndate: 2026-08-20\nweekday: 周四\nsource: wechat-diary\n---\n\n# 2026-08-20\n\n\n**09:00**\n\n老文件的一条\n";
    h = mkW({ sharedDailyNote: false }, { [HP]: OURS12 });
    check("B12 有 source: wechat-diary 的老文件: countDay 照旧数全文", (await h.W.countDay(HD)) === 1);
    hu = await h.W.undoLastBlock(HD);
    check("B12 有 source: wechat-diary 的老文件: 能撤, 行为不变", hu.ok === true && hu.removed === "老文件的一条" && !hu.foreign && (await h.W.countDay(HD)) === 0, JSON.stringify(hu));
    const pF = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, BOUND_DATA());
    stubWriter(pF);
    pF.writer.undoLastBlock = async () => ({ ok: false, removed: null, foreign: true });
    const fr12 = await pF.agent._dispatch("撤回", false, []);
    check("B12d agent: stubWriter 返回 {ok:false, foreign:true} → 回 UNDO_FOREIGN_REPLY(教去 Obsidian 手动删)", fr12 === I.UNDO_FOREIGN_REPLY && fr12.includes("手动删") && !fr12.includes("不是插件建的"), fr12);

    // B13 附件三模式
    resetRand();
    h = mkW({ attachmentMode: "custom", attachmentFolder: "Assets", attachmentSubFormat: "YYYY" });
    check("B13 custom: attachmentPath / attachmentPathNamed 以 Assets/2026/ 开头", /^Assets\/2026\/2026-08-20-1030-[0-9a-f]{4}\.jpg$/.test(h.W.attachmentPath(HD, "jpg")) && h.W.attachmentPathNamed(HD, "报告.pdf") === "Assets/2026/2026-08-20-1030-报告.pdf", h.W.attachmentPath(HD, "jpg"));
    const hJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    let hi = await h.W.writeImage(hJpg, "jpg", HD);
    const custImg = h.v.created.find((x) => x.startsWith("Assets/2026/") && x.endsWith(".jpg"));
    check("B13 custom: 图片真落在 Assets/2026/, 节里是完整路径 wikilink", hi.n === 1 && !!custImg && h.v.files[HP].includes("![[" + custImg + "]]"), JSON.stringify(h.v.created));
    const fmCalls = [];
    h = mkW({ attachmentMode: "obsidian", templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    h.wp.app.fileManager = { getAvailablePathForAttachment: async (name, src) => { fmCalls.push({ name, src, dayExists: HP in h.v.files }); return "Attach/" + name; } };
    hi = await h.W.writeImage(hJpg, "jpg", HD);
    check("B13 obsidian(共用模式): 调接口前当天文件已建出, sourcePath = 当天文件", fmCalls.length === 1 && fmCalls[0].dayExists === true && fmCalls[0].src === HP, JSON.stringify(fmCalls));
    const obsImg = h.v.created.find((x) => x.startsWith("Attach/") && x.endsWith(".jpg"));
    check("B13 obsidian: 图片落到 Attach/, 建文件在图片之前, 节追加在模板末尾", hi.n === 1 && !!obsImg && h.v.created.indexOf(HP) < h.v.created.indexOf(obsImg) && h.v.files[HP] === TPL_A_R + "\n## 微信随手记\n**10:30**\n\n![[" + obsImg + "]]\n", JSON.stringify([h.v.created, h.v.files[HP]]));
    ha = await h.W.writeAttachment(Buffer.from("%PDF"), h.W.attachmentPathNamed(HD, "报告.pdf"), HD, "", null);
    check("B13 obsidian: writeAttachment 也落 Attach/", ha.n === 2 && ha.path === "Attach/2026-08-20-1030-报告.pdf" && Buffer.isBuffer(h.v.files["Attach/2026-08-20-1030-报告.pdf"]), JSON.stringify(ha));
    check("B13 diary(默认, 独立模式)与 0.3.1 相同", /^日记\/attachments\/2026\/2026-08-20-1030-[0-9a-f]{4}\.jpg$/.test(mkW({ sharedDailyNote: false }).W.attachmentPath(HD, "jpg")));

    // B14 语音气泡正则(与 main.js _voiceBubbleFor 里的字面量一致)
    const VOICE_RE = /(^|\/)\d{4}-\d{2}-\d{2}-\d{4}-语音(?:-[0-9a-f]{4}| \d+)*\.wav$/;
    check("B14 语音气泡正则: custom 路径 / 撞名「 1」后缀 / 重试 -a1b2 后缀 / 无目录 都匹配", VOICE_RE.test("Assets/2026/2026-08-20-1030-语音.wav") && VOICE_RE.test("x/2026-08-20-1030-语音 1.wav") && VOICE_RE.test("日记/attachments/2026/2026-08-20-1030-语音-a1b2.wav") && VOICE_RE.test("2026-08-20-1030-语音.wav"));
    check("B14 语音气泡正则: 「英语语音作业.wav」「2026-08-20-语音.wav」不匹配", !VOICE_RE.test("英语语音作业.wav") && !VOICE_RE.test("2026-08-20-语音.wav"));
    check("B14 main.js 里的正则字面量与这里一致(防两边漂移)", require("fs").readFileSync(__dirname + "/../main.js", "utf8").includes("/" + VOICE_RE.source + "/"));

    // B15 跨天 / 帮助 / 欢迎语(agent 层, 真 writer, 共用模式)
    setNow("2026-08-21T09:15:00+08:00");
    const pS = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.session.entered_date = "2026-08-20"; return d; })());
    pS.settings.sharedDailyNote = true; pS.settings.sectionHeading = "微信随手记";
    const sv = fakeVault2(); pS.app.vault = sv;
    sv.files[HP] = "# 2026-08-20\n\n## 微信随手记\n**14:30**\n\n昨天的\n\n## 复盘\n昨天复盘\n";
    let sr = await pS.agent._dispatch("今天第一条", false, []);
    eq("B15 跨天(前一天未封存): 回执 = (2026-08-20 的已自动收尾 📖) + 去掉开页前缀的正文", sr, "(2026-08-20 的已自动收尾 📖)\n\n记下来啦~ 今天第 1 段 ✍️" + H_TIPS);
    eq("B15 昨天的封存行在节内, ## 复盘 不动", sv.files[HP], "# 2026-08-20\n\n## 微信随手记\n**14:30**\n\n昨天的\n\n\n---\n_(今日封存于 09:15)_\n\n## 复盘\n昨天复盘\n");
    eq("B15 今天的文件 = 只有我们那一节", sv.files["日记/2026/2026-08-21.md"], "## 微信随手记\n**09:15**\n\n今天第一条\n");
    sr = await pS.agent._dispatch("帮助", false, []);
    check("B15 帮助末尾: 「微信随手记」这一节归插件管", sr.includes("「微信随手记」这一节归插件管") && sr.includes("节下面写任何标题就算节结束"), sr.slice(-80));
    sr = await pS.agent._dispatch("在吗", false, []);
    check("B15 「在吗」只数节内: 已记 1 段", sr.includes("已记 1 段"), sr);
    sr = await pS.agent._dispatch("撤回", false, []);
    check("B15 共用模式撤回走节内: 撤掉「今天第一条」, 标题留着", sr === "好的, 撤掉了「今天第一条」" && sv.files["日记/2026/2026-08-21.md"] === "## 微信随手记\n", JSON.stringify([sr, sv.files["日记/2026/2026-08-21.md"]]));
    const pW = await newPlugin({ [SECRET_TOKEN]: "TOK1" }, (() => { const d = BOUND_DATA(); d.profile = { state: "unknown", name: null }; return d; })());
    pW.settings.sharedDailyNote = true; pW.app.vault = fakeVault2();
    sr = await pW.agent._dispatch("在吗", false, []);
    check("B15 首次见面欢迎语(共用模式): 说「每日笔记里」与节名, 不再说「日记」文件夹", sr.includes("每日笔记里") && sr.includes("「微信随手记」这一节") && !sr.includes("「日记」文件夹"), sr);

    // ── 2026-08-27 落地后 diff 审查改的语义(docs/15 §4.2/§4.3 已同步) ──
    setNow("2026-08-20T10:30:00+08:00");

    // B16 围栏转义(共用模式): 块内行首 ``` / ~~~ 会让节扫描进入"围栏内", 后面用户的标题不再算节终点 → 行首加 \
    console.log("  — B16 围栏转义");
    eq("B16 escapeFenceLines: ``` / ~~~ / 缩进 ≤3 空格 都转义; 行中 ``` 与 4 空格缩进不动", I.escapeFenceLines("```js\ncode\n~~~\n  ```\n行中 ``` 不动\n    ```\n"), "\\```js\ncode\n\\~~~\n  \\```\n行中 ``` 不动\n    ```\n");
    eq("B16 escapeFenceLines: 单行 ~~~ / 空串", I.escapeFenceLines("~~~") + "|" + I.escapeFenceLines(""), "\\~~~|");
    const MID16 = "# 2026-08-20\n\n## 微信随手记\n**09:00**\n\n第一条\n\n## 复盘\n复盘内容\n";
    const FENCE_MSG = "代码如下\n```\nconsole.log(1)";
    h = mkW({}, { [HP]: MID16 });
    hr = await h.W.write(FENCE_MSG, false, HD);
    eq("B16 共用模式: 单个 ``` 行落盘成 \\```, ## 复盘 及之后逐字节不变", h.v.files[HP], "# 2026-08-20\n\n## 微信随手记\n**09:00**\n\n第一条\n\n\n**10:30**\n\n代码如下\n\\```\nconsole.log(1)\n\n## 复盘\n复盘内容\n");
    check("B16 节没被围栏吞掉: n===2, countDay===2, 节终点仍是 ## 复盘", hr.n === 2 && (await h.W.countDay(HD)) === 2 && I.locateSection(h.v.files[HP], "微信随手记").bodyEnd === h.v.files[HP].indexOf("## 复盘"), JSON.stringify([hr.n, h.v.files[HP]]));
    hu = await h.W.undoLastBlock(HD);
    eq("B16 撤回只删我们那块(含孤儿段头), 文件回到写入前", h.v.files[HP], MID16);
    check("B16 removed = 转义后的块", hu.ok === true && hu.removed === "代码如下\n\\```\nconsole.log(1)", JSON.stringify(hu));
    const hI16 = mkW({ sharedDailyNote: false });
    hr = await hI16.W.write(FENCE_MSG, false, HD);
    check("B16 独立模式同样消息不转义(与 0.3.1 相同)", hr.n === 1 && hI16.v.files[HP].endsWith("**10:30**\n\n代码如下\n```\nconsole.log(1)\n") && !hI16.v.files[HP].includes("\\```"), JSON.stringify(hI16.v.files[HP]));

    // B17 复核清单(替代旧的 _scheduleCreateCheck/_mutGen): 插件建了当天文件后写进节的每一块都登记, 每次写入重置 1.5s 计时;
    // 触发时缺哪条补哪条(按原顺序); 窗口内撤回过的从清单移除; 撤回时节已没了 → 补回时丢最后一条; 封存过 → 补回后再补封存行
    console.log("  — B17 复核清单");
    // 复核回调不返回 promise, 补写内部要过好几个 await: 调完后让微任务队列跑空再断言
    const flush = async (fn) => { await fn(); await new Promise((res) => setImmediate(res)); };
    const lastTimer = () => hTimers[hTimers.length - 1];
    const pcOf = (x) => x.wp._pendingCheck;
    let nb;
    // (a) 建文件 + 两条 → 整篇被覆盖成模板 → 两条都补回
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hTimers.length = 0; nb = notices.length;
    await h.W.write("第一条", false, HD);
    check("B17a 建文件写第 1 条: 登记 1 条, 定时器 1.5s", !!pcOf(h) && pcOf(h).day === HD && pcOf(h).items.length === 1 && hTimers.length === 1 && hTimers[0].ms === 1500, JSON.stringify([pcOf(h), hTimers.map((t) => t.ms)]));
    await h.W.write("第二条", false, HD);
    check("B17a 写第 2 条: 清单 2 条按序, 前一个定时器被 clearTimeout, 新登记一个", pcOf(h).items.length === 2 && pcOf(h).items[0].block === "第一条" && pcOf(h).items[1].block === "第二条" && hTimers.length === 2 && hTimers[0].cancelled === true && !hTimers[1].cancelled, JSON.stringify([pcOf(h).items, hTimers.map((t) => !!t.cancelled)]));
    h.v.files[HP] = TPL_A_R;   // 模拟 Templater: read → modify 整篇写回成只有模板(我们的节没了)
    await flush(lastTimer());
    eq("B17a 触发复核 → 两条按原顺序补回, 节在末尾", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n第一条\n\n第二条\n");
    check("B17a Notice「已补回 2 条」, 清单已清空, 补回走 process 不再 create", notices.slice(nb).some((n) => n.includes("已补回 2 条")) && pcOf(h) === null && h.v.created.filter((x) => x === HP).length === 1, JSON.stringify(notices.slice(nb)));
    // (b) 窗口内撤回第 2 条 → 只补第 1 条
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hTimers.length = 0; nb = notices.length;
    await h.W.write("第一条", false, HD);
    await h.W.write("第二条", false, HD);
    hu = await h.W.undoLastBlock(HD);
    check("B17b 窗口内撤回第 2 条 → 清单只剩第 1 条", hu.ok === true && hu.removed === "第二条" && pcOf(h).items.length === 1 && pcOf(h).items[0].block === "第一条", JSON.stringify([hu, pcOf(h)]));
    h.v.files[HP] = TPL_A_R;
    await flush(lastTimer());
    eq("B17b 触发 → 只补回第 1 条", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n第一条\n");
    check("B17b Notice「已补回 1 条」", notices.slice(nb).some((n) => n.includes("已补回 1 条")), JSON.stringify(notices.slice(nb)));
    // (c) 节被抹掉后用户撤回(找不到节) → 补回时丢掉最后一条 = 唯一一条 → 不补
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hTimers.length = 0; nb = notices.length;
    await h.W.write("第一条", false, HD);
    h.v.files[HP] = TPL_A_R;
    hu = await h.W.undoLastBlock(HD);
    check("B17c 节已被抹掉时撤回 → ok:false, 清单标 dropLast", hu.ok === false && !!pcOf(h) && pcOf(h).dropLast === true && pcOf(h).items.length === 1, JSON.stringify([hu, pcOf(h)]));
    await flush(lastTimer());
    check("B17c 触发 → 不补(丢掉的最后一条正是用户想撤的), 文件仍只有模板, 无 Notice", h.v.files[HP] === TPL_A_R && notices.length === nb && pcOf(h) === null, JSON.stringify([h.v.files[HP], notices.slice(nb)]));
    // (d) 窗口内封存 → 补回正文后封存行也回来
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    hTimers.length = 0; nb = notices.length;
    await h.W.write("第一条", false, HD);
    hf = await h.W.finalizeDay(HD);
    check("B17d 窗口内 finalizeDay → sealed, 清单标 sealed, 清单不作废", hf.status === "sealed" && !!pcOf(h) && pcOf(h).sealed === true && pcOf(h).items.length === 1, JSON.stringify([hf, pcOf(h)]));
    h.v.files[HP] = TPL_A_R;
    await flush(lastTimer());
    eq("B17d 触发 → 第 1 条补回且封存行也回来了", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n第一条\n\n\n---\n_(今日封存于 10:30)_\n");
    check("B17d 补回后 countDay===1, 再封 → already", (await h.W.countDay(HD)) === 1 && (await h.W.finalizeDay(HD)).status === "already", h.v.files[HP]);
    // (e) 文件不是插件建的 → 不登记
    h = mkW({ templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A, [HP]: TPL_A_R });
    hTimers.length = 0;
    hr = await h.W.write("第一条", false, HD);
    check("B17e 文件本来就存在(不是插件建的) → _pendingCheck 空, 不登记定时器", hr.n === 1 && !pcOf(h) && hTimers.length === 0, JSON.stringify([pcOf(h), hTimers.length]));
    hr = await h.W.write("第二条", false, HD);
    check("B17e 之后再写也不登记", hr.n === 2 && !pcOf(h) && hTimers.length === 0);

    // B18 obsidian 附件模式建壳也复核: 当天第一条是图片 → resolveAttachmentPath 先建壳(带模板) → 图片块追加 → 与建文件同款登记
    console.log("  — B18 obsidian 附件模式建壳");
    h = mkW({ attachmentMode: "obsidian", templatePath: TPL_PATH }, { [TPL_PATH]: TPL_A });
    h.wp.app.fileManager = { getAvailablePathForAttachment: async (name) => "Attach/" + name };
    hTimers.length = 0; nb = notices.length;
    hi = await h.W.writeImage(hJpg, "jpg", HD);
    const shellImg = h.v.created.find((x) => x.startsWith("Attach/") && x.endsWith(".jpg"));
    check("B18 共用+obsidian: 先建壳再落图再追加块, 登记了 1 个定时器、清单 1 条", hi.n === 1 && !!shellImg && h.v.created.indexOf(HP) < h.v.created.indexOf(shellImg) && hTimers.length === 1 && !!pcOf(h) && pcOf(h).items.length === 1 && pcOf(h).items[0].block === "![[" + shellImg + "]]", JSON.stringify([h.v.created, pcOf(h), hTimers.length]));
    eq("B18 壳 + 图片块 = 模板 + 节", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n![[" + shellImg + "]]\n");
    h.v.files[HP] = TPL_A_R;
    await flush(lastTimer());
    eq("B18 模拟覆盖后触发 → 图片块补回", h.v.files[HP], TPL_A_R + "\n## 微信随手记\n**10:30**\n\n![[" + shellImg + "]]\n");
    check("B18 Notice「已补回 1 条」", notices.slice(nb).some((n) => n.includes("已补回 1 条")), JSON.stringify(notices.slice(nb)));
    // 独立模式 + obsidian: 当天文件不存在 → 先建空文件给接口当 sourcePath, 之后 _transform 补 frontmatter+段头, 与直接 create 的字节相同
    h = mkW({ sharedDailyNote: false, attachmentMode: "obsidian" });
    const fm18 = [];
    h.wp.app.fileManager = { getAvailablePathForAttachment: async (name, src) => { fm18.push({ src, dayExists: HP in h.v.files }); return "Attach/" + name; } };
    hTimers.length = 0;
    hi = await h.W.writeImage(hJpg, "jpg", HD);
    const indImg = h.v.created.find((x) => x.startsWith("Attach/") && x.endsWith(".jpg"));
    check("B18 独立+obsidian: 调接口前当天文件已存在, sourcePath = 当天文件, 图片路径以桩前缀开头", hi.n === 1 && fm18.length === 1 && fm18[0].dayExists === true && fm18[0].src === HP && /^Attach\/2026-08-20-1030-[0-9a-f]{4}\.jpg$/.test(indImg || ""), JSON.stringify([fm18, h.v.created]));
    eq("B18 独立+obsidian: 当天文件 = 0.3.1 同款 frontmatter(以 ---\\ndate: 开头) + 标题 + 图片块", h.v.files[HP], "---\ndate: 2026-08-20\nweekday: 周四\nsource: wechat-diary\n---\n\n# 2026-08-20\n\n\n**10:30**\n\n![[" + indImg + "]]\n");
    check("B18 独立模式不登记复核", !pcOf(h) && hTimers.length === 0, String(hTimers.length));

    // B19 数字本地化: 界面语言 ar/fa/hi 时 moment 会把数字换成本地数字, 纯数字令牌的路径必须仍与 0.3.1 逐字节相同
    console.log("  — B19 数字本地化");
    const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
    // 包一层 momentStub: 带 locale(name), 默认 "ar"; format 时若当前 locale 是 ar 就把数字换成阿拉伯-印度数字(只在本用例构造, 直接传给 renderPath)
    const momentAr = (input, fmt) => {
      const m = momentStub(input, fmt);
      let cur = "ar";
      return { isValid: () => true, locale(name) { if (name) cur = String(name); return this; }, format(f) { const s = m.format(f); return cur === "ar" ? s.replace(/\d/g, (d) => AR_DIGITS[+d]) : s; } };
    };
    eq("B19 桩自检: 默认 ar 输出阿拉伯-印度数字", momentAr("2026-08-30").format("YYYY-MM-DD"), "٢٠٢٦-٠٨-٣٠");
    eq("B19 renderPath 纯数字令牌固定 en: 输出仍是 ASCII", I.renderPath("YYYY/YYYY-MM-DD", "2026-08-30", momentAr), "2026/2026-08-30");
    let arOut = null, arErr = null;
    try { arOut = I.renderPath("YYYY/MMM/DD", "2026-08-30", momentAr); } catch (e) { arErr = e; }
    check("B19 带 MMM 的格式允许走本地: 不抛错, 有输出", arErr === null && typeof arOut === "string" && arOut.length > 0, arErr ? String(arErr) : arOut);
    eq("B19 [字面量] 里的英文不算 MMM: 仍固定 en", I.renderPath("[Summary]/YYYY/YYYY-MM-DD", "2026-08-30", momentAr), "Summary/2026/2026-08-30");
    eq("B19 没有 locale 方法的桩(原 momentStub)照旧", I.renderPath("YYYY/YYYY-MM-DD", "2026-08-30", momentStub), "2026/2026-08-30");

    // B20 helpText: 「一天从几点开始」改过的用户, 帮助里那句跟着变; 默认 4 与常量逐字相同; 共用模式加节的说明
    console.log("  — B20 helpText");
    check("B20 helpText(false, …, 4) === HELP_TEXT(逐字相同)", I.helpText(false, "微信随手记", 4) === I.texts.HELP_TEXT, I.helpText(false, "微信随手记", 4));
    check("B20 HELP_TEXT 本身含「凌晨 4 点前」(下面两条替换的前提)", I.texts.HELP_TEXT.includes("凌晨 4 点前"));
    const ht0 = I.helpText(false, "微信随手记", 0);
    check("B20 dayStartHour=0: 「一天从零点切换」, 不再说「凌晨 4 点前」", ht0.includes("一天从零点切换") && !ht0.includes("凌晨 4 点前"), ht0);
    const ht6 = I.helpText(false, "微信随手记", 6);
    check("B20 dayStartHour=6: 「凌晨 6 点前」", ht6.includes("凌晨 6 点前") && !ht6.includes("凌晨 4 点前"), ht6);
    const htS = I.helpText(true, "微信随手记", 4);
    check("B20 共用模式: 以 HELP_TEXT 开头, 末尾含「这一节归插件管」与节名", htS.startsWith(I.texts.HELP_TEXT) && htS.slice(-120).includes("「微信随手记」这一节归插件管"), htS.slice(-120));

    // B21 firstPrefix 剥离: 节标题本身含「」时, 共用模式开页前缀也能被 stripFirstPrefix 整个剥掉(跨天告知替换用)
    console.log("  — B21 firstPrefix 剥离");
    eq("B21 节标题含「」: stripFirstPrefix 剥掉整个开页前缀", I.stripFirstPrefix(I.firstOfDayPrefixShared("2026-08-30", "随手记「工作」") + "记下来啦"), "记下来啦");
    eq("B21 普通节标题也剥", I.stripFirstPrefix(I.firstOfDayPrefixShared("2026-08-30", "微信随手记") + "记下来啦"), "记下来啦");
    eq("B21 独立模式开页前缀照旧剥", I.stripFirstPrefix(I.texts.FIRST_OF_DAY_PREFIX + "记下来啦"), "记下来啦");
  } finally {
    global.Date = RealDate; Math.random = realRandom; global.window.setTimeout = realWinSetTimeout; global.window.clearTimeout = realWinClearTimeout;
    I.setDayStartHour(4); I.setNudgeNightHour(22);
  }

  console.log("\n【D14】默认值(2026-09-02 谷雨拍板): 剪藏默认关、语音原声默认开——全新安装与 0.3.1 老 data.json 升级两种路径都要落在默认值上");
  {
    check("D14 DEFAULT_SETTINGS.webClipEnabled === false", I.DEFAULT_SETTINGS.webClipEnabled === false, String(I.DEFAULT_SETTINGS.webClipEnabled));
    check("D14 DEFAULT_SETTINGS.saveVoiceAudio === true", I.DEFAULT_SETTINGS.saveVoiceAudio === true, String(I.DEFAULT_SETTINGS.saveVoiceAudio));
    const pFresh = await newPlugin({}, null);
    check("D14 全新安装: 剪藏关", pFresh.settings.webClipEnabled === false, String(pFresh.settings.webClipEnabled));
    check("D14 全新安装: 语音原声开", pFresh.settings.saveVoiceAudio === true, String(pFresh.settings.saveVoiceAudio));
    // 0.3.1 用户的 data.json 里没有这两个键(剪藏是 0.4.0 才有的; 语音原声 D12 默认关时多数人没碰过开关)
    const pOld = await newPlugin({}, { settings: { diaryFolder: "日记", timezone: "Asia/Shanghai", reminderEnabled: true, reminderTime: "21:30" } });
    check("D14 老 data.json 升级: 没设过 → 剪藏关", pOld.settings.webClipEnabled === false, String(pOld.settings.webClipEnabled));
    check("D14 老 data.json 升级: 没设过 → 语音原声开", pOld.settings.saveVoiceAudio === true, String(pOld.settings.saveVoiceAudio));
    const pSet = await newPlugin({}, { settings: { diaryFolder: "日记", webClipEnabled: true, saveVoiceAudio: false } });
    check("D14 用户明确设过的值不被默认值覆盖", pSet.settings.webClipEnabled === true && pSet.settings.saveVoiceAudio === false);
  }

  console.log("\n────────────────────────");
  console.log(fail === 0 ? `全部通过 (${pass})` : `${pass} 通过, ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("harness 崩了:", e); process.exit(2); });
