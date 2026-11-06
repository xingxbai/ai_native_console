"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge, Background, Controls, Handle, MiniMap, Position, ReactFlow,
  useEdgesState, useNodesState, type Connection, type Edge, type Node, type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type StepType = "query" | "approval" | "end";
type StepData = { label: string; stepType: StepType };
type StepNode = Node<StepData, "step">;

const names: Record<StepType, string> = { query: "查询", approval: "人工审批", end: "结束" };
const colors: Record<StepType, string> = { query: "#207a74", approval: "#af7028", end: "#52646b" };

// 画布只允许三种业务节点；Handle 决定节点能否作为连线来源或目标。
function Step({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className={`w-44 rounded-md border bg-white px-3 py-2 shadow-sm ${selected ? "border-[#207a74] ring-2 ring-[#b9ded9]" : "border-[#cbd7da]"}`}>
      <Handle type="target" position={Position.Left} />
      <div className="text-xs font-semibold" style={{ color: colors[data.stepType] }}>{names[data.stepType]}</div>
      <div className="mt-1 break-words text-sm font-medium leading-5">{data.label}</div>
      {data.stepType !== "end" && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

const initialNodes: StepNode[] = [
  { id: "query-1", type: "step", position: { x: 70, y: 140 }, data: { label: "查询订单状态", stepType: "query" } },
  { id: "approval-1", type: "step", position: { x: 340, y: 140 }, data: { label: "主管确认变更", stepType: "approval" } },
  { id: "end-1", type: "step", position: { x: 610, y: 140 }, data: { label: "完成", stepType: "end" } },
];
const initialEdges: Edge[] = [
  { id: "query-approval", source: "query-1", target: "approval-1" },
  { id: "approval-end", source: "approval-1", target: "end-1" },
];

export function WorkflowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StepNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [validation, setValidation] = useState<{ valid: boolean; issues: string[] } | null>(null);
  const selected = nodes.find((node) => node.id === selectedId);
  const nodeTypes = useMemo(() => ({ step: Step }), []);

  // 草稿变化后旧校验结果失效，避免用户把旧的“可发布”当成当前结果。
  useEffect(() => { setValidation(null); }, [nodes, edges]);

  // 连线编辑只做即时交互约束；完整图校验和发布属于 Day 27。
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const source = nodes.find((node) => node.id === connection.source);
    return Boolean(source && connection.target && connection.source !== connection.target && source.data.stepType !== "end");
  }, [nodes]);

  const onConnect = useCallback((connection: Connection) => {
    if (!isValidConnection(connection)) { setNotice("不能连接到自身，也不能从结束节点发出连线"); return; }
    if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) return;
    setEdges((current) => addEdge(connection, current));
    setNotice("");
  }, [edges, isValidConnection, setEdges]);

  function addStep(stepType: StepType) {
    setValidation(null);
    const id = crypto.randomUUID();
    setNodes((current) => [...current, {
      id, type: "step", position: { x: 100 + current.length * 36, y: 80 + current.length * 28 },
      data: { label: names[stepType], stepType },
    }]);
    setSelectedId(id);
  }

  function removeSelected() {
    if (!selectedId) return;
    setNodes((current) => current.filter((node) => node.id !== selectedId));
    setEdges((current) => current.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId(null);
    setValidation(null);
  }

  // 只导出业务字段，避免把 React Flow 的视图内部状态当成执行协议。
  const workflow = { version: 1, nodes: nodes.map(({ id, position, data }) => ({ id, position, type: data.stepType, label: data.label })), edges: edges.map(({ source, target }) => ({ source, target })) };

  async function checkWorkflow() {
    try {
      const response = await fetch("/api/workflows/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(workflow) });
      setValidation(await response.json());
    } catch { setValidation({ valid: false, issues: ["校验服务暂不可用"] }); }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold">订单处理流程</h1><p className="mt-1 text-sm text-[#52646b]">草稿</p></div>
        <div className="flex flex-wrap gap-2">
          {(["query", "approval", "end"] as const).map((type) => <button key={type} type="button" onClick={() => addStep(type)} className="rounded border border-[#bdcbd0] bg-white px-3 py-2 text-sm hover:bg-[#eef4f4]">添加{names[type]}</button>)}
          <button type="button" onClick={checkWorkflow} className="rounded bg-[#173c42] px-3 py-2 text-sm text-white hover:bg-[#24545a]">检查流程</button>
          <button type="button" onClick={() => setShowJson((value) => !value)} className="rounded border border-[#bdcbd0] bg-white px-3 py-2 text-sm hover:bg-[#eef4f4]">{showJson ? "隐藏 JSON" : "查看 JSON"}</button>
        </div>
      </div>
      {validation && <div role="status" className={`mb-4 border-l-4 px-3 py-2 text-sm ${validation.valid ? "border-[#2d6847] bg-[#edf6ef]" : "border-[#a04237] bg-[#fdf0ee]"}`}>
        <strong>{validation.valid ? "结构检查通过" : "结构检查未通过"}</strong>
        {validation.issues.map((issue) => <div key={issue}>{issue}</div>)}
      </div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="h-[480px] min-w-0 overflow-hidden rounded border border-[#bdcbd0] bg-white sm:h-[600px]">
          <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} isValidConnection={isValidConnection} onNodeClick={(_, node) => setSelectedId(node.id)} onPaneClick={() => setSelectedId(null)} fitView deleteKeyCode={["Backspace", "Delete"]}>
            <Background color="#dce5e7" gap={20} /><Controls /><MiniMap pannable zoomable nodeColor={(node) => colors[(node.data as StepData).stepType]} />
          </ReactFlow>
        </div>
        <aside className="min-w-0 border-t border-[#dbe2e5] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <h2 className="text-sm font-semibold">节点设置</h2>
          {selected ? <div className="mt-4 space-y-4">
            <div className="text-xs text-[#52646b]">{names[selected.data.stepType]}</div>
            <label className="block text-sm">名称<input value={selected.data.label} maxLength={80} onChange={(event) => setNodes((current) => current.map((node) => node.id === selected.id ? { ...node, data: { ...node.data, label: event.target.value } } : node))} className="mt-2 w-full rounded border border-[#bdcbd0] bg-white px-3 py-2 outline-none focus:border-[#207a74]" /></label>
            <button type="button" onClick={removeSelected} className="rounded border border-[#c89b94] px-3 py-2 text-sm text-[#a04237]">删除节点</button>
          </div> : <p className="mt-4 text-sm text-[#52646b]">选择一个节点后可编辑名称。</p>}
          {notice && <p role="alert" className="mt-4 text-sm text-[#a04237]">{notice}</p>}
        </aside>
      </div>
      {showJson && <section className="mt-5"><h2 className="mb-2 text-sm font-semibold">工作流 JSON</h2><pre className="max-h-64 overflow-auto rounded border border-[#bdcbd0] bg-white p-4 text-xs">{JSON.stringify(workflow, null, 2)}</pre></section>}
    </div>
  );
}
