# Bezel Demo

A React Native / Expo prototype for peer-to-peer prediction offers, backed by a persistent local ledger. Two simulated participants can create offers, match all or part of an opposing stake, confirm results, and inspect how funds move through reservations and settlement.

**All balances and transactions are simulated.** This is an independent engineering project, with no real payments, production authentication, or cross-device synchronization. The source folder retains its original `stake-local-mobile` name.

## Run the demo

Prerequisites: Node.js 22.13+ (Node 22 recommended), npm, and Git. For a phone, use Expo Go compatible with **Expo SDK 57**. For a simulator, install Xcode (iOS/macOS) or Android Studio and an Android emulator.

```sh
git clone https://github.com/santi-el/bezel-demo.git
cd bezel-demo
npm ci --prefix stake-local-mobile
npm start
```

Scan the Expo QR code on a phone connected to the same network, or press `i` / `a` for an installed simulator or emulator. Alternatively run `npm run ios` or `npm run android`. No API keys or environment variables are required. Root scripts delegate to the mobile package; a root dependency install is unnecessary.

## Five-minute walkthrough

1. Select **betmaster99** using the local login shortcut. Create an offer with a $25 creator stake and 1:2 odds. Leave expiry at **No limit**.
2. In Settings, switch to **BoxDaddy**. Find that offer in Near You. The full opposing stake is $50, with a $10 refundable deposit and $1.40 nonrefundable commission. Review the quote before matching.
3. Switch back to the creator and accept the match. Pending matches also have a persisted 20-second acceptance deadline; the engine processes it on access/resume.
4. Submit the same result from both accounts. TRUE pays both stakes to the creator; FALSE pays both to the matcher. When enabled, NULL refunds stakes. Each participant receives their own deposit; commissions remain charged.
5. Inspect Wallet, held funds, and transaction details. Restart the app to check persistence. Repeat with conflicting results to see disputed holds and explicit local resolution in Results.

To explore partial matching, create a fresh offer with the same stakes and match $10 from the opponent account: it allocates $5 of the creator's existing stake. Match & Raise and active Raise create separately funded offers; active Raise leaves the existing wager unchanged. Settings also provides a demo reset.

## Engineering design

- **Presentation:** feature-organized React Native screens and React Navigation stacks/tabs retain the original UI.
- **Service boundary:** `stake-local-mobile/src/services/api/adapter.ts` translates screen-facing dollar values and models into domain operations. The API client is local; there is no HTTP backend.
- **Domain engine:** `stake-local-mobile/src/domain/demo.ts` owns accounts, offers, separate matches, ledger entries, reservations, deadlines, and settlement. Money is stored as integer cents, with rational rounding for proportional allocations.
- **Persistence:** a single engine instance saves versioned snapshots through AsyncStorage. Mutations are queued, applied to a candidate snapshot, and committed through storage. Tests exercise rollback when saving fails.
- **Traceability:** ledger entries carry offer/match references. Wallet details derive from reservations, including both participant roles and disputed funds.

Partial matches allocate existing creator exposure rather than charging it twice. Linked raises require their own funds. Deadline processing lives in the engine rather than screen countdowns. Operation keys guard supported repeated submissions. These decisions make the money rules testable independently of the UI.

## Verification

```sh
npm run typecheck
npm test
npm --prefix stake-local-mobile run export:mobile
```

The suite covers cent rounding and conservation of funds, insufficient balances, full/partial matching, acceptance deadlines, duplicate operations, failed persistence, settlement, disputes, account isolation, compatibility with older snapshots, and service adapter behavior. UI preservation tests compare source styles and selected copy against original commit `6f975e9`; use a full Git clone, not a source ZIP or shallow clone.

GitHub Actions runs type checking and tests with full history. Platform exports validate bundling; they do not prove touch interactions or visual layout. See [validation notes](docs/VALIDATION.md) for the publication checks.

## Tradeoffs and limitations

This prototype prioritizes inspectable accounting and repeatable local scenarios. Account switching simulates multiple participants on one device. Locations/distances and social interactions include fixtures; notifications and support/contact reports remain local. Dispute resolution is a demo control, not independent arbitration.

A production implementation would require server-authoritative transactions, authenticated identities, concurrency controls across devices, payment integration, operational dispute handling, and appropriate product/legal review. AsyncStorage is not a secure financial database. Native touch-flow testing remains separate from automated source and engine checks.

## Project layout

- `stake-local-mobile/` — runnable mobile app, domain engine, adapters, and tests.
- `docs/` — verification notes.
- `web-prototype/` — historical reference note, not a runnable web application.

The original history is retained to make the evolution and preservation baseline inspectable. No open-source license has been added.
