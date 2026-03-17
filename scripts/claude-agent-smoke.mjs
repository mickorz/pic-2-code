import { query } from '@anthropic-ai/claude-agent-sdk';

const mode = process.argv[2] || 'models';
const cwd = process.cwd();

const buildPrompt = [
  '你是一个只读测试代理。',
  '请在当前仓库中完成以下步骤：',
  '1. 使用 Read 读取 package.json 与 vite.config.ts',
  '2. 使用 Bash 运行 npm run build',
  '3. 最终只输出一个 JSON 对象，字段固定为 buildPassed summary warnings',
  '4. 不要修改任何文件',
].join('\n');

const extractAssistantText = (message) => {
  if (message.type !== 'assistant') return '';
  if (!Array.isArray(message.message?.content)) return '';

  return message.message.content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
};

const parseJsonBlock = (text) => {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

const listModels = async () => {
  const q = query({
    prompt: '',
    options: {
      cwd,
      maxTurns: 1,
      tools: [],
      permissionMode: 'plan',
      persistSession: false,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'pic2code/claude-models',
      },
    },
  });

  try {
    const models = await q.supportedModels();
    console.log(JSON.stringify({
      ok: true,
      count: models.length,
      models: models.slice(0, 20),
    }, null, 2));
  } finally {
    q.close();
  }
};

const runBuildSmoke = async () => {
  const q = query({
    prompt: buildPrompt,
    options: {
      cwd,
      maxTurns: 6,
      tools: ['Read', 'Bash'],
      allowedTools: ['Read', 'Bash'],
      permissionMode: 'default',
      persistSession: false,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'pic2code/claude-build-smoke',
      },
    },
  });

  let assistantText = '';
  let resultMessage = null;

  try {
    for await (const message of q) {
      const text = extractAssistantText(message);
      if (text) {
        assistantText += `${text}\n`;
      }

      if (message.type === 'result') {
        resultMessage = message;
      }
    }
  } finally {
    q.close();
  }

  const payload = {
    ok: resultMessage?.subtype === 'success',
    resultSubtype: resultMessage?.subtype || 'unknown',
    assistantText: assistantText.trim(),
    structured: parseJsonBlock(assistantText),
    errors: resultMessage?.type === 'result' && resultMessage.subtype !== 'success'
      ? resultMessage.errors
      : [],
  };

  console.log(JSON.stringify(payload, null, 2));

  if (!payload.ok) {
    process.exit(1);
  }
};

if (mode === 'models') {
  await listModels();
} else if (mode === 'build') {
  await runBuildSmoke();
} else {
  console.error(`不支持的模式: ${mode}`);
  process.exit(1);
}
