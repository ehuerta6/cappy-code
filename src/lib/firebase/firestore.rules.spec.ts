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
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

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
    );
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
    await assertFails(
      updateDoc(doc(db, 'sessions/draft'), { branch: 'advanced' }),
    );
    await assertSucceeds(
      updateDoc(doc(db, 'sessions/draft'), { branch: 'general' }),
    );
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
});
