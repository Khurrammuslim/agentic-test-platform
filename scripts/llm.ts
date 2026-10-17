export const MODEL = process.env.LLM_MODEL ?? 'qwen2.5-coder:7b';
const ENDPOINT = process.env.LLM_URL ?? 'http://localhost:11434/api/chat';

export async function ask(system: string, user: string, _maxTokens = 2000): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { temperature: 0.2, num_ctx: 4096 },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  if (!data.message?.content) {
    throw new Error('Empty reply from LLM. Full response: ' + JSON.stringify(data));
  }
  return data.message.content;
}
