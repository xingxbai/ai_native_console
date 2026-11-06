import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

const State = Annotation.Root({
  orderId: Annotation<number>,
  queries: Annotation<number>({ reducer: (old, next) => old + next, default: () => 0 }),
});

function createGraph(checkpointer: MemorySaver) {
  return new StateGraph(State)
    .addNode("recordQuery", () => ({ queries: 1 }))
    .addEdge(START, "recordQuery")
    .addEdge("recordQuery", END)
    .compile({ checkpointer });
}

// 演示身份由服务端持有；thread_id 只负责定位状态，不代表访问权限。
const owners = new Map([ ["tenant-a:order-123", "alice"] ]);
function configFor(threadId: string, actor: string) {
  if (owners.get(threadId) !== actor) throw new Error("无权访问该线程");
  return { configurable: { thread_id: threadId } };
}

const memory = new MemorySaver();
const graph = createGraph(memory);
const thread = configFor("tenant-a:order-123", "alice");

if (process.argv[2] === "inspect") {
  console.log("独立进程读取:", (await graph.getState(thread)).values);
  process.exit(0);
}

await graph.invoke({ orderId: 123 }, thread);
await graph.invoke({ orderId: 123 }, thread);
console.log("同线程:", (await graph.getState(thread)).values);

// 另一线程没有 checkpoint；即使知道线程 ID，未经授权也不能读取。
const otherThread = { configurable: { thread_id: "tenant-a:order-124" } };
console.log("另一线程:", (await graph.getState(otherThread)).values);
try {
  configFor("tenant-a:order-123", "bob");
} catch (error) {
  console.log("越权:", error instanceof Error ? error.message : String(error));
}

// 新建 checkpointer 等价于失去当前进程内存；它无法读取旧状态。
const restarted = createGraph(new MemorySaver());
console.log("新内存实例:", (await restarted.getState(thread)).values);
