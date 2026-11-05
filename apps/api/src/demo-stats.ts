import { z } from "zod";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { fetchReadOnlyJson } from "./tool-execution.js";
const tasksSchema = z.array(z.object({
  userId: z.literal(1),
  completed: z.boolean(),
}));

export async function getDemoTaskStats(signal: AbortSignal) {
  // 公网演示接口只读；Node 端完成统计，只把汇总数字交给模型。
  const tasks = tasksSchema.parse(await fetchReadOnlyJson("https://jsonplaceholder.typicode.com/todos?userId=1", signal));
  const completed = tasks.filter((task) => task.completed).length;
  return { total: tasks.length, completed, pending: tasks.length - completed };
}

export async function getDemoUserInfo(signal: AbortSignal) {
  // ESM 中用模块地址定位文件；不要依赖不存在的 __dirname 或进程工作目录。
  const data = await readFile(new URL("./data/userInfo.json", import.meta.url), { encoding: "utf-8", signal });
  const parsed = z.object({ userInfo: z.object({ id: z.number(), name: z.string(), username: z.string() }) }).parse(JSON.parse(data));
  return parsed.userInfo;
}

export async function* streamDemoUserInfo(signal: AbortSignal) {
  // 按字符边界分块发送原始文件，避免把大 JSON 交给模型或一次性载入内存。
  const decoder = new StringDecoder("utf8");
  const stream = createReadStream(new URL("./data/userInfo.json", import.meta.url), { highWaterMark: 8192, signal });
  for await (const chunk of stream) {
    const text = decoder.write(chunk as Buffer);
    if (text) yield text;
  }
  const last = decoder.end();
  if (last) yield last;
}
