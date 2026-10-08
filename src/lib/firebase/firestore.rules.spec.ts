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
      setDoc(doc(database, 'sessionControl/liveSession'), {
        sessionId: 'live',
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
        title: 'Unpublished and used live',
        description: 'Must remain unpublished after lifecycle release.',
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
        description: 'Legacy publication is inferred from true.',
        constraints: '',
        exampleInput: '3',
        exampleOutput: '4',
        category: 'interview-style',
        isPublic: true,
      }),
      setDoc(doc(database, 'problemBank/legacy-private'), {
        title: 'Legacy private bank Problem',
        description: 'Legacy false remains private.',
        constraints: '',
        exampleInput: '3',
        exampleOutput: '4',
        category: 'interview-style',
        isPublic: false,
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
    }
    const solutionPaths = [
      'sessions/draft/problems/revealed',
      'sessions/live/problems/hidden',
      'sessions/live/problems/revealed',
      'sessions/ended/problems/hidden',
      'sessions/ended/problems/revealed',
    ];
    for (const parentPath of solutionPaths) {
      for (const language of ['python', 'java', 'cpp']) {
        writes.push(
          setDoc(doc(database, `${parentPath}/solutions/${language}`), {
            code: `${language} source`,
          }),
        );
      }
    }
    await Promise.all(writes);
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

  it('requires an atomic live-session pointer and allows only one live Session', async () => {
    const db = officerDb();
    await assertFails(updateDoc(doc(db, 'sessions/draft'), { status: 'live' }));

    const staleWrite = writeBatch(db);
    staleWrite.update(doc(db, 'sessions/draft'), { status: 'live' });
    staleWrite.update(doc(db, 'sessionControl/liveSession'), {
      sessionId: 'draft',
    });
    await assertFails(staleWrite.commit());

    const transition = writeBatch(db);
    transition.update(doc(db, 'sessions/live'), { status: 'draft' });
    transition.update(doc(db, 'sessions/draft'), { status: 'live' });
    transition.update(doc(db, 'sessionControl/liveSession'), {
      sessionId: 'draft',
    });
    await assertSucceeds(transition.commit());
    await assertSucceeds(getDoc(doc(db, 'sessions/draft')));
  });

  it('allows Not Live only with the pointer cleared and preserves prepared Problem data', async () => {
    const db = officerDb();
    await assertFails(updateDoc(doc(db, 'sessions/live'), { status: 'draft' }));

    const transition = writeBatch(db);
    transition.update(doc(db, 'sessions/live'), { status: 'draft' });
    transition.update(doc(db, 'sessionControl/liveSession'), {
      sessionId: null,
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

  it('allows deleting a live Session only when its live claim is released atomically', async () => {
    const db = officerDb();
    await assertFails(deleteDoc(doc(db, 'sessions/live')));

    const deletion = writeBatch(db);
    deletion.update(doc(db, 'sessionControl/liveSession'), { sessionId: null });
    deletion.delete(doc(db, 'sessions/live'));
    await assertSucceeds(deletion.commit());
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
        where('isPublished', '==', true),
        where('hiddenByLiveSessionId', '==', null),
      ),
    );
    expect(visible.docs.map((item) => item.id)).toEqual(['public']);
    await assertSucceeds(getDoc(doc(member, 'problemBank/public')));
    await assertSucceeds(getDoc(doc(member, 'problemBank/legacy-public')));
    await assertSucceeds(
      getDocs(
        query(collection(member, 'problemBank'), where('isPublic', '==', true)),
      ),
    );
    await assertFails(getDoc(doc(member, 'problemBank/used-private')));
    await assertFails(getDoc(doc(member, 'problemBank/legacy-private')));
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
        isPublished: true,
        hiddenByLiveSessionId: null,
      }),
    );
    await assertSucceeds(getDoc(doc(officer, 'problemBank/used-live')));
    await assertFails(
      setDoc(doc(officer, 'problemBank/invalid-category'), {
        title: 'Invalid category',
        category: 'leetcode',
        isPublished: false,
        hiddenByLiveSessionId: null,
      }),
    );
  });

  it('allows a public bank entry before the first live Session exists', async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'sessionControl/liveSession'));
    });
    await assertSucceeds(
      setDoc(doc(officerDb(), 'problemBank/first'), {
        title: 'First reusable Problem',
        description: 'Public before a Session is live.',
        constraints: '',
        exampleInput: '1',
        exampleOutput: '1',
        category: 'custom',
        isPublished: false,
        hiddenByLiveSessionId: null,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(officerDb(), 'problemBank/first'), { isPublished: true }),
    );
    await assertSucceeds(getDoc(doc(anonymousDb(), 'problemBank/first')));
  });

  it('allows explicit Officer publish and unpublish while Members follow the saved intent', async () => {
    const officer = officerDb();
    const member = anonymousDb();
    await assertSucceeds(
      updateDoc(doc(officer, 'problemBank/used-private'), {
        isPublished: true,
      }),
    );
    // The active live Session still hides this Bank copy.
    await assertFails(getDoc(doc(member, 'problemBank/used-private')));

    await assertSucceeds(
      updateDoc(doc(officer, 'problemBank/public'), { isPublished: false }),
    );
    await assertFails(getDoc(doc(member, 'problemBank/public')));
    await assertFails(
      getDoc(doc(member, 'problemBank/public/solutions/python')),
    );
    await assertSucceeds(getDoc(doc(officer, 'problemBank/public')));
  });

  it('keeps a live Session bank Problem unavailable even if an Officer tries to make it public', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    await assertFails(getDoc(doc(member, 'problemBank/used-live')));
    await assertFails(
      getDoc(doc(member, 'problemBank/used-live/solutions/python')),
    );
    await assertSucceeds(
      updateDoc(doc(officer, 'problemBank/used-live'), { isPublished: true }),
    );
    const visible = await getDocs(
      query(
        collection(member, 'problemBank'),
        where('isPublished', '==', true),
        where('hiddenByLiveSessionId', '==', null),
      ),
    );
    expect(visible.docs.map((item) => item.id)).toEqual(['public']);
  });

  it.each(['draft', 'ended'] as const)(
    'restores bank visibility after a live Session becomes %s',
    async (nextStatus) => {
      const member = anonymousDb();
      const officer = officerDb();
      const transition = writeBatch(officer);
      transition.update(doc(officer, 'sessions/live'), { status: nextStatus });
      transition.update(doc(officer, 'sessionControl/liveSession'), {
        sessionId: null,
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
      await assertSucceeds(
        getDocs(
          query(
            collection(member, 'problemBank'),
            where('isPublished', '==', true),
            where('hiddenByLiveSessionId', '==', null),
          ),
        ),
      );
      await assertFails(getDoc(doc(member, 'problemBank/used-private')));
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
    'restores the saved publication intent after a full live → %s cycle',
    async (nextStatus) => {
      const member = anonymousDb();
      const officer = officerDb();
      const releaseInitial = writeBatch(officer);
      releaseInitial.update(doc(officer, 'sessions/live'), { status: 'draft' });
      releaseInitial.update(doc(officer, 'sessionControl/liveSession'), {
        sessionId: null,
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
      goLive.update(doc(officer, 'sessionControl/liveSession'), {
        sessionId: 'draft',
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
      stopLive.update(doc(officer, 'sessionControl/liveSession'), {
        sessionId: null,
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
      await assertFails(getDoc(doc(member, 'problemBank/used-private')));
    },
  );

  it('releases live hiding when the live Session is deleted without changing publication intent', async () => {
    const member = anonymousDb();
    const officer = officerDb();
    const deletion = writeBatch(officer);
    deletion.update(doc(officer, 'sessionControl/liveSession'), {
      sessionId: null,
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
    await assertFails(getDoc(doc(member, 'problemBank/used-private')));
  });
});
