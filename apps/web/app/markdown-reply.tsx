import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownReply({ content, streaming }: { content: string; streaming: boolean }) {
  // 代码围栏尚未闭合时展示原文，避免生成中反复改变代码块结构。
  if (streaming && content.split("```").length % 2 === 0) {
    return <pre className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{content}</pre>;
  }

  return (
    <div className="markdown-reply mt-2 break-words text-sm leading-7">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => null,
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
        }}
      >{content}</ReactMarkdown>
    </div>
  );
}
