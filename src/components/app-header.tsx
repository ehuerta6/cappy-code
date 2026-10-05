import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import brandIcon from '@/app/icon.png';
import ThemeToggle from './theme-toggle';
import styles from './app-header.module.css';

export default function AppHeader({
  context,
  live = false,
  children,
}: {
  context?: string;
  live?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="CappyCode home">
          <Image src={brandIcon} width={28} height={28} alt="" priority />
          <span>CappyCode</span>
        </Link>
        <div className={styles.actions}>
          <ThemeToggle />
          {context || children ? (
            <span className={styles.separator} aria-hidden="true" />
          ) : null}
          {context ? (
            <span
              className={`${styles.context} ${live ? styles.liveContext : ''}`}
            >
              {live ? <span aria-hidden="true">●</span> : null}
              {context}
            </span>
          ) : null}
          {children}
        </div>
      </div>
    </header>
  );
}
