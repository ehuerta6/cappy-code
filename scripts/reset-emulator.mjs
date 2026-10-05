import { clearEmulatorData, seedEmulatorData } from './emulator-seed-data.mjs';

await clearEmulatorData();
console.log('Cleared local Firestore and Auth emulator data.');
await seedEmulatorData();
