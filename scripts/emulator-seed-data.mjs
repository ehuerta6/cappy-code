import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

const host = '127.0.0.1';
const projectId = 'demo-cappycode-local';
const firestoreBase = `http://${host}:8080`;
const authBase = `http://${host}:9099/identitytoolkit.googleapis.com/v1`;
const officerEmail = 'cappy@gmail.com';
const officerPassword = 'cappy123';

const timestamp = Timestamp.fromDate(new Date('2026-10-04T18:00:00Z'));

const sessions = [
  {
    id: 'live-hash-maps',
    branch: 'intro',
    title: 'CIC Intro — Hash Maps & Arrays',
    date: '2026-10-05',
    status: 'live',
  },
  {
    id: 'draft-sliding-window',
    branch: 'intro',
    title: 'CIC Intro — Sliding Window Preview',
    date: '2026-10-12',
    status: 'draft',
  },
  {
    id: 'draft-custom-workshop',
    branch: 'intro',
    title: 'CIC Intro — Custom Workshop',
    date: '2026-10-19',
    status: 'draft',
  },
  {
    id: 'ended-intro-review',
    branch: 'intro',
    title: 'CIC Intro — Fall Foundations Review',
    date: '2026-09-28',
    status: 'ended',
  },
  {
    id: 'ended-arrays-hashing',
    branch: 'intro',
    title: 'CIC Intro — Arrays & Hashing',
    date: '2026-09-21',
    status: 'ended',
  },
  {
    id: 'ended-two-pointers',
    branch: 'intro',
    title: 'CIC Intro — Two Pointers',
    date: '2026-09-14',
    status: 'ended',
  },
  {
    id: 'ended-sliding-window',
    branch: 'intro',
    title: 'CIC Intro — Sliding Window',
    date: '2026-09-07',
    status: 'ended',
  },
  {
    id: 'ended-stack',
    branch: 'intro',
    title: 'CIC Intro — Stack Patterns',
    date: '2026-08-31',
    status: 'ended',
  },
  {
    id: 'ended-binary-search',
    branch: 'intro',
    title: 'CIC Intro — Binary Search',
    date: '2026-08-24',
    status: 'ended',
  },
  {
    id: 'ended-linked-lists',
    branch: 'intro',
    title: 'CIC Intro — Linked Lists',
    date: '2026-08-17',
    status: 'ended',
  },
  {
    id: 'ended-trees',
    branch: 'intro',
    title: 'CIC Intro — Trees',
    date: '2026-08-10',
    status: 'ended',
  },
  {
    id: 'ended-graphs',
    branch: 'intro',
    title: 'CIC Intro — Graphs & Grids',
    date: '2026-08-03',
    status: 'ended',
  },
  {
    id: 'ended-dynamic-programming',
    branch: 'intro',
    title: 'CIC Intro — Dynamic Programming',
    date: '2026-07-27',
    status: 'ended',
  },
  {
    id: 'ended-general-practice',
    branch: 'general',
    title: 'CIC General — Graph Algorithms',
    date: '2026-09-18',
    status: 'ended',
  },
  {
    id: 'ended-icpc-practice',
    branch: 'icpc',
    title: 'CIC ICPC — Contest Patterns',
    date: '2026-09-20',
    status: 'ended',
  },
];

const problems = [
  {
    sessionId: 'live-hash-maps',
    id: 'two-sum',
    title: 'Two Sum',
    description:
      'Given an integer array `nums` and a target, return the **indices** of two distinct values that add up to the target.',
    exampleInput: 'nums = [2, 7, 11, 15], target = 9',
    exampleOutput: '[0, 1]',
    constraints:
      '2 ≤ nums.length ≤ 10⁴\n-10⁹ ≤ nums[i] ≤ 10⁹\n-10⁹ ≤ target ≤ 10⁹\nExactly one valid answer exists; do not use the same element twice.',
    answersVisible: true,
    difficulty: 'medium',
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    solution: 'two-sum',
    solutionComplexities: {
      python: {
        timeComplexity: 'O(n)',
        timeComplexityReason:
          'One pass with average constant-time hash lookups.',
        spaceComplexity: 'O(n)',
        spaceComplexityReason: 'The map can store each value.',
      },
      java: {
        timeComplexity: 'O(n)',
        timeComplexityReason:
          'One pass with average constant-time hash lookups.',
        spaceComplexity: 'O(n)',
        spaceComplexityReason: 'The map can store each value.',
      },
      cpp: {
        timeComplexity: 'O(n)',
        timeComplexityReason:
          'One pass with average constant-time hash lookups.',
        spaceComplexity: 'O(n)',
        spaceComplexityReason: 'The map can store each value.',
      },
    },
  },
  {
    sessionId: 'live-hash-maps',
    id: 'custom-frequency-map',
    title: 'Custom: First Repeated Workshop ID',
    description:
      'Return the first value that appears for a second time while scanning the list from left to right.',
    exampleInput: 'ids = [14, 6, 9, 6, 14]',
    exampleOutput: '6',
    constraints:
      'The answer is the first repeated value encountered from left to right.',
    answersVisible: false,
    solution: 'first-repeat',
    solutionComplexities: {
      python: {
        timeComplexity: 'O(n)',
        timeComplexityReason: 'Each value is checked at most once.',
        spaceComplexity: 'O(n)',
        spaceComplexityReason: 'The set may contain all values.',
      },
      java: {
        timeComplexity: 'O(n)',
        timeComplexityReason: 'Each value is checked at most once.',
        spaceComplexity: 'O(n)',
        spaceComplexityReason: 'The set may contain all values.',
      },
    },
  },
  {
    sessionId: 'live-hash-maps',
    id: 'valid-anagram',
    title: 'Valid Anagram',
    description:
      'Determine whether the two lowercase strings contain the same characters with the same frequencies.',
    exampleInput: 's = "anagram", t = "nagaram"',
    exampleOutput: 'true',
    answersVisible: false,
    difficulty: 'easy',
    leetcodeUrl: 'https://leetcode.com/problems/valid-anagram/',
    solution: 'valid-anagram',
    solutionComplexities: {
      python: {
        timeComplexity: 'O(n)',
        timeComplexityReason: 'Both strings are scanned once.',
        spaceComplexity: 'O(1)',
        spaceComplexityReason: 'The lowercase alphabet bounds the count map.',
      },
      java: {
        timeComplexity: 'O(n)',
        timeComplexityReason: 'Both strings are scanned once.',
        spaceComplexity: 'O(1)',
        spaceComplexityReason: 'The lowercase alphabet bounds the count array.',
      },
      cpp: {
        timeComplexity: 'O(n)',
        timeComplexityReason: 'Both strings are scanned once.',
        spaceComplexity: 'O(1)',
        spaceComplexityReason: 'The lowercase alphabet bounds the count array.',
      },
    },
  },
  {
    sessionId: 'draft-sliding-window',
    id: 'best-time-stock',
    title: 'Best Time to Buy and Sell Stock',
    description:
      'Choose one day to buy and a later day to sell. Return the greatest possible profit, or zero when no trade helps.',
    exampleInput: 'prices = [7, 1, 5, 3, 6, 4]',
    exampleOutput: '5',
    constraints: '1 ≤ prices.length ≤ 10⁵\nPrices are non-negative integers.',
    answersVisible: false,
    leetcodeUrl:
      'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    solution: 'stock-profit',
  },
  {
    sessionId: 'draft-sliding-window',
    id: 'longest-unique-window',
    title: 'Longest Substring Without Repeating Characters',
    description:
      'Find the length of the longest substring that contains no repeated characters.',
    exampleInput: 's = "abcabcbb"',
    exampleOutput: '3',
    constraints:
      '0 ≤ s.length ≤ 5 × 10⁴\ns contains printable ASCII characters.',
    answersVisible: false,
    leetcodeUrl:
      'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
    solution: 'longest-unique-window',
  },
  {
    sessionId: 'draft-custom-workshop',
    id: 'custom-pair-growth',
    title: 'Custom: Pairwise Growth Challenge',
    description: 'Add the products of every distinct pair in the list.',
    exampleInput: 'values = [1, 2, 3]',
    exampleOutput: '11',
    answersVisible: false,
    solution: 'pairwise-growth',
  },
  {
    sessionId: 'ended-intro-review',
    id: 'review-two-sum',
    title: 'Two Sum',
    description:
      'Find two distinct indices whose values add up to the requested target.',
    exampleInput: 'nums = [2, 7, 11, 15], target = 9',
    exampleOutput: '[0, 1]',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/two-sum/',
    solution: 'two-sum',
  },
  {
    sessionId: 'ended-intro-review',
    id: 'review-custom-check-in',
    title: 'Custom: Workshop Check-in Counts',
    description:
      'Count how many times each check-in code appears so the facilitator can compare attendance.',
    exampleInput: 'codes = ["A", "B", "A", "C", "B", "A"]',
    exampleOutput: '{A: 3, B: 2, C: 1}',
    answersVisible: false,
    solution: 'count-values',
  },
  {
    sessionId: 'ended-intro-review',
    id: 'review-valid-parentheses',
    title: 'Valid Parentheses',
    description:
      'Check that every opening bracket is closed by the matching type in the correct order.',
    exampleInput: 's = "([]{})"',
    exampleOutput: 'true',
    constraints: 's contains only the bracket characters ()[]{}.',
    answersVisible: false,
    leetcodeUrl: 'https://leetcode.com/problems/valid-parentheses/',
    solution: 'valid-parentheses',
  },
  {
    sessionId: 'ended-arrays-hashing',
    id: 'contains-duplicate',
    title: 'Contains Duplicate',
    description:
      'Return true when any value occurs at least twice in the input array.',
    exampleInput: 'nums = [1, 2, 3, 1]',
    exampleOutput: 'true',
    constraints: '1 ≤ nums.length ≤ 10⁵\nValues are integers.',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/contains-duplicate/',
    solution: 'contains-duplicate',
  },
  {
    sessionId: 'ended-arrays-hashing',
    id: 'product-except-self',
    title: 'Product of Array Except Self',
    description:
      'Return each position’s product of all other values without using division.',
    exampleInput: 'nums = [1, 2, 3, 4]',
    exampleOutput: '[24, 12, 8, 6]',
    constraints:
      '2 ≤ nums.length ≤ 10⁵\nProducts fit in a signed 32-bit integer.',
    answersVisible: false,
    difficulty: 'hard',
    leetcodeUrl: 'https://leetcode.com/problems/product-of-array-except-self/',
    solution: 'product-except-self',
  },
  {
    sessionId: 'ended-arrays-hashing',
    id: 'custom-array-checksum',
    title: 'Custom: Array Checksum',
    description:
      'Return the sum of values that occur exactly once in the array.',
    exampleInput: 'values = [4, 2, 4, 7, 2, 9]',
    exampleOutput: '16',
    answersVisible: true,
    solution: 'unique-sum',
  },
  {
    sessionId: 'ended-two-pointers',
    id: 'container-most-water',
    title: 'Container With Most Water',
    description:
      'Choose two vertical lines that contain the greatest possible amount of water.',
    exampleInput: 'height = [1, 8, 6, 2, 5, 4, 8, 3, 7]',
    exampleOutput: '49',
    constraints: '2 ≤ height.length ≤ 10⁵\n0 ≤ height[i] ≤ 10⁴',
    answersVisible: false,
    difficulty: 'medium',
    leetcodeUrl: 'https://leetcode.com/problems/container-with-most-water/',
    solution: 'container-water',
  },
  {
    sessionId: 'ended-two-pointers',
    id: 'custom-merge-rows',
    title: 'Custom: Merge Two Sorted Rows',
    description:
      'Merge two ascending arrays while preserving the original order of equal values.',
    exampleInput: 'left = [1, 4, 8], right = [2, 4, 9]',
    exampleOutput: '[1, 2, 4, 4, 8, 9]',
    answersVisible: true,
    solution: 'merge-arrays',
  },
  {
    sessionId: 'ended-sliding-window',
    id: 'sliding-stock',
    title: 'Best Time to Buy and Sell Stock',
    description:
      'Track the best return available from one purchase followed by one later sale.',
    exampleInput: 'prices = [7, 1, 5, 3, 6, 4]',
    exampleOutput: '5',
    answersVisible: true,
    leetcodeUrl:
      'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/',
    solution: 'stock-profit',
  },
  {
    sessionId: 'ended-sliding-window',
    id: 'custom-window-temperature',
    title: 'Custom: Warmest Three-Day Window',
    description:
      'Find the greatest total temperature across any three consecutive days.',
    exampleInput: 'temps = [18, 21, 19, 25, 24]',
    exampleOutput: '68',
    answersVisible: false,
    solution: 'max-window-sum',
  },
  {
    sessionId: 'ended-stack',
    id: 'stack-valid-parentheses',
    title: 'Valid Parentheses',
    description:
      'Use a stack to verify that parentheses, braces, and brackets are balanced.',
    exampleInput: 's = "{[()]}"',
    exampleOutput: 'true',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/valid-parentheses/',
    solution: 'valid-parentheses',
  },
  {
    sessionId: 'ended-stack',
    id: 'custom-markdown-delimiters',
    title: 'Custom: Workshop Delimiter Check',
    description:
      'Return whether each opening parenthesis, bracket, or brace has a matching closer.',
    exampleInput: 'text = "[(())]"',
    exampleOutput: 'true',
    answersVisible: false,
    solution: 'balanced-delimiters',
  },
  {
    sessionId: 'ended-binary-search',
    id: 'binary-search',
    title: 'Binary Search',
    description:
      'Return the index of target in a sorted array, or -1 when it is absent.',
    exampleInput: 'nums = [-1, 0, 3, 5, 9, 12], target = 9',
    exampleOutput: '4',
    constraints: '1 ≤ nums.length ≤ 10⁴\nnums is sorted in ascending order.',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/binary-search/',
    solution: 'binary-search',
  },
  {
    sessionId: 'ended-binary-search',
    id: 'custom-range-search',
    title: 'Custom: Find the First Available Seat',
    description:
      'In a sorted list of seat numbers, find the insertion position for the next available seat.',
    exampleInput: 'seats = [2, 5, 8, 12], requested = 7',
    exampleOutput: '2',
    answersVisible: false,
    solution: 'search-insert',
  },
  {
    sessionId: 'ended-linked-lists',
    id: 'merge-two-lists',
    title: 'Merge Two Sorted Lists',
    description:
      'Merge two sorted linked lists and return the head of the combined sorted list.',
    exampleInput: 'list1 = [1, 2, 4], list2 = [1, 3, 4]',
    exampleOutput: '[1, 1, 2, 3, 4, 4]',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/merge-two-sorted-lists/',
    solution: 'merge-two-lists',
  },
  {
    sessionId: 'ended-linked-lists',
    id: 'custom-reverse-agenda',
    title: 'Custom: Reverse the Workshop Agenda',
    description:
      'Reverse a singly linked list of agenda items and return the new first item.',
    exampleInput: 'agenda = ["warm-up", "practice", "review"]',
    exampleOutput: '["review", "practice", "warm-up"]',
    answersVisible: false,
    solution: 'reverse-list',
  },
  {
    sessionId: 'ended-trees',
    id: 'maximum-depth-tree',
    title: 'Maximum Depth of Binary Tree',
    description:
      'Return the number of nodes on the longest path from the root down to a leaf.',
    exampleInput: 'root = [3, 9, 20, null, null, 15, 7]',
    exampleOutput: '3',
    constraints: 'The tree contains at most 10⁴ nodes.',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/',
    solution: 'max-depth-tree',
  },
  {
    sessionId: 'ended-trees',
    id: 'custom-tree-levels',
    title: 'Custom: Count Filled Workshop Levels',
    description:
      'Return the number of levels in a binary tree that contain at least one node.',
    exampleInput: 'root = [8, 4, 12, 2, 6]',
    exampleOutput: '3',
    constraints: 'The tree contains at most 10⁴ nodes.',
    answersVisible: false,
    solution: 'count-tree-levels',
  },
  {
    sessionId: 'ended-graphs',
    id: 'number-of-islands',
    title: 'Number of Islands',
    description:
      'Count connected groups of land in a grid where horizontal and vertical neighbors are adjacent.',
    exampleInput: 'grid = [[1,1,0],[0,1,0],[1,0,1]]',
    exampleOutput: '3',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/number-of-islands/',
    solution: 'number-of-islands',
  },
  {
    sessionId: 'ended-graphs',
    id: 'custom-campus-path',
    title: 'Custom: Campus Room Reachability',
    description:
      'Starting in one room, determine whether a sequence of doorways can reach the destination room.',
    exampleInput: 'doors = [[0, 1], [1, 3], [2, 4]], start = 0, end = 3',
    exampleOutput: 'true',
    answersVisible: false,
    solution: 'room-reachability',
  },
  {
    sessionId: 'ended-dynamic-programming',
    id: 'climbing-stairs',
    title: 'Climbing Stairs',
    description:
      'Count the ways to reach the top when each move climbs one or two steps.',
    exampleInput: 'n = 5',
    exampleOutput: '8',
    answersVisible: true,
    leetcodeUrl: 'https://leetcode.com/problems/climbing-stairs/',
    solution: 'climbing-stairs',
  },
  {
    sessionId: 'ended-dynamic-programming',
    id: 'house-robber',
    title: 'House Robber',
    description:
      'Choose non-adjacent houses to maximize the total value collected.',
    exampleInput: 'nums = [2, 7, 9, 3, 1]',
    exampleOutput: '12',
    answersVisible: false,
    leetcodeUrl: 'https://leetcode.com/problems/house-robber/',
    solution: 'house-robber',
  },
];

const implementations = {
  'two-sum': {
    python: `def two_sum(nums, target):
    seen = {}
    for index, value in enumerate(nums):
        needed = target - value
        if needed in seen:
            return [seen[needed], index]
        seen[value] = index
    return []`,
    java: `int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int needed = target - nums[i];
        if (seen.containsKey(needed)) return new int[] {seen.get(needed), i};
        seen.put(nums[i], i);
    }
    return new int[0];
}`,
    cpp: `vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); ++i) {
        int needed = target - nums[i];
        if (seen.count(needed)) return {seen[needed], i};
        seen[nums[i]] = i;
    }
    return {};
}`,
  },
  'first-repeat': {
    python: `def first_repeat(values):
    seen = set()
    for value in values:
        if value in seen:
            return value
        seen.add(value)
    return None`,
    java: `Integer firstRepeat(int[] values) {
    Set<Integer> seen = new HashSet<>();
    for (int value : values) {
        if (!seen.add(value)) return value;
    }
    return null;
}`,
    cpp: `optional<int> firstRepeat(vector<int>& values) {
    unordered_set<int> seen;
    for (int value : values) {
        if (!seen.insert(value).second) return value;
    }
    return nullopt;
}`,
  },
  'valid-anagram': {
    python: `def is_anagram(left, right):
    if len(left) != len(right):
        return False
    counts = {}
    for char in left:
        counts[char] = counts.get(char, 0) + 1
    for char in right:
        counts[char] = counts.get(char, 0) - 1
    return all(count == 0 for count in counts.values())`,
    java: `boolean isAnagram(String left, String right) {
    if (left.length() != right.length()) return false;
    int[] counts = new int[26];
    for (char ch : left.toCharArray()) counts[ch - 'a']++;
    for (char ch : right.toCharArray()) counts[ch - 'a']--;
    for (int count : counts) if (count != 0) return false;
    return true;
}`,
    cpp: `bool isAnagram(string left, string right) {
    if (left.size() != right.size()) return false;
    array<int, 26> counts{};
    for (char ch : left) counts[ch - 'a']++;
    for (char ch : right) counts[ch - 'a']--;
    return all_of(counts.begin(), counts.end(), [](int n) { return n == 0; });
}`,
  },
  'stock-profit': {
    python: `def max_profit(prices):
    lowest = float("inf")
    best = 0
    for price in prices:
        lowest = min(lowest, price)
        best = max(best, price - lowest)
    return best`,
    java: `int maxProfit(int[] prices) {
    int lowest = Integer.MAX_VALUE;
    int best = 0;
    for (int price : prices) {
        lowest = Math.min(lowest, price);
        best = Math.max(best, price - lowest);
    }
    return best;
}`,
    cpp: `int maxProfit(vector<int>& prices) {
    int lowest = INT_MAX, best = 0;
    for (int price : prices) {
        lowest = min(lowest, price);
        best = max(best, price - lowest);
    }
    return best;
}`,
  },
  'longest-unique-window': {
    python: `def longest_unique(text):
    last_seen = {}
    left = best = 0
    for right, char in enumerate(text):
        left = max(left, last_seen.get(char, -1) + 1)
        last_seen[char] = right
        best = max(best, right - left + 1)
    return best`,
    java: `int longestUnique(String text) {
    Map<Character, Integer> lastSeen = new HashMap<>();
    int left = 0, best = 0;
    for (int right = 0; right < text.length(); right++) {
        char ch = text.charAt(right);
        left = Math.max(left, lastSeen.getOrDefault(ch, -1) + 1);
        lastSeen.put(ch, right);
        best = Math.max(best, right - left + 1);
    }
    return best;
}`,
    cpp: `int longestUnique(string text) {
    unordered_map<char, int> lastSeen;
    int left = 0, best = 0;
    for (int right = 0; right < text.size(); ++right) {
        left = max(left, lastSeen[text[right]] > 0 ? lastSeen[text[right]] : 0);
        best = max(best, right - left + 1);
        lastSeen[text[right]] = right + 1;
    }
    return best;
}`,
  },
  'pairwise-growth': {
    python: `def pairwise_growth(values):
    total = 0
    for left in range(len(values)):
        for right in range(left + 1, len(values)):
            total += values[left] * values[right]
    return total`,
    java: `int pairwiseGrowth(int[] values) {
    int total = 0;
    for (int left = 0; left < values.length; left++)
        for (int right = left + 1; right < values.length; right++)
            total += values[left] * values[right];
    return total;
}`,
    cpp: `int pairwiseGrowth(vector<int>& values) {
    int total = 0;
    for (int left = 0; left < values.size(); ++left)
        for (int right = left + 1; right < values.size(); ++right)
            total += values[left] * values[right];
    return total;
}`,
  },
  'count-values': {
    python: `def count_values(values):
    counts = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return counts`,
    java: `Map<String, Integer> countValues(String[] values) {
    Map<String, Integer> counts = new LinkedHashMap<>();
    for (String value : values)
        counts.put(value, counts.getOrDefault(value, 0) + 1);
    return counts;
}`,
    cpp: `unordered_map<string, int> countValues(vector<string>& values) {
    unordered_map<string, int> counts;
    for (const string& value : values) counts[value]++;
    return counts;
}`,
  },
  'valid-parentheses': {
    python: `def is_valid(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in text:
        if char in "([{":
            stack.append(char)
        elif not stack or stack.pop() != pairs[char]:
            return False
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
  'contains-duplicate': {
    python: `def contains_duplicate(nums):
    return len(nums) != len(set(nums))`,
    java: `boolean containsDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>();
    for (int value : nums) if (!seen.add(value)) return true;
    return false;
}`,
    cpp: `bool containsDuplicate(vector<int>& nums) {
    unordered_set<int> seen;
    for (int value : nums) if (!seen.insert(value).second) return true;
    return false;
}`,
  },
  'product-except-self': {
    python: `def product_except_self(nums):
    result = [1] * len(nums)
    prefix = 1
    for i, value in enumerate(nums):
        result[i] = prefix
        prefix *= value
    suffix = 1
    for i in range(len(nums) - 1, -1, -1):
        result[i] *= suffix
        suffix *= nums[i]
    return result`,
    java: `int[] productExceptSelf(int[] nums) {
    int[] result = new int[nums.length];
    int prefix = 1;
    for (int i = 0; i < nums.length; i++) { result[i] = prefix; prefix *= nums[i]; }
    int suffix = 1;
    for (int i = nums.length - 1; i >= 0; i--) { result[i] *= suffix; suffix *= nums[i]; }
    return result;
}`,
    cpp: `vector<int> productExceptSelf(vector<int>& nums) {
    vector<int> result(nums.size(), 1);
    int prefix = 1;
    for (int i = 0; i < nums.size(); ++i) { result[i] = prefix; prefix *= nums[i]; }
    int suffix = 1;
    for (int i = nums.size() - 1; i >= 0; --i) { result[i] *= suffix; suffix *= nums[i]; }
    return result;
}`,
  },
  'unique-sum': {
    python: `def unique_sum(values):
    counts = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    return sum(value for value, count in counts.items() if count == 1)`,
    java: `int uniqueSum(int[] values) {
    Map<Integer, Integer> counts = new HashMap<>();
    for (int value : values) counts.put(value, counts.getOrDefault(value, 0) + 1);
    return counts.entrySet().stream().filter(entry -> entry.getValue() == 1)
        .mapToInt(Map.Entry::getKey).sum();
}`,
    cpp: `int uniqueSum(vector<int>& values) {
    unordered_map<int, int> counts;
    for (int value : values) counts[value]++;
    int total = 0;
    for (auto [value, count] : counts) if (count == 1) total += value;
    return total;
}`,
  },
  'container-water': {
    python: `def max_area(height):
    left, right = 0, len(height) - 1
    best = 0
    while left < right:
        best = max(best, min(height[left], height[right]) * (right - left))
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return best`,
    java: `int maxArea(int[] height) {
    int left = 0, right = height.length - 1, best = 0;
    while (left < right) {
        best = Math.max(best, Math.min(height[left], height[right]) * (right - left));
        if (height[left] < height[right]) left++; else right--;
    }
    return best;
}`,
    cpp: `int maxArea(vector<int>& height) {
    int left = 0, right = height.size() - 1, best = 0;
    while (left < right) {
        best = max(best, min(height[left], height[right]) * (right - left));
        if (height[left] < height[right]) ++left; else --right;
    }
    return best;
}`,
  },
  'merge-arrays': {
    python: `def merge_sorted(left, right):
    result = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i]); i += 1
        else:
            result.append(right[j]); j += 1
    return result + left[i:] + right[j:]`,
    java: `int[] mergeSorted(int[] left, int[] right) {
    int[] result = new int[left.length + right.length];
    int i = 0, j = 0, k = 0;
    while (i < left.length && j < right.length)
        result[k++] = left[i] <= right[j] ? left[i++] : right[j++];
    while (i < left.length) result[k++] = left[i++];
    while (j < right.length) result[k++] = right[j++];
    return result;
}`,
    cpp: `vector<int> mergeSorted(vector<int>& left, vector<int>& right) {
    vector<int> result;
    int i = 0, j = 0;
    while (i < left.size() && j < right.size())
        result.push_back(left[i] <= right[j] ? left[i++] : right[j++]);
    while (i < left.size()) result.push_back(left[i++]);
    while (j < right.size()) result.push_back(right[j++]);
    return result;
}`,
  },
  'max-window-sum': {
    python: `def max_window_sum(values, width=3):
    current = sum(values[:width])
    best = current
    for right in range(width, len(values)):
        current += values[right] - values[right - width]
        best = max(best, current)
    return best`,
    java: `int maxWindowSum(int[] values, int width) {
    int current = 0;
    for (int i = 0; i < width; i++) current += values[i];
    int best = current;
    for (int right = width; right < values.length; right++) {
        current += values[right] - values[right - width];
        best = Math.max(best, current);
    }
    return best;
}`,
    cpp: `int maxWindowSum(vector<int>& values, int width) {
    int current = accumulate(values.begin(), values.begin() + width, 0);
    int best = current;
    for (int right = width; right < values.size(); ++right) {
        current += values[right] - values[right - width];
        best = max(best, current);
    }
    return best;
}`,
  },
  'balanced-delimiters': {
    python: `def balanced_delimiters(text):
    pairs = {")": "(", "]": "[", "}": "{"}
    stack = []
    for char in text:
        if char in "([{":
            stack.append(char)
        elif not stack or stack.pop() != pairs.get(char):
            return False
    return not stack`,
    java: `boolean balancedDelimiters(String text) {
    Deque<Character> stack = new ArrayDeque<>();
    for (char ch : text.toCharArray()) {
        if (ch == '(' || ch == '[' || ch == '{') stack.push(ch);
        else if (ch == ')' || ch == ']' || ch == '}') {
            if (stack.isEmpty()) return false;
            char open = stack.pop();
            if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{')) return false;
        }
    }
    return stack.isEmpty();
}`,
    cpp: `bool balancedDelimiters(string text) {
    stack<char> values;
    for (char ch : text) {
        if (ch == '(' || ch == '[' || ch == '{') values.push(ch);
        else if (ch == ')' || ch == ']' || ch == '}') {
            if (values.empty()) return false;
            char open = values.top(); values.pop();
            if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{')) return false;
        }
    }
    return values.empty();
}`,
  },
  'binary-search': {
    python: `def binary_search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        middle = left + (right - left) // 2
        if nums[middle] == target:
            return middle
        if nums[middle] < target:
            left = middle + 1
        else:
            right = middle - 1
    return -1`,
    java: `int binarySearch(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left <= right) {
        int middle = left + (right - left) / 2;
        if (nums[middle] == target) return middle;
        if (nums[middle] < target) left = middle + 1; else right = middle - 1;
    }
    return -1;
}`,
    cpp: `int binarySearch(vector<int>& nums, int target) {
    int left = 0, right = nums.size() - 1;
    while (left <= right) {
        int middle = left + (right - left) / 2;
        if (nums[middle] == target) return middle;
        if (nums[middle] < target) left = middle + 1; else right = middle - 1;
    }
    return -1;
}`,
  },
  'search-insert': {
    python: `def search_insert(nums, target):
    left, right = 0, len(nums)
    while left < right:
        middle = left + (right - left) // 2
        if nums[middle] < target:
            left = middle + 1
        else:
            right = middle
    return left`,
    java: `int searchInsert(int[] nums, int target) {
    int left = 0, right = nums.length;
    while (left < right) {
        int middle = left + (right - left) / 2;
        if (nums[middle] < target) left = middle + 1; else right = middle;
    }
    return left;
}`,
    cpp: `int searchInsert(vector<int>& nums, int target) {
    int left = 0, right = nums.size();
    while (left < right) {
        int middle = left + (right - left) / 2;
        if (nums[middle] < target) left = middle + 1; else right = middle;
    }
    return left;
}`,
  },
  'merge-two-lists': {
    python: `def merge_two_lists(left, right):
    sentinel = ListNode()
    tail = sentinel
    while left and right:
        if left.val <= right.val:
            tail.next, left = left, left.next
        else:
            tail.next, right = right, right.next
        tail = tail.next
    tail.next = left or right
    return sentinel.next`,
    java: `ListNode mergeTwoLists(ListNode left, ListNode right) {
    ListNode sentinel = new ListNode(0), tail = sentinel;
    while (left != null && right != null) {
        if (left.val <= right.val) { tail.next = left; left = left.next; }
        else { tail.next = right; right = right.next; }
        tail = tail.next;
    }
    tail.next = left != null ? left : right;
    return sentinel.next;
}`,
    cpp: `ListNode* mergeTwoLists(ListNode* left, ListNode* right) {
    ListNode sentinel(0), *tail = &sentinel;
    while (left && right) {
        if (left->val <= right->val) { tail->next = left; left = left->next; }
        else { tail->next = right; right = right->next; }
        tail = tail->next;
    }
    tail->next = left ? left : right;
    return sentinel.next;
}`,
  },
  'reverse-list': {
    python: `def reverse_list(head):
    previous = None
    current = head
    while current:
        following = current.next
        current.next = previous
        previous, current = current, following
    return previous`,
    java: `ListNode reverseList(ListNode head) {
    ListNode previous = null, current = head;
    while (current != null) {
        ListNode following = current.next;
        current.next = previous;
        previous = current;
        current = following;
    }
    return previous;
}`,
    cpp: `ListNode* reverseList(ListNode* head) {
    ListNode* previous = nullptr;
    while (head) {
        ListNode* following = head->next;
        head->next = previous;
        previous = head;
        head = following;
    }
    return previous;
}`,
  },
  'max-depth-tree': {
    python: `def max_depth(root):
    if root is None:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))`,
    java: `int maxDepth(TreeNode root) {
    if (root == null) return 0;
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
    cpp: `int maxDepth(TreeNode* root) {
    if (!root) return 0;
    return 1 + max(maxDepth(root->left), maxDepth(root->right));
}`,
  },
  'count-tree-levels': {
    python: `def count_levels(root):
    if root is None:
        return 0
    queue = [root]
    levels = 0
    while queue:
        levels += 1
        queue = [child for node in queue for child in (node.left, node.right) if child]
    return levels`,
    java: `int countLevels(TreeNode root) {
    if (root == null) return 0;
    Queue<TreeNode> queue = new ArrayDeque<>();
    queue.add(root);
    int levels = 0;
    while (!queue.isEmpty()) {
        for (int size = queue.size(); size > 0; size--) {
            TreeNode node = queue.remove();
            if (node.left != null) queue.add(node.left);
            if (node.right != null) queue.add(node.right);
        }
        levels++;
    }
    return levels;
}`,
    cpp: `int countLevels(TreeNode* root) {
    if (!root) return 0;
    queue<TreeNode*> pending; pending.push(root);
    int levels = 0;
    while (!pending.empty()) {
        for (int size = pending.size(); size > 0; --size) {
            auto node = pending.front(); pending.pop();
            if (node->left) pending.push(node->left);
            if (node->right) pending.push(node->right);
        }
        ++levels;
    }
    return levels;
}`,
  },
  'number-of-islands': {
    python: `def num_islands(grid):
    rows, cols = len(grid), len(grid[0])
    def visit(r, c):
        if r < 0 or c < 0 or r == rows or c == cols or grid[r][c] != "1":
            return
        grid[r][c] = "0"
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            visit(r + dr, c + dc)
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                count += 1
                visit(r, c)
    return count`,
    java: `int numIslands(char[][] grid) {
    int count = 0;
    for (int r = 0; r < grid.length; r++) for (int c = 0; c < grid[0].length; c++) {
        if (grid[r][c] == '1') { count++; sink(grid, r, c); }
    }
    return count;
}
void sink(char[][] grid, int r, int c) {
    if (r < 0 || c < 0 || r == grid.length || c == grid[0].length || grid[r][c] != '1') return;
    grid[r][c] = '0';
    sink(grid, r + 1, c); sink(grid, r - 1, c);
    sink(grid, r, c + 1); sink(grid, r, c - 1);
}`,
    cpp: `void sink(vector<vector<char>>& grid, int r, int c);
int numIslands(vector<vector<char>>& grid) {
    int count = 0;
    for (int r = 0; r < grid.size(); ++r) for (int c = 0; c < grid[0].size(); ++c)
        if (grid[r][c] == '1') { ++count; sink(grid, r, c); }
    return count;
}
void sink(vector<vector<char>>& grid, int r, int c) {
    if (r < 0 || c < 0 || r == grid.size() || c == grid[0].size() || grid[r][c] != '1') return;
    grid[r][c] = '0';
    sink(grid, r + 1, c); sink(grid, r - 1, c);
    sink(grid, r, c + 1); sink(grid, r, c - 1);
}`,
  },
  'room-reachability': {
    python: `def can_reach(doors, start, destination):
    graph = {}
    for left, right in doors:
        graph.setdefault(left, []).append(right)
        graph.setdefault(right, []).append(left)
    pending, seen = [start], {start}
    while pending:
        room = pending.pop()
        if room == destination:
            return True
        for neighbor in graph.get(room, []):
            if neighbor not in seen:
                seen.add(neighbor)
                pending.append(neighbor)
    return False`,
    java: `boolean canReach(int[][] doors, int start, int destination) {
    Map<Integer, List<Integer>> graph = new HashMap<>();
    for (int[] door : doors) {
        graph.computeIfAbsent(door[0], key -> new ArrayList<>()).add(door[1]);
        graph.computeIfAbsent(door[1], key -> new ArrayList<>()).add(door[0]);
    }
    Set<Integer> seen = new HashSet<>();
    Deque<Integer> pending = new ArrayDeque<>();
    pending.push(start);
    while (!pending.isEmpty()) {
        int room = pending.pop();
        if (room == destination) return true;
        if (seen.add(room)) pending.addAll(graph.getOrDefault(room, List.of()));
    }
    return false;
}`,
    cpp: `bool canReach(vector<vector<int>>& doors, int start, int destination) {
    unordered_map<int, vector<int>> graph;
    for (auto& door : doors) { graph[door[0]].push_back(door[1]); graph[door[1]].push_back(door[0]); }
    unordered_set<int> seen;
    stack<int> pending; pending.push(start);
    while (!pending.empty()) {
        int room = pending.top(); pending.pop();
        if (room == destination) return true;
        if (seen.insert(room).second) for (int next : graph[room]) pending.push(next);
    }
    return false;
}`,
  },
  'climbing-stairs': {
    python: `def climb_stairs(n):
    one_step, two_steps = 1, 1
    for _ in range(n - 1):
        one_step, two_steps = one_step + two_steps, one_step
    return one_step`,
    java: `int climbStairs(int n) {
    int oneStep = 1, twoSteps = 1;
    for (int step = 1; step < n; step++) {
        int next = oneStep + twoSteps;
        twoSteps = oneStep;
        oneStep = next;
    }
    return oneStep;
}`,
    cpp: `int climbStairs(int n) {
    int oneStep = 1, twoSteps = 1;
    for (int step = 1; step < n; ++step) {
        int next = oneStep + twoSteps;
        twoSteps = oneStep; oneStep = next;
    }
    return oneStep;
}`,
  },
  'house-robber': {
    python: `def rob(values):
    two_back = one_back = 0
    for value in values:
        two_back, one_back = one_back, max(one_back, two_back + value)
    return one_back`,
    java: `int rob(int[] values) {
    int twoBack = 0, oneBack = 0;
    for (int value : values) {
        int best = Math.max(oneBack, twoBack + value);
        twoBack = oneBack;
        oneBack = best;
    }
    return oneBack;
}`,
    cpp: `int rob(vector<int>& values) {
    int twoBack = 0, oneBack = 0;
    for (int value : values) {
        int best = max(oneBack, twoBack + value);
        twoBack = oneBack; oneBack = best;
    }
    return oneBack;
}`,
  },
};

function assertFixture() {
  const counts = Object.groupBy(sessions, (session) => session.status);
  const constrainedProblems = problems.filter(
    (problem) =>
      typeof problem.constraints === 'string' && problem.constraints.trim(),
  );
  if (
    sessions.length !== 13 ||
    problems.length !== 28 ||
    constrainedProblems.length < 10 ||
    constrainedProblems.length === problems.length ||
    counts.live?.length !== 1 ||
    counts.draft?.length !== 2 ||
    counts.ended?.length !== 10
  )
    throw new Error(
      'The local fixture must contain 1 Live, 2 Draft, and 10 Past Sessions with 28 Problems.',
    );
  const sessionIds = new Set(sessions.map(({ id }) => id));
  const problemIds = new Set();
  const supportedLanguages = ['python', 'java', 'cpp'];
  const supportedDifficulties = ['easy', 'medium', 'hard'];
  const seededDifficulties = new Set(
    problems.map((problem) => problem.difficulty).filter(Boolean),
  );
  if (
    supportedDifficulties.some(
      (difficulty) => !seededDifficulties.has(difficulty),
    ) ||
    problems.every((problem) => problem.difficulty !== undefined)
  )
    throw new Error(
      'The local fixture must cover every Problem difficulty and unset Problems.',
    );
  for (const problem of problems) {
    const path = `${problem.sessionId}/${problem.id}`;
    if (!sessionIds.has(problem.sessionId) || problemIds.has(path))
      throw new Error(`Invalid or duplicate seeded Problem: ${path}`);
    problemIds.add(path);
    const implementation = implementations[problem.solution];
    if (
      !implementation ||
      supportedLanguages.some(
        (language) =>
          typeof implementation[language] !== 'string' ||
          !implementation[language].trim(),
      ) ||
      typeof problem.exampleInput !== 'string' ||
      typeof problem.exampleOutput !== 'string' ||
      (problem.constraints !== undefined &&
        typeof problem.constraints !== 'string') ||
      (problem.difficulty !== undefined &&
        !supportedDifficulties.includes(problem.difficulty)) ||
      !problem.exampleOutput.trim()
    )
      throw new Error(
        `Missing Problem example or prepared language solution for ${path}.`,
      );
    if (
      problem.leetcodeUrl &&
      !/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/?$/i.test(
        problem.leetcodeUrl,
      )
    )
      throw new Error(`Invalid LeetCode URL on ${path}.`);
  }
  for (const session of sessions) {
    const sessionProblems = problems.filter(
      (problem) => problem.sessionId === session.id,
    );
    if (sessionProblems.length === 0)
      throw new Error(`Seeded Session ${session.id} has no Problems.`);
    if (session.status === 'live' && sessionProblems.length < 3)
      throw new Error('The live Session must contain at least three Problems.');
  }
}

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
    `${firestoreBase}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await request(
    `http://${host}:9099/emulator/v1/projects/${projectId}/accounts`,
    { method: 'DELETE' },
  );
}

export async function seedEmulatorData() {
  assertFixture();
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

  const sessionDocuments = sessions.map(({ id, ...value }) => [
    `sessions/${id}`,
    { ...value, createdAt: timestamp, updatedAt: timestamp },
  ]);
  const problemOrders = new Map();
  const problemDocuments = problems.map(({ sessionId, id, ...value }) => {
    const order = problemOrders.get(sessionId) ?? 0;
    problemOrders.set(sessionId, order + 1);
    const fields = { ...value, order };
    delete fields.solution;
    delete fields.solutionComplexities;
    return [`sessions/${sessionId}/problems/${id}`, fields];
  });
  const solutionDocuments = problems.flatMap((problem) => {
    const { solution, solutionComplexities, sessionId, id } = problem;
    const implementation = implementations[solution];
    return ['python', 'java', 'cpp'].map((language) => [
      `sessions/${sessionId}/problems/${id}/solutions/${language}`,
      {
        code: implementation[language],
        ...(solutionComplexities?.[language] ?? {}),
      },
    ]);
  });
  const documents = [
    ...sessionDocuments,
    ...problemDocuments,
    ...solutionDocuments,
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
    `Seeded ${problems.length} Problems across ${sessions.length} Sessions in ${projectId}.`,
  );
  console.log(`Local emulator Officer is ready: ${officerEmail}.`);
  console.log(`Auth emulator UID: ${account.localId}`);
}
