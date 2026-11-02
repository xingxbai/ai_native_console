import { streamDemoUserInfo } from "./demo-stats.js";
import { readDemoOrders } from "./order-demo.js";

type DirectTool = {
  name: string;
  display: "json" | "markdown";
  matches: (message: string) => boolean;
  stream: (message: string, signal: AbortSignal) => AsyncIterable<string>;
};

async function* oneResult(value: Promise<string>) { yield await value; }

function orderId(message: string) { return Number(message.match(/订单\s*(\d+)/)?.[1]); }

// 确定性命令在这里登记；新增同类工具无需修改 SSE 路由。
const directTools: DirectTool[] = [
  {
    name: "userInfo.json",
    display: "json",
    matches: (message) => message === "返回用户信息",
    stream: (_message, signal) => streamDemoUserInfo(signal),
  },
  {
    name: "getOrder",
    display: "json",
    matches: (message) => /^返回订单\s*\d+\s*的完整数据$/.test(message),
    stream: (message, signal) => oneResult(readDemoOrders(signal).then(({ orders }) => {
      const order = orders.find((item) => item.id === orderId(message));
      return JSON.stringify(order ?? { error: "订单不存在" }, null, 2);
    })),
  },
  {
    name: "getOrderStatus",
    display: "markdown",
    matches: (message) => /^订单\s*\d+\s*现在是什么状态[？?]?$/.test(message),
    stream: (message, signal) => oneResult(readDemoOrders(signal).then(({ orders }) => {
      const order = orders.find((item) => item.id === orderId(message));
      return order ? `演示订单 ${order.id}：${order.status}` : "演示订单不存在。";
    })),
  },
  {
    name: "countTodayRefunds",
    display: "markdown",
    matches: (message) => /^统计今天有多少笔退款[？?]?$/.test(message),
    stream: (_message, signal) => oneResult(readDemoOrders(signal).then(({ orders, asOfDate }) =>
      `演示日期 ${asOfDate}：已退款 ${orders.filter((order) => order.status === "已退款" && order.refundDate === asOfDate).length} 笔。`)),
  },
  {
    name: "topRefunds",
    display: "markdown",
    matches: (message) => /^列出退款金额最高的\s*10\s*笔订单[？?]?$/.test(message),
    stream: (_message, signal) => oneResult(readDemoOrders(signal).then(({ orders }) => {
      const rows = orders.filter((order) => order.status === "已退款")
        .sort((a, b) => b.refundAmount - a.refundAmount).slice(0, 10);
      return ["演示数据，按退款金额降序：", "", "| 订单 | 退款金额（元） |", "| --- | ---: |",
        ...rows.map((order) => `| ${order.id} | ${order.refundAmount} |`)].join("\n");
    })),
  },
  {
    name: "ordersTable",
    display: "markdown",
    matches: (message) => /^把这份\s*JSON\s*转成表格[？?]?$/.test(message),
    stream: (_message, signal) => oneResult(readDemoOrders(signal).then(({ orders }) =>
      ["演示订单 JSON：", "", "| 订单 | 客户 | 状态 | 金额（元） |", "| --- | --- | --- | ---: |",
        ...orders.map((order) => `| ${order.id} | ${order.customer} | ${order.status} | ${order.amount} |`)].join("\n"))),
  },
];

export function findDirectTool(message: string): DirectTool | undefined {
  return directTools.find((tool) => tool.matches(message));
}
