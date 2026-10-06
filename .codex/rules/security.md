# Security

General security rules for software engineering and AI-assisted development.

## Secrets

Never place secrets in:

- source code;
- committed configuration;
- prompts intended for persistence;
- logs;
- screenshots;
- issues;
- pull requests;
- documentation.

Use environment variables, secret managers, or the project's established secure mechanism.

Redact sensitive values from examples and debugging output.

## Trust boundaries

Enforce sensitive authorization decisions at a trusted boundary.

Do not rely on client-side checks as the only protection for privileged behavior.

Treat client input as untrusted.

## Least privilege

Use the minimum permissions required for the task.

Avoid exposing privileged credentials to environments that do not need them.

## Authentication vs authorization

Authentication establishes identity.

Authorization determines what that identity may access or change.

Do not treat successful login as sufficient authorization.

## Data

Protect sensitive data throughout:

- collection;
- storage;
- logs;
- transmission;
- debugging;
- exports.

Do not copy production data into development workflows without a justified and safe process.

## Dependencies and tooling

Before introducing software with meaningful access, consider:

- permissions;
- data exposure;
- network access;
- background execution;
- update behavior;
- vendor lock-in.

## Destructive actions

Identify actions that can:

- delete data;
- overwrite state;
- alter production;
- rotate credentials;
- change access controls.

Use explicit confirmation and reversible approaches when practical.

## Security findings

When reporting a security issue, explain:

- the affected boundary;
- the concrete failure or attack scenario;
- the protection that should prevent it.

Avoid vague statements such as "this is insecure" without explaining why.
