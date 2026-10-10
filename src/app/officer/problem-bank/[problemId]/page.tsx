import OfficerBankProblemEditor from '@/components/problems/officer-bank-problem-editor';

export default async function OfficerBankProblemPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  return <OfficerBankProblemEditor key={problemId} problemId={problemId} />;
}
