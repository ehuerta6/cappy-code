import MemberSessionPage from '@/components/member/member-session-page';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <MemberSessionPage sessionId={sessionId} />;
}
