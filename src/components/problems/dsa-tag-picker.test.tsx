// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import DsaTagPicker from './dsa-tag-picker';
import { DsaTagCatalogProvider } from './dsa-tag-catalog-provider';
import type { DsaTag } from '@/lib/dsa-tags';

const initialDsaTags: DsaTag[] = [
  { id: 'arrays', label: 'Arrays', family: 'data', order: 0, active: true },
  { id: 'hash-map', label: 'Hash Map', family: 'data', order: 1, active: true },
];

const catalog = vi.hoisted(() => ({
  listDsaTags: vi.fn(),
  createDsaTag: vi.fn(),
  updateDsaTag: vi.fn(),
  archiveDsaTag: vi.fn(),
  deleteUnusedDsaTag: vi.fn(),
  countDsaTagReferences: vi.fn(),
  reorderDsaTags: vi.fn(),
}));
vi.mock('@/lib/firebase/dsa-tags', () => catalog);

function renderPicker(
  onChange = vi.fn(),
  selected: string[] = [],
  initialCatalog = initialDsaTags,
  refreshedCatalog = initialCatalog,
) {
  catalog.listDsaTags
    .mockReset()
    .mockResolvedValueOnce(initialCatalog)
    .mockResolvedValue(refreshedCatalog);
  return {
    onChange,
    ...render(
      <DsaTagCatalogProvider>
        <DsaTagPicker selected={selected} onChange={onChange} />
      </DsaTagCatalogProvider>,
    ),
  };
}

describe('DsaTagPicker', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('searches locally, toggles selected values, and prevents duplicate selection', async () => {
    const onChange = vi.fn();
    renderPicker(onChange);
    await screen.findByRole('button', { name: /Arrays/ });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tags' }), {
      target: { value: 'hash' },
    });
    expect(screen.getByRole('button', { name: /Hash Map/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Arrays/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Hash Map/ }));
    expect(onChange).toHaveBeenCalledWith(['hash-map']);
  });

  it('shows a recoverable catalog error and retries loading', async () => {
    catalog.listDsaTags
      .mockReset()
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValue(initialDsaTags);
    render(
      <DsaTagCatalogProvider>
        <DsaTagPicker selected={[]} onChange={vi.fn()} />
      </DsaTagCatalogProvider>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not load DSA tags: Permission denied',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading tags' }));
    expect(await screen.findByRole('button', { name: /Arrays/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('selects tags with the keyboard', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderPicker(onChange);
    await screen.findByRole('button', { name: /Arrays/ });
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /Arrays/ }),
    );
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith(['arrays']);
  });

  it('opens and closes the catalog with predictable keyboard focus', async () => {
    const user = userEvent.setup();
    renderPicker();
    const manageButton = await screen.findByRole('button', {
      name: 'Manage DSA tags',
    });
    await user.click(manageButton);
    const closeButton = screen.getByRole('button', {
      name: 'Close DSA tag catalog',
    });
    expect(document.activeElement).toBe(closeButton);
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(manageButton);
  });

  it('keeps tag selection in a loading state until the persisted catalog arrives', () => {
    catalog.listDsaTags.mockReturnValue(new Promise(() => {}));
    render(
      <DsaTagCatalogProvider>
        <DsaTagPicker selected={[]} onChange={vi.fn()} />
      </DsaTagCatalogProvider>,
    );
    expect(screen.getByText('Loading DSA tags…')).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Manage DSA tags' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('creates a catalog tag from the secondary manager', async () => {
    catalog.createDsaTag.mockResolvedValue({
      id: 'sliding-window',
      label: 'Sliding Window',
      family: 'strategy',
      order: 2,
      active: true,
    });
    catalog.updateDsaTag.mockResolvedValue(undefined);
    renderPicker();
    await screen.findByRole('button', { name: /Arrays/ });
    fireEvent.click(screen.getByRole('button', { name: 'Manage DSA tags' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    fireEvent.change(screen.getByLabelText('Tag name'), {
      target: { value: 'Sliding Window' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save tag' }));
    await waitFor(() =>
      expect(catalog.createDsaTag).toHaveBeenCalledWith({
        label: 'Sliding Window',
        family: 'data',
        order: 2,
      }),
    );
    await waitFor(() => expect(catalog.listDsaTags).toHaveBeenCalled());
    expect(screen.getByText('DSA tag catalog')).toBeTruthy();
  });

  it('renames catalog metadata while keeping the same referenced ID', async () => {
    catalog.updateDsaTag.mockResolvedValue(undefined);
    renderPicker();
    await screen.findByRole('button', { name: /Arrays/ });
    fireEvent.click(screen.getByRole('button', { name: 'Manage DSA tags' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Arrays' }));
    fireEvent.change(screen.getByLabelText('Tag name'), {
      target: { value: 'Sequences' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save tag' }));
    await waitFor(() =>
      expect(catalog.updateDsaTag).toHaveBeenCalledWith({
        ...initialDsaTags[0],
        label: 'Sequences',
        family: 'data',
      }),
    );
  });

  it('archives an in-use tag while retaining the selected historical chip and hiding new selection', async () => {
    const archivedCatalog = [
      { ...initialDsaTags[0], active: false },
      initialDsaTags[1],
    ];
    catalog.archiveDsaTag.mockResolvedValue(undefined);
    renderPicker(vi.fn(), ['arrays'], initialDsaTags, archivedCatalog);
    await screen.findByRole('button', { name: 'Remove Arrays' });
    fireEvent.click(screen.getByRole('button', { name: 'Manage DSA tags' }));
    const arraysRow = screen.getByRole('button', {
      name: 'Edit Arrays',
    }).parentElement;
    if (!arraysRow) throw new Error('Missing the Arrays catalog row.');
    fireEvent.click(within(arraysRow).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(catalog.archiveDsaTag).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Remove Arrays' })).toBeTruthy();
    expect(
      within(screen.getByLabelText('Tag suggestions')).queryByRole('button', {
        name: 'Arrays',
      }),
    ).toBeNull();
  });

  it('permanently deletes an unused archived tag after confirmation', async () => {
    const archivedCatalog = [
      { ...initialDsaTags[0], active: false },
      initialDsaTags[1],
    ];
    catalog.countDsaTagReferences.mockResolvedValue(0);
    catalog.deleteUnusedDsaTag.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPicker(vi.fn(), [], archivedCatalog);
    await screen.findByRole('button', { name: 'Manage DSA tags' });
    fireEvent.click(screen.getByRole('button', { name: 'Manage DSA tags' }));
    const arraysRow = screen.getByRole('button', {
      name: 'Edit Arrays',
    }).parentElement;
    if (!arraysRow) throw new Error('Missing the Arrays catalog row.');
    fireEvent.click(within(arraysRow).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(catalog.deleteUnusedDsaTag).toHaveBeenCalledWith('arrays'),
    );
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
