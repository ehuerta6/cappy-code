import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let environment: RulesTestEnvironment;
const bucket = 'gs://demo-cappycode-storage.appspot.com';

beforeAll(async () => {
  const [host, rawPort] = (
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? ''
  ).split(':');
  if (!host || !rawPort)
    throw new Error('Run these tests with the Firebase Storage Emulator.');
  environment = await initializeTestEnvironment({
    projectId: 'demo-cappycode-storage',
    storage: {
      host,
      port: Number(rawPort),
      rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

beforeEach(async () => {
  await environment.clearStorage();
});

const smallPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe('Firebase Storage rules', () => {
  it('allows public reads and officer-only creation of valid images', async () => {
    const officer = environment.authenticatedContext('officer').storage(bucket);
    const imageRef = ref(
      officer,
      'problem-images/officer/123e4567-e89b-12d3-a456-426614174000',
    );
    await assertSucceeds(
      uploadBytes(imageRef, smallPng, { contentType: 'image/png' }),
    );
    await assertSucceeds(
      getDownloadURL(
        ref(
          environment.unauthenticatedContext().storage(bucket),
          'problem-images/officer/123e4567-e89b-12d3-a456-426614174000',
        ),
      ),
    );
  });

  it('denies anonymous writes, mismatched owners, unsupported types, and oversized images', async () => {
    const anonymous = environment
      .authenticatedContext('member', {
        firebase: { sign_in_provider: 'anonymous' },
      })
      .storage(bucket);
    const officer = environment.authenticatedContext('officer').storage(bucket);
    await assertFails(
      uploadBytes(
        ref(
          anonymous,
          'problem-images/member/123e4567-e89b-12d3-a456-426614174000',
        ),
        smallPng,
        {
          contentType: 'image/png',
        },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          officer,
          'problem-images/someone-else/123e4567-e89b-12d3-a456-426614174000',
        ),
        smallPng,
        {
          contentType: 'image/png',
        },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          officer,
          'problem-images/officer/123e4567-e89b-12d3-a456-426614174001',
        ),
        smallPng,
        {
          contentType: 'image/svg+xml',
        },
      ),
    );
    await assertFails(
      uploadBytes(
        ref(
          officer,
          'problem-images/officer/123e4567-e89b-12d3-a456-426614174002',
        ),
        new Uint8Array(5 * 1024 * 1024 + 1),
        { contentType: 'image/png' },
      ),
    );
  });

  it('keeps uploaded assets immutable', async () => {
    const officer = environment.authenticatedContext('officer').storage(bucket);
    const imageRef = ref(
      officer,
      'problem-images/officer/123e4567-e89b-12d3-a456-426614174003',
    );
    await assertSucceeds(
      uploadBytes(imageRef, smallPng, { contentType: 'image/png' }),
    );
    await assertFails(
      uploadBytes(imageRef, smallPng, { contentType: 'image/png' }),
    );
    await assertFails(deleteObject(imageRef));
  });
});
