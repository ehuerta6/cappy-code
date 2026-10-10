export default function ProblemExamples({
  input,
  output,
  id,
}: {
  input: string;
  output: string;
  id: string;
}) {
  return (
    <section
      className="border-t border-border-soft pt-4"
      aria-labelledby={`examples-${id}`}
    >
      <h2
        className="mb-2 mt-0 text-base font-semibold leading-6"
        id={`examples-${id}`}
      >
        Examples
      </h2>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:divide-x sm:divide-border-soft">
        <section className="min-w-0 py-2 sm:pr-5">
          <h3 className="mb-1 mt-0 text-sm font-semibold leading-5 text-muted">
            Input
          </h3>
          <pre className="m-0 min-w-0 whitespace-pre-wrap break-words font-mono text-[15px] leading-[23px]">
            <code>{input || 'No example input'}</code>
          </pre>
        </section>
        <section className="min-w-0 border-t border-border-soft py-3 sm:border-t-0 sm:pl-5 sm:pt-2">
          <h3 className="mb-1 mt-0 text-sm font-semibold leading-5 text-muted">
            Expected output
          </h3>
          <pre className="m-0 min-w-0 whitespace-pre-wrap break-words font-mono text-[15px] leading-[23px]">
            <code>{output || 'No expected output'}</code>
          </pre>
        </section>
      </div>
    </section>
  );
}
