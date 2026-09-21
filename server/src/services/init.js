// 初始化模式核心：一次性强 prompt + 项目描述 + 成员分工 → 任务结构草案
// 设计约束（来自用户）：草案是"给人确认调整的建议，不是最终拍板"；
// 一次性结构化输出即可，不需要复杂推理链。
const llm = require('./llm');

// 从成员分工描述派生角色的 system_prompt（运行时该成员与 AI 协作的人格基础）
function deriveSystemPrompt(projectName, projectDesc, member) {
  return `你是科研协作平台中的 AI 协作伙伴，正在协助「${projectName}」项目的成员 ${member.name}。

【项目背景】
${projectDesc || '（暂无详细描述）'}

【该成员的分工】
${member.role_description}

【你的工作原则】
1. 只围绕该成员的分工提供帮助，不越界替其他成员做判断；
2. 给出的建议要可执行、可验证，避免空泛；
3. 涉及需要团队共识的结论时，提醒该成员向项目创立人确认后再生效；
4. 对话内容不会自动成为团队事实，重要结论需要明确提交并确认。`;
}

// 一次性生成任务结构草案
async function generateTaskDraft({ project, members }) {
  const memberLines = members
    .map((m, i) => `${i + 1}. ${m.name} —— ${m.role_description}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: `你是科研项目初始化助手。根据项目描述和团队成员分工，生成一份"任务结构建议草案"。

硬性要求：
1. 输出必须是 JSON 对象，不要输出任何额外文字；
2. 草案只是建议，供创立人确认调整，语气保持中立；
3. 每个任务必须尽量指派给最合适的成员（按名字引用）；
4. 任务数量 3-8 个，覆盖项目启动最关键的工作面；
5. 若有任何重要工作面无法匹配到现有成员，列入 unassigned_gaps。

输出 JSON 结构（严格遵守）：
{
  "tasks": [
    {
      "title": "任务标题（一句话，动宾结构）",
      "description": "要做什么、做到什么程度算完成（2-3 句）",
      "priority": "P0 或 P1 或 P2",
      "suggested_owner": "成员名字（必须来自成员列表，无法指派则为 null）",
      "match_reasoning": "为什么建议由这个人负责（一句话）"
    }
  ],
  "unassigned_gaps": ["未被任何成员覆盖的工作面描述"]
}`,
    },
    {
      role: 'user',
      content: `【项目名称】${project.name}

【项目描述】
${project.description || '（暂无详细描述）'}

【团队成员与分工】
${memberLines}

请生成任务结构建议草案。`,
    },
  ];

  // mock 模式的兜底草案：按成员轮转为每个成员生成一条建议任务
  const mockData = {
    tasks: [
      ...members.slice(0, 4).map((m, i) => ({
        title: `明确${m.name}负责方向的第一版产出`,
        description: `围绕「${m.role_description}」，形成一份可供团队评审的初步产出（文档或原型），并在例会上同步。`,
        priority: i === 0 ? 'P0' : 'P1',
        suggested_owner: m.name,
        match_reasoning: `该任务与其分工「${m.role_description}」直接对应。`,
      })),
      {
        title: '组织一次全组对齐会，确认任务边界',
        description: '全体成员过一遍本草案，确认各自认领的任务边界与交付时间，存在争议的当场调整。',
        priority: 'P0',
        suggested_owner: members[0]?.name || null,
        match_reasoning: '由项目创立人召集最为顺畅。',
      },
    ],
    unassigned_gaps: members.length < 2 ? ['团队人数较少，外部调研与用户验证工作暂无明确负责人。'] : [],
  };

  const result = await llm.chatJson({ messages, temperature: 0.4, mockData });

  // 兜底清洗：保证结构完整
  const data = result.data || {};
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  return {
    tasks: tasks.map((t) => ({
      title: String(t.title || '未命名任务').slice(0, 120),
      description: String(t.description || '').slice(0, 800),
      priority: ['P0', 'P1', 'P2'].includes(t.priority) ? t.priority : 'P1',
      suggested_owner: t.suggested_owner ? String(t.suggested_owner) : null,
      match_reasoning: t.match_reasoning ? String(t.match_reasoning).slice(0, 300) : '',
    })),
    unassigned_gaps: Array.isArray(data.unassigned_gaps) ? data.unassigned_gaps.map(String) : [],
    usage: {
      model: result.model,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
    },
  };
}

module.exports = { generateTaskDraft, deriveSystemPrompt };
