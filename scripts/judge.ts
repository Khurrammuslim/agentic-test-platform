import { ask } from './llm.js';

const [text, rubric] = process.argv.slice(2);
if (!text || !rubric) throw new Error('Usage: npm run judge -- "<text>" "<rubric>"');

const system =
  'You are a strict test judge. Reply with JSON only: {"pass": boolean, "reason": string}. Judge ONLY against the rubric.';
const raw = await ask(system, `Rubric: ${rubric}\n\n${text}`, 300);
const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
console.log(result);
process.exit(result.pass ? 0 : 1);
