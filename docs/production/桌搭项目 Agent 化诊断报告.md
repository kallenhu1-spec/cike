# 桌搭项目 Agent 化诊断报告

日期：2026-09-25

## 1. Agent 化程度判定

结论：当前项目大约属于“传统桌宠应用 + API 能力封装”，整体 Agent 化程度约 28%（可视为“传统应用/脚本型助手”而非“真正 Agentic 系统”）。

评估维度概览：

- 决策控制流：25%
- 状态机与记忆：35%
- 主动性与心跳：45%
- 能力解耦：20%
- 认知与反馈闭环：30%

综合判断：

- 有明确的时段/场景分层、定时提醒和本地记忆存储，说明系统已经具备“桌面陪伴”的基本状态管理雏形。
- 但缺少真正的 Agent 决策层：没有由 LLM/GM 根据上下文动态做任务规划、路由、异常判定和工具选择；也没有统一的 Agent Loop、FSM、Tool/Skill Registry 和回放审计。
- 目前更像是：本地脚本 + UI 状态 + 规则选句 + 调用模型/图像 API 的工作流，而不是“一个具备感知、决策、执行与自检的代理”。

## 2. 关键代码块诊断

### 2.1 决策控制流：硬编码而非动态 Agent Routing

源码证据：

- `src/core.cjs`
  - `eligible(state, date, idle)`：基于时间、静默时段、每日上限、最后说话时间和窗口约束筛选。
  - `choose(state, builtin, date, random, options)`：基于 `row.scenes`、`row.period`、`row.weekdays`、`m.blocked` 等硬编码条件筛选候选语句。
- `src/main.cjs`
  - `setInterval(() => speak(), 60000)`
  - `handle("image-generate", input => require("./seedream.cjs").generate(input))`
  - `handle("save", (input) => ...)`

诊断：

- 这不是 LLM 进行“我现在该做什么”的分发，而是静态规则判断。
- 代码的分支逻辑依赖 `if`、数组筛选、时间窗口和已定义字段，而不是基于上下文生成的计划。
- `prompt.cjs` 只生成一批离线建议，不承担运行时任务调度。

结论：

- 这是“规则驱动的内容选择逻辑”，不是 Agent 的动态路由器。

### 2.2 状态机与记忆：有状态，但缺乏显式 Agent Memory 分层

源码证据：

- `src/moments.cjs`
  - `SCENES` 定义了 `wake / morning / lunch / afternoon / evening / winddown / late`
  - `context(profile, date)` 根据时间和 rhythm 推断当前 scene
- `src/core.cjs`
  - `defaults()` 中定义 `memory.firstSeen`, `lastDay`, `dailyCount`, `recent`, `blocked`, `windows`, `lastTopic`
  - `record()` 负责记录事件历史（在现有代码中可见其记录行为被广泛使用）

诊断：

- 这已经有“状态机雏形”：时间片段、内容过滤、静默窗口都存在。
- 但它不是标准的 Agent FSM：没有 `Idle / Focus / Care / Listening / Acting` 这样的显式状态图，也没有状态进入/退出条件、动作约束和状态转移日志。
- Memory 也不算完整的 Agent memory：
  - 有 `recent`、`blocked`、`visits`，但没有明确的短期/长期/任务记忆拆分；
  - 没有上下文隔离层、记忆压缩、TTL、归档、审计；
  - 没有真正的 memory store 与 retrieval 冲突控制。

结论：

- 当前是“状态化脚本”，而非带记忆隔离和状态转移控制的 Agent。

### 2.3 主动性与心跳：有定时 tick，但仍偏被动式提醒

源码证据：

- `src/main.cjs`
  - `setTimeout(() => speak(), 12000);`
  - `setInterval(() => speak(), 60000);`
- `src/pet.js`
  - `setInterval(idleTick, 24000);`
  - `setInterval(refreshMoment, 15000);`

诊断：

- 这表明系统确实有“heartbeat / tick”机制：它会在后台不断更新场景、检查闲置状态并尝试发出提醒。
- 但它并不是 Agent 的“主动感知循环”：
  - 任务是固定的“按时发一句话”而不是基于环境变化动态制定任务；
  - 没有对用户状态进行结构化感知（如当前任务、情绪、桌面环境、声音状态、最近交互、提醒优先级）；
  - 没有从 tick 中构建一个持续观察与反思的世界模型。

结论：

- 这是“定时提醒型心跳”，不是主动 Agent 的感知与行动循环。

### 2.4 能力解耦：有功能层，但没有真正的 Skill/Tool Harness

源码证据：

- `src/seedream.cjs`
  - 生图模型调用。
- `src/voice-ai.cjs`
  - 本地语音/AI 引擎支撑。
- `src/prompt.cjs`
  - 文案生成模板。
- `src/art.cjs` / `src/motions.js`
  - 动画与动作功能。

诊断：

- 这些能力已经比较“模块化”，但它们的调用方式仍是直接的 `require()` 和 `handle()`。缺少统一的 Tool/Skill 层。
- 例如：
  - 不存在统一的 `Skill` 接口，例如 `select_best_moment()`, `generate_ip_asset()`, `animate_action()`, `check_prompt_quality()`；
  - 也不存在“工具可见性”、权限管理、输出 schema 校验和回退策略；
  - UI 里的按钮、动画和提醒仍是前端/后端静态逻辑驱动，而不是 Agent 调度出来的技能动作。

结论：

- 该项目已经有能力模块，但没有真正挂在 Agent Harness 上的 Skill 执行层。

### 2.5 认知与反馈闭环：有输入对象，但缺乏结构化感知和自检

源码证据：

- `src/core.cjs` 里 `validateLibrary()` 对内容库进行字段校验；
- `src/seedream.cjs` 有 `status()` 和 `generate()`；
- `src/pet.js` 里会刷新 moment、渲染 art、处理 `fivePhase` 等反馈；
- `src/main.cjs` 中 `image-pick`、`image-apply`、`voice-save` 等都执行了参数校验和结果回传。

诊断：

- 这说明项目有“输入校验”和“输出结果回流”的意识。
- 但真正的 Agent 认知闭环需要：
  - 结构化 Perception 层：用户状态、时间状态、桌面环境、交互上下文；
  - 评估层：判断当前动作是否合理、是否符合人设；
  - 审计层：输出前做 prompt / asset / action quality check；
  - 自纠正：基于失败/不匹配回滚重试或重新规划。

当前项目没有实现这些审计和更新闭环。

结论：

- 只有“字段验证”，没有“Agent 级自我审计与修正”。

## 3. 典型“硬编码 / 假 Agent”代码块

### 3.1 `src/core.cjs` 的 `eligible()` 与 `choose()`

这是最典型的“假 Agent”根源。

```js
function eligible(state, date, idle = 0) {
  const m = state.memory, s = state.settings;
  return (
    s.enabled &&
    !quiet(date.getHours(), s.quietStart, s.quietEnd) &&
    idle < 300 &&
    (m.lastDay === dayKey(date) ? m.dailyCount : 0) < s.dailyMax &&
    date.getTime() - m.lastAt >= s.interval * 60000 &&
    !(m.windows || []).includes(moments.budgetWindow(state, date))
  );
}
```

问题：

- 逻辑完全是线性规则判断；
- 没有 LLM 规划，也没有 context-aware decision；
- 没有“这时该说什么”与“当前情境是否适合提醒”的语义判定。

### 3.2 `src/moments.cjs` 的 `context()`

```js
function context(profile, date) {
  const minute = date.getHours() * 60 + date.getMinutes();
  let scene = minute < 360 || minute >= 1380 ? "late" : ...
  const rhythm = parseRhythm(profile.rhythm);
  if (rhythm) {
    if (mod(minute - rhythm.wake) < 90) scene = "wake";
    else if (mod(rhythm.sleep - minute) > 0 && mod(rhythm.sleep - minute) <= 60) scene = "winddown";
  }
  return { scene, ... };
}
```

问题：

- 只是时段推断，不是 agent-aware perception；
- 没有“用户当前在忙什么、环境处于何种状态、是否该安静”的真实感知；
- 更像一个 Time Context Engine，而不是认知 Engine。

### 3.3 `src/main.cjs` 的 `speak()` 和 `setInterval()`

```js
setInterval(() => speak(), 60000);

function speak(force = false, now = new Date(), excludeIds = [], preview = false) {
  const item = core.choose(state, builtin, now, Math.random, { preview: force, excludeIds });
  ...
  pet.webContents.send("speak", { ...item, voiceText: item.text, ... });
}
```

问题：

- 看起来像“有主动性”，但仍是固定生成/发言逻辑；
- 没有基于上下文的任务优先级和多工具协同；
- 没有更高层 Agent Loop 控制行为。

### 3.4 `src/seedream.cjs` 的 API 连接

```js
const response = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
  body: JSON.stringify({
    model: envValue("ARK_IMAGE_MODEL", DEFAULT_MODEL),
    prompt: imagePrompt({ purpose, style, action }),
    image: [referenceImage],
    ...
  })
});
```

问题：

- 这是功能能力调用，不是 Agent 规划；
- 它没有工具 schema、任务分解、计划回溯或生成质量判断；
- 它只是把能力“包起来”供 UI 使用。

## 4. 升级重构建议：把静态 Feature 改造成真正的 Agent Skill

下面给出 3 个具体重构步骤。核心目标：把“按钮/卡片/提醒/图像生成”从前端脚本改造成独立 Skill，由统一 Agent orchestrator 调度。

### 重构步骤 1：建立统一 Agent Runtime 与 FSM

Before：

```js
function speak(force = false, now = new Date()) {
  const item = core.choose(state, builtin, now, Math.random);
  pet.webContents.send("speak", { ...item });
}
```

After：

```js
class CompanionAgent {
  constructor(memory, tools, stateMachine) {
    this.memory = memory;
    this.tools = tools;
    this.stateMachine = stateMachine;
  }

  async tick(context) {
    const phase = this.stateMachine.current();
    if (phase === "idle") {
      const observation = await this.tools.observe(context);
      const plan = await this.tools.plan(observation, this.memory);
      if (plan.shouldSpeak) {
        return this.tools.speak(plan);
      }
    }
    if (phase === "focus") {
      return this.tools.respondToUserInteraction(context);
    }
  }
}
```

说明：

- 让 Agent 主循环统一接管：观测、决策、执行、回顾；
- 让 `Idle / Focus / Care / Listening / Acting` 等状态显式存在；
- 让 tool 调用和 spä error recovery 成为标准动作，而不是直接 UI 分支。

### 重构步骤 2：把功能拆成真正的 Skills / Tools

Before：

```js
handle("image-generate", input => require("./seedream.cjs").generate(input));
handle("prompt", () => require("./prompt.cjs")(state.profile));
handle("art", (input) => require("./art.cjs")(input));
```

After：

```js
const skillRegistry = {
  observeContext: async (ctx) => { /* 读取时间、动作、桌面状态、用户偏好 */ },
  buildCharacterAsset: async (photo, style) => { /* 生成角色母版 */ },
  generateMotionSpec: async (character, action) => { /* 生成动作语义和 keyframes */ },
  validateOutput: async (asset) => { /* 审计完整性和风格一致性 */ },
  speakCard: async (item) => { /* 选择文案并发出 */ },
};
```

说明：

- 每个能力都拥有 clear input schema + output schema + fallback；
- Agent 可以按需组合调用，而不是 UI 直接发起固定 API；
- 这样才是“Tool use / Skill orchestration”，而不是调用函数库。

### 重构步骤 3：增加 Perception + Audit + Self-Correction

Before：

```js
if (!row) return null;
pet.webContents.send("speak", { ...row });
```

After：

```js
const perception = {
  time: now,
  scene: moment.scene,
  idleMinutes: state.memory.lastAt,
  userMood: inferUserMood(state),
  lastInteraction: state.memory.lastTopic,
};

const plan = await agent.plan(perception);
const checked = await audit(plan, { rules: ["tone", "safety", "non-repetitive", "scene-fit"] });
if (!checked.ok) {
  return agent.retryWithFallback();
}
return execute(plan);
```

说明：

- 需要结构化感知：时间、情绪、桌面状态、最近任务、历史反馈；
- 需要审计：内容质量、动作合理性、角色一致性、不重复；
- 需要 fallback：若生成不合格，回退到更安全的静态动作或普通语句。

## 5. 最终结论

当前项目已经具备：

- 时间/场景状态管理；
- 定时 tick 与提醒机制；
- 本地记忆和偏好保存；
- 模型/图像/语音功能调用能力；
- 一定范围的组件解耦。

但它还不是“真正的 AI Agentic 架构”，因为：

- 决策仍是硬编码规则；
- 状态机不完整也未显式表达；
- 记忆没有长期/短期隔离与审计；
- Tool / Skill 仍是函数式调用，而非统一 Harness；
- 缺少感知、审计和自我修正闭环。

如果要把它升级成真正的桌搭 AI Agent，最低要求是：

1. 一个统一的 Agent Loop；
2. 一个显式 FSM；
3. 独立 Skill/Tool Registry；
4. 结构化 Perception 与 Audit；
5. 能力和动作与状态分层，形成稳定的体验闭环。

在当前代码基线下，最现实的判断是：

- 它是“有感知雏形的桌宠应用”
- 不是“真正挂载到了 Agent Harness 上的桌搭代理”

这也是为什么它能做到“好看有陪伴感”，但还不能被简单认定为成熟 Agent 系统。

## 6. 结论一句话

当前项目更像「规则驱动的桌面陪伴脚本 + AI API 能力层」，而不是「真实的 Agentic 桌搭系统」；它已经有状态、时间和模组能力，但还缺少统一的 Agent 决策、memory isolation、skill orchestration 与 self-audit。
