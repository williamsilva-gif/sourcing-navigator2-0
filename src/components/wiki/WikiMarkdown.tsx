import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function WikiMarkdown({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm italic text-muted-foreground">Sem conteúdo.</p>;
  }
  return (
    <div className="wiki-content text-[15px] leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-4 mt-6 text-3xl font-bold tracking-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-8 border-b border-border pb-2 text-2xl font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-6 text-lg font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4 text-base font-semibold">{children}</h4>,
          p: ({ children }) => <p className="mb-4">{children}</p>,
          a: ({ children, href }) => <a href={href} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">{children}</a>,
          ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-primary/40 bg-muted/40 px-4 py-2 italic text-muted-foreground">{children}</blockquote>,
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className ?? "");
            if (isBlock) return <code className={className}>{children}</code>;
            return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
          },
          pre: ({ children }) => <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs">{children}</pre>,
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border bg-muted/40">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t border-border px-3 py-2">{children}</td>,
          hr: () => <hr className="my-6 border-border" />,
          img: ({ src, alt }) => <img src={src} alt={alt} className="my-4 max-w-full rounded-lg border border-border" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
