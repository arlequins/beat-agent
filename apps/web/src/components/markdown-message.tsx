import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  a: ({ children, href }) => (
    <a
      className="text-primary underline underline-offset-4 hover:opacity-80"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-primary/40 text-muted-foreground my-4 border-l-2 pl-4 italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className, node: _node, ...props }) => (
    <code
      className={`rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] ${className ?? ""}`}
      {...props}
    >
      {children}
    </code>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 mt-6 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 text-lg font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 font-semibold tracking-tight first:mt-0">
      {children}
    </h3>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-xl bg-zinc-950 p-4 text-zinc-100 shadow-inner [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>
  ),
};

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="break-words text-[15px] leading-7">
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
