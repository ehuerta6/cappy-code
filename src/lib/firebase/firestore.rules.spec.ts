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
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
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
  await environment.withSecurityRulesDisabled(async ({ firestore }) => {
    const records = [
      ['draft', 'draft', 'revealed', true],
      ['live', 'live', 'hidden', false],
      ['live', 'live', 'revealed', true],
      ['ended', 'ended', 'revealed', true],
    ] as const;
    const writes = records.flatMap(
      ([sessionId, status, problemId, visible]) => {
        const database = firestore();
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
    const solutionPaths = [
      'sessions/draft/problems/revealed',
      'sessions/live/problems/hidden',
      'sessions/live/problems/revealed',
      'sessions/ended/problems/revealed',
    ];
    for (const parentPath of solutionPaths) {
      for (const language of ['python', 'java', 'cpp']) {
        writes.push(
          setDoc(doc(firestore(), `${parentPath}/solutions/${language}`), {
            code: `${language} source`,
            output: `${language} output`,
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
  it('allows an authenticated officer to read and write draft sessions, problems, and fixed solutions', async () => {
    const db = officerDb();
    await assertSucceeds(getDoc(doc(db, 'sessions/draft')));
    await assertSucceeds(
      setDoc(doc(db, 'sessions/draft'), {
        title: 'Updated draft',
        status: 'draft',
      }),
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
      await assertSucceeds(setDoc(solution, { code: 'updated', output: '' }));
    }
    await assertFails(
      getDoc(doc(db, 'sessions/draft/problems/revealed/solutions/rust')),
    );
  });

  it('denies anonymous draft Session reads and all anonymous Session writes', async () => {
    const db = anonymousDb();
    await assertFails(getDoc(doc(db, 'sessions/draft')));
    await assertSucceeds(getDoc(doc(db, 'sessions/live')));
    await assertSucceeds(getDoc(doc(db, 'sessions/ended')));
    await assertFails(
      setDoc(doc(db, 'sessions/live'), { title: 'forbidden', status: 'live' }),
    );
    const anonymousAuth = anonymousAuthDb();
    await assertFails(getDoc(doc(anonymousAuth, 'sessions/draft')));
    await assertFails(
      setDoc(doc(anonymousAuth, 'sessions/draft'), {
        title: 'forbidden',
        status: 'draft',
      }),
    );
  });

  it('allows anonymous Problem reads only beneath live or ended Sessions', async () => {
    const db = anonymousDb();
    await assertFails(getDoc(doc(db, 'sessions/draft/problems/revealed')));
    await assertSucceeds(getDoc(doc(db, 'sessions/live/problems/hidden')));
    await assertSucceeds(getDoc(doc(db, 'sessions/ended/problems/revealed')));
    await assertFails(
      updateDoc(doc(db, 'sessions/live/problems/hidden'), { title: 'write' }),
    );
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

  it('denies hidden and draft Solutions and permits revealed public Solutions only for fixed languages', async () => {
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
      await assertFails(
        getDoc(
          doc(db, `sessions/draft/problems/revealed/solutions/${language}`),
        ),
      );
      await assertFails(
        setDoc(
          doc(db, `sessions/live/problems/revealed/solutions/${language}`),
          { code: 'write', output: '' },
        ),
      );
    }
    await assertFails(
      getDoc(doc(db, 'sessions/live/problems/revealed/solutions/rust')),
    );
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
