# Getting started

Run CappyCode locally with the Firebase emulators. This setup uses seeded local
data and does not connect to production Firebase.

## Requirements

- Node.js **24.11.0** (the version in `.nvmrc`; supported range is `>=24.11.0 <27`)
- npm **11.6.2**
- Java 11 or newer for the Firestore Emulator

## Install and start

Clone the repository and install the locked dependencies:

```bash
git clone https://github.com/ehuerta6/cappy-code.git
cd cappy-code
npm ci
cp .env.example .env.local
```

The example enables Firebase emulators and uses the local-only project ID
`demo-cappycode-local`. Start the Authentication and Firestore emulators in one
terminal:

```bash
npm run emulators
```

In a second terminal, load the deterministic fixture and start the app:

```bash
npm run seed
npm run dev
```

Open <http://localhost:3000/> for the Member session list. The Problem Bank is
at <http://localhost:3000/problem-bank>; Officer Mode is at
<http://localhost:3000/officer>. The seeded Officer credential is documented
in [Firebase emulator setup](FIREBASE.md#local-emulator-development) and works
only with the local Auth Emulator.

To restore the known fixture after local testing, leave the emulators running
and run this in another terminal:

```bash
npm run reset
```

`reset` clears and reseeds only the local Auth and Firestore emulators. `seed`
loads the fixture without clearing local data. Never point either command at a
real Firebase project. For emulator configuration, production configuration,
and Rules details, see [Firebase foundation](FIREBASE.md).

## Development checks

Run these from the repository root:

| Command                | What it checks                                         |
| ---------------------- | ------------------------------------------------------ |
| `npm test`             | Unit tests                                             |
| `npm run test:rules`   | Firestore Security Rules tests in the emulator         |
| `npm run e2e`          | Browser tests using local Auth and Firestore emulators |
| `npm run lint`         | ESLint                                                 |
| `npm run typecheck`    | TypeScript types                                       |
| `npm run format:check` | Prettier formatting                                    |
| `npm run build`        | Production build                                       |

The Rules and E2E commands start their own emulators. More Firebase details are
in [Firebase foundation](FIREBASE.md).
