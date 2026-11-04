import { chatRequestSchema } from "@ai-native-console/contracts";

type PageState = {
  route: string;
  selectedOrderId: string;
  statusFilter: string;
};

export function collectPageContext(state: PageState) {
  // 只从显式页面状态挑选白名单字段，不读取 DOM、输入框或客户信息。
  const context = {
    route: state.route,
    selectedOrderId: state.selectedOrderId || undefined,
    statusFilter: state.statusFilter,
  };
  return chatRequestSchema.shape.context.unwrap().parse(context);
}
