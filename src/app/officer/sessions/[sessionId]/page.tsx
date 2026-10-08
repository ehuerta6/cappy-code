import OfficerSessions from '@/components/sessions/officer-sessions';

export default async function OfficerSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <OfficerSessions sessionId={sessionId} />;
}
