import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function WikiMarkdown({ source }: { source: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-lg prose-a:text-primary prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-lg prose-pre:bg-muted prose-img:rounded-lg prose-table:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source || "_Sem conteúdo._"}</ReactMarkdown>
    </div>
  );
}
