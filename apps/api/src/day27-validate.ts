import { validateWorkflow } from "./workflow-validation.js";

const nodes = [
  { id: "q", type: "query", label: "查询订单", position: { x: 0, y: 0 } },
  { id: "a", type: "approval", label: "确认变更", position: { x: 200, y: 0 } },
  { id: "e", type: "end", label: "结束", position: { x: 400, y: 0 } },
];
const edges = [{ source: "q", target: "a" }, { source: "a", target: "e" }];
const cases = [
  ["正常", { version: 1, nodes, edges }],
  ["环路", { version: 1, nodes, edges: [...edges, { source: "a", target: "q" }] }],
  ["缺失节点", { version: 1, nodes, edges: [...edges, { source: "q", target: "missing" }] }],
  ["旧版本", { version: 0, nodes, edges }],
  ["孤立节点", { version: 1, nodes: [...nodes, { id: "extra", type: "query", label: "无入口", position: { x: 0, y: 100 } }], edges }],
] as const;

// 课程命令直接调用与 HTTP 入口相同的服务端校验函数。
for (const [name, workflow] of cases) console.log(name, JSON.stringify(validateWorkflow(workflow)));
