import { streamDemoUserInfo } from "./demo-stats.js";

type DirectTool = {
  name: string;
  matches: (message: string) => boolean;
  stream: (signal: AbortSignal) => AsyncIterable<string>;
};

// 确定性命令在这里登记；新增同类工具无需修改 SSE 路由。
const directTools: DirectTool[] = [
  {
    name: "userInfo.json",
    matches: (message) => message === "返回用户信息",
    stream: streamDemoUserInfo,
  },
];

export function findDirectTool(message: string): DirectTool | undefined {
  return directTools.find((tool) => tool.matches(message));
}
