// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

const editor = vi.hoisted(() => vi.fn());
vi.mock('@monaco-editor/react', () => ({ default: editor }));
vi.mock('@/lib/firebase/auth', () => ({
  getOfficerAuth: vi.fn(() => {
    throw new Error('Members must not need auth');
  }),
}));

import CodeWorkspace from './code-workspace';

afterEach(cleanup);

it('allows anonymous language navigation while keeping every editor read-only', async () => {
  editor.mockReturnValue(null);
  const user = userEvent.setup();
  render(<CodeWorkspace />);
  expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  expect(screen.queryByLabelText('Password')).toBeNull();
  expect(
    screen.getByRole('link', { name: 'Officer Login' }).getAttribute('href'),
  ).toBe('/officer');
  for (const language of ['Python', 'Java', 'C++']) {
    await user.click(screen.getByRole('tab', { name: language }));
    const props = editor.mock.calls.at(-1)![0];
    expect(props.options.readOnly).toBe(true);
    expect(props.onChange).toBeUndefined();
  }
});
