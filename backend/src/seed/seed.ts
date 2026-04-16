/**
 * CodeClash — Problem Seeder
 * Run: npm run seed
 *
 * Seeds 20 DSA problems:
 *   5 arrays, 3 strings, 3 trees, 2 dp, 2 graphs, 2 hashing, 1 sorting, 2 recursion
 */

import * as dotenv from "dotenv";
dotenv.config();

import { db } from "../db";
import { problems } from "../db/schema";
import type { NewProblem } from "../db/schema";
import "dotenv/config";



const PROBLEM_BANK: NewProblem[] = [
  // ─── Arrays (5) ───────────────────────────────────────────────────────────

  {
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "easy",
    topics: ["arrays", "hashing"],
    companyTags: ["google", "amazon", "meta"],
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the **indices** of the two numbers that add up to \`target\`.

You may assume exactly one solution exists, and you may not use the same element twice.`,
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] = 2 + 7 = 9" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    constraints: "2 ≤ nums.length ≤ 10⁴\n-10⁹ ≤ nums[i] ≤ 10⁹\n-10⁹ ≤ target ≤ 10⁹",
    testCases: [
      { input: "[2,7,11,15]\n9", expected_output: "[0,1]", is_hidden: false },
      { input: "[3,2,4]\n6", expected_output: "[1,2]", is_hidden: false },
      { input: "[3,3]\n6", expected_output: "[0,1]", is_hidden: true },
      { input: "[1,4,5,7,9]\n12", expected_output: "[1,4]", is_hidden: true },
      { input: "[-1,-2,-3,-4,-5]\n-8", expected_output: "[2,4]", is_hidden: true },
    ],
    starterCode: {
      javascript: `function twoSum(nums, target) {\n  // your code here\n};`,
      python: `def two_sum(nums: list[int], target: int) -> list[int]:\n    # your code here\n    pass`,
      cpp: `vector<int> twoSum(vector<int>& nums, int target) {\n    // your code here\n}`,
    },
    editorial: "Use a hash map. On each element, check if (target - element) exists in the map. O(n) time, O(n) space.",
  },

  {
    title: "Maximum Subarray",
    slug: "maximum-subarray",
    difficulty: "medium",
    topics: ["arrays", "dp"],
    companyTags: ["amazon", "microsoft"],
    description: `Given an integer array \`nums\`, find the **contiguous subarray** with the largest sum and return its sum.`,
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "Subarray [4,-1,2,1] has sum 6" },
      { input: "nums = [1]", output: "1" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    constraints: "1 ≤ nums.length ≤ 10⁵\n-10⁴ ≤ nums[i] ≤ 10⁴",
    testCases: [
      { input: "[-2,1,-3,4,-1,2,1,-5,4]", expected_output: "6", is_hidden: false },
      { input: "[1]", expected_output: "1", is_hidden: false },
      { input: "[5,4,-1,7,8]", expected_output: "23", is_hidden: false },
      { input: "[-1,-2,-3,-4]", expected_output: "-1", is_hidden: true },
      { input: "[1,-1,1,-1,1,-1,1]", expected_output: "1", is_hidden: true },
    ],
    starterCode: {
      javascript: `function maxSubArray(nums) {\n  // your code here\n};`,
      python: `def max_sub_array(nums: list[int]) -> int:\n    # your code here\n    pass`,
      cpp: `int maxSubArray(vector<int>& nums) {\n    // your code here\n}`,
    },
    editorial: "Kadane's algorithm. Track current sum and global max in one pass. O(n) time, O(1) space.",
  },

  {
    title: "Product of Array Except Self",
    slug: "product-of-array-except-self",
    difficulty: "medium",
    topics: ["arrays"],
    companyTags: ["amazon", "apple", "google"],
    description: `Given an integer array \`nums\`, return an array \`answer\` such that \`answer[i]\` equals the product of all elements of \`nums\` **except** \`nums[i]\`.

You must solve it **without division** and in O(n) time.`,
    examples: [
      { input: "nums = [1,2,3,4]", output: "[24,12,8,6]" },
      { input: "nums = [-1,1,0,-3,3]", output: "[0,0,9,0,0]" },
    ],
    constraints: "2 ≤ nums.length ≤ 10⁵\n-30 ≤ nums[i] ≤ 30",
    testCases: [
      { input: "[1,2,3,4]", expected_output: "[24,12,8,6]", is_hidden: false },
      { input: "[-1,1,0,-3,3]", expected_output: "[0,0,9,0,0]", is_hidden: false },
      { input: "[2,2,2,2]", expected_output: "[8,8,8,8]", is_hidden: true },
      { input: "[1,0]", expected_output: "[0,1]", is_hidden: true },
    ],
    starterCode: {
      javascript: `function productExceptSelf(nums) {\n  // your code here\n};`,
      python: `def product_except_self(nums: list[int]) -> list[int]:\n    # your code here\n    pass`,
      cpp: `vector<int> productExceptSelf(vector<int>& nums) {\n    // your code here\n}`,
    },
    editorial: "Two-pass prefix/suffix products. No division needed. O(n) time, O(1) extra space.",
  },

  {
    title: "Container With Most Water",
    slug: "container-with-most-water",
    difficulty: "medium",
    topics: ["arrays"],
    companyTags: ["amazon", "google"],
    description: `You are given an integer array \`height\` of length \`n\`. There are \`n\` vertical lines drawn at position \`i\` with height \`height[i]\`. Find two lines that together with the x-axis form a container with the most water. Return the **maximum amount** of water it can store.`,
    examples: [
      { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49", explanation: "Lines at index 1 and 8 form the largest container" },
      { input: "height = [1,1]", output: "1" },
    ],
    constraints: "2 ≤ n ≤ 10⁵\n0 ≤ height[i] ≤ 10⁴",
    testCases: [
      { input: "[1,8,6,2,5,4,8,3,7]", expected_output: "49", is_hidden: false },
      { input: "[1,1]", expected_output: "1", is_hidden: false },
      { input: "[4,3,2,1,4]", expected_output: "16", is_hidden: true },
      { input: "[1,2,1]", expected_output: "2", is_hidden: true },
    ],
    starterCode: {
      javascript: `function maxArea(height) {\n  // your code here\n};`,
      python: `def max_area(height: list[int]) -> int:\n    # your code here\n    pass`,
      cpp: `int maxArea(vector<int>& height) {\n    // your code here\n}`,
    },
    editorial: "Two-pointer approach. Start at both ends, move the shorter pointer inward. O(n) time.",
  },

  {
    title: "Best Time to Buy and Sell Stock",
    slug: "best-time-to-buy-and-sell-stock",
    difficulty: "easy",
    topics: ["arrays"],
    companyTags: ["amazon", "bloomberg", "facebook"],
    description: `You are given an array \`prices\` where \`prices[i]\` is the price of a stock on day \`i\`. You want to maximize profit by choosing a single day to buy and a later day to sell. Return the **maximum profit**. If no profit is possible, return \`0\`.`,
    examples: [
      { input: "prices = [7,1,5,3,6,4]", output: "5", explanation: "Buy on day 2 (price=1), sell on day 5 (price=6)" },
      { input: "prices = [7,6,4,3,1]", output: "0", explanation: "No profit possible" },
    ],
    constraints: "1 ≤ prices.length ≤ 10⁵\n0 ≤ prices[i] ≤ 10⁴",
    testCases: [
      { input: "[7,1,5,3,6,4]", expected_output: "5", is_hidden: false },
      { input: "[7,6,4,3,1]", expected_output: "0", is_hidden: false },
      { input: "[1,2]", expected_output: "1", is_hidden: true },
      { input: "[2,4,1,7]", expected_output: "6", is_hidden: true },
    ],
    starterCode: {
      javascript: `function maxProfit(prices) {\n  // your code here\n};`,
      python: `def max_profit(prices: list[int]) -> int:\n    # your code here\n    pass`,
      cpp: `int maxProfit(vector<int>& prices) {\n    // your code here\n}`,
    },
    editorial: "Track minimum price seen so far and max profit in one pass. O(n) time.",
  },

  // ─── Strings (3) ──────────────────────────────────────────────────────────

  {
    title: "Valid Anagram",
    slug: "valid-anagram",
    difficulty: "easy",
    topics: ["strings", "hashing"],
    companyTags: ["amazon", "bloomberg"],
    description: `Given two strings \`s\` and \`t\`, return \`true\` if \`t\` is an anagram of \`s\`, and \`false\` otherwise.`,
    examples: [
      { input: `s = "anagram", t = "nagaram"`, output: "true" },
      { input: `s = "rat", t = "car"`, output: "false" },
    ],
    constraints: "1 ≤ s.length, t.length ≤ 5 × 10⁴\ns and t consist of lowercase English letters",
    testCases: [
      { input: "anagram\nnagaram", expected_output: "true", is_hidden: false },
      { input: "rat\ncar", expected_output: "false", is_hidden: false },
      { input: "a\na", expected_output: "true", is_hidden: true },
      { input: "ab\nba", expected_output: "true", is_hidden: true },
      { input: "hello\nworld", expected_output: "false", is_hidden: true },
    ],
    starterCode: {
      javascript: `function isAnagram(s, t) {\n  // your code here\n};`,
      python: `def is_anagram(s: str, t: str) -> bool:\n    # your code here\n    pass`,
      cpp: `bool isAnagram(string s, string t) {\n    // your code here\n}`,
    },
    editorial: "Sort both strings and compare, or use a frequency map. O(n log n) or O(n).",
  },

  {
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "medium",
    topics: ["strings", "hashing"],
    companyTags: ["amazon", "google", "bloomberg"],
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.`,
    examples: [
      { input: `s = "abcabcbb"`, output: "3", explanation: `"abc" is the answer` },
      { input: `s = "bbbbb"`, output: "1" },
      { input: `s = "pwwkew"`, output: "3" },
    ],
    constraints: "0 ≤ s.length ≤ 5 × 10⁴\ns consists of English letters, digits, symbols and spaces",
    testCases: [
      { input: "abcabcbb", expected_output: "3", is_hidden: false },
      { input: "bbbbb", expected_output: "1", is_hidden: false },
      { input: "pwwkew", expected_output: "3", is_hidden: false },
      { input: "", expected_output: "0", is_hidden: true },
      { input: "dvdf", expected_output: "3", is_hidden: true },
    ],
    starterCode: {
      javascript: `function lengthOfLongestSubstring(s) {\n  // your code here\n};`,
      python: `def length_of_longest_substring(s: str) -> int:\n    # your code here\n    pass`,
      cpp: `int lengthOfLongestSubstring(string s) {\n    // your code here\n}`,
    },
    editorial: "Sliding window with a set/map. Expand right, shrink left when duplicate found. O(n).",
  },

  {
    title: "Valid Parentheses",
    slug: "valid-parentheses",
    difficulty: "easy",
    topics: ["strings"],
    companyTags: ["amazon", "google", "meta"],
    description: `Given a string \`s\` containing only \`(\`, \`)\`, \`{\`, \`}\`, \`[\` and \`]\`, determine if the input string is **valid**. A string is valid if open brackets are closed by the same type in the correct order.`,
    examples: [
      { input: `s = "()"`, output: "true" },
      { input: `s = "()[]{}"`, output: "true" },
      { input: `s = "(]"`, output: "false" },
    ],
    constraints: "1 ≤ s.length ≤ 10⁴\ns consists of parentheses only",
    testCases: [
      { input: "()", expected_output: "true", is_hidden: false },
      { input: "()[]{}", expected_output: "true", is_hidden: false },
      { input: "(]", expected_output: "false", is_hidden: false },
      { input: "([)]", expected_output: "false", is_hidden: true },
      { input: "{[]}", expected_output: "true", is_hidden: true },
    ],
    starterCode: {
      javascript: `function isValid(s) {\n  // your code here\n};`,
      python: `def is_valid(s: str) -> bool:\n    # your code here\n    pass`,
      cpp: `bool isValid(string s) {\n    // your code here\n}`,
    },
    editorial: "Use a stack. Push on open brackets, pop and verify on close brackets. O(n).",
  },

  // ─── Trees (3) ────────────────────────────────────────────────────────────

  {
    title: "Maximum Depth of Binary Tree",
    slug: "maximum-depth-of-binary-tree",
    difficulty: "easy",
    topics: ["trees", "recursion"],
    companyTags: ["amazon", "linkedin"],
    description: `Given the \`root\` of a binary tree, return its **maximum depth**. The maximum depth is the number of nodes along the longest path from the root down to the farthest leaf node.`,
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "3" },
      { input: "root = [1,null,2]", output: "2" },
    ],
    constraints: "0 ≤ number of nodes ≤ 10⁴\n-100 ≤ Node.val ≤ 100",
    testCases: [
      { input: "[3,9,20,null,null,15,7]", expected_output: "3", is_hidden: false },
      { input: "[1,null,2]", expected_output: "2", is_hidden: false },
      { input: "[]", expected_output: "0", is_hidden: true },
      { input: "[1]", expected_output: "1", is_hidden: true },
    ],
    starterCode: {
      javascript: `function maxDepth(root) {\n  // your code here\n};`,
      python: `def max_depth(root) -> int:\n    # your code here\n    pass`,
      cpp: `int maxDepth(TreeNode* root) {\n    // your code here\n}`,
    },
    editorial: "DFS recursion: return 1 + max(maxDepth(left), maxDepth(right)). Base case: null → 0.",
  },

  {
    title: "Validate Binary Search Tree",
    slug: "validate-binary-search-tree",
    difficulty: "medium",
    topics: ["trees"],
    companyTags: ["amazon", "microsoft", "bloomberg"],
    description: `Given the \`root\` of a binary tree, determine if it is a valid **Binary Search Tree (BST)**. A valid BST requires: left subtree nodes are strictly less than root, right subtree nodes are strictly greater than root, and both subtrees are also valid BSTs.`,
    examples: [
      { input: "root = [2,1,3]", output: "true" },
      { input: "root = [5,1,4,null,null,3,6]", output: "false", explanation: "Root is 5 but right child is 4" },
    ],
    constraints: "1 ≤ number of nodes ≤ 10⁴\n-2³¹ ≤ Node.val ≤ 2³¹ - 1",
    testCases: [
      { input: "[2,1,3]", expected_output: "true", is_hidden: false },
      { input: "[5,1,4,null,null,3,6]", expected_output: "false", is_hidden: false },
      { input: "[1]", expected_output: "true", is_hidden: true },
      { input: "[2,2,2]", expected_output: "false", is_hidden: true },
    ],
    starterCode: {
      javascript: `function isValidBST(root) {\n  // your code here\n};`,
      python: `def is_valid_bst(root) -> bool:\n    # your code here\n    pass`,
      cpp: `bool isValidBST(TreeNode* root) {\n    // your code here\n}`,
    },
    editorial: "DFS with bounds: pass (min, max) at each node. For left child, max = node.val; for right, min = node.val.",
  },

  {
    title: "Level Order Traversal",
    slug: "binary-tree-level-order-traversal",
    difficulty: "medium",
    topics: ["trees"],
    companyTags: ["amazon", "microsoft", "google"],
    description: `Given the \`root\` of a binary tree, return the **level order traversal** of its node values (i.e., from left to right, level by level).`,
    examples: [
      { input: "root = [3,9,20,null,null,15,7]", output: "[[3],[9,20],[15,7]]" },
      { input: "root = [1]", output: "[[1]]" },
      { input: "root = []", output: "[]" },
    ],
    constraints: "0 ≤ number of nodes ≤ 2000\n-1000 ≤ Node.val ≤ 1000",
    testCases: [
      { input: "[3,9,20,null,null,15,7]", expected_output: "[[3],[9,20],[15,7]]", is_hidden: false },
      { input: "[1]", expected_output: "[[1]]", is_hidden: false },
      { input: "[]", expected_output: "[]", is_hidden: true },
    ],
    starterCode: {
      javascript: `function levelOrder(root) {\n  // your code here\n};`,
      python: `def level_order(root) -> list[list[int]]:\n    # your code here\n    pass`,
      cpp: `vector<vector<int>> levelOrder(TreeNode* root) {\n    // your code here\n}`,
    },
    editorial: "BFS with a queue. Track level size at each iteration. O(n) time.",
  },

  // ─── Dynamic Programming (2) ──────────────────────────────────────────────

  {
    title: "Climbing Stairs",
    slug: "climbing-stairs",
    difficulty: "easy",
    topics: ["dp", "recursion"],
    companyTags: ["amazon", "apple", "adobe"],
    description: `You are climbing a staircase of \`n\` steps. You can climb 1 or 2 steps at a time. In how many distinct ways can you reach the top?`,
    examples: [
      { input: "n = 2", output: "2", explanation: "1+1 or 2" },
      { input: "n = 3", output: "3", explanation: "1+1+1, 1+2, 2+1" },
    ],
    constraints: "1 ≤ n ≤ 45",
    testCases: [
      { input: "2", expected_output: "2", is_hidden: false },
      { input: "3", expected_output: "3", is_hidden: false },
      { input: "1", expected_output: "1", is_hidden: true },
      { input: "10", expected_output: "89", is_hidden: true },
      { input: "45", expected_output: "1836311903", is_hidden: true },
    ],
    starterCode: {
      javascript: `function climbStairs(n) {\n  // your code here\n};`,
      python: `def climb_stairs(n: int) -> int:\n    # your code here\n    pass`,
      cpp: `int climbStairs(int n) {\n    // your code here\n}`,
    },
    editorial: "Fibonacci sequence in disguise. dp[i] = dp[i-1] + dp[i-2]. O(n) time, O(1) space.",
  },

  {
    title: "Coin Change",
    slug: "coin-change",
    difficulty: "medium",
    topics: ["dp"],
    companyTags: ["amazon", "google", "microsoft"],
    description: `You are given an integer array \`coins\` representing coin denominations and an integer \`amount\`. Return the **fewest number of coins** needed to make up that amount. If it's impossible, return \`-1\`.`,
    examples: [
      { input: "coins = [1,5,6,9], amount = 11", output: "2", explanation: "6+5 = 11" },
      { input: "coins = [2], amount = 3", output: "-1" },
      { input: "coins = [1], amount = 0", output: "0" },
    ],
    constraints: "1 ≤ coins.length ≤ 12\n1 ≤ coins[i] ≤ 2³¹ - 1\n0 ≤ amount ≤ 10⁴",
    testCases: [
      { input: "[1,5,6,9]\n11", expected_output: "2", is_hidden: false },
      { input: "[2]\n3", expected_output: "-1", is_hidden: false },
      { input: "[1]\n0", expected_output: "0", is_hidden: false },
      { input: "[1,2,5]\n11", expected_output: "3", is_hidden: true },
      { input: "[186,419,83,408]\n6249", expected_output: "20", is_hidden: true },
    ],
    starterCode: {
      javascript: `function coinChange(coins, amount) {\n  // your code here\n};`,
      python: `def coin_change(coins: list[int], amount: int) -> int:\n    # your code here\n    pass`,
      cpp: `int coinChange(vector<int>& coins, int amount) {\n    // your code here\n}`,
    },
    editorial: "Bottom-up DP. dp[i] = min coins to make amount i. dp[0]=0, dp[i]=min(dp[i-c]+1) for each coin c.",
  },

  // ─── Graphs (2) ───────────────────────────────────────────────────────────

  {
    title: "Number of Islands",
    slug: "number-of-islands",
    difficulty: "medium",
    topics: ["graphs"],
    companyTags: ["amazon", "google", "facebook"],
    description: `Given an \`m × n\` 2D grid of \`'1'\` (land) and \`'0'\` (water), count the **number of islands**. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.`,
    examples: [
      {
        input: `grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]`,
        output: "1",
      },
      {
        input: `grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]`,
        output: "3",
      },
    ],
    constraints: "m == grid.length\nn == grid[i].length\n1 ≤ m, n ≤ 300",
    testCases: [
      {
        input: `[["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]`,
        expected_output: "1",
        is_hidden: false,
      },
      {
        input: `[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]`,
        expected_output: "3",
        is_hidden: false,
      },
      { input: `[["1"]]`, expected_output: "1", is_hidden: true },
      { input: `[["0"]]`, expected_output: "0", is_hidden: true },
    ],
    starterCode: {
      javascript: `function numIslands(grid) {\n  // your code here\n};`,
      python: `def num_islands(grid: list[list[str]]) -> int:\n    # your code here\n    pass`,
      cpp: `int numIslands(vector<vector<char>>& grid) {\n    // your code here\n}`,
    },
    editorial: "DFS/BFS from each unvisited land cell, marking visited cells. Count DFS calls = island count. O(m*n).",
  },

  {
    title: "Course Schedule",
    slug: "course-schedule",
    difficulty: "medium",
    topics: ["graphs"],
    companyTags: ["amazon", "google", "facebook"],
    description: `There are \`numCourses\` courses (0 to numCourses-1). You're given \`prerequisites\` where \`prerequisites[i] = [a, b]\` means you must take course \`b\` before \`a\`. Return \`true\` if it's possible to finish all courses.`,
    examples: [
      { input: "numCourses = 2, prerequisites = [[1,0]]", output: "true" },
      { input: "numCourses = 2, prerequisites = [[1,0],[0,1]]", output: "false", explanation: "Cycle detected" },
    ],
    constraints: "1 ≤ numCourses ≤ 2000\n0 ≤ prerequisites.length ≤ 5000",
    testCases: [
      { input: "2\n[[1,0]]", expected_output: "true", is_hidden: false },
      { input: "2\n[[1,0],[0,1]]", expected_output: "false", is_hidden: false },
      { input: "1\n[]", expected_output: "true", is_hidden: true },
      { input: "3\n[[1,0],[2,1],[0,2]]", expected_output: "false", is_hidden: true },
    ],
    starterCode: {
      javascript: `function canFinish(numCourses, prerequisites) {\n  // your code here\n};`,
      python: `def can_finish(numCourses: int, prerequisites: list[list[int]]) -> bool:\n    # your code here\n    pass`,
      cpp: `bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {\n    // your code here\n}`,
    },
    editorial: "Cycle detection in a directed graph. Use DFS with 3-color marking (unvisited/visiting/visited) or topological sort (Kahn's algorithm).",
  },

  // ─── Hashing (2) ──────────────────────────────────────────────────────────

  {
    title: "Group Anagrams",
    slug: "group-anagrams",
    difficulty: "medium",
    topics: ["hashing", "strings"],
    companyTags: ["amazon", "facebook", "uber"],
    description: `Given an array of strings \`strs\`, group the **anagrams** together. Return the groups in any order.`,
    examples: [
      {
        input: `strs = ["eat","tea","tan","ate","nat","bat"]`,
        output: `[["bat"],["nat","tan"],["ate","eat","tea"]]`,
      },
      { input: `strs = [""]`, output: `[[""]]` },
      { input: `strs = ["a"]`, output: `[["a"]]` },
    ],
    constraints: "1 ≤ strs.length ≤ 10⁴\n0 ≤ strs[i].length ≤ 100",
    testCases: [
      {
        input: `["eat","tea","tan","ate","nat","bat"]`,
        expected_output: `[["bat"],["nat","tan"],["ate","eat","tea"]]`,
        is_hidden: false,
      },
      { input: `[""]`, expected_output: `[[""]]`, is_hidden: false },
      { input: `["a"]`, expected_output: `[["a"]]`, is_hidden: true },
    ],
    starterCode: {
      javascript: `function groupAnagrams(strs) {\n  // your code here\n};`,
      python: `def group_anagrams(strs: list[str]) -> list[list[str]]:\n    # your code here\n    pass`,
      cpp: `vector<vector<string>> groupAnagrams(vector<string>& strs) {\n    // your code here\n}`,
    },
    editorial: "Sort each string as key in a hash map. Group strings sharing the same sorted key. O(n * k log k).",
  },

  {
    title: "Top K Frequent Elements",
    slug: "top-k-frequent-elements",
    difficulty: "medium",
    topics: ["hashing", "sorting"],
    companyTags: ["amazon", "google", "facebook"],
    description: `Given an integer array \`nums\` and an integer \`k\`, return the \`k\` most frequent elements. You may return the answer in **any order**.`,
    examples: [
      { input: "nums = [1,1,1,2,2,3], k = 2", output: "[1,2]" },
      { input: "nums = [1], k = 1", output: "[1]" },
    ],
    constraints: "1 ≤ nums.length ≤ 10⁵\nk is in the range [1, unique elements count]\nAnswer is unique",
    testCases: [
      { input: "[1,1,1,2,2,3]\n2", expected_output: "[1,2]", is_hidden: false },
      { input: "[1]\n1", expected_output: "[1]", is_hidden: false },
      { input: "[4,4,4,6,6,1]\n2", expected_output: "[4,6]", is_hidden: true },
    ],
    starterCode: {
      javascript: `function topKFrequent(nums, k) {\n  // your code here\n};`,
      python: `def top_k_frequent(nums: list[int], k: int) -> list[int]:\n    # your code here\n    pass`,
      cpp: `vector<int> topKFrequent(vector<int>& nums, int k) {\n    // your code here\n}`,
    },
    editorial: "Frequency map + bucket sort. O(n) with bucket sort, O(n log n) with heap.",
  },

  // ─── Sorting (1) ──────────────────────────────────────────────────────────

  {
    title: "Merge Intervals",
    slug: "merge-intervals",
    difficulty: "medium",
    topics: ["sorting", "arrays"],
    companyTags: ["amazon", "google", "microsoft"],
    description: `Given an array of \`intervals\` where \`intervals[i] = [start, end]\`, merge all overlapping intervals and return an array of the **non-overlapping intervals** that cover all intervals in the input.`,
    examples: [
      { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
      { input: "intervals = [[1,4],[4,5]]", output: "[[1,5]]" },
    ],
    constraints: "1 ≤ intervals.length ≤ 10⁴\nintervals[i].length == 2\n0 ≤ start ≤ end ≤ 10⁴",
    testCases: [
      { input: "[[1,3],[2,6],[8,10],[15,18]]", expected_output: "[[1,6],[8,10],[15,18]]", is_hidden: false },
      { input: "[[1,4],[4,5]]", expected_output: "[[1,5]]", is_hidden: false },
      { input: "[[1,4],[0,4]]", expected_output: "[[0,4]]", is_hidden: true },
      { input: "[[1,4],[0,0]]", expected_output: "[[0,0],[1,4]]", is_hidden: true },
    ],
    starterCode: {
      javascript: `function merge(intervals) {\n  // your code here\n};`,
      python: `def merge(intervals: list[list[int]]) -> list[list[int]]:\n    # your code here\n    pass`,
      cpp: `vector<vector<int>> merge(vector<vector<int>>& intervals) {\n    // your code here\n}`,
    },
    editorial: "Sort by start time. Iterate and merge overlapping intervals by comparing current end with next start.",
  },

  // ─── Recursion / Backtracking (2) ─────────────────────────────────────────

  {
    title: "Subsets",
    slug: "subsets",
    difficulty: "medium",
    topics: ["recursion", "arrays"],
    companyTags: ["amazon", "facebook", "apple"],
    description: `Given an integer array \`nums\` of **unique** elements, return all possible subsets (the power set). The solution must not contain duplicate subsets. Return the answer in any order.`,
    examples: [
      { input: "nums = [1,2,3]", output: "[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]" },
      { input: "nums = [0]", output: "[[],[0]]" },
    ],
    constraints: "1 ≤ nums.length ≤ 10\n-10 ≤ nums[i] ≤ 10\nAll nums are unique",
    testCases: [
      { input: "[1,2,3]", expected_output: "[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]", is_hidden: false },
      { input: "[0]", expected_output: "[[],[0]]", is_hidden: false },
      { input: "[1,2]", expected_output: "[[],[1],[2],[1,2]]", is_hidden: true },
    ],
    starterCode: {
      javascript: `function subsets(nums) {\n  // your code here\n};`,
      python: `def subsets(nums: list[int]) -> list[list[int]]:\n    # your code here\n    pass`,
      cpp: `vector<vector<int>> subsets(vector<int>& nums) {\n    // your code here\n}`,
    },
    editorial: "Backtracking: at each index, include or skip the element. 2^n subsets total. O(2^n * n) time.",
  },

  {
    title: "Generate Parentheses",
    slug: "generate-parentheses",
    difficulty: "medium",
    topics: ["recursion", "strings"],
    companyTags: ["amazon", "google", "microsoft"],
    description: `Given \`n\` pairs of parentheses, write a function to generate all combinations of **well-formed parentheses**.`,
    examples: [
      { input: "n = 3", output: `["((()))","(()())","(())()","()(())","()()()"]` },
      { input: "n = 1", output: `["()"]` },
    ],
    constraints: "1 ≤ n ≤ 8",
    testCases: [
      { input: "1", expected_output: `["()"]`, is_hidden: false },
      { input: "2", expected_output: `["(())","()()"]`, is_hidden: false },
      { input: "3", expected_output: `["((()))","(()())","(())()","()(())","()()()"]`, is_hidden: true },
    ],
    starterCode: {
      javascript: `function generateParenthesis(n) {\n  // your code here\n};`,
      python: `def generate_parenthesis(n: int) -> list[str]:\n    # your code here\n    pass`,
      cpp: `vector<string> generateParenthesis(int n) {\n    // your code here\n}`,
    },
    editorial: "Backtracking with open/close counters. Add '(' if open < n, add ')' if close < open.",
  },
];

async function seed() {
  console.log("🌱 Seeding CodeClash problem bank...\n");

  try {
    // Upsert problems by slug — safe to run multiple times
    for (const problem of PROBLEM_BANK) {
      await db
        .insert(problems)
        .values(problem)
        .onConflictDoNothing({ target: problems.slug });

      const tag = problem.difficulty.toUpperCase().padEnd(6);
      const topics = problem.topics!.slice(0, 2).join(", ");
      console.log(`  ✅ [${tag}] ${problem.title} (${topics})`);
    }

    console.log(`\n🎉 Seeded ${PROBLEM_BANK.length} problems successfully!`);
    console.log("\nBreakdown:");
    const byTopic: Record<string, number> = {};
    PROBLEM_BANK.forEach((p) =>
      p.topics!.forEach((t) => {
        byTopic[t] = (byTopic[t] ?? 0) + 1;
      })
    );
    Object.entries(byTopic)
      .sort((a, b) => b[1] - a[1])
      .forEach(([t, c]) => console.log(`  ${t.padEnd(12)} ${c} problems`));
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }

  process.exit(0);
}

seed();