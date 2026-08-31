// 网页剪藏执行验证: 公众号范围 + DOM/回退解析 + 并发图片 + vault 落盘 + URL 去重。
// 跑法: npm install && node tests/webcliptest.js (DOMParser 夹具使用 jsdom)
const Module = require("module");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

global.window = {
  setTimeout: (...a) => setTimeout(...a),
  clearTimeout: (...a) => clearTimeout(...a),
  setInterval: (...a) => setInterval(...a),
  clearInterval: (...a) => clearInterval(...a),
};
global.btoa = (s) => Buffer.from(String(s), "binary").toString("base64");

class Plugin {}
class PluginSettingTab {}
class Modal {}
class Notice {}
class AbstractInputSuggest {}
const chain = new Proxy({}, { get: () => () => chain });
class Setting { constructor() { return chain; } }

// 最新 main 的 DiaryWriter 通过 Obsidian moment 渲染路径；测试桩必须覆盖这条真实调用链。
function momentStub(input) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(input || ""));
  if (!match) throw new Error("momentStub: 不认识的日期 " + String(input));
  const values = { YYYY: match[1], YY: match[1].slice(-2), MM: match[2].padStart(2, "0"), M: String(Number(match[2])), DD: match[3].padStart(2, "0"), D: String(Number(match[3])) };
  return {
    locale() { return this; },
    format(pattern) {
      return String(pattern || "YYYY-MM-DD").replace(/\[([^\]]*)\]|YYYY|YY|MM|M|DD|D/g, (token, literal) => literal != null ? literal : values[token]);
    },
  };
}

let requestHandler = async () => ({ status: 500, headers: {}, text: "" });
const obsidianStub = {
  Plugin, PluginSettingTab, Modal, Notice, AbstractInputSuggest, Setting,
  moment: momentStub,
  normalizePath: (p) => String(p).replace(/\/+/g, "/"),
  requestUrl: (...args) => requestHandler(...args),
  Platform: { isDesktop: true },
};
const originalLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "obsidian") return obsidianStub;
  return originalLoad.call(this, req, ...rest);
};

const WechatDiaryPlugin = require(path.join(__dirname, "..", "main.js"));
const I = WechatDiaryPlugin.__internals;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  → " + extra : "")); }
}

function fakeVault() {
  const files = new Map();
  const folders = new Set();
  const fileObj = (p) => ({ path: p, name: p.split("/").pop(), extension: (p.split(".").pop() || "") });
  return {
    files,
    getFolderByPath: (p) => folders.has(p) ? { path: p, children: [] } : null,
    createFolder: async (p) => { folders.add(p); return { path: p, children: [] }; },
    getAbstractFileByPath: (p) => files.has(p) ? fileObj(p) : (folders.has(p) ? { path: p, children: [] } : null),
    getFileByPath: (p) => files.has(p) ? fileObj(p) : null,
    getMarkdownFiles: () => [...files.keys()].filter((p) => p.endsWith(".md")).map(fileObj),
    getFiles: () => [...files.keys()].map(fileObj),
    create: async (p, content) => {
      if (files.has(p)) throw new Error("EEXIST");
      files.set(p, String(content));
      return fileObj(p);
    },
    createBinary: async (p, content) => { files.set(p, Buffer.from(content)); return fileObj(p); },
    cachedRead: async (f) => String(files.get(f.path) || ""),
    process: async (f, fn) => {
      const next = fn(String(files.get(f.path) || ""));
      files.set(f.path, next);
      return next;
    },
  };
}

(async () => {
  console.log("\n【1】链接识别与安全边界");
  const urls = I.extractWebUrls("值得看：https://example.com/a?x=1）。再看 https://example.org/p#part");
  check("识别两个链接", urls.length === 2, JSON.stringify(urls));
  check("剥掉聊天标点", urls[0] === "https://example.com/a?x=1", urls[0]);
  check("锚点归一化去重", urls[1] === "https://example.org/p", urls[1]);
  check("提取微信附言", I.linkNoteFromText("值得看：https://example.com/a", ["https://example.com/a"]) === "值得看");
  check("默认只剪藏公众号链接", I.shouldClipWebUrl("https://mp.weixin.qq.com/s/abc", {}) && !I.shouldClipWebUrl("https://example.com/a", {}));
  check("用户可主动开启其它网站剪藏", I.shouldClipWebUrl("https://example.com/a", { webClipOtherSites: true }));
  check("拒绝 localhost", I.isUnsafeWebUrl("http://localhost:3000/x"));
  check("拒绝 localhost 尾点绕过", I.isUnsafeWebUrl("http://localhost.:3000/x"));
  check("拒绝 127.0.0.1", I.isUnsafeWebUrl("http://127.0.0.1/x"));
  check("拒绝 192.168.x.x", I.isUnsafeWebUrl("http://192.168.1.2/x"));
  check("拒绝 IPv6 loopback", I.isUnsafeWebUrl("http://[::1]/x"));
  check("允许公开 HTTPS", !I.isUnsafeWebUrl("https://example.com/article"));
  check("图片数量默认值为 30", I.webClipMaxImages({}) === 30);
  check("图片数量上限不超过 100", I.webClipMaxImages({ webClipMaxImages: 999 }) === 100);
  check("图片总量默认值为 50MB", I.webClipMaxTotalImageBytes({}) === 50 * 1024 * 1024);
  check("图片总量配置限制在 15–500MB", I.webClipMaxTotalImageBytes({ webClipMaxTotalImageMb: 3 }) === 15 * 1024 * 1024 && I.webClipMaxTotalImageBytes({ webClipMaxTotalImageMb: 999 }) === 500 * 1024 * 1024);

  console.log("\n【2】HTML → Markdown (Node fallback)");
  const html = [
    "<!doctype html><html><head>",
    "<title>备用标题</title>",
    '<meta property="og:title" content="一篇测试文章">',
    '<meta name="author" content="小明">',
    '<meta property="og:site_name" content="示例站">',
    '<link rel="canonical" href="/canonical">',
    "</head><body><nav>导航广告</nav><article>",
    "<h1>一篇测试文章</h1>",
    "<p>这是第一段正文，包含足够多的文字来验证正文提取不会误把导航当成文章主体。</p>",
    '<p>这是第二段，带有 <strong>重点内容</strong> 和 <a href="/more">延伸链接</a>。</p>',
    '<img data-src="/cover.png" alt="封面图" width="1200" height="800">',
    '<img src="null" alt="懒加载占位">',
    "<ul><li>要点一</li><li>要点二</li></ul>",
    "</article><footer>页脚噪音</footer></body></html>",
  ].join("");
  const article = I.extractArticleFromHtml(html, "https://example.com/original", 200000);
  check("优先 og:title", article.title === "一篇测试文章", article.title);
  check("提取作者和站点", article.author === "小明" && article.site === "示例站");
  check("解析 canonical", article.canonicalUrl === "https://example.com/canonical", article.canonicalUrl);
  check("正文转 Markdown", article.markdown.includes("**重点内容**") && article.markdown.includes("[延伸链接](https://example.com/more)"), article.markdown);
  check("标题不重复", !article.markdown.startsWith("# 一篇测试文章"));
  check("排除导航页脚", !article.markdown.includes("导航广告") && !article.markdown.includes("页脚噪音"));
  check("识别正文懒加载图片", article.images.length === 1 && article.images[0].url === "https://example.com/cover.png", JSON.stringify(article.images));
  check("忽略 null 假图片地址", !article.markdown.includes("/null"), article.markdown);
  check("正文保留图片占位", article.markdown.includes(article.images[0].token), article.markdown);

  console.log("\n【2.5】真实公众号 DOMParser 路径与 Markdown 安全");
  const fixture = fs.readFileSync(path.join(__dirname, "fixtures", "wechat-article-stripped.html"), "utf8");
  global.DOMParser = new JSDOM("").window.DOMParser;
  const wechatSource = "https://mp.weixin.qq.com/s?__biz=MzTest&mid=2247480001&idx=1&sn=stable&chksm=first&scene=1";
  const domArticle = I.extractArticleFromHtml(fixture, wechatSource, 200000);
  delete global.DOMParser;
  check("公众号优先选 #js_content", domArticle.markdown.includes("这是公众号正文第一段") && !domArticle.markdown.includes("作者头像和发布日期噪音"), domArticle.markdown);
  check("公众号页眉页脚和弹窗已剔除", !/微信扫一扫|在小说阅读器|取消 允许|对话框噪音/.test(domArticle.markdown), domArticle.markdown);
  check("代码块保留 Python 缩进", domArticle.markdown.includes("\n    if name:\n        return"), domArticle.markdown);
  check("嵌套列表保留层级", /- 一级列表\n\s{2,}- 二级列表/.test(domArticle.markdown), domArticle.markdown);
  check("网页文本不能注入 Obsidian 语法", !domArticle.markdown.includes("![[secret]]") && !domArticle.markdown.includes("![[table-secret]]") && !domArticle.markdown.includes("%% 注释 %%") && !domArticle.markdown.includes("<iframe") && !/(^|\n)```dataviewjs/.test(domArticle.markdown), domArticle.markdown);
  check("插件自己的图片占位仍保留", domArticle.images.length === 1 && domArticle.markdown.includes(domArticle.images[0].token), domArticle.markdown);
  check("公众号身份剥掉波动参数", domArticle.identityUrl.includes("__biz=MzTest") && domArticle.identityUrl.includes("mid=2247480001") && !/chksm|scene/.test(domArticle.identityUrl), domArticle.identityUrl);
  const longA = I.extractArticleFromHtml(fixture, "https://mp.weixin.qq.com/s?__biz=MzLongA&mid=2247480101&idx=1&sn=a&chksm=one", 200000);
  const longB = I.extractArticleFromHtml(fixture, "https://mp.weixin.qq.com/s?__biz=MzLongB&mid=2247480102&idx=1&sn=b&chksm=two", 200000);
  check("两篇不同长链不会身份碰撞", longA.identityUrl !== longB.identityUrl && longA.identityUrl.includes("MzLongA") && longB.identityUrl.includes("MzLongB"), longA.identityUrl + " / " + longB.identityUrl);
  check("URL 参数优先且不误抓字符串拼接诱饵", !longA.identityUrl.includes("%2Bbiz%2B") && !longA.identityUrl.includes("+biz+"), longA.identityUrl);
  const shortSame = I.extractArticleFromHtml(fixture, "https://mp.weixin.qq.com/s/short-id", 200000);
  check("长链与短链按页面 biz/mid/idx 互认", shortSame.identityUrl === domArticle.identityUrl, shortSame.identityUrl + " / " + domArticle.identityUrl);
  const baitOnly = '<script>var x = "__biz=" + biz + "&mid=" + mid + "&idx=" + idx;</script><article><p>这是只含字符串拼接诱饵的足够长正文，不应当被当成真实的公众号变量赋值。</p></article>';
  const baitArticle = I.extractArticleFromHtml(baitOnly, "https://mp.weixin.qq.com/s/bait-only", 200000);
  check("只有拼接诱饵时退回短链身份", baitArticle.identityUrl === "https://mp.weixin.qq.com/s/bait-only", baitArticle.identityUrl);
  const adjacent = I.extractArticleFromHtml('<article><p>普通感叹号!<a href="https://example.com/a">链接</a>，以及分开的 [<span>[私密</span>]] 都不能在节点边界恢复成 Obsidian 活语法。</p></article>', "https://example.com/adjacent", 200000);
  check("相邻文本节点不能拼出图片或双链语法", !/(^|[^\\])!\[/.test(adjacent.markdown) && !/(^|[^\\])\[\[/.test(adjacent.markdown), adjacent.markdown);
  global.DOMParser = new JSDOM("").window.DOMParser;
  const newlineTitle = I.extractArticleFromHtml('<meta property="og:title" content="Foo\n Bar"><article><p>这是足够长的正文，用于验证标题换行会在写入日记内链之前被压成普通空格而不是跨行。</p></article>', "https://example.com/title", 200000);
  const publishedArticle = I.extractArticleFromHtml('<script>var createTime = "1724803200";</script><article><p>这是足够长的公众号正文，用于验证源码里的 createTime 可以补全发布时间字段。</p></article>', "https://mp.weixin.qq.com/s/time", 200000);
  delete global.DOMParser;
  check("标题内部换行压成空格", newlineTitle.title === "Foo Bar", newlineTitle.title);
  check("公众号 createTime 可补发布时间", publishedArticle.published === "2024-08-28T00:00:00.000Z", publishedArticle.published);

  console.log("\n【3】WebClipper 请求闸门");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  let directCalls = 0;
  requestHandler = async (opts) => {
    if (opts.url === "https://example.com/original") {
      check("请求目标正确", true);
      check("带 HTML Accept", String(opts.headers.Accept).includes("text/html"));
      check("页面 UA 是纯浏览器 UA", !String(opts.headers["User-Agent"]).includes("WeChat-Diary"), opts.headers["User-Agent"]);
      return { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, text: html };
    }
    check("图片优先走 requestUrl", opts.url === "https://example.com/cover.png", opts.url);
    check("图片 requestUrl 带 image Accept", String(opts.headers.Accept).includes("image/"));
    return { status: 200, headers: { "Content-Type": "image/png", "Content-Length": String(png.length) }, arrayBuffer: png };
  };
  const directImageRequest = async (url, headers, timeoutMs) => {
    directCalls += 1;
    check("图片直连目标正确", url === "https://example.com/cover.png", url);
    check("图片直连带 image Accept", String(headers.Accept).includes("image/"));
    check("图片直连带原文 Referer", headers.Referer === "https://example.com/canonical", headers.Referer);
    check("图片直连超时不超过 10 秒", timeoutMs <= 10000, timeoutMs);
    return { status: 200, headers: { "Content-Type": "image/png", "Content-Length": String(png.length) }, buffer: png };
  };
  const clipper = new I.WebClipper(
    { settings: { webClipMaxChars: 200000, webClipSaveImages: true, webClipMaxImages: 30 } },
    { directImageRequest });
  const fetched = await clipper.fetchArticle("https://example.com/original#x");
  check("请求后提取成功", fetched.title === "一篇测试文章" && fetched.markdown.includes("第二段"));
  check("正文图片下载成功", fetched.images.length === 1 && fetched.images[0].ext === "png" && fetched.images[0].buffer.equals(png));
  check("正常图片请求不走 Node 直连", directCalls === 0, directCalls);
  requestHandler = async (opts) => {
    if (opts.url === "https://example.com/original") return { status: 200, headers: { "Content-Type": "text/html" }, text: html };
    throw new Error("net::ERR_BLOCKED_BY_CLIENT");
  };
  const blockedFallback = await clipper.fetchArticle("https://example.com/original");
  check("仅被 Electron 拦截时回退 Node 直连", directCalls === 1 && blockedFallback.images[0].buffer.equals(png), directCalls);
  requestHandler = async (opts) => opts.url === "https://example.com/original"
    ? { status: 200, headers: { "Content-Type": "text/html" }, text: html }
    : { status: 403, headers: {}, arrayBuffer: Buffer.alloc(0) };
  const partial = await clipper.fetchArticle("https://example.com/original");
  check("HTTP 失败不拖垮正文且不滥用直连", partial.markdown.includes("第二段") && partial.images[0].error.includes("HTTP 403") && directCalls === 1, JSON.stringify(partial.images));

  const concurrentHtml = '<article><p>这是用于验证并发下载的足够长正文，后面放五张正文图片。正文继续补充一些真实内容，确保正文选择器不会把它误判成导航或空页面。</p>' +
    [1, 2, 3, 4, 5].map((n) => '<img src="https://img.example/' + n + '.png">').join("") + '</article>';
  let activeImages = 0, maxActiveImages = 0;
  requestHandler = async (opts) => {
    if (opts.url === "https://example.com/concurrent") return { status: 200, headers: { "Content-Type": "text/html" }, text: concurrentHtml };
    activeImages += 1; maxActiveImages = Math.max(maxActiveImages, activeImages);
    await new Promise((resolve) => setTimeout(resolve, 10));
    activeImages -= 1;
    return { status: 200, headers: { "Content-Type": "image/png" }, arrayBuffer: png };
  };
  const concurrent = await new I.WebClipper({ settings: { webClipSaveImages: true } }).fetchArticle("https://example.com/concurrent");
  check("图片最多并发 4 张", concurrent.images.length === 5 && maxActiveImages === 4, maxActiveImages);
  let unsafeCalled = false;
  requestHandler = async () => { unsafeCalled = true; return { status: 200, headers: {}, text: html }; };
  try { await clipper.fetchArticle("http://127.0.0.1:8080/admin"); } catch (e) {
    check("私网 URL 抛 unsafe", e.code === "unsafe", e.code);
  }
  check("私网 URL 未发请求", !unsafeCalled);

  console.log("\n【4】写入剪藏、日记入口与重复 URL 复用");
  const vault = fakeVault();
  const plugin = {
    settings: { diaryFolder: "日记", webClipFolder: "" },
    app: { vault },
    data: { webClips: [] },
  };
  const writer = new I.DiaryWriter(plugin, null);
  const originalSentence = "值得研究：https://example.com/original";
  const first = await writer.writeWebClip(fetched, originalSentence, "值得研究", "2026-08-28");
  check("首篇写入成功", first.n === 1 && !first.reused, JSON.stringify(first));
  check("报告一张本地图片", first.imageCount === 1 && first.imageFailed === 0, JSON.stringify(first));
  check("剪藏文件存在", vault.files.has(first.path), first.path);
  const clipBody = String(vault.files.get(first.path));
  check("frontmatter 保留来源", clipBody.includes('source_url: "https://example.com/original"'));
  check("frontmatter 记录图片结果", clipBody.includes("web_clip_image_count: 1") && clipBody.includes("web_clip_image_failed: 0"));
  check("保留微信附言和正文", clipBody.includes("## 微信附言") && clipBody.includes("值得研究") && clipBody.includes("## 正文"));
  const assetFiles = [...vault.files.keys()].filter((p) => p.startsWith("日记/剪藏/assets/") && p.endsWith(".png"));
  check("图片写入剪藏 assets", assetFiles.length === 1 && Buffer.isBuffer(vault.files.get(assetFiles[0])), JSON.stringify(assetFiles));
  check("正文改成本地图片内链", clipBody.includes("![[" + assetFiles[0] + "]]" ) && !clipBody.includes("%%WECHAT_DIARY_IMAGE_"), clipBody);
  const diaryPath = "日记/2026/2026-08-28.md";
  check("今日日记写内链入口", String(vault.files.get(diaryPath)).includes("[[" + first.path + "|🔖 一篇测试文章]]"));
  check("今日日记先保留原句再另起一行放入口", String(vault.files.get(diaryPath)).includes(originalSentence + "\n[[" + first.path), String(vault.files.get(diaryPath)));
  const second = await writer.writeWebClip(fetched, "第二次：https://example.com/original", "第二次", "2026-08-28");
  check("重复 URL 复用原文件", second.reused && second.path === first.path && second.n === 2, JSON.stringify(second));
  const clipFiles = [...vault.files.keys()].filter((p) => p.startsWith("日记/剪藏/") && p.endsWith(".md"));
  check("只生成一个剪藏文件", clipFiles.length === 1, JSON.stringify(clipFiles));

  const aliasVault = fakeVault();
  const aliasWriter = new I.DiaryWriter({ settings: plugin.settings, app: { vault: aliasVault }, data: { webClips: [] } }, null);
  const aliasWrite = await aliasWriter.writeWebClip({ ...newlineTitle, images: [] }, "原句 https://example.com/title", "", "2026-08-28");
  check("日记内链 alias 不允许换行或方括号注入", String(aliasVault.files.get(diaryPath)).includes("|🔖 Foo Bar]]") && !String(aliasVault.files.get(diaryPath)).includes("Foo\n"), String(aliasVault.files.get(diaryPath)));

  let contractOk = true, contractExtra = "";
  for (const [i, original] of ["# 标题\r\n\r\n\r\n正文", "---\n正文", "_(伪标记)_\n正文"].entries()) {
    const contractVault = fakeVault();
    const contractWriter = new I.DiaryWriter({ settings: plugin.settings, app: { vault: contractVault }, data: { webClips: [] } }, null);
    const contractArticle = { ...fetched, url: fetched.url + "?contract=" + i, canonicalUrl: fetched.canonicalUrl + "?contract=" + i,
      identityUrl: fetched.identityUrl + "?contract=" + i, images: [] };
    const result = await contractWriter.writeWebClip(contractArticle, original, "", "2026-08-28");
    const diary = String(contractVault.files.get(diaryPath) || "");
    const expectedStart = "\\" + original.replace(/\r\n/g, "\n").split("\n")[0];
    if (!result.n || !diary.includes(expectedStart) || diary.includes("\n\n正文")) { contractOk = false; contractExtra += "\n" + diary; }
  }
  check("剪藏原句复用 write() 的空行与保留前缀守卫", contractOk, contractExtra);

  const failedVault = fakeVault();
  const failedWriter = new I.DiaryWriter({ settings: plugin.settings, app: { vault: failedVault }, data: { webClips: [] } }, null);
  const partialWrite = await failedWriter.writeWebClip(partial, "https://example.com/original", "", "2026-08-28");
  const partialBody = String(failedVault.files.get(partialWrite.path));
  check("图片失败仍保存正文", partialWrite.n === 1 && partialWrite.imageCount === 0 && partialWrite.imageFailed === 1, JSON.stringify(partialWrite));
  check("图片失败保留可点击原图", partialBody.includes("[图片未保存：封面图](<https://example.com/cover.png>)"), partialBody);
  check("图片失败原因写入笔记", partialBody.includes("## 图片保存报告") && partialBody.includes("图片返回 HTTP 403"), partialBody);

  const oldVault = fakeVault();
  const oldPlugin = { settings: plugin.settings, app: { vault: oldVault }, data: { webClips: [] } };
  const upgradeWriter = new I.DiaryWriter(oldPlugin, null);
  const oldPath = upgradeWriter.webClipPath(fetched, "2026-08-28");
  oldVault.files.set(oldPath, I.formatWebClipMarkdown({ ...fetched, images: [] }, "旧版无图片").replace(/^web_clip_image_.*\n/gm, ""));
  oldPlugin.data.webClips.push({ url: fetched.canonicalUrl, path: oldPath });
  const upgraded = await upgradeWriter.writeWebClip(fetched, "升级图片：https://example.com/original", "升级图片", "2026-08-28");
  check("早期无图片元数据的剪藏不覆盖并生成图片版", !upgraded.reused && upgraded.path !== oldPath && oldVault.files.has(oldPath) && upgraded.imageCount === 1, JSON.stringify(upgraded));

  const retryVault = fakeVault();
  const retryPlugin = { settings: plugin.settings, app: { vault: retryVault }, data: { webClips: [] } };
  const retryWriter = new I.DiaryWriter(retryPlugin, null);
  const failedPath = retryWriter.webClipPath(fetched, "2026-08-28");
  retryVault.files.set(failedPath, I.formatWebClipMarkdown({ ...partial, imageTotal: 1, imageCount: 0, imageFailed: 1 }, "首次全失败"));
  retryPlugin.data.webClips.push({ url: fetched.canonicalUrl, path: failedPath });
  const retried = await retryWriter.writeWebClip(fetched, "修复后重试：https://example.com/original", "修复后重试", "2026-08-28");
  check("图片全失败的旧剪藏允许重试", !retried.reused && retried.path !== failedPath && retryVault.files.has(failedPath) && retried.imageCount === 1, JSON.stringify(retried));

  console.log("\n【5】剪藏 Markdown 格式");
  const formatted = I.formatWebClipMarkdown({ ...article, truncated: true }, "我的附言", "2026-08-28T00:00:00.000Z");
  check("可追溯字段齐全", formatted.includes("canonical_url:") && formatted.includes("identity_url:") && formatted.includes("clipped_at:") && formatted.includes("source: wechat-diary-web-clip"));
  check("截断显式标注", formatted.includes("[!warning]"));
  const dangerousTitle = I.formatWebClipMarkdown({ ...article, title: "![封面](x) [[私密笔记]]", images: [] }, "");
  check("标题展示也会转义网页语法", dangerousTitle.includes("# !\\[封面](x) \\[\\[私密笔记\\]\\]") && !dangerousTitle.includes("# ![封面]"), dangerousTitle);
  check("有序列表只转义标点不显示反斜杠数字", I.escapeWebText("1. 第一项").startsWith("1\\. ") && !I.escapeWebText("1. 第一项").startsWith("\\1."), I.escapeWebText("1. 第一项"));
  check("网页实体先转义 & 防止二次解码", I.escapeWebText("&lt;script&gt;").includes("&amp;lt;script&amp;gt;"), I.escapeWebText("&lt;script&gt;"));
  check("文件名消毒", !/[\/\\:*?"<>|#^[\]]/.test(I.safeClipFilename("坏/标题:*?[]")));

  console.log("\n【6】消息路由与「记：」绕过");
  const calls = { fetched: [], clipped: [], appended: [], plain: [] };
  const routePlugin = {
    settings: { webClipEnabled: true, webClipOtherSites: false, webClipFolder: "", diaryFolder: "日记" },
    data: {
      profile: { state: "active", name: null },
      session: { reminder_streak: 0, last_activity_ts: 0 },
    },
    writer: {
      webClipFolder: () => "日记/剪藏",
      saveWebClip: async (a, note) => {
        calls.clipped.push({ a, note });
        return { path: "日记/剪藏/" + calls.clipped.length + ".md", title: a.title, identityUrl: a.url,
          reused: a.url.includes("reused"), imageCount: 2, imageFailed: 1 };
      },
      appendWebClipEntries: async (entries, originalText) => {
        calls.appended.push({ entries, originalText });
        return { n: calls.appended.length, sealed: false };
      },
      write: async (text) => {
        calls.plain.push(text);
        return { n: calls.plain.length, sealed: false, reply: "记下来啦" };
      },
    },
    clipper: {
      fetchArticle: async (url) => {
        calls.fetched.push(url);
        return { title: "路由测试", url, canonicalUrl: url, markdown: "这是足够长的网页正文，用于验证消息会进入剪藏路由而不是普通日记写入。" };
      },
    },
    ai: null,
    chatHandler: null,
  };
  const agent = new I.DiaryAgent(routePlugin);
  let routeReply = await agent._handle("稍后研究：https://example.com/route", false, {}, I.detectIntent("稍后研究：https://example.com/route"));
  check("普通链接默认只按原句记录且不访问", calls.fetched.length === 0 && calls.clipped.length === 0 && calls.plain[0] === "稍后研究：https://example.com/route", JSON.stringify(calls));
  routeReply = await agent._handle("稍后研究：https://mp.weixin.qq.com/s/route", false, {}, I.detectIntent("稍后研究：https://mp.weixin.qq.com/s/route"));
  check("公众号链接进入剪藏路由", calls.fetched.length === 1 && calls.clipped.length === 1, routeReply);
  check("剪藏写入收到一次附言", calls.clipped[0].note === "稍后研究", JSON.stringify(calls.clipped[0]));
  check("原句与入口作为同一个日记块提交", calls.appended[0].originalText === "稍后研究：https://mp.weixin.qq.com/s/route" && calls.appended[0].entries.length === 1, JSON.stringify(calls.appended[0]));
  check("回执沿用段数并报告保存目录", routeReply.includes("记下来啦~ 今天第 1 段") && routeReply.includes("网页《路由测试》已存到 日记/剪藏 文件夹"), routeReply);
  routePlugin.settings.webClipOtherSites = true;
  routeReply = await agent._handle("开启后：https://example.com/route", false, {}, I.detectIntent("开启后：https://example.com/route"));
  check("开启扩展后普通网站也会剪藏", calls.fetched.length === 2 && calls.clipped.length === 2, routeReply);
  routeReply = await agent._handle("一起看 https://example.com/one 和 https://example.com/two", false, {}, I.detectIntent("一起看 https://example.com/one 和 https://example.com/two"));
  const multiAppend = calls.appended[calls.appended.length - 1];
  const multiSaved = calls.clipped.slice(-2);
  check("多链接的原句与所有入口只写一个日记块", multiAppend.originalText.includes("https://example.com/one") && multiAppend.entries.length === 2, JSON.stringify(multiAppend));
  check("多链接附言只写入一个剪藏且空白已收敛", multiSaved[0].note === "一起看 和" && multiSaved[1].note === "", JSON.stringify(multiSaved));
  routeReply = await agent._handle("https://example.com/reused", false, {}, I.detectIntent("https://example.com/reused"));
  check("重复剪藏回执明确提示复用", routeReply.includes("之前存过，已复用"), routeReply);
  routeReply = await agent._handle("记：https://example.com/raw", false, {}, I.detectIntent("记：https://example.com/raw"));
  check("「记：」绕过抓取", !calls.fetched.includes("https://example.com/raw") && calls.plain.includes("https://example.com/raw"), JSON.stringify(calls));
  routePlugin.clipper.fetchArticle = async () => { throw new I.WebClipError("no_text", "页面需要登录"); };
  routeReply = await agent._handle("https://mp.weixin.qq.com/s/login-only", false, {}, I.detectIntent("https://mp.weixin.qq.com/s/login-only"));
  check("抓取失败保留原句", calls.plain.includes("https://mp.weixin.qq.com/s/login-only") && routeReply.includes("原句已记入今天的日记"), routeReply);

  console.log("\n────────────────────────");
  if (fail) {
    console.log("失败 " + fail + "，通过 " + pass);
    process.exitCode = 1;
  } else {
    console.log("全部通过 (" + pass + ")");
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
