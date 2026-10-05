import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

const host = '127.0.0.1';
const projectId = 'demo-cappycode-local';
const authBase = `http://${host}:9099/identitytoolkit.googleapis.com/v1`;
const officerEmail = 'officer@cappycode.local';
const officerPassword = 'cappycode-local-only';

const timestamp = '2026-10-04T18:00:00Z';
const session = (title, date, status) => ({
  title,
  date,
  status,
  createdAt: Timestamp.fromDate(new Date(timestamp)),
  updatedAt: Timestamp.fromDate(new Date(timestamp)),
});

const examples = {
  python: {
    code: 'def two_sum(nums, target):\n    seen = {}\n    for index, value in enumerate(nums):\n        needed = target - value\n        if needed in seen:\n            return [seen[needed], index]\n        seen[value] = index\n    return []',
    output: '[0, 1]',
  },
  java: {
    code: 'int[] twoSum(int[] nums, int target) {\n    Map<Integer, Integer> seen = new HashMap<>();\n    for (int i = 0; i < nums.length; i++) {\n        int needed = target - nums[i];\n        if (seen.containsKey(needed)) return new int[] {seen.get(needed), i};\n        seen.put(nums[i], i);\n    }\n    return new int[0];\n}',
    output: '[0, 1]',
  },
  cpp: {
    code: 'vector<int> twoSum(vector<int>& nums, int target) {\n    unordered_map<int, int> seen;\n    for (int i = 0; i < nums.size(); ++i) {\n        int needed = target - nums[i];\n        if (seen.count(needed)) return {seen[needed], i};\n        seen[nums[i]] = i;\n    }\n    return {};\n}',
    output: '[0, 1]',
  },
};

const extraSolutions = {
  'custom-brackets': {
    python: `def balanced(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in text:
        if char in "([{": stack.append(char)
        elif not stack or stack.pop() != pairs[char]: return False
    return not stack`,
    java: `boolean balanced(String text) {
    Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
    Deque<Character> stack = new ArrayDeque<>();
    for (char ch : text.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') stack.push(ch);
        else if (stack.isEmpty() || stack.pop() != pairs.get(ch)) return false;
    }
    return stack.isEmpty();
}`,
    cpp: `bool balanced(string text) {
    unordered_map<char, char> pairs{{')', '('}, {']', '['}, {'}', '{'}};
    stack<char> values;
    for (char ch : text) {
        if (ch == '(' || ch == '[' || ch == '{') values.push(ch);
        else if (values.empty() || values.top() != pairs[ch]) return false;
        else values.pop();
    }
    return values.empty();
}`,
  },
  'valid-parentheses': {
    python: `def is_valid(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in text:
        if char in "([{": stack.append(char)
        elif not stack or stack.pop() != pairs[char]: return False
    return not stack`,
    java: `boolean isValid(String text) {
    Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
    Deque<Character> stack = new ArrayDeque<>();
    for (char ch : text.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') stack.push(ch);
        else if (stack.isEmpty() || stack.pop() != pairs.get(ch)) return false;
    }
    return stack.isEmpty();
}`,
    cpp: `bool isValid(string text) {
    unordered_map<char, char> pairs{{')', '('}, {']', '['}, {'}', '{'}};
    stack<char> values;
    for (char ch : text) {
        if (ch == '(' || ch == '[' || ch == '{') values.push(ch);
        else if (values.empty() || values.top() != pairs[ch]) return false;
        else values.pop();
    }
    return values.empty();
}`,
  },
  'custom-merge': {
    python: `def merge(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]: result.append(left[i]); i += 1
        else: result.append(right[j]); j += 1
    return result + left[i:] + right[j:]`,
    java: `int[] merge(int[] left, int[] right) {
    int[] result = new int[left.length + right.length];
    int i = 0, j = 0, k = 0;
    while (i < left.length && j < right.length)
        result[k++] = left[i] <= right[j] ? left[i++] : right[j++];
    while (i < left.length) result[k++] = left[i++];
    while (j < right.length) result[k++] = right[j++];
    return result;
}`,
    cpp: `vector<int> merge(vector<int>& left, vector<int>& right) {
    vector<int> result;
    int i = 0, j = 0;
    while (i < left.size() && j < right.size())
        result.push_back(left[i] <= right[j] ? left[i++] : right[j++]);
    while (i < left.size()) result.push_back(left[i++]);
    while (j < right.size()) result.push_back(right[j++]);
    return result;
}`,
  },
};

const problems = [
  {
    path: 'sessions/draft-october/problems/custom-array-sum',
    title: 'Custom: Array Pair Sum',
    description: 'Return the indices of two values that add up to the target.',
    exampleInput: 'nums = [2, 7, 11, 15], target = 9',
    exampleOutput: '[0, 1]',
    order: 0,
    answersVisible: false,
  },
  {
    path: 'sessions/live-october/problems/two-sum',
    title: 'Two Sum',
    description: 'Return the indices of the two numbers that add up to target.',
    exampleInput: 'nums = [2, 7, 11, 15], target = 9',
    exampleOutput: '[0, 1]',
    order: 0,
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
  },
  {
    path: 'sessions/live-october/problems/custom-brackets',
    title: 'Custom: Balanced Brackets',
    description: 'Decide whether every opening bracket is correctly closed.',
    exampleInput: 'text = "([])"',
    exampleOutput: 'true',
    order: 1,
    answersVisible: false,
  },
  {
    path: 'sessions/ended-september/problems/valid-parentheses',
    title: 'Valid Parentheses',
    description: 'Check whether brackets close in the correct order.',
    exampleInput: 'text = "()[]{}"',
    exampleOutput: 'true',
    order: 0,
    answersVisible: false,
    leetcodeUrl: 'https://leetcode.com/problems/valid-parentheses/',
  },
  {
    path: 'sessions/ended-september/problems/custom-merge',
    title: 'Custom: Merge Two Sorted Lists',
    description: 'Merge two ascending lists into one ascending list.',
    exampleInput: 'left = [1, 4], right = [2, 3]',
    exampleOutput: '[1, 2, 3, 4]',
    order: 1,
    answersVisible: false,
  },
];

const field = (value) => {
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  throw new Error(`Unsupported seed field: ${String(value)}`);
};

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      `Cannot reach Firebase Emulator at ${host}. Start it with npm run emulators.`,
      { cause: error },
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error?.message ?? response.statusText;
    throw new Error(`Emulator request failed (${response.status}): ${message}`);
  }
  return body;
}

export async function clearEmulatorData() {
  await request(
    `http://${host}:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await request(
    `http://${host}:9099/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' },
  );
}

export async function seedEmulatorData() {
  const account = await request(
    `${authBase}/accounts:signUp?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: officerEmail,
        password: officerPassword,
        returnSecureToken: true,
      }),
    },
  ).catch(async (error) => {
    if (!String(error.message).includes('EMAIL_EXISTS')) throw error;
    return request(`${authBase}/accounts:signInWithPassword?key=demo-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: officerEmail,
        password: officerPassword,
        returnSecureToken: true,
      }),
    });
  });

  const documents = [
    [
      'sessions/draft-october',
      session('CIC Intro — Arrays Workshop', '2026-10-12', 'draft'),
    ],
    [
      'sessions/live-october',
      session('CIC Intro — Hash Maps', '2026-10-05', 'live'),
    ],
    [
      'sessions/ended-september',
      session('CIC Intro — September Review', '2026-09-28', 'ended'),
    ],
    ...problems.map(({ path, ...problem }) => [
      path,
      Object.fromEntries(
        Object.entries(problem).map(([key, value]) => [key, field(value)]),
      ),
    ]),
    ...problems.flatMap(({ path }) =>
      Object.entries(examples).map(([language, solution]) => [
        `${path}/solutions/${language}`,
        {
          code:
            extraSolutions[path.split('/').at(-1)]?.[language] ?? solution.code,
          output: path.endsWith('custom-merge')
            ? '[1, 2, 3, 4]'
            : path.endsWith('custom-brackets') ||
                path.endsWith('valid-parentheses')
              ? 'true'
              : solution.output,
        },
      ]),
    ),
  ];

  const environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port: 8080,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
  try {
    await environment.withSecurityRulesDisabled(async (context) => {
      const database = context.firestore();
      for (const [path, fields] of documents) {
        await setDoc(doc(database, path), fields);
      }
    });
  } finally {
    await environment.cleanup();
  }

  console.log(
    `Seeded ${problems.length} Problems and 3 Sessions in ${projectId}.`,
  );
  console.log(`Local Officer: ${officerEmail} / ${officerPassword}`);
  console.log(`Auth emulator UID: ${account.localId}`);
}
