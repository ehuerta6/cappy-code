import { MemberBankProblemPage } from '@/components/member/member-problem-bank';

export default async function BankProblemPage({
  params,
}: {
  params: Promise<{ problemId: string }>;
}) {
  const { problemId } = await params;
  return <MemberBankProblemPage problemId={problemId} />;
}
