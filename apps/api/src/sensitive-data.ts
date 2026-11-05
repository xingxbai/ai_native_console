export function redactSensitiveText(text: string) {
  // 这是已知格式的最小脱敏规则；不能替代服务端授权或覆盖所有个人信息。
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[API_KEY]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[JWT]")
    .replace(/\b1[3-9]\d{9}\b/g, "[PHONE]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");
}
