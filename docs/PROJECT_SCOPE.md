# Project Scope

This document defines what CappyCode is intended to be, and what it is not intended to become during its initial development.

## Product Goal

CappyCode is an officer-focused CIC Intro solution showcase. During a session, an officer presents one interview-style solution in Python, Java, and C++ side by side so students can compare the languages while following along on a projected screen.

The showcase should help students recognize that the same algorithm can have different syntax, type declarations, standard-library APIs, and data-structure names depending on the language. Students are the audience viewing the presentation; CIC Intro officers are the primary users operating the app.

## Core Use Case

Near the end of a session, an officer selects a problem tab, reviews or enters code in the Python, Java, and C++ Monaco editors, and selects one source language. The officer chooses when the solution is ready and clicks **Translate**.

The app sends the selected source language and its code to `POST /api/translate`. A server-side coding model returns structured code for Python, Java, and C++, plus concise explanations in a **“What changed?”** section. The response should help officers present language differences while preserving the intended algorithm and behavior.

Translations are explicit and manual. Editing code, switching tabs, or pausing after typing does not run a translation. There is no automatic or debounced translation requirement.

## Supported Languages and Editors

The showcase presents these three languages together:

- Python
- Java
- C++

Use a Monaco editor for each language in the side-by-side presentation. The officer selects exactly one of the three languages as the source for each translation request. The other language panes provide the translated comparison.

## Translation Architecture

The browser sends the selected source language and source code to the application endpoint at `POST /api/translate`. The endpoint calls a server-side coding model and returns structured translations and “What changed?” explanations.

The product is not tied to a particular model provider. Provider choice and credentials belong to server-side configuration. Credentials must never be sent to or embedded in browser code.

The model response should preserve the intended algorithm, expected behavior, and complexity when possible. Translated code should be idiomatic enough to compare and teach, rather than a mechanical line-by-line rewrite. Explanations should be concise, relevant to the presented solution, and understandable to CIC Intro students.

## Problem Tabs and Session Persistence

The interface includes problem tabs so an officer can move among prepared interview-style examples during a session.

The proof of concept may optionally persist the current showcase session in browser `localStorage`. This persistence is local to that browser and device. It does not require account-based saved solutions or a server database.

## Problem Areas

Prioritize introductory and intermediate interview topics:

- arrays and strings;
- hash maps and sets;
- stacks and queues;
- linked lists;
- two pointers;
- sliding window;
- binary search;
- trees and graph traversal;
- recursion;
- introductory dynamic programming.

CappyCode is scoped to interview-style examples used for CIC Intro instruction. It is not intended to translate arbitrary Python, Java, or C++ applications.

## Initial User Experience

The initial showcase should provide:

- tabs for selecting a prepared problem;
- three side-by-side Monaco editors for Python, Java, and C++;
- a source-language selector with one selected language;
- an explicit **Translate** action;
- a clear translating/loading state and useful error state;
- structured translations and a **“What changed?”** explanation area;
- optional browser-local session persistence.

Translation should only begin after the officer explicitly requests it.

## Non-Goals

The initial project does not need:

- user accounts, authentication, or profiles;
- a database or server-side session storage;
- leaderboards or social features;
- full LeetCode problem hosting;
- code submissions or online judging;
- production application, framework, or package translation;
- arbitrary multi-file project translation;
- languages beyond Python, Java, and C++;
- automatic or debounced translation while typing;
- an AI chatbot or advanced debugging assistant.

## Product Principle

Use this question to evaluate additions:

> Does this help a CIC Intro officer present the same interview solution across Python, Java, and C++ so students can understand it?

If not, the feature is probably outside the current scope.
