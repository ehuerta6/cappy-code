import { afterEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(() => ({})),
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: vi.fn().mockResolvedValue(undefined),
  getDownloadURL: vi.fn().mockResolvedValue('https://storage.example/image'),
}));
const auth = vi.hoisted(() => ({
  currentUser: { uid: 'officer-1', isAnonymous: false } as null | {
    uid: string;
    isAnonymous: boolean;
  },
}));

vi.mock('client-only', () => ({}));
vi.mock('firebase/storage', () => firebase);
vi.mock('./auth', () => ({ getOfficerAuth: () => auth }));
vi.mock('./client', () => ({ getFirebaseApp: () => ({}) }));

import { uploadProblemImage } from './storage';

afterEach(() => {
  firebase.uploadBytes.mockClear();
  firebase.getDownloadURL.mockClear();
  auth.currentUser = { uid: 'officer-1', isAnonymous: false };
  vi.unstubAllGlobals();
});

describe('Problem image uploads', () => {
  it('validates the image signature and uses a unique owner-scoped object', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'asset-id' });
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      'diagram.png',
      { type: 'image/png' },
    );
    await expect(uploadProblemImage(file)).resolves.toBe(
      'https://storage.example/image',
    );
    expect(firebase.ref).toHaveBeenCalledWith(
      {},
      'problem-images/officer-1/asset-id',
    );
    expect(firebase.uploadBytes).toHaveBeenCalledWith(
      { path: 'problem-images/officer-1/asset-id' },
      file,
      expect.objectContaining({
        contentType: 'image/png',
        cacheControl: 'public,max-age=31536000,immutable',
      }),
    );
  });

  it('rejects unsupported, oversized, and mismatched image content', async () => {
    await expect(
      uploadProblemImage(
        new File(['x'], 'diagram.svg', { type: 'image/svg+xml' }),
      ),
    ).rejects.toThrow('Choose a PNG, JPEG, or WebP image.');
    await expect(
      uploadProblemImage(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
          type: 'image/png',
        }),
      ),
    ).rejects.toThrow('smaller than 5 MB');
    await expect(
      uploadProblemImage(
        new File(['not a PNG'], 'fake.png', { type: 'image/png' }),
      ),
    ).rejects.toThrow('does not match its image type');
    expect(firebase.uploadBytes).not.toHaveBeenCalled();
  });

  it('requires a signed-in Officer account', async () => {
    auth.currentUser = { uid: 'member', isAnonymous: true };
    const file = new File(
      [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
      'diagram.png',
      { type: 'image/png' },
    );
    await expect(uploadProblemImage(file)).rejects.toThrow(
      'Sign in to Officer Mode',
    );
  });
});
