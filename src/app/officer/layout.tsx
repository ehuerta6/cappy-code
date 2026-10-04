import type { ReactNode } from 'react';
import OfficerAuthGate from '@/components/officer-auth-gate';

export default function OfficerLayout({ children }: { children: ReactNode }) {
  return <OfficerAuthGate>{children}</OfficerAuthGate>;
}
