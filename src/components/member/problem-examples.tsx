export default function ProblemExamples({
  input,
  output,
  id,
  headingLevel,
}: {
  input: string;
  output: string;
  id: string;
  headingLevel: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const DetailHeading = headingLevel === 2 ? 'h3' : 'h4';

  return (
    <section
      className="border-t border-border-soft pt-4"
      aria-labelledby={`examples-${id}`}
    >
      <Heading
        className="mb-2 mt-0 text-base font-semibold leading-6"
        id={`examples-${id}`}
      >
        Examples
      </Heading>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:divide-x sm:divide-border-soft">
        <section className="min-w-0 py-2 sm:pr-5">
          <DetailHeading className="mb-1 mt-0 text-sm font-semibold leading-5 text-muted">
            Input
          </DetailHeading>
          <pre className="m-0 min-w-0 whitespace-pre-wrap break-words font-mono text-[15px] leading-[23px]">
            <code>{input || 'No example input'}</code>
          </pre>
        </section>
        <section className="min-w-0 border-t border-border-soft py-3 sm:border-t-0 sm:pl-5 sm:pt-2">
          <DetailHeading className="mb-1 mt-0 text-sm font-semibold leading-5 text-muted">
            Expected output
          </DetailHeading>
          <pre className="m-0 min-w-0 whitespace-pre-wrap break-words font-mono text-[15px] leading-[23px]">
            <code>{output || 'No expected output'}</code>
          </pre>
        </section>
      </div>
    </section>
  );
}
