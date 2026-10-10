import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const projectId = 'demo-cappycode-rules';
let environment: RulesTestEnvironment;

beforeAll(async () => {
  const [host, rawPort] = (process.env.FIRESTORE_EMULATOR_HOST ?? '').split(
    ':',
  );
  if (!host || !rawPort)
    throw new Error('Run these tests with the Firestore Emulator.');
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: Number(rawPort),
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    const records = [
      ['draft', 'draft', 'revealed', true],
      ['live', 'live', 'hidden', false],
      ['live', 'live', 'revealed', true],
      ['ended', 'ended', 'hidden', false],
      ['ended', 'ended', 'revealed', true],
    ] as const;
    const writes = records.flatMap(
      ([sessionId, status, problemId, visible]) => {
        return [
          setDoc(doc(database, `sessions/${sessionId}`), {
            title: sessionId,
            status,
            ...(sessionId === 'live'
              ? { bankProblemIds: ['used-live', 'used-private'] }
              : {}),
          }),
          setDoc(doc(database, `sessions/${sessionId}/problems/${problemId}`), {
            title: problemId,
            description: 'Public description',
            exampleInput: '1',
            exampleOutput: '2',
            order: 0,
            answersVisible: visible,
          }),
        ];
      },
    );
    writes.push(
      setDoc(doc(database, 'sessionControl/intro'), {
        sessionId: 'live',
        bankProblemIds: ['used-live', 'used-private'],
      }),
      setDoc(doc(database, 'problemBank/used-live'), {
        title: 'Used during live Session',
        description: 'Prepared answer must stay out of the bank.',
        constraints: '',
        exampleInput: '1',
        exampleOutput: '2',
        category: 'custom',
        isPublished: true,
        hiddenByLiveSessionId: 'live',
      }),
      setDoc(doc(database, 'problemBank/used-private'), {
        title: 'Legacy unpublished and used live',
        description: 'Legacy publication fields are ignored after release.',
        constraints: '',
        exampleInput: '1',
        exampleOutput: '2',
        category: 'custom',
        isPublished: false,
        hiddenByLiveSessionId: 'live',
      }),
      setDoc(doc(database, 'problemBank/public'), {
        title: 'Public bank Problem',
        description: 'Available to Members.',
        constraints: '',
        exampleInput: '3',
        exampleOutput: '4',
        category: 'interview-style',
        isPublished: true,
        hiddenByLiveSessionId: null,
      }),
      setDoc(doc(database, 'problemBank/legacy-public'), {
        title: 'Legacy public bank Problem',
        description: 'Legacy publication fields are ignored.',
        constraints: '',
        exampleInput: '3',
        exampleOutput: '4',
        category: 'interview-style',
        isPublic: true,
        hiddenByLiveSessionId: null,
      }),
      setDoc(doc(database, 'problemBank/legacy-private'), {
        title: 'Legacy private bank Problem',
        description: 'Legacy false does not hide this Problem.',
        constraints: '',
        exampleInput: '3',
        exampleOutput: '4',
        category: 'interview-style',
        isPublic: false,
        hiddenByLiveSessionId: null,
      }),
      setDoc(doc(database, 'problemBank/legacy-unpublished'), {
        title: 'Legacy unpublished field',
        description: 'isPublished false does not hide this Problem.',
        constraints: '',
        exampleInput: '3',
        exampleOutput: '4',
        category: 'interview-style',
        isPublished: false,
        hiddenByLiveSessionId: null,
      }),
    );
    for (const problemId of ['used-live', 'used-private', 'public']) {
      for (const language of ['python', 'java', 'cpp']) {
        writes.push(
          setDoc(
            doc(database, `problemBank/${problemId}/solutions/${language}`),
            {
              code: `${problemId} ${language} source`,
              timeComplexity: 'O(n)',
            },
          ),
        );
      }
      writes.push(
        setDoc(doc(database, `problemBank/${problemId}/approaches/primary`), {
          name: 'Primary',
          tags: ['Arrays'],
          order: 0,
        }),
      );
      for (const language of ['python', 'java', 'cpp'])
        writes.push(
          setDoc(
            doc(
              database,
              `problemBank/${problemId}/approaches/primary/solutions/${language}`,
            ),
            { code: `${language} nested bank source` },
          ),
        );
    }
    const solutionPaths = [
      'sessions/draft/problems/revealed',
      'sessions/live/problems/hidden',
      'sessions/live/problems/revealed',
      'sessions/ended/problems/hidden',
      'sessions/ended/problems/revealed',
    ];
    for (const parentPath of solutionPaths) {
      writes.push(
        setDoc(doc(database, `${parentPath}/approaches/primary`), {
          name: 'Primary',
          tags: ['Arrays'],
          order: 0,
        }),
      );
      for (const language of ['python', 'java', 'cpp']) {
        writes.push(
          setDoc(doc(database, `${parentPath}/solutions/${language}`), {
            code: `${language} source`,
          }),
        );
        writes.push(
          setDoc(
            doc(
              database,
              `${parentPath}/approaches/primary/solutions/${language}`,
            ),
            { code: `${language} nested source`, timeComplexity: 'O(n)' },
          ),
        );
      }
    }
    await Promise.all(writes);
  });
});

describe('DSA tag catalog authorization', () => {
  it('allows public catalog reads while restricting catalog writes to officers', async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const officer = environment
      .authenticatedContext('officer', {
        firebase: { sign_in_provider: 'password' },
      })
      .firestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'dsaTags/arrays'), {
        label: 'Arrays',
        family: 'data',
        order: 0,
        active: true,
      });
    });
    await assertSucceeds(getDoc(doc(anonymous, 'dsaTags/arrays')));
    await assertFails(
      setDoc(doc(anonymous, 'dsaTags/custom'), {
        label: 'Custom',
        family: 'data',
        order: 1,
        active: true,
      }),
    );
    await assertSucceeds(
      setDoc(doc(officer, 'dsaTags/custom'), {
        label: 'Custom',
        family: 'data',
        order: 1,
        active: true,
      }),
    );
    await assertFails(
      setDoc(doc(officer, 'dsaTags/invalid'), {
        label: '',
        family: 'neon',
        order: -1,
        active: true,
      }),
    );
  });

  it('requires unique bounded stable IDs for new Approach tags', async () => {
    const officer = officerDb();
    await assertSucceeds(
      setDoc(doc(officer, 'sessions/draft/problems/new/approaches/ok'), {
        name: 'Primary',
        tags: ['arrays', 'two-pointers'],
        order: 0,
      }),
    );
    await assertFails(
      setDoc(doc(officer, 'sessions/draft/problems/new/approaches/duplicate'), {
        name: 'Duplicate',
        tags: ['arrays', 'arrays'],
        order: 0,
      }),
    );
    await assertFails(
      setDoc(doc(officer, 'sessions/draft/problems/new/approaches/invalid'), {
        name: 'Invalid',
        tags: ['Hash Map'],
        order: 0,
      }),
    );
    await assertFails(
      setDoc(doc(officer, 'sessions/draft/problems/new/approaches/too-many'), {
        name: 'Too many',
        tags: Array.from({ length: 17 }, (_, index) => `tag-${index}`),
        order: 0,
      }),
    );
  });
});

function anonymousDb() {
  return environment.unauthenticatedContext().firestore();
}

function officerDb() {
  return environment
    .authenticatedContext('officer', {
      firebase: { sign_in_provider: 'password' },
    })
    .firestore();
}

function anonymousAuthDb() {
  return environment
    .authenticatedContext('anonymous-user', {
      firebase: { sign_in_provider: 'anonymous' },
    })
    .firestore();
}

describe('Firestore security rules', () => {
  it('allows one atomic new draft Session copy and its children, but denies child creates under a live Session', async () => {
    const db = officerDb();
    const batch = writeBatch(db);
    batch.set(doc(db, 'sessions/atomic-copy'), {
      branch: 'general',
      title: 'Copied Session',
      date: '2026-10-08',
      status: 'draft',
    });
    batch.set(doc(db, 'sessions/atomic-copy/problems/problem-copy'), {
      title: 'Copied Problem',
      description: 'A representative Problem',
      exampleInput: '1',
      exampleOutput: '1',
      constraints: '',
      order: 0,
      answersVisible: false,
    });
    batch.set(
      doc(
        db,
        'sessions/atomic-copy/problems/problem-copy/approaches/approach-copy',
      ),
      { name: 'Primary', tags: ['arrays'], order: 0 },
    );
    for (const language of ['python', 'java', 'cpp']) {
      batch.set(
        doc(
          db,
          `sessions/atomic-copy/problems/problem-copy/approaches/approach-copy/solutions/${language}`,
        ),
        { code: `${language} source`, timeComplexity: 'O(1)' },
      );
    }
    await assertSucceeds(batch.commit());

    await assertFails(
      setDoc(doc(db, 'sessions/live/problems/new-problem'), {
        title: 'Forbidden Problem',
        description: '',
        exampleInput: '',
        exampleOutput: '',
        order: 1,
        answersVisible: false,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'sessions/live/problems/hidden/approaches/new-approach'), {
        name: 'Forbidden',
        tags: [],
        order: 1,
      }),
    );
  });

  it('requires a supported branch on new Sessions and rejects invalid branch updates', async () => {
    const db = officerDb();
    await assertFails(
      setDoc(doc(db, 'sessions/new-legacy'), {
        title: 'New session',
        status: 'draft',
      }),
    );
    for (const branch of ['intro', 'general', 'icpc']) {
      await assertSucceeds(
        setDoc(doc(db, `sessions/new-${branch}`), {
          branch,
          title: 'New session',
          status: 'draft',
        }),
      );
    }
    await assertFails(
      setDoc(doc(db, 'sessions/invalid'), {
        branch: 'advanced',
        title: 'Invalid session',
        status: 'draft',
      }),
    );
    const legacy = doc(db, 'sessions/draft');
    await assertSucceeds(
      updateDoc(legacy, { title: 'Legacy metadata update' }),
    );
    expect((await getDoc(legacy)).data()).not.toHaveProperty('branch');
    await assertFails(updateDoc(legacy, { branch: 'advanced' }));
    await assertSucceeds(updateDoc(legacy, { branch: 'general' }));
    await assertFails(updateDoc(doc(db, 'sessions/live'), { branch: 'icpc' }));

    const modern = doc(db, 'sessions/new-intro');
    await assertSucceeds(updateDoc(modern, { branch: 'icpc' }));
    await assertFails(updateDoc(modern, { branch: 'advanced' }));
    await assertFails(updateDoc(modern, { branch: deleteField() }));
  });

  it('allows an authenticated officer to read and write draft sessions, problems, and fixed solutions', async () => {
    const db = officerDb();
    await assertSucceeds(getDoc(doc(db, 'sessions/draft')));
    await assertSucceeds(
      setDoc(doc(db, 'sessions/draft'), {
        title: 'Updated draft',
        status: 'draft',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'sessions/draft'), { title: 'Updated title' }),
    );
    await assertSucceeds(getDoc(doc(db, 'sessions/draft/problems/revealed')));
    await assertSucceeds(
      updateDoc(doc(db, 'sessions/draft/problems/revealed'), {
        answersVisible: false,
      }),
    );
    for (const language of ['python', 'java', 'cpp']) {
      const solution = doc(
        db,
        `sessions/draft/problems/revealed/solutions/${language}`,
      );
      await assertSucceeds(getDoc(solution));
      await assertSucceeds(setDoc(solution, { code: 'updated' }));
    }
    await assertFails(
      getDoc(doc(db, 'sessions/draft/problems/revealed/solutions/rust')),
    );
  });

  it('denies anonymous draft Session reads', async () => {
    const db = anonymousDb();
    await assertFails(getDoc(doc(db, 'sessions/draft')));
    await assertSucceeds(getDoc(doc(db, 'sessions/live')));
    await assertSucceeds(getDoc(doc(db, 'sessions/ended')));
    const anonymousAuth = anonymousAuthDb();
    await assertFails(getDoc(doc(anonymousAuth, 'sessions/draft')));
  });

  it('allows anonymous Problem reads only beneath live or ended Sessions', async () => {
    const db = anonymousDb();
    await assertFails(getDoc(doc(db, 'sessions/draft/problems/revealed')));
    await assertSucceeds(getDoc(doc(db, 'sessions/live/problems/hidden')));
    await assertSucceeds(getDoc(doc(db, 'sessions/ended/problems/revealed')));
  });

  it('denies anonymous and Firebase-anonymous writes to Sessions, Problems, and Solutions', async () => {
    for (const db of [anonymousDb(), anonymousAuthDb()]) {
      const session = doc(db, 'sessions/live');
      const problem = doc(db, 'sessions/live/problems/revealed');
      const solution = doc(
        db,
        'sessions/live/problems/revealed/solutions/python',
      );

      await assertFails(setDoc(session, { title: 'forbidden' }));
      await assertFails(updateDoc(session, { title: 'forbidden' }));
      await assertFails(deleteDoc(session));
      await assertFails(
        setDoc(doc(db, 'sessions/live/problems/new'), {
          title: 'forbidden',
        }),
      );
      await assertFails(updateDoc(problem, { title: 'forbidden' }));
      await assertFails(deleteDoc(problem));
      await assertFails(setDoc(solution, { code: 'forbidden' }));
      await assertFails(updateDoc(solution, { code: 'forbidden' }));
      await assertFails(deleteDoc(solution));
    }
  });

  it('permits public discovery queries only when they prove each Session is public', async () => {
    const db = anonymousDb();
    await assertSucceeds(
      getDocs(query(collection(db, 'sessions'), where('status', '==', 'live'))),
    );
    await assertSucceeds(
      getDocs(
        query(collection(db, 'sessions'), where('status', '==', 'ended')),
      ),
    );
    await assertFails(getDocs(collection(db, 'sessions')));
  });

  it('requires an atomic branch claim when a Session goes live', async () => {
    const db = officerDb();
    await assertFails(updateDoc(doc(db, 'sessions/draft'), { status: 'live' }));

    const staleWrite = writeBatch(db);
    staleWrite.update(doc(db, 'sessions/draft'), { status: 'live' });
    staleWrite.update(doc(db, 'sessionControl/intro'), {
      sessionId: 'draft',
      bankProblemIds: [],
    });
    await assertFails(staleWrite.commit());

    const transition = writeBatch(db);
    transition.update(doc(db, 'sessions/live'), { status: 'draft' });
    transition.update(doc(db, 'sessions/draft'), { status: 'live' });
    transition.update(doc(db, 'sessionControl/intro'), {
      sessionId: 'draft',
      bankProblemIds: [],
    });
    await assertSucceeds(transition.commit());
    await assertSucceeds(getDoc(doc(db, 'sessions/draft')));
  });

  it('allows one live Session per branch and rejects direct same-branch bypasses', async () => {
    const db = officerDb();
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      for (const [id, branch] of [
        ['general-draft', 'general'],
        ['icpc-draft', 'icpc'],
        ['intro-second', 'intro'],
        ['general-second', 'general'],
        ['icpc-second', 'icpc'],
      ] as const) {
        await setDoc(doc(admin, `sessions/${id}`), {
          title: id,
          date: '2026-10-09',
          branch,
          status: 'draft',
        });
      }
    });

    await assertFails(
      updateDoc(doc(db, 'sessions/general-draft'), { status: 'live' }),
    );
    const crossBranchStart = writeBatch(db);
    crossBranchStart.update(doc(db, 'sessions/general-draft'), {
      status: 'live',
    });
    crossBranchStart.set(doc(db, 'sessionControl/general'), {
      sessionId: 'general-draft',
      bankProblemIds: [],
    });
    crossBranchStart.update(doc(db, 'sessions/icpc-draft'), { status: 'live' });
    crossBranchStart.set(doc(db, 'sessionControl/icpc'), {
      sessionId: 'icpc-draft',
      bankProblemIds: [],
    });
    await assertSucceeds(crossBranchStart.commit());
    await assertSucceeds(getDoc(doc(db, 'sessions/live')));
    await assertSucceeds(getDoc(doc(db, 'sessions/general-draft')));
    await assertSucceeds(getDoc(doc(db, 'sessions/icpc-draft')));

    const conflictingIntro = writeBatch(db);
    conflictingIntro.update(doc(db, 'sessions/intro-second'), {
      status: 'live',
    });
    conflictingIntro.update(doc(db, 'sessionControl/intro'), {
      sessionId: 'intro-second',
      bankProblemIds: [],
    });
    await assertFails(conflictingIntro.commit());

    const conflictingGeneral = writeBatch(db);
    conflictingGeneral.update(doc(db, 'sessions/general-second'), {
      status: 'live',
    });
    conflictingGeneral.set(doc(db, 'sessionControl/general'), {
      sessionId: 'general-second',
      bankProblemIds: [],
    });
    await assertFails(conflictingGeneral.commit());

    const conflictingIcpc = writeBatch(db);
    conflictingIcpc.update(doc(db, 'sessions/icpc-second'), { status: 'live' });
    conflictingIcpc.set(doc(db, 'sessionControl/icpc'), {
      sessionId: 'icpc-second',
      bankProblemIds: [],
    });
    await assertFails(conflictingIcpc.commit());

    const stopIntro = writeBatch(db);
    stopIntro.update(doc(db, 'sessions/live'), { status: 'draft' });
    stopIntro.update(doc(db, 'sessionControl/intro'), {
      sessionId: null,
      bankProblemIds: [],
    });
    await assertSucceeds(stopIntro.commit());
    await assertSucceeds(getDoc(doc(db, 'sessions/general-draft')));
    await assertSucceeds(getDoc(doc(db, 'sessions/icpc-draft')));
  });

  it('serializes concurrent Go Live attempts through the branch claim document', async () => {
    const db = officerDb();
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'sessionControl/intro'), {
        sessionId: null,
        bankProblemIds: [],
      });
      for (const id of ['intro-a', 'intro-b'])
        await setDoc(doc(admin, `sessions/${id}`), {
          title: id,
          date: '2026-10-09',
          branch: 'intro',
          status: 'draft',
        });
    });

    const start = (id: string) =>
      runTransaction(db, async (transaction) => {
        const claim = await transaction.get(doc(db, 'sessionControl/intro'));
        if (claim.data()?.sessionId != null)
          throw new Error('Intro is already live');
        transaction.update(doc(db, `sessions/${id}`), { status: 'live' });
        transaction.set(doc(db, 'sessionControl/intro'), {
          sessionId: id,
          bankProblemIds: [],
        });
      });
    const attempts = await Promise.allSettled([
      start('intro-a'),
      start('intro-b'),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    const introClaim = await getDoc(doc(db, 'sessionControl/intro'));
    expect(['intro-a', 'intro-b']).toContain(introClaim.data()?.sessionId);
    const statuses = await Promise.all(
      ['intro-a', 'intro-b'].map((id) => getDoc(doc(db, `sessions/${id}`))),
    );
    expect(
      statuses.filter((snapshot) => snapshot.data()?.status === 'live'),
    ).toHaveLength(1);
  });

  it('migrates a legacy global live pointer without ending its Session', async () => {
    const db = officerDb();
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      await deleteDoc(doc(admin, 'sessionControl/intro'));
      await setDoc(doc(admin, 'sessionControl/liveSession'), {
        sessionId: 'live',
      });
      await setDoc(doc(admin, 'sessions/general-new'), {
        title: 'General live',
        date: '2026-10-09',
        branch: 'general',
        status: 'draft',
        bankProblemIds: [],
      });
    });
    const migration = writeBatch(db);
    migration.set(doc(db, 'sessionControl/intro'), {
      sessionId: 'live',
      bankProblemIds: ['used-live', 'used-private'],
    });
    migration.update(doc(db, 'sessionControl/liveSession'), {
      sessionId: null,
    });
    migration.update(doc(db, 'sessions/general-new'), { status: 'live' });
    migration.set(doc(db, 'sessionControl/general'), {
      sessionId: 'general-new',
      bankProblemIds: [],
    });
    await assertSucceeds(migration.commit());
    expect((await getDoc(doc(db, 'sessions/live'))).data()?.status).toBe(
      'live',
    );
    expect(
      (await getDoc(doc(db, 'sessionControl/intro'))).data()?.sessionId,
    ).toBe('live');
    expect(
      (await getDoc(doc(db, 'sessionControl/liveSession'))).data()?.sessionId,
    ).toBeNull();
  });

  it('keeps a shared Bank Problem hidden until the final live branch releases it', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'sessions/general-live'), {
        title: 'General live',
        date: '2026-10-09',
        branch: 'general',
        status: 'live',
        bankProblemIds: ['used-live'],
      });
      await setDoc(doc(admin, 'sessionControl/general'), {
        sessionId: 'general-live',
        bankProblemIds: ['used-live'],
      });
      await setDoc(doc(admin, 'sessions/icpc-live'), {
        title: 'ICPC live',
        date: '2026-10-09',
        branch: 'icpc',
        status: 'live',
        bankProblemIds: ['used-live'],
      });
      await setDoc(doc(admin, 'sessionControl/icpc'), {
        sessionId: 'icpc-live',
        bankProblemIds: ['used-live'],
      });
    });
    await assertFails(getDoc(doc(member, 'problemBank/used-live')));
    await assertSucceeds(getDoc(doc(member, 'problemBank/public')));
    await assertSucceeds(
      getDoc(doc(member, 'problemBank/public/solutions/python')),
    );
    const stopIntro = writeBatch(officer);
    stopIntro.update(doc(officer, 'sessions/live'), { status: 'draft' });
    stopIntro.update(doc(officer, 'sessionControl/intro'), {
      sessionId: null,
      bankProblemIds: [],
    });
    stopIntro.update(doc(officer, 'problemBank/used-live'), {
      hiddenByLiveSessionId: 'general-live',
    });
    await assertSucceeds(stopIntro.commit());
    await assertFails(getDoc(doc(member, 'problemBank/used-live')));

    const stopGeneral = writeBatch(officer);
    stopGeneral.update(doc(officer, 'sessions/general-live'), {
      status: 'ended',
    });
    stopGeneral.update(doc(officer, 'sessionControl/general'), {
      sessionId: null,
      bankProblemIds: [],
    });
    stopGeneral.update(doc(officer, 'problemBank/used-live'), {
      hiddenByLiveSessionId: 'icpc-live',
    });
    await assertSucceeds(stopGeneral.commit());
    await assertFails(getDoc(doc(member, 'problemBank/used-live')));

    const stopIcpc = writeBatch(officer);
    stopIcpc.update(doc(officer, 'sessions/icpc-live'), { status: 'ended' });
    stopIcpc.update(doc(officer, 'sessionControl/icpc'), {
      sessionId: null,
      bankProblemIds: [],
    });
    stopIcpc.update(doc(officer, 'problemBank/used-live'), {
      hiddenByLiveSessionId: null,
    });
    await assertSucceeds(stopIcpc.commit());
    await assertSucceeds(getDoc(doc(member, 'problemBank/used-live')));
  });

  it('retries live Session deletion when another branch claims the same Bank Problem during deletion', async () => {
    const db = officerDb();
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sessions/general-arrives'), {
        title: 'General arrives during deletion',
        date: '2026-10-09',
        branch: 'general',
        status: 'draft',
        bankProblemIds: ['used-live'],
      });
    });

    let signalDeletionReads!: () => void;
    let releaseDeletion!: () => void;
    const deletionReadsReady = new Promise<void>((resolve) => {
      signalDeletionReads = resolve;
    });
    const deletionMayCommit = new Promise<void>((resolve) => {
      releaseDeletion = resolve;
    });
    let deletionAttempts = 0;
    const deletion = runTransaction(db, async (transaction) => {
      deletionAttempts += 1;
      const [session, ...controls] = await Promise.all([
        transaction.get(doc(db, 'sessions/live')),
        transaction.get(doc(db, 'sessionControl/liveSession')),
        transaction.get(doc(db, 'sessionControl/intro')),
        transaction.get(doc(db, 'sessionControl/general')),
        transaction.get(doc(db, 'sessionControl/icpc')),
        transaction.get(doc(db, 'problemBank/used-live')),
      ]);
      const intro = controls[1]!;
      const general = controls[2]!;
      const icpc = controls[3]!;
      const bank = controls[4]!;
      if (deletionAttempts === 1) {
        signalDeletionReads();
        await deletionMayCommit;
      }
      const remainingClaim = [intro, general, icpc].find(
        (claim) =>
          claim.exists() &&
          claim.data().sessionId !== 'live' &&
          claim.data().bankProblemIds?.includes('used-live'),
      );
      const remainingOwner = remainingClaim?.exists()
        ? remainingClaim.data().sessionId
        : null;
      transaction.update(doc(db, 'sessionControl/intro'), {
        sessionId: null,
        bankProblemIds: [],
      });
      if (bank.data()?.hiddenByLiveSessionId !== (remainingOwner ?? null))
        transaction.update(doc(db, 'problemBank/used-live'), {
          hiddenByLiveSessionId: remainingOwner ?? null,
        });
      transaction.delete(doc(db, 'sessions/live'));
      expect(session.data()?.status).toBe('live');
    });

    await deletionReadsReady;
    await runTransaction(db, async (transaction) => {
      await Promise.all([
        transaction.get(doc(db, 'sessions/general-arrives')),
        transaction.get(doc(db, 'sessionControl/general')),
        transaction.get(doc(db, 'problemBank/used-live')),
      ]);
      transaction.update(doc(db, 'sessions/general-arrives'), {
        status: 'live',
      });
      transaction.set(doc(db, 'sessionControl/general'), {
        sessionId: 'general-arrives',
        bankProblemIds: ['used-live'],
      });
      transaction.update(doc(db, 'problemBank/used-live'), {
        hiddenByLiveSessionId: 'general-arrives',
      });
    });
    releaseDeletion();
    await deletion;

    expect(deletionAttempts).toBeGreaterThan(1);
    expect(
      (await getDoc(doc(db, 'sessions/general-arrives'))).data()?.status,
    ).toBe('live');
    expect(
      (await getDoc(doc(db, 'problemBank/used-live'))).data()
        ?.hiddenByLiveSessionId,
    ).toBe('general-arrives');
    await assertFails(getDoc(doc(anonymousDb(), 'problemBank/used-live')));
  });

  it('allows Not Live only with the pointer cleared and preserves prepared Problem data', async () => {
    const db = officerDb();
    await assertFails(updateDoc(doc(db, 'sessions/live'), { status: 'draft' }));

    const transition = writeBatch(db);
    transition.update(doc(db, 'sessions/live'), { status: 'draft' });
    transition.update(doc(db, 'sessionControl/intro'), {
      sessionId: null,
      bankProblemIds: [],
    });
    await assertSucceeds(transition.commit());
    const problem = await getDoc(doc(db, 'sessions/live/problems/hidden'));
    if (!problem.exists())
      throw new Error('Expected prepared Problem to remain.');
    if (problem.data().answersVisible !== false)
      throw new Error('Expected answer visibility to remain hidden.');
    await assertSucceeds(
      getDoc(doc(db, 'sessions/live/problems/hidden/solutions/python')),
    );
  });

  it('does not allow ended Sessions to return to draft or live', async () => {
    const db = officerDb();
    await assertFails(
      updateDoc(doc(db, 'sessions/ended'), { status: 'draft' }),
    );
    await assertFails(updateDoc(doc(db, 'sessions/ended'), { status: 'live' }));
  });

  it('allows live and ended content corrections but rejects structural Problem writes', async () => {
    const db = officerDb();
    const liveProblem = doc(db, 'sessions/live/problems/hidden');
    const endedProblem = doc(db, 'sessions/ended/problems/hidden');

    await assertSucceeds(
      updateDoc(liveProblem, {
        title: 'Corrected title',
        description: 'Corrected description',
        constraints: 'n <= 100',
        exampleInput: '3',
        exampleOutput: '6',
        difficulty: 'medium',
        category: 'interview-style',
        leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
      }),
    );
    await assertSucceeds(updateDoc(liveProblem, { answersVisible: true }));
    await assertSucceeds(
      setDoc(doc(db, 'sessions/live/problems/hidden/solutions/python'), {
        code: 'corrected source',
        timeComplexity: 'O(n)',
      }),
    );
    await assertSucceeds(updateDoc(endedProblem, { title: 'Past correction' }));
    await assertSucceeds(
      setDoc(doc(db, 'sessions/ended/problems/hidden/solutions/java'), {
        code: 'corrected ended source',
        spaceComplexity: 'O(1)',
      }),
    );

    for (const problem of [liveProblem, endedProblem]) {
      await assertFails(updateDoc(problem, { order: 1 }));
      await assertFails(updateDoc(problem, { bankOrigin: 'bank' }));
      await assertFails(updateDoc(problem, { bankProblemId: 'new-bank-link' }));
      await assertFails(updateDoc(problem, { bankCopyPending: false }));
      await assertFails(
        setDoc(doc(db, `${problem.path.replace('/hidden', '/new')}`), {
          title: 'New Problem',
          order: 1,
          answersVisible: false,
        }),
      );
      await assertFails(deleteDoc(problem));
    }
    await assertFails(
      updateDoc(doc(db, 'sessions/live'), { bankProblemIds: ['new-link'] }),
    );
    await assertFails(
      updateDoc(doc(db, 'sessions/ended'), { bankProblemIds: ['new-link'] }),
    );
  });

  it('allows atomic deletion of a live Session hierarchy only when its live claim is released', async () => {
    const db = officerDb();
    await environment.withSecurityRulesDisabled(async (context) => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'sessions/general-live'), {
        title: 'General live',
        date: '2026-10-09',
        branch: 'general',
        status: 'live',
        bankProblemIds: ['used-live'],
      });
      await setDoc(doc(admin, 'sessionControl/general'), {
        sessionId: 'general-live',
        bankProblemIds: ['used-live'],
      });
    });
    await assertFails(deleteDoc(doc(db, 'sessions/live')));
    await assertFails(deleteDoc(doc(db, 'sessions/live/problems/hidden')));
    await assertFails(
      deleteDoc(doc(db, 'sessions/live/problems/hidden/approaches/primary')),
    );

    const deletion = writeBatch(db);
    deletion.update(doc(db, 'sessionControl/intro'), {
      sessionId: null,
      bankProblemIds: [],
    });
    deletion.update(doc(db, 'problemBank/used-live'), {
      hiddenByLiveSessionId: 'general-live',
    });
    deletion.update(doc(db, 'problemBank/used-private'), {
      hiddenByLiveSessionId: null,
    });
    for (const problemId of ['hidden', 'revealed']) {
      for (const language of ['python', 'java', 'cpp']) {
        deletion.delete(
          doc(db, `sessions/live/problems/${problemId}/solutions/${language}`),
        );
        deletion.delete(
          doc(
            db,
            `sessions/live/problems/${problemId}/approaches/primary/solutions/${language}`,
          ),
        );
      }
      deletion.delete(
        doc(db, `sessions/live/problems/${problemId}/approaches/primary`),
      );
      deletion.delete(doc(db, `sessions/live/problems/${problemId}`));
    }
    deletion.delete(doc(db, 'sessions/live'));
    await assertSucceeds(deletion.commit());
    expect(
      (await getDoc(doc(db, 'sessionControl/general'))).data()?.sessionId,
    ).toBe('general-live');
    expect(
      (await getDoc(doc(db, 'problemBank/used-live'))).data()
        ?.hiddenByLiveSessionId,
    ).toBe('general-live');
    expect(
      (await getDoc(doc(db, 'problemBank/used-private'))).data()
        ?.hiddenByLiveSessionId,
    ).toBeNull();
    for (const problemId of ['hidden', 'revealed']) {
      expect(
        (
          await getDoc(
            doc(db, `sessions/live/problems/${problemId}/approaches/primary`),
          )
        ).exists(),
      ).toBe(false);
      expect(
        (await getDoc(doc(db, `sessions/live/problems/${problemId}`))).exists(),
      ).toBe(false);
    }
    await assertFails(getDoc(doc(anonymousDb(), 'problemBank/used-live')));
  });

  it('allows atomic deletion of an ended Session with nested content', async () => {
    const db = officerDb();
    const deletion = writeBatch(db);
    for (const language of ['python', 'java', 'cpp']) {
      deletion.delete(
        doc(db, `sessions/ended/problems/hidden/solutions/${language}`),
      );
      deletion.delete(
        doc(
          db,
          `sessions/ended/problems/hidden/approaches/primary/solutions/${language}`,
        ),
      );
    }
    deletion.delete(
      doc(db, 'sessions/ended/problems/hidden/approaches/primary'),
    );
    deletion.delete(doc(db, 'sessions/ended/problems/hidden'));
    deletion.delete(doc(db, 'sessions/ended'));

    await assertSucceeds(deletion.commit());
    expect((await getDoc(doc(db, 'sessions/ended'))).exists()).toBe(false);
    expect(
      (await getDoc(doc(db, 'sessions/ended/problems/hidden'))).exists(),
    ).toBe(false);
  });

  it('denies draft and live hidden Solutions and permits all ended Solutions for fixed languages', async () => {
    const db = anonymousDb();
    for (const language of ['python', 'java', 'cpp']) {
      await assertFails(
        getDoc(doc(db, `sessions/live/problems/hidden/solutions/${language}`)),
      );
      await assertSucceeds(
        getDoc(
          doc(db, `sessions/live/problems/revealed/solutions/${language}`),
        ),
      );
      await assertSucceeds(
        getDoc(
          doc(db, `sessions/ended/problems/revealed/solutions/${language}`),
        ),
      );
      await assertSucceeds(
        getDoc(doc(db, `sessions/ended/problems/hidden/solutions/${language}`)),
      );
      await assertFails(
        getDoc(
          doc(db, `sessions/draft/problems/revealed/solutions/${language}`),
        ),
      );
    }
    for (const sessionId of ['draft', 'live', 'ended']) {
      await assertFails(
        getDoc(
          doc(db, `sessions/${sessionId}/problems/revealed/solutions/rust`),
        ),
      );
    }
  });

  it('changes anonymous Solution permission immediately after Show Answers and Hide Answers writes', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    const problem = 'sessions/live/problems/hidden';
    const solution = doc(member, `${problem}/solutions/python`);

    await assertFails(getDoc(solution));
    await assertSucceeds(
      updateDoc(doc(officer, problem), { answersVisible: true }),
    );
    await assertSucceeds(getDoc(solution));
    await assertSucceeds(
      updateDoc(doc(officer, problem), { answersVisible: false }),
    );
    await assertFails(getDoc(solution));
  });

  it('allows public bank reads, including prepared Solutions, and denies anonymous writes', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    const visible = await getDocs(
      query(
        collection(member, 'problemBank'),
        where('hiddenByLiveSessionId', '==', null),
      ),
    );
    expect(visible.docs.map((item) => item.id)).toEqual([
      'legacy-private',
      'legacy-public',
      'legacy-unpublished',
      'public',
    ]);
    await assertSucceeds(getDoc(doc(member, 'problemBank/public')));
    await assertSucceeds(getDoc(doc(member, 'problemBank/legacy-public')));
    await assertFails(getDoc(doc(member, 'problemBank/used-private')));
    await assertSucceeds(getDoc(doc(member, 'problemBank/legacy-private')));
    await assertSucceeds(getDoc(doc(member, 'problemBank/legacy-unpublished')));
    await assertFails(
      getDoc(doc(member, 'problemBank/used-private/solutions/python')),
    );
    for (const language of ['python', 'java', 'cpp']) {
      await assertSucceeds(
        getDoc(doc(member, `problemBank/public/solutions/${language}`)),
      );
      await assertFails(
        setDoc(doc(member, `problemBank/public/solutions/${language}`), {
          code: 'write',
        }),
      );
    }
    await assertFails(
      setDoc(doc(member, 'problemBank/member'), {
        title: 'Member write',
        category: 'custom',
        hiddenByLiveSessionId: null,
      }),
    );
    await assertSucceeds(getDoc(doc(officer, 'problemBank/used-live')));
    await assertFails(
      setDoc(doc(officer, 'problemBank/invalid-category'), {
        title: 'Invalid category',
        category: 'leetcode',
        hiddenByLiveSessionId: null,
      }),
    );
    await assertFails(
      setDoc(doc(officer, 'problemBank/created-hidden'), {
        title: 'Cannot create already hidden',
        category: 'custom',
        hiddenByLiveSessionId: 'live',
      }),
    );
  });

  it('denies Member Bank deletion and preserves Session snapshots when an Officer deletes the Bank hierarchy', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, 'sessions/ended'), {
          status: 'ended',
          bankProblemIds: ['public'],
        }),
        setDoc(doc(db, 'sessions/ended/problems/hidden'), {
          title: 'Historical snapshot',
          description: 'Copied statement',
          exampleInput: '1',
          exampleOutput: '2',
          bankProblemId: 'public',
        }),
      ]);
    });

    await assertFails(deleteDoc(doc(anonymousDb(), 'problemBank/public')));

    const db = officerDb();
    const batch = writeBatch(db);
    for (const language of ['python', 'java', 'cpp']) {
      batch.delete(doc(db, `problemBank/public/solutions/${language}`));
      batch.delete(
        doc(db, `problemBank/public/approaches/primary/solutions/${language}`),
      );
    }
    batch.delete(doc(db, 'problemBank/public/approaches/primary'));
    batch.delete(doc(db, 'problemBank/public'));
    await assertSucceeds(batch.commit());

    await assertFails(getDoc(doc(anonymousDb(), 'problemBank/public')));
    expect(
      (await getDoc(doc(db, 'sessions/ended/problems/hidden'))).data(),
    ).toMatchObject({
      title: 'Historical snapshot',
      description: 'Copied statement',
      bankProblemId: 'public',
    });
    expect(
      (await getDoc(doc(db, 'sessions/ended'))).data()?.bankProblemIds,
    ).toEqual(['public']);
    for (const language of ['python', 'java', 'cpp']) {
      await assertSucceeds(
        getDoc(doc(db, `sessions/ended/problems/hidden/solutions/${language}`)),
      );
      await assertSucceeds(
        getDoc(
          doc(
            db,
            `sessions/ended/problems/hidden/approaches/primary/solutions/${language}`,
          ),
        ),
      );
    }
  });

  it('allows a public bank entry before the first live Session exists', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'sessionControl/intro'));
    });
    await assertSucceeds(
      setDoc(doc(officerDb(), 'problemBank/first'), {
        title: 'First reusable Problem',
        description: 'Public before a Session is live.',
        constraints: '',
        exampleInput: '1',
        exampleOutput: '1',
        category: 'custom',
        hiddenByLiveSessionId: null,
      }),
    );
    await assertSucceeds(getDoc(doc(anonymousDb(), 'problemBank/first')));
  });

  it('keeps a live Session bank Problem unavailable even when its hiding marker is stale', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    await assertFails(getDoc(doc(member, 'problemBank/used-live')));
    await assertFails(
      getDoc(doc(member, 'problemBank/used-live/solutions/python')),
    );
    // Clearing stale hiding metadata cannot expose a Bank Problem used by the live Session.
    await assertSucceeds(
      updateDoc(doc(officer, 'problemBank/used-live'), {
        hiddenByLiveSessionId: null,
      }),
    );
    await assertFails(getDoc(doc(member, 'problemBank/used-live')));
  });

  it.each(['draft', 'ended'] as const)(
    'restores bank visibility after a live Session becomes %s',
    async (nextStatus) => {
      const member = anonymousDb();
      const officer = officerDb();
      const transition = writeBatch(officer);
      transition.update(doc(officer, 'sessions/live'), { status: nextStatus });
      transition.update(doc(officer, 'sessionControl/intro'), {
        sessionId: null,
        bankProblemIds: [],
      });
      transition.update(doc(officer, 'problemBank/used-live'), {
        hiddenByLiveSessionId: null,
      });
      transition.update(doc(officer, 'problemBank/used-private'), {
        hiddenByLiveSessionId: null,
      });
      await assertSucceeds(transition.commit());
      await assertSucceeds(getDoc(doc(member, 'problemBank/used-live')));
      await assertSucceeds(
        getDoc(doc(member, 'problemBank/used-live/solutions/cpp')),
      );
      const visible = await getDocs(
        query(
          collection(member, 'problemBank'),
          where('hiddenByLiveSessionId', '==', null),
        ),
      );
      expect(visible.docs.map((item) => item.id)).toContain('used-private');
      await assertSucceeds(getDoc(doc(member, 'problemBank/used-private')));
      if (nextStatus === 'draft') {
        await assertFails(
          getDoc(doc(member, 'sessions/live/problems/hidden/solutions/python')),
        );
      } else {
        await assertSucceeds(
          getDoc(doc(member, 'sessions/live/problems/hidden/solutions/python')),
        );
      }
    },
  );

  it.each(['draft', 'ended'] as const)(
    'restores public visibility after a full live → %s cycle',
    async (nextStatus) => {
      const member = anonymousDb();
      const officer = officerDb();
      const releaseInitial = writeBatch(officer);
      releaseInitial.update(doc(officer, 'sessions/live'), { status: 'draft' });
      releaseInitial.update(doc(officer, 'sessionControl/intro'), {
        sessionId: null,
        bankProblemIds: [],
      });
      releaseInitial.update(doc(officer, 'problemBank/used-live'), {
        hiddenByLiveSessionId: null,
      });
      releaseInitial.update(doc(officer, 'problemBank/used-private'), {
        hiddenByLiveSessionId: null,
      });
      await assertSucceeds(releaseInitial.commit());
      await assertSucceeds(
        updateDoc(doc(officer, 'sessions/draft'), {
          bankProblemIds: ['public', 'used-private'],
        }),
      );

      const goLive = writeBatch(officer);
      goLive.update(doc(officer, 'sessions/draft'), { status: 'live' });
      goLive.update(doc(officer, 'sessionControl/intro'), {
        sessionId: 'draft',
        bankProblemIds: ['public', 'used-private'],
      });
      goLive.update(doc(officer, 'problemBank/public'), {
        hiddenByLiveSessionId: 'draft',
      });
      goLive.update(doc(officer, 'problemBank/used-private'), {
        hiddenByLiveSessionId: 'draft',
      });
      await assertSucceeds(goLive.commit());
      await assertFails(getDoc(doc(member, 'problemBank/public')));
      await assertFails(
        getDoc(doc(member, 'problemBank/public/solutions/python')),
      );
      await assertSucceeds(getDoc(doc(officer, 'problemBank/public')));

      const stopLive = writeBatch(officer);
      stopLive.update(doc(officer, 'sessions/draft'), { status: nextStatus });
      stopLive.update(doc(officer, 'sessionControl/intro'), {
        sessionId: null,
        bankProblemIds: [],
      });
      stopLive.update(doc(officer, 'problemBank/public'), {
        hiddenByLiveSessionId: null,
      });
      stopLive.update(doc(officer, 'problemBank/used-private'), {
        hiddenByLiveSessionId: null,
      });
      await assertSucceeds(stopLive.commit());
      await assertSucceeds(getDoc(doc(member, 'problemBank/public')));
      await assertSucceeds(
        getDoc(doc(member, 'problemBank/public/solutions/python')),
      );
      await assertSucceeds(getDoc(doc(member, 'problemBank/used-private')));
    },
  );

  it('releases live hiding when the live Session is deleted', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    const deletion = writeBatch(officer);
    deletion.update(doc(officer, 'sessionControl/intro'), {
      sessionId: null,
      bankProblemIds: [],
    });
    deletion.update(doc(officer, 'problemBank/used-live'), {
      hiddenByLiveSessionId: null,
    });
    deletion.update(doc(officer, 'problemBank/used-private'), {
      hiddenByLiveSessionId: null,
    });
    deletion.delete(doc(officer, 'sessions/live'));
    await assertSucceeds(deletion.commit());
    await assertSucceeds(getDoc(doc(member, 'problemBank/used-live')));
    await assertSucceeds(getDoc(doc(member, 'problemBank/used-private')));
  });

  it('protects Approach metadata and Solutions with Session reveal state and lifecycle', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    await assertFails(
      getDoc(doc(member, 'sessions/live/problems/hidden/approaches/primary')),
    );
    await assertFails(
      getDoc(
        doc(
          member,
          'sessions/live/problems/hidden/approaches/primary/solutions/python',
        ),
      ),
    );
    await assertSucceeds(
      getDoc(doc(member, 'sessions/live/problems/revealed/approaches/primary')),
    );
    await assertSucceeds(
      getDoc(
        doc(
          member,
          'sessions/live/problems/revealed/approaches/primary/solutions/python',
        ),
      ),
    );
    await assertFails(
      setDoc(doc(officer, 'sessions/live/problems/revealed/approaches/new'), {
        name: 'New',
        tags: [],
        order: 1,
      }),
    );
    await assertFails(
      deleteDoc(
        doc(officer, 'sessions/live/problems/revealed/approaches/primary'),
      ),
    );
    await assertFails(
      updateDoc(
        doc(officer, 'sessions/live/problems/revealed/approaches/primary'),
        { order: 2 },
      ),
    );
    await assertSucceeds(
      updateDoc(
        doc(officer, 'sessions/live/problems/revealed/approaches/primary'),
        { name: 'Corrected', tags: ['tree'] },
      ),
    );
    await assertSucceeds(
      updateDoc(
        doc(
          officer,
          'sessions/live/problems/revealed/approaches/primary/solutions/python',
        ),
        { code: 'corrected' },
      ),
    );
    await assertSucceeds(
      updateDoc(doc(officer, 'sessions/live/problems/revealed'), {
        answersVisible: false,
      }),
    );
    await assertFails(
      getDoc(doc(member, 'sessions/live/problems/revealed/approaches/primary')),
    );
    await assertFails(
      getDoc(
        doc(
          member,
          'sessions/live/problems/revealed/approaches/primary/solutions/python',
        ),
      ),
    );
    await assertSucceeds(
      getDoc(doc(member, 'sessions/ended/problems/hidden/approaches/primary')),
    );
    await assertSucceeds(
      getDoc(
        doc(
          member,
          'sessions/ended/problems/hidden/approaches/primary/solutions/cpp',
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(member, 'sessions/draft/problems/revealed/approaches/primary'),
      ),
    );
  });

  it('allows Bank Approach reads only under visible parents', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    await assertSucceeds(
      getDoc(doc(member, 'problemBank/public/approaches/primary')),
    );
    await assertSucceeds(
      getDoc(
        doc(member, 'problemBank/public/approaches/primary/solutions/java'),
      ),
    );
    await assertFails(
      getDoc(doc(member, 'problemBank/used-live/approaches/primary')),
    );
    await assertFails(
      getDoc(
        doc(member, 'problemBank/used-live/approaches/primary/solutions/java'),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(officer, 'problemBank/used-live/approaches/primary/solutions/java'),
      ),
    );
    await assertFails(
      getDoc(doc(member, 'problemBank/used-private/approaches/primary')),
    );
  });
});
