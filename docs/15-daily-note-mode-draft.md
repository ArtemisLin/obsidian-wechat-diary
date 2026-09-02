# #15 路径可配置 + 写进已有的每日笔记——设计终稿(v3)

> 状态: **终稿(v3) = v1 经三视角对抗审稿(13 agent, 30 条发现驳倒 1 存活 29, 合并 18 条直接改 + 3 条选择题 + 8 条记录在案, 全文 `15-review-round1.md`)修订为 v2, 再由谷雨 2026-08-29 对 §9 三道选择题拍板 + 终审补 6 条; 2026-08-30 落地; 落地 diff 审查轮(13 agent, 存活 30 条, `15-review-round2.md`)的必修/应修 15 条已改进代码并回填本文, 记录在案 9 条见 §8**。行号指 main.js 0.3.1(HEAD c9ca058)。
> 来源: GitHub issue #1(royxue, 2026-08-27/28), 谷雨 2026-08-29 拍板: 做「写进已有的每日笔记」开关; 节的默认标题「微信随手记」; 标题节不用代码块; 本轮先于「切换文件夹」(#14)发版(0.4.0); **对不开开关的用户零影响**。

## 0. 一句话

两件事: ①日记文件的路径格式和附件位置改成可配置; ②新增开关「写进已有的每日笔记」——开了之后微信内容不再单独建文件, 而是写进用户当天那个每日笔记文件里的 `## 微信随手记` 一节, 插件只认、只动这一节。

## 1. 需求(Roy 的两条留言, 翻译过的)

1. 插件现在写死 `日记/2026/2026-08-27.md` + `日记/attachments/2026/`; 他的每日笔记是 `xx/2026/08/` 年/月两层, 附件有专门文件夹。要路径可配置。
2. 最好是和他的每日笔记**同一个文件**(一天一个, 不是所有天一个); 他知道各人模板不同, 不指望插件适配结构; 建议插件"固定追加一个自己的区块"。

不做的: 适配用户模板结构; 代码块形式(代码块里图片不显示、语音气泡和链接都不能用; 标题节的边界同样清楚)。

## 2. 设置项(「日记」区块, 现有「日记文件夹」下面)

| 字段 | 默认 | 说明 |
|---|---|---|
| `diaryFolder` 日记文件夹 | `日记`(现有) | 根目录。新增: 填 `/` = 库根目录(核心每日笔记默认就在根目录); 三个路径函数里 `/` 视为根目录不拼前缀; 现有 `\|\| "日记"` 兜底一处不改 |
| `pathFormat` 日记文件路径格式 | `YYYY/YYYY-MM-DD` | 相对根目录, **moment 格式**(与 Obsidian 每日笔记的"日期格式"同一套写法; `moment` 由 `require("obsidian")` 导出, obsidian.d.ts 4561 行已核); 不用写 `.md`。**英文字母会被当成日期代码, 文件夹名要放方括号里**: Roy 填 `YYYY/MM/YYYY-MM-DD`, 想加固定目录写 `[daily]/YYYY/MM/YYYY-MM-DD` |
| `sharedDailyNote` 写进已有的每日笔记 | 关 | 开了之后按 §4 走; 关着时 §4 的代码一行都不进。**打开时自动对齐(谷雨 8/31 拍板做法一)**: 读每日笔记插件(核心或 Periodic Notes daily)的 folder/format, 与当前设置不一致 → 直接弹「从每日笔记设置导入」确认框; 读不到 → Notice 提示自己选(不静默改任何值; 之后用户改了每日笔记插件设置, 我们不自动跟, 预览行可见)。**关闭时**: 今天的文件里有我们的节 = 共用模式自建, 弹「知道了」型说明(关掉后内容追加到同一文件末尾、撤回只认微信部分), **不提供改回默认**——谷雨实测点「改回默认」会把路径格式改掉、文件散两个层级; 「改回默认」只留给真正的外来文件 |
| `sectionHeading` 节标题 | `微信随手记` | 开关开时显示; 存文字不存 `##`, 级别固定二级(拍板原话就是 `## 微信随手记`); 用户打了 `###` 被剥掉时 **Notice「节标题固定二级, 已去掉 #」不静默**; desc: 「级别固定二级; **别用你每日笔记里已有的标题(插件会把那一节当成自己的, 撤回会删到你的内容)**; 改标题只影响之后, 已写的留在旧标题下; 想固定位置, 把 `## 微信随手记` 写进你的每日笔记模板, 标题下面留空」。打开开关或保存标题时探测今天的文件: 该标题下已有非空内容 → 确认框「今天的每日笔记里「日志」下面已经有内容, 插件会把它当成自己的一节; 确定用这个标题吗」 |
| `templatePath` 新建文件时用的模板 | 空 | 开关开时显示; 文件不存在时按它创建(§4.3), 空 = 只建我们那一节。存 vault 内 `.md` 全路径。desc 在上次建文件读模板失败后标红「上次没找到模板文件」 |
| 按钮「从每日笔记设置导入」 | — | 开关开时显示。优先 Periodic Notes(`app.plugins.getPlugin("periodic-notes")?.settings?.daily`, 同三字段), 否则核心插件 `app.internalPlugins.getPluginById("daily-notes")`——**要看 `.enabled`**(关着也返回对象), 取 `.instance.options` 的 `folder / format / template`。取值处理(核心插件真实形态): `folder` 空 → 填 `/`; `format` 空 → `YYYY-MM-DD`; `template` 是不带 `.md` 的链接式路径 → `metadataCache.getFirstLinkpathDest(normalizePath(t), "")` 解析成 TFile 存 `.path`, 再兜一次 `t + ".md"`, 都找不到 → Notice「模板文件没找到, 请手填」。两个插件都没启用 → Notice「每日笔记插件没有启用, 请手填」。**导入前确认框**: 「将把 日记文件夹 / 路径格式 / 模板 改为你每日笔记的设置(当前值: …), 继续吗」——它一键覆盖三项手填值, 不能静默 |
| `attachmentMode` 附件位置 | `diary` | 下拉三选一: `diary` 日记文件夹内的 `attachments/YYYY`(现状) / `obsidian` 跟随 Obsidian 的附件设置 / `custom` 自定义 |
| `attachmentFolder` 自定义附件文件夹 | 空 | `custom` 时显示; **单框点开选库里的文件夹**(谷雨 8/30 终审: 不让用户填文件夹), `/` = 库根目录 |
| `attachmentSubFormat` 按日期分子文件夹 | 空 | `custom` 时显示; moment 格式如 `YYYY/MM`, 可空; 实时预览(B3) |
| `dayStartHour` 一天从几点开始 | 4(现有字段, 新增 UI) | **只在开关开时显示**(B2), 下拉 0–12; desc「用每日笔记的建议填 0(和它一样零点切); 每日提醒的最晚时间也跟着变」; 「提醒时间」desc 里写死的"最晚 03:59"改成按此值动态 |

**设置页布局(谷雨 2026-08-30 验收后定)**: 四个分区——「微信」(绑定) / 「日记」(日记文件夹、路径格式、时区) / 「写进已有的每日笔记」(开关 + 开关开了才出现的节标题、模板、导入、一天从几点开始) / 「附件」(附件位置、自定义文件夹、按日期分子文件夹); 语音/提醒/AI 不变。**文件夹和模板都不让用户填, 用"单框 + 点开即列整棵树"选**(第一版做成级联下拉, 谷雨否掉: 一个值拆三个控件、每级都要答、看一眼就改了设置——她点第三级看了一下, 日记文件夹被改成了 `…/2026`): 一个输入框, 点进去弹出全部文件夹按层级缩进的列表, 打字过滤, 点一项才选定; 手打不存在的路径离开输入框时回退并提示"先在文件列表里建好"; 模板同款, 列 .md 文件。与 Obsidian 核心「附件默认存放路径」同一种交互。路径格式改成预设(按年 / 按年/月 / 按年/年-月——Roy 9/1 反馈补的, 月份文件夹不重名 / 不分文件夹)+「自定义…」, 选自定义才露出输入框(任意 moment 格式都行, 只是预设里没有的用户会以为不支持——所以常见布局要进预设)。说明文字拆短, 「附件位置」按选中项只显示对应一句。

**校验**(纯函数进 bindtest):
- `pathFormat` / `attachmentFolder`:
  1. 去首尾空白与首尾 `/`; 去尾部 `.md`; 不含 `..` 段; 渲染结果不含 `\ : * ? " < > |`。
  2. **令牌白名单**: 剥掉 `[..]` 字面量后, 剩余字母只允许日期类 moment 令牌 `YYYY YY M MM MMM MMMM D DD DDD DDDD d dd ddd dddd E e w ww Q`; 时分秒与 AM/PM 令牌(`H h m s A a S`)及任何其他字母一律拒, 错误文案「英文字母会被当成日期代码, 文件夹名请放在方括号里, 如 [Assets]」。这样导入带回的 `YYYY-MM-DD dddd` 合法, 而 `Assets/YYYY`(真 moment 渲染成 `AM006t0/2026`)被拒。
  3. `pathFormat` 还要**按天唯一**: 渲染同一年 366 天 + 次年 1 月 1 日全部互不相同(只在校验时跑一次; 取代 v1 的四个特例日期——它放过 `YYYY/MD`: 01-12 与 11-02 都是 `2026/112`)。
  4. **呈现(B3)**: 输入框下方一行实时预览「今天会写到: 日记/2026/08/2026-08-29.md」(附件同理「附件会存到: …」), 200–600ms 去抖; 不合法时预览行变红写原因(「英文字母会被当成日期代码, 请用方括号括起来」/「这个格式两天会写进同一个文件, 没有保存」), **不弹 Notice, 只在合法时落盘, 不回退输入框**。Obsidian 每日笔记设置页同款做法。
- `sectionHeading`: 去首尾空白; 剥前导 `#` 与空格(带 Notice); 非空; ≤30 码点; 不含换行。
- **改了格式/文件夹/标题, 已有文件不搬、已写的不迁移**, 只影响之后——设置项说明写这一句。

## 3. 路径层(两种模式共用)

- 纯函数 `renderPath(format, dateStr)`: `moment(dateStr, "YYYY-MM-DD").format(format)` → `normalizePath`。
- `diaryPath(day)` = `root === "/" ? rendered + ".md" : normalizePath(root + "/" + rendered + ".md")`; 路径函数内部对 `settings.pathFormat || DEFAULT_SETTINGS.pathFormat`、`attachmentMode || "diary"` 做兜底(与 3179 `diaryFolder || "日记"` 同款, 不押在 onload 的 Object.assign 上——bindtest 里真 writer 用例是直接造 settings 对象的)。默认值渲染结果与现在逐字相同。
- **附件路径函数保持同步**: `attachmentPath(day, ext)` / `attachmentPathNamed(day, origName)` 签名与返回不变(diary/custom 都能同步算出; 现有 7 条同步断言与 6 处按名字挂的桩原样有效); `custom` 模式取 `renderPath(attachmentFolder, day) + "/" + fileName`。
- 新增 **async `resolveAttachmentPath(day, path)`**: 非 `obsidian` 模式原样返回; `obsidian` 模式取 basename 调 `app.fileManager.getAvailablePathForAttachment(basename, diaryPath(day))`(官方 API, 1.5.7 起, `minAppVersion` 1.11.4 够; 它**自建父目录并对撞名自动去重**——v1 写反了)。五处调用点(writeImage 3360/3363、_writeVoiceEntry 3869、_writeVoiceFallback 3922、_writeFileItem 3966)各加一行 `path = await this.writer.resolveAttachmentPath(day, path)`; 3363 的同分钟重摇循环保留同步调用。三模式跑同一段代码(obsidian 模式下 `getAbstractFileByPath` 必为 null, 重试循环天然不进)。
- **共用模式 + obsidian 模式**: 接口对不存在的 sourcePath 会退到库根目录(Obsidian 源码: 拿不到 TFile 置 null, `./`/`./子目录` 设置就落到根)。所以调接口前 `vault.getFileByPath(diaryPath(day))` 为空时先 `_createDayFile(day)`(§4.3, 带模板, 不写节), 再算路径、createBinary、追加块。
- **语音气泡识别改成只看文件名**(4927 现写死 `attachments/\d{4}/` 前缀): `/(^|\/)\d{4}-\d{2}-\d{2}-\d{4}-语音(?:-[0-9a-f]{4}| \d+)*\.wav$/`——仍锚定本插件完整文件名(「英语语音作业.wav」不误伤), 兼容 Obsidian 撞名后缀「语音 1.wav」; 4916 的 `[src*="-语音"]` 预筛不动。README「保存语音原声」注明气泡跟文件名走、与附件位置无关。`fileMd5s` 存 vault 全路径, 改模式后老条目仍有效, 不改。
- 与 #14 的衔接: 根目录以后从"固定 diaryFolder"变成"当前分区", 格式与附件设置全局共用; 本轮把根目录作为显式参数传进路径函数, #14 只改传参。

## 4. 共用文件模式(`sharedDailyNote` = 开)

### 4.1 节的定义(`locateSection(content, heading)`, 可直接编码)

- 逐行按 `\n` 扫描(行尾允许 `\r` 与空白)。维持 `inFence` 状态: 以 ``` 或 `~~~` 开头的行翻转; inFence 时既不匹配我们的标题也不当终止标题。文件以 `---\n` 开头 → 先跳到闭合 `---` 之后再扫(frontmatter 里的 `# ` 不算); **没有闭合行则不视为 frontmatter, 从头扫**(否则整个文件被跳过)。标题比对用字符串等值或 `escapeRegExp` 后的正则——标题文字里有 `.` `(` 等正则字符(「随手记(工作)」)时不能直接拼正则。
- 节标题行 = `## ` + `sectionHeading`(精确, 允许尾随空白)。**第一个**匹配的算数。
- 返回 `{ headingStart(标题行行首), bodyStart(标题行换行之后), bodyEnd(下一个任意级别标题行 `^#{1,6} ` 的行首, 或文件长度) }`, 或 `null`。**任意级别标题都截断**——§4.2 的转义保证插件自己永不写任何级别的标题行, 所以不损失功能; 而用户把节固定在文件中间后在节后写 `### 备注`, 不截断就会被「撤回」删掉。
- 节的范围 = `[headingStart, bodyEnd)`, 节后的空行归节内。
- `spliceSection(content, loc, newBody)`: 写回 = 前段 + (前段非空且不以 `\n` 结尾则补 `\n`) + `\n` + 标题行 + `\n` + 新正文(rstrip 后补单个 `\n`; 正文为空则什么都不补) + (后面还有内容则再补一个 `\n`) + 后段。可验证的承诺: **`bodyEnd` 之后的内容逐字节不动; 标题前允许多一个空行**。
- 交给 `fn` 的 body: 先做 `\r\n`/`\r` → `\n` 归一化(用户文件来自 Windows/autocrlf/同步盘时 CRLF 真实存在, 不归一化 `countMessages` 永远是 1、「撤回」一次删光整节——驳斥者在真 writer 上实测), 再去尾部空行、留单个 `\n`。写回节内用 LF, 节外字节不碰。独立模式不做归一化(零影响; 独立文件被 autocrlf 改过的隐患记停车场)。

### 4.2 写入/计数/撤回/封存全部只看节正文(`_editDay(day, fn, { create })`)

- 独立模式: 就是现有 `_transform`(3270), 一字不改; 返回全文。
- 共用模式: 读文件 → `locateSection` → `fn(body)` → `spliceSection` 写回(`vault.process`); **返回节正文**。四个调用点(write 3336 / writeAttachment 3238 / appendLinkBlock 3251 / writeImage 3380)的 `countMessages` 与 `includes(CLOSING_MARKER)` 只看这个返回值——否则 Roy 每日笔记上面 20 个自己的段落会让第一条回执报「第 21 段」, 送达确认信号(D9)就崩了。
- **只有 `_appendBlock` 传 `create: true`**: 文件不存在 → §4.3 建; 文件存在没有节 → 在文件末尾追加(空行 + 标题行 + 正文)。**undo / finalizeDay / countDay 在文件不存在或没有节时直接返回现状**(`ok:false` / `empty` / 0), 不建文件、不建节、不套模板——否则昨天用户手写了一天没发微信, 今早跨天封存就往昨天的每日笔记里塞一个空 `## 微信随手记`, 甚至替昨天套模板建一篇。`fn` 产出与 body 相同 → 不调 process 不落盘(免得改 mtime 触发同步盘)。
- **写入**: `canMergeIntoLastHeader(body, ts)` 在正文上判; body 为 "" 时产出 `**HH:MM**\n\n块\n`——**不带 frontmatter、不带 `# 日期` 标题**(文件是用户的, 头部归用户), 首尾空行交给 spliceSection 收口。
- **计数**: `countMessages(body)`; 「在吗」「提醒」「晚安」据此。
- **撤回**: 正文内删最后一条消息块 + 孤儿段头, 封存行保留规则同现状(D9); **正文撤到空时只清正文, 标题行留着**(spliceSection 写成标题行 + 单个换行)——标题可能是用户写在模板里的(固定位置的正规用法), 删它就是动用户内容, 而且下一条会跑到文件末尾。与独立模式撤光后保留 `# 日期` 的现状同构(bindtest【29】已断言)。空节对 finalizeDay 就是 empty, 无害。
- **封存**: 封存标记追加在正文末尾(节内), 不是文件末尾。
- **跨天 `_loadOrReset`**: `finalizeDay(entered_date)` 按格式定位昨天的文件, 按上面的"不建"规则走。
- **转义(只在共用模式)**: 挂在 `_appendBlock`(3287, write/writeAttachment/writeImage/appendLinkBlock 四条路的唯一汇合点)对整个 block 做: 任何一行以 `#`×1–6 + 空格开头 → 行首加 `\`。**独立模式 3319 一字不动**(v1 写"两种模式都生效"违反零影响: 老用户两行消息第二行 `## 计划` 0.3.1 原样存, 不能变成 `\## 计划`)。挂在 `_appendBlock` 而不是 `write()`, 是因为语音原声块的转写文字走 `writeAttachment` 的 textAfter(3236–3240)不经 write。`#hashtag`(无空格)不受影响。
- 用户自己在节里手写的内容: 插件当成自己的(计数、可能被撤回)。规则一句话: "这一节归插件, 节下面写任何标题就算节结束", 写进帮助与 README。
- 用户改了 `sectionHeading` / 手改文件里的标题级别: 旧标题下的内容找不到 → 新建一节; 不迁移。

**独立模式的"外来文件"护栏(B1, 两种模式的边界)**: 开关关着但路径指向用户自己的每日笔记(试完开关又关掉; 或只配路径不开开关)时, 独立模式会把用户文件当成自己的——`countMessages` 把用户每个空行块数成段, 「撤回」撤光我们的内容后再撤就删 `## 微信随手记` 行、再撤删用户自己的段落。护栏: 独立模式下文件存在、非空、frontmatter 没有 `source: wechat-diary`(020/019 建的文件都有, 空文件补全的也有, 是可靠的"我们建的"标记)→ 写入照常追加(内容优先记下), 但 `undoLastBlock` 拒绝并回执「这个文件不是插件建的, 撤不了, 请到 Obsidian 里手动删」, `countDay` 只数我们段头之后的块, `finalizeDay` 段头之后有块才封存(封存行仍在文件末尾), 段数只数段头之后; 没有块不落笔——否则会往用户昨天的每日笔记里塞封存行, 且「在吗」0 段与「晚安」3 段自相矛盾(审查轮 Z2)。有 `source: wechat-diary` frontmatter 的老文件永不触发; **但 0.3.1 的「打开今天的日记」命令建的空文件被用户先手写过的(没有 frontmatter)会命中**(审查轮 Z1 证实), 所以护栏不能整文件拒绝: 只有我们段头之后没有块才拒, 有块照撤(全文最后一个块必在段头之后, 只删它, 结果与 0.3.1 字节一致), 回执不断言归属(「这个文件里没有微信记的内容可撤」)。**设置页提示**: 关开关或保存 pathFormat 时用今天的渲染路径探测, 命中不是插件建的文件 → 弹确认「路径仍指向你的每日笔记, 关掉后插件会把它当自己的文件(撤回会被拒绝); 要改回默认路径吗」+「改回默认」按钮(导入按钮记住导入前的值)。

### 4.3 文件不存在时(`_createDayFile(day, body)`, 只在 `_appendBlock` 的 create 路径与 §3/§4.6 的"先建文件"路径用)

- **一次 `vault.create`**: 读模板(有则渲染, 无则空串) → 在渲染结果上跑 `locateSection`: **模板本身已含同名标题**(固定位置的正规用法)→ `spliceSection` 把正文填进去; 无节 → 末尾追加 → 一次写入。不做"创建再追加"两步(会产出两个同名标题, 第一条消息从此不计数、撤不到)。
- `create` 抛「已存在」(TOCTOU): 改用共用模式的普通 splice fn 对现有内容 `process`; **模板只在 create 路径用, 永不进 process**。
- **文件存在但内容为空**(Templater/Calendar 刚建的壳): 按"文件存在、无节"处理, **不套模板**——壳是别人建的, Templater 马上会来填, 我们套只会撞。独立模式对空文件补 frontmatter 的现状不动。
- **Templater 竞态**: 它的「新文件创建时触发」监听 vault create 事件不分创建者, 延迟约 300ms 后 read → modify 整篇写回; 单条消息的 create 在 300ms 内没事, 但用户连发时第 2/3 条在它 read→modify 窗口内追加就被写回的快照抹掉, 回执却已说「记下来啦」(模板里有 `tp.system.prompt` 这类慢命令时窗口是秒级)。对策: **只在"本次由插件建了文件"这条路径上**, create 后约 1.5s `cachedRead` 复核一次, 节里找不到刚写的块(按块原文比对)就再走一遍 `_editDay` 幂等补写; 不是每次写入都复核。**复核清单**(审查轮修订): 文件是插件建的(带正文建, 或 obsidian 附件模式先建壳再追加)之后写进节里的**每一块**都登记, 最后一次写入 1.5s 后读一次文件, 缺哪条按原顺序补哪条(连发只复核一次; v1 只盯第一块会让窗口内的第 2/3 条静默丢)。窗口内被「撤回」的块从清单移除不补(谷雨终审抓出的"补回已撤的块"); 「撤回」时节已被抹掉的, 补回时丢掉最后一条; 封存不作废, 补回后再补封存行(v1 的"任何撤回/封存都作废"会把「第一条+晚安」积压批次的第一条丢掉)。补回时 Obsidian 侧 Notice。不用 `_writeGen`(普通写入也 ++, 连发第 2 条就会让复核作废)。README「诚实的限制」直说: 装了 Templater 新建触发器的, 插件建的当日文件会被它再处理一遍, 插件写完 1–2 秒复核补回。
- 模板渲染 `renderTemplate(tpl, day, now, title)`: 占位符 `{{title}}` `{{date}}` `{{time}}` 及带格式的 `{{date:FMT}}` `{{time:FMT}}`(官方文档核过: 核心 Templates/Daily notes 支持的就这三个, 默认 `YYYY-MM-DD` / `HH:mm`); 正则 `\{\{(date|time)(?::([^}]*))?\}\}` 让 `{{time:HH:mm}}` 的冒号只切第一个; `date` 用逻辑日, `time` 用当下, `title` = 文件名不含扩展名。**动手前在生产库 开核心插件建一篇逐个对拍**, 结果回填这里。
- 模板文件不存在/读失败: 按"没有模板"建文件(发出去=记下了优先), 微信回执照常, 但 **Obsidian 侧 Notice「每日笔记模板没找到: <路径>」+ 设置页 templatePath 的 desc 标红**, 不能只 console.warn(否则微信先到的每一天都静默丢模板)。

### 4.4 一天的边界

插件按逻辑日(凌晨 `dayStartHour` 点切, 默认 4, 契约 v1.2)选文件; 核心每日笔记按零点切。凌晨 1 点发的消息进"昨天"的每日笔记。**B2 定案**: 开关开着时设置页露出「一天从几点开始」(§2), 默认仍 4, 想和每日笔记对齐的填 0; 不开开关的用户不受影响。README 写明。§4.5 的回执带逻辑日日期, 落错天一眼能看出。

### 4.5 文案变化(只在共用模式; 「微信随手记」处一律用配置值 `sectionHeading`)

| 现状 | 共用模式 |
|---|---|
| `今天的第一条记录, 已经记录在新开的文件里啦 📖` | `今天的第一条记录, 记进 2026-08-27 的每日笔记「微信随手记」一节了 📖`(日期 = 逻辑日: 凌晨落进"昨天"时一眼能看出, 不能说"今天的每日笔记") |
| 跨天 `(昨天的已自动收尾, 翻开新的一页 📖)` | `(2026-08-27 的已自动收尾 📖)` |
| 欢迎语 `记的东西在 Obsidian 的「日记」文件夹; 想换地方: …` | `记的东西在你每天的每日笔记里, 「微信随手记」这一节; 想换地方: Obsidian 设置 → 第三方插件 → WeChat Diary` |
| 帮助末段 | 加一句 `「微信随手记」这一节归插件管: 撤回、段数都只看这一节; 节下面写任何标题就算节结束` |

其余回执(记下来啦/撤回/晚安/在吗)不变。

### 4.6 「打开今天的日记」命令(4655–4663)

现在直接 `openLinkText(diaryPath(今天))`, 文件不存在时 Obsidian 新建空文件。共用模式下这就是用户的每日笔记: 空文件一建, 核心插件不再套模板, 我们按 §4.3 也不套——自己的命令制造了要防的"每天丢模板"。改: 共用模式下文件不存在 → 先 `await _createDayFile(day)`(带模板, 不写节)再打开; 独立模式不变。不转调核心的 daily-notes 命令(零点 vs 逻辑日会打开不同文件)。

### 4.7 与「切换文件夹」(#14)的关系

本轮开关只管默认日记; 分区永远是独立文件夹里的独立文件, 路径格式与附件设置全局共用。"分区也各写进每日笔记的一节"记进停车场。#14 终稿 v3 的 §3/§5.5/§7 在本轮落地后改几句(根目录参数化、附件"同根"判定改为"同一附件目录"), 状态机与文案不变。

## 5. 数据契约 v1.4

- 路径布局是**默认值**: `根目录/YYYY/YYYY-MM-DD.md` + `根目录/attachments/YYYY/`; 用户可改格式(moment)与附件位置; 读取方需从 data.json 的 `settings.diaryFolder / pathFormat` 推路径, 或按 frontmatter `source: wechat-diary` + `date` 全库识别。**019 只支持默认布局, 路径可配是 020-only。**
- **共用文件模式**: 插件不独占文件, 而是独占已有文件里以 `## <标题>` 开头的一节(标题以 `settings.sectionHeading` 为准, 默认「微信随手记」; 读取方先读该配置或按 `## <标题>` 全库搜索); 节的范围到下一个**任意级别**标题行或文件末尾(代码围栏内不算); 节内格式与独占文件完全一致(段头/块/封存行), 但**没有 frontmatter 和 `# 日期` 标题**, 日期取自所在文件的每日笔记日期; **节标题一旦存在插件不删**。
- 转义: **共用模式下**写入方对节内任何 `^#{1,6} ` 行加 `\` 前缀; 独立模式规则不变(仅首行 `# `)。读取方: 行首 `\#` 视为原文 `#`; 旧文件与 019 产出不保证此规则。
- 按 D6 同步到 019 的副本。

## 6. 改动面

- `DEFAULT_SETTINGS` + `pathFormat / sharedDailyNote / sectionHeading / templatePath / attachmentMode / attachmentFolder`(默认值渲染结果与现状逐字相同; 路径函数内部再兜底一次)。
- 纯函数(全部 `__internals` 导出, 表驱动测): `renderPath / validatePathFormat(白名单+366 天唯一) / normalizeHeading / locateSection / spliceSection / normalizeNewlines / escapeHeadingLines / renderTemplate`。
- `DiaryWriter`: `diaryPath` 支持 `/` 根目录与 pathFormat; `attachmentPath / attachmentPathNamed` 同步不变 + `custom` 分支; 新增 async `resolveAttachmentPath`; `_editDay(day, fn, {create})` 统一入口, 独立模式即现有 `_transform`; `_createDayFile(day, body)` 一次 create + TOCTOU 兜底 + 复核补写; `write / writeImage / writeAttachment / appendLinkBlock / undoLastBlock / finalizeDay / countDay` 改走 `_editDay`, 共用模式看节正文。
- `DiaryAgent`: `_welcome()` / 开页前缀 / 跨天语按模式换文案(§4.5); UNDO 分支接护栏回执(B1); 其余不动。
- `DiaryWriter` 独立模式: `_isForeignFile(content)`(frontmatter 无 `source: wechat-diary`)→ undo 拒绝 / countDay 只数段头后的块(B1)。
- 语音气泡正则(4927)改文件名锚定; 「打开今天的日记」命令(4655)共用模式先建文件。
- 设置页: 「日记」区块加 §2 的项, 开关关着时 `sectionHeading / templatePath / 导入按钮 / dayStartHour` 隐藏(`display()` 重绘); 「附件位置」下拉; `pathFormat / attachmentFolder` 实时预览行(B3); `sectionHeading` 剥 `#` 带 Notice; 关开关/保存格式时的外来文件确认弹窗(B1); 「提醒时间」desc 动态。
- `makeApp` 桩补 `fileManager.getAvailablePathForAttachment / metadataCache.getFirstLinkpathDest / internalPlugins / plugins`; obsidian 桩补 `moment`(**实现 `[..]` 字面量, 白名单外的字母替换成可见占位 `?`**, 让"Assets 不括起来"在测试里也失败)——要在真 writer 用例【29】之前生效。
- README: 「功能」加两行; 「数据格式」段更新(示例路径带方括号); 「诚实的限制」加 Templater 再处理+复核、4 点边界、编辑器中写入、**同步冲突面变大**(共用模式下同一文件手机也在编辑: Obsidian Sync 会合并, iCloud/坚果云等出"冲突副本"时插件在副本里找不到节, 那天的内容可能留在副本里, 插件解决不了); 「保存语音原声」注明气泡跟文件名。契约文档 v1.4; docs/00-decisions.md 加 D13。
- **测试**:
  - **零影响硬证据**: 新增黄金文件回归——用 BOUND_DATA 形状(0.3.1 的 data.json, 无新字段)起真插件 + fakeVault, 跑一天脚本(文字、两行含 `## ` 的文字、语音原声块、图片、晚安、撤回、跨天封存), `diaryPath / attachmentPath / attachmentPathNamed` 返回值与整个文件内容和从 0.3.1 实跑抓下来的**硬编码字面字符串**逐字节比较(现有 405 断言的 stubWriter 不经过路径层, 不能当证据); 发版前在生产库 用 0.3.1 的 data.json 原样启动, 当天文件 diff 为空。
  - 纯函数: 格式校验(白名单/366 天唯一/`..`/尾 `.md`/非法字符/`[Assets]` 合法而 `Assets` 不合法/`YYYY/MD` 被拒)、renderPath(根目录 `/`)、locateSection(节在末尾/在中间后接用户标题/**三级标题也截断**/节后紧跟含 `# ` 行的代码块/frontmatter 里的 `# `/标题重复取第一个/无节/CRLF)、spliceSection(节外逐字节不变; 节后三个空行再接用户标题; 三种文件结尾各一条)、escapeHeadingLines(`#hashtag` 不动)、renderTemplate 三占位符含格式与 `HH:mm` 冒号。
  - 真 `DiaryWriter` + fakeVault(535 起已有): 共用模式下——文件不存在无模板/有模板/模板已含同名标题(只有一个标题且消息在其下); create 第一次抛错 → 最终只有一个标题; fakeVault 加 create 后异步 modify 覆盖的钩子模拟 Templater → 块被补回; 文件存在无节(追加到末尾, 用户内容不动); 文件存在但空(不套模板); 节在中间(写入不动后面的用户标题); 文件里先有 3 段用户内容 + 用户标题再写第一条 → n===1 且回执带开页前缀; 撤回只删节内、后面用户内容逐字节保留; **撤到空只剩标题, 前后用户内容不变**; 封存行在节内; 有用户内容无节的文件上跑 undo/finalize/countDay → 文件字节不变; countDay 只数节内; 用 writeAttachment 发 textAfter 第二行 `## x` 的语音块 → 节没被截断; 全 CRLF 文件写两条 → n===2, 撤回只删一条, 节外仍是 CRLF; 附件三模式(含 obsidian 模式先建文件); 语音气泡正则 custom 路径与「 1」后缀; **外来文件护栏**: 独立模式 + 无 `source` frontmatter 的用户文件 → 写入追加成功、撤回被拒且文件字节不变、countDay 只数我们的块; 有 frontmatter 的老文件行为不变。
  - **生产库手测清单**(fakeVault 覆盖不到): ①核心每日笔记模板占位符逐个对拍; ②Obsidian 四种附件设置 × 当日文件已存在/不存在; ③**每日笔记在编辑器打开且在别的节连续输入时, 微信连发 3 条(含 1 张图)**: 打的字一个不少、三个块都在、编辑器无需手动 reload, Live Preview 与源码模式各一遍(契约注记 2026-08-11 的"vault.process 解决编辑器冲突"从未在这个场景实测过; 真出问题再考虑活动文件走 editor API 或复用复核补写); ④装 Templater 新建触发器连发 3 条。

## 7. 明确不做

- 适配用户模板结构(只固定追加一节); 代码块/callout 形式。
- Templater 模板处理(只做复核补写)。
- 搬迁已有文件 / 迁移旧标题下的内容。
- 分区(#14)的共用模式。
- 独立模式的 CRLF 归一化(停车场)。

## 8. 记录在案不改(审稿轮裁决)

- 用户手改文件里的标题级别 → 两节, 不丢内容; 设置说明已含"改标题只影响之后"。
- 同一天开关来回切: 今天已记的段落不跟着走; 设置说明加一句。关开关那半被"外来文件"护栏挡住(B1)。
- 撤回预览里带反斜杠: 现状对 `\# ` 已如此, 接受。
- `fileMd5s` 复用表: 老条目仍有效、复用时引用旧位置, 不改。
- 独立模式的 CRLF 隐患: 30+ 天没报过, 改它就不是零影响, 停车场。
- Periodic Notes: 导入按钮顺手支持(同三字段, 零成本); 其余不特殊处理。
- 凌晨 0–4 点的行为本身: 契约 v1.2 不挑战, 只做 §4.5 带日期回执 + B2 的 UI 决定。
- 核心每日笔记把 `{{title}}` 渲染成完整格式串(含路径斜杠, `# 2026/08/2026-08-31`), 我们渲染文件名(`# 2026-08-31`)——测试库对拍发现(8/31), 我们的更合理, 保持, 记录在案。
- 共用模式下每日笔记插件仍会自己建它设置里的文件——只要用户对齐了位置(做法一保证)两边就是同一个文件; 不对齐会出两棵树, 这正是自动对齐要防的。
- 改 pathFormat 当天的效应(在吗说 0、撤回撤不到): 驳倒——"已有文件不搬"一句 + 老文件仍在, 用户自救成本低。
- 老用户里若有人早已把 Daily Notes 指到 `日记/YYYY/YYYY-MM-DD`(文件没有 `source: wechat-diary`), 护栏会让「撤回」从"能删(会误删他的内容)"变成"拒绝并说明": 是行为变化, 但更安全, 记录在案。
- 与语言相关的令牌(`MMM` `dddd`)随 Obsidian 界面语言渲染, 换语言后路径变、新建文件——核心每日笔记同样如此, 不特殊处理; 预览行能看见。纯数字令牌固定 en 地区(ar/fa/hi 界面下 moment 会换本地数字, 默认路径必须与 0.3.1 逐字节相同)。
- 节标题之前有未闭合围栏(用户正在编辑器里敲代码块)时找不到节, 会在末尾另建一节, 不丢内容, 用户闭合后手动合并。
- 模板里节标题下的占位文字会被第一条消息替换(设置说明写明「标题下面留空」)。
- frontmatter 未闭合时, 之后第一个 `---` 行当闭合(与 Obsidian 一致); 文件以 BOM 开头且节标题在首行时匹配不到, 末尾另建一节——两者都是用户文件已经写坏, 不丢字节。
- 独立模式 + 附件「跟随 Obsidian」: 当天文件不存在时先建空文件再算路径(否则接口退到库根), 与共用模式同理。

## 9. 审稿轮抛出的 3 道选择题——谷雨 2026-08-29 拍板

**B1 开关关着、路径却指向用户每日笔记 → 护栏 + 设置页提示都做。** 场景: 试完开关又关掉, 或只配路径不开开关——独立模式会把用户文件当自己的, 「撤回」最终删到用户自己的段落, 是本轮唯一一条"开关关着也会动用户内容"的路径。定案见 §4.2 末段: frontmatter 无 `source: wechat-diary` 的文件写入照常、撤回拒绝并说明、计数只数我们的块; 关开关/保存格式时探测到外来文件弹确认并给「改回默认」。老用户永不触发。

**B2 一天的边界 → 开关开着时露出「一天从几点开始」设置项, 默认仍 4。** 共用模式下零点后的内容进昨天那份每日笔记, 只靠手改 data.json 非开发者没路; 自动切成 0 会让提醒窗口静默变化, 不直白。定案见 §2 / §4.4。

**B3 路径格式校验的呈现 → 输入框下方实时预览。** 格式串没有形状可判, 每键 Notice 会刷屏; 预览是唯一能让用户在保存前看见结果的形态, 乱码(`Assets` 不括起来)也在用户眼前现形。定案见 §2 校验第 4 条。附件"文件夹 + 子路径格式"的拆分不做(单一格式串 + 预览已够直白)。

## 10. 版本与灰度

0.4.0: 本轮。0.5.0: 切换文件夹(#14)。发版时机与站外通知(GitHub issue 回复)由谷雨定。

**建议的灰度(待谷雨定)**: 本轮改的是所有写入路径, 是 0.3.0 以来最大改动。先打 `0.4.0-beta.1` 的 Release(三件套照发)但 **main 上的 manifest.json 不 bump**——商城只看 main 的 manifest, 200 个装机的人看不到; 在 issue #1 请 Roy 用 BRAT 装预发布版, 共用模式在他真实的库里跑几天(他的模板/Templater/附件设置是我们造不出来的), 谷雨自己的 生产库 用 0.3.1 的 data.json 跑同一版验零影响; 都没问题再 bump manifest 正式发 0.4.0。

## 附: 审稿人看代码的入口(main.js)

- 块解析 `HEADER_RE_G / canMergeIntoLastHeader / isMessageBlock / countMessages` 3141–3173
- `DiaryWriter` 3175–3457: `diaryPath` 3178, `attachmentPath` 3184, `attachmentPathNamed` 3192, `writeAttachment` 3216(textAfter 3236–3240), `_ensureParents` 3258, `_transform` 3270, `_appendBlock` 3287, `write` 3308(首行转义 3319), `countDay` 3342, `writeImage` 3354(重摇循环 3363), `undoLastBlock` 3385, `finalizeDay` 3430
- `DiaryAgent._loadOrReset` 3825, `_welcome` 3819, `_writeVoiceEntry` 3869, `_writeVoiceFallback` 3922, `_writeFileItem` 3966, `welcomeText` 2457, `FIRST_OF_DAY_PREFIX` 2586, `HELP_TEXT` 2473
- 语音气泡 `_voiceBubbleFor` 4922(正则 4927, 预筛 4916); 「打开今天的日记」命令 4655–4663
- 设置页 4421–4575(「日记文件夹」输入即搜索 4463–4490, 提醒时间校验 4497–4515); `DEFAULT_SETTINGS` 2363; `DEFAULT_DATA` 4578
- obsidian 导入 2331(`moment` 需加进解构); 测试 tests/bindtest.js(`makeApp` 60, `stubWriter` 196, `fakeVault` 535, 真 writer 用例 549 起, 【29】【33】【34】)
