import MemberSessionPage from '@/components/member/member-session-page';

export default async function SessionProblemPage({
  params,
}: {
  params: Promise<{ sessionId: string; problemId: string }>;
}) {
  const { sessionId, problemId } = await params;
  return <MemberSessionPage sessionId={sessionId} problemId={problemId} />;
}
