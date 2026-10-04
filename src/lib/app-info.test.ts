import { describe, expect, it } from 'vitest';
import { appInfo } from './app-info';

describe('app information', () => {
  it('provides the application name and description', () => {
    expect(appInfo.name).toBe('CappyCode');
    expect(appInfo.description).toContain('Python, Java, and C++');
  });
});
