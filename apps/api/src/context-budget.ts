import type { ChatRequest } from "@ai-native-console/contracts";

const INPUT_BUDGET = 512;
const OUTPUT_RESERVE = 1024;

export function estimateTokens(text: string) {
  // 仅用于本课的粗估：两个 Unicode 字符约算一个 token，不代表供应商计费值。
  return Math.ceil(Array.from(text).length / 2);
}

export function assembleToolInstructions(base: string, message: string, context: ChatRequest["context"], inputBudget = INPUT_BUDGET) {
  const selected = context?.selectedOrderId
    ? ` 当前页面选中演示订单 ${context.selectedOrderId}；若用户说“这条订单”，先用工具查询该编号。`
    : "";
  const filter = context?.statusFilter && context.statusFilter !== "all"
    ? ` 页面状态筛选为 ${context.statusFilter}。`
    : "";
  const fits = (instructions: string) => estimateTokens(instructions) + estimateTokens(message) <= inputBudget;

  // 用户问题和服务端规则优先；筛选条件、选中线索依次降级。
  if (!fits(base)) return { instructions: base, estimatedInputTokens: estimateTokens(base) + estimateTokens(message), overBudget: true,
    omitted: [...(filter ? ["filter"] : []), ...(selected ? ["selection"] : [])] };
  const withSelection = base + selected;
  const instructions = fits(withSelection + filter) ? withSelection + filter : fits(withSelection) ? withSelection : base;
  return {
    instructions,
    estimatedInputTokens: estimateTokens(instructions) + estimateTokens(message),
    overBudget: false,
    omitted: [
      ...(filter && !instructions.includes(filter) ? ["filter"] : []),
      ...(selected && !instructions.includes(selected) ? ["selection"] : []),
    ],
  };
}

export const toolBudget = { input: INPUT_BUDGET, outputReserve: OUTPUT_RESERVE } as const;
