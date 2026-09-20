# Firebase Handoff

This project must remain a personal, no-cost Firebase project on the Spark plan. Do not link a billing account or enable a feature that requires the Blaze plan.

## Project

- Project ID: `finance-dbd6e`
- Web app: `Finance Web`
- App ID: `1:1086653437055:web:be118a049c111044a2db4a`
- Auth domain: `finance-dbd6e.firebaseapp.com`
- Storage bucket: `finance-dbd6e.firebasestorage.app`
- Messaging sender ID: `1086653437055`
- Firestore database ID: `(default)`
- Preferred Firestore location: `asia-south1` (Mumbai), if available when the database is created

The Spark-plan and billing status above were reported by Firebase Gemini and have not been independently queried by this repository.

## Repository Files

- `firestore.rules`: authenticated per-user access under `/users/{uid}` and deny-by-default access everywhere else
- `firestore.indexes.json`: required composite indexes
- `firebase.json`: Firebase CLI paths for the rules and indexes
- `.env.example`: Vite Firebase configuration template; it intentionally contains no real API key
- `.env`: local Firebase configuration for the registered web app; ignored by Git

## Manual Console Checklist

1. In Firebase Console, open Project Settings > General and copy the Web API Key.
2. Create the default Firestore database in **Production mode**, Native mode, using `asia-south1` if available. Do not use Test mode, even temporarily.
3. In Firestore > Rules, paste the repository's `firestore.rules` and publish it.
4. In Authentication > Sign-in method, enable Google only and select a support email.
5. In Authentication > Settings > Authorized domains, keep `localhost`, `127.0.0.1`, and `finance-dbd6e.firebaseapp.com`. Add the exact GitHub Pages domain only when deployment is configured.
6. Put the real Web API Key in a local `.env` copied from `.env.example`. Never commit `.env`.
7. Deploy indexes with `firebase deploy --only firestore:indexes` after reviewing the selected Firebase project.

## Application Configuration

The frontend initializes Firebase from Vite environment variables and deliberately uses an in-memory Firestore cache:

```ts
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  memoryLocalCache,
} from "firebase/firestore";

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});
```

Google Sign-In gates the application. Firestore is authoritative; IndexedDB and runtime asset seeding have been removed.

## No-Cost Guardrails

- Stay on the Spark plan and do not attach a billing account.
- Do not use Cloud Functions, phone authentication, App Hosting, paid backups, point-in-time recovery, TTL deletes, or paid Firebase Extensions.
- Do not store the imported finance workbooks or other private source files in Firebase Storage.
- Do not persist finance records in IndexedDB or localStorage.
- Use Firestore only for the signed-in user's records beneath `/users/{uid}`.
- Keep reads and listeners bounded; do not attach unbounded real-time listeners to entire histories.
- A budget alert is only a notification, not a hard spending cap. The primary protection is remaining on Spark with no billing account linked.

## Pending Inputs

- Confirmation that Firestore was created in Production mode
- Confirmation that the repository rules were published
- Confirmation that Google Sign-In was enabled
- Exact deployed GitHub Pages domain, when available
