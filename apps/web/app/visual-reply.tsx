"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { visualSchema, type Visual } from "@ai-native-console/contracts";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

function Bar({ rows }: { rows: Extract<Visual, { type: "bar" }>["rows"] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const chart = echarts.init(container.current);
    // 模型只能提供标签和数值，图表配置始终由应用生成。
    chart.setOption({
      grid: { left: 24, right: 16, top: 12, bottom: 48, containLabel: true },
      xAxis: { type: "category", data: rows.map((row) => row.label), axisLabel: { width: 72, overflow: "truncate" } },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: rows.map((row) => row.value), itemStyle: { color: "#207a74" } }],
      tooltip: { trigger: "axis" },
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [rows]);

  return <div ref={container} className="h-80 w-full" role="img" aria-label={rows.map((row) => `${row.label} ${row.value}`).join("，")} />;
}

export function VisualReply({ value }: { value: unknown }) {
  const result = visualSchema.safeParse(value);
  if (!result.success) return <p className="text-sm text-[#a04237]">可视化数据格式不正确。</p>;
  const visual = result.data;

  // 组件白名单只包含 KPI、表格和柱状图；未知类型不会被执行或渲染。
  return <section className="mt-3 min-h-96 border-t border-[#dbe2e5] pt-3">
    <h3 className="text-sm font-semibold text-[#173c42]">{visual.title}</h3>
    {visual.type === "kpi" && <div className="flex min-h-80 flex-col justify-center"><span className="text-sm text-[#65747a]">{visual.label}</span><strong className="text-3xl text-[#207a74]">{visual.value}</strong></div>}
    {visual.type === "table" && <div className="h-80 overflow-auto pt-4"><table className="w-full text-left text-sm"><thead><tr><th className="border-b p-2">项目</th><th className="border-b p-2">数值</th></tr></thead><tbody>{visual.rows.map((row, index) => <tr key={index}><td className="border-b p-2">{row.label}</td><td className="border-b p-2 tabular-nums">{row.value}</td></tr>)}</tbody></table></div>}
    {visual.type === "bar" && <Bar rows={visual.rows} />}
  </section>;
}
