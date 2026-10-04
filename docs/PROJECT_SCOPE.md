# Project Scope

This document defines what CappyCode is intended to be and, equally importantly, what it is not intended to become during its initial development.

## Product Goal

CappyCode helps beginner programmers compare equivalent **technical interview solutions** across Python, Java, and C++.

The product should help students recognize that the same algorithm can have different syntax, type declarations, standard-library APIs, and data-structure names depending on the language.

## Target Users

The primary users are students in the **Coding Interview Club Intro branch**, especially freshmen and sophomores who are beginning to practice Data Structures & Algorithms and LeetCode-style problems.

The app should still be usable by anyone without requiring an account.

## Core Use Case

A student writes a solution in one supported language.

CappyCode then:

1. identifies the source language selected by the student;
2. translates the implementation into the other supported languages;
3. preserves the algorithm and complexity;
4. displays the translated versions;
5. explains meaningful language differences when useful.

## Supported Languages

Initial support:

- Python
- Java
- C++

Adding more languages is not a current priority.

## Algorithmic Scope

CappyCode should prioritize common beginner and intermediate interview concepts:

- arrays;
- strings;
- hash maps;
- hash sets;
- stacks;
- queues;
- linked lists;
- two pointers;
- sliding window;
- binary search;
- trees;
- DFS;
- BFS;
- recursion;
- introductory dynamic programming.

## Translation Requirements

Translations should preserve:

- the algorithmic strategy;
- expected behavior;
- asymptotic time complexity;
- asymptotic space complexity;
- equivalent data-structure usage.

Translations should be idiomatic enough to teach the target language.

The system should avoid literal line-by-line translation when a language has a more natural equivalent.

## Educational Layer

When useful, CappyCode should explain differences such as:

- `dict` vs `HashMap` vs `unordered_map`;
- dynamic typing vs explicit type declarations;
- array/list APIs;
- iteration patterns;
- null values;
- standard-library differences.

Explanations should be concise and written for beginners.

## Initial UX

The first version should prioritize clarity over visual complexity.

Expected UI concepts:

- one primary code editor;
- source-language selector;
- translated-language tabs or panels;
- automatic translation after a short typing pause;
- loading state;
- error state;
- "What changed?" explanation section.

## Non-Goals

The initial project does not need:

- user accounts;
- authentication;
- profiles;
- saved solutions;
- leaderboards;
- social features;
- a database;
- full LeetCode problem hosting;
- code submissions or online judging;
- production application translation;
- framework translation;
- package-management translation;
- arbitrary multi-file project translation;
- more than Python, Java, and C++;
- an AI chatbot;
- advanced debugging assistance.

These features can be reconsidered later only if they support the educational goal.

## Product Principle

A useful test for new features is:

> Does this help a beginner understand interview code across Python, Java, and C++?

If the answer is no, the feature is probably outside the current scope.
