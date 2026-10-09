'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ProblemImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        className="my-4 block text-sm text-muted"
        role="img"
        aria-label={alt}
      >
        Image unavailable: {alt}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="my-4 h-auto max-w-full rounded border border-border-soft object-contain"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function ProblemMarkdown({ children }: { children: string }) {
  return (
    <div className="problem-markdown max-w-[80ch] text-base leading-[26px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => (
            <h3 className="mb-2 mt-5 text-lg font-semibold leading-[26px] first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 mt-5 text-lg font-semibold leading-[26px] first:mt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-base font-semibold leading-6 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1 pl-6 marker:text-muted">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1 pl-6 marker:text-muted">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-border-strong pl-4 text-muted">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-md border border-border-soft bg-raised px-3 py-2 font-mono text-[15px] leading-[23px]">
              {children}
            </pre>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className="font-mono">{children}</code>
            ) : (
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
                {children}
              </code>
            ),
          a: ({ href, children }) =>
            href ? (
              <a
                className="text-accent underline decoration-border-strong underline-offset-4 hover:text-accent-hover focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                href={href}
                target={/^https?:\/\//i.test(href) ? '_blank' : undefined}
                rel={
                  /^https?:\/\//i.test(href) ? 'noopener noreferrer' : undefined
                }
              >
                {children}
              </a>
            ) : (
              <>{children}</>
            ),
          img: ({ src, alt }) => {
            if (typeof src !== 'string' || !src || !alt?.trim()) return null;
            let imageUrl: URL;
            try {
              imageUrl = new URL(src);
            } catch {
              return null;
            }
            if (
              imageUrl.protocol !== 'https:' ||
              imageUrl.username ||
              imageUrl.password
            )
              return null;
            return <ProblemImage src={imageUrl.href} alt={alt} />;
          },
          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto">
              <table className="border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border-soft bg-raised px-2 py-1 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border-soft px-2 py-1">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
