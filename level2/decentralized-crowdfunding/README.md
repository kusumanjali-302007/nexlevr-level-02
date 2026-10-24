# 🚀 Decentralized Crowdfunding Platform

An educational, beginner-friendly **all-or-nothing crowdfunding dApp**. Anyone can create a campaign, anyone can fund it with (test) ETH, and the rules are enforced by a Solidity smart contract:

- ✅ Goal reached **and** deadline passed → the creator withdraws the funds.
- ❌ Goal missed by the deadline → every contributor can claim a refund.

> ⚠️ **Test ETH only.** This is a learning project and has not been professionally audited. Never use it with real funds or a wallet that holds real money.

---

## 1. Features & Technology Stack

| Area | Technology |
|---|---|
| Smart contract | Solidity 0.8.24 |
| Development / testing / deployment | Hardhat |
| Tests & scripts | JavaScript (Mocha + Chai, Hardhat Toolbox) |
| Blockchain interaction | Ethers.js v6 |
| Frontend | HTML, CSS, vanilla JavaScript |
| Local blockchain | Hardhat Network (chain ID 31337) |
| Wallet | MetaMask |

**Contract features:** create campaigns (unique IDs) · contribute ETH · per-contributor tracking · creator-only withdrawal · refunds on failure · view functions for details/status · custom errors · re-entrancy guard · checks-effects-interactions · safe ETH transfers.

**Frontend features:** connect MetaMask · show address + ETH balance · create campaign · list campaigns with progress bars and countdowns · contribute · withdraw · claim refund · **real-time updates** (page refreshes automatically on every new block, with a live activity feed and a "● Live" indicator) · loading spinner and status messages (success is shown **only after the transaction is confirmed in a block**) · friendly error messages · responsive and dark-mode friendly.

## 2. Project Structure

```
decentralized-crowdfunding/
├── contracts/
│   ├── Crowdfunding.sol            # the main contract
│   └── test/
│       ├── ReentrancyAttacker.sol  # TEST-ONLY malicious contract
│       └── RejectEther.sol         # TEST-ONLY contract that refuses ETH
├── scripts/
│   └── deploy.js                   # deploys + writes public/contract-config.json
├── test/
│   └── Crowdfunding.test.js        # 49 unit tests
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── vendor/ethers.umd.min.js    # Ethers.js (bundled, works offline)
├── hardhat.config.js               # config + `fast-forward` helper task
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

`public/contract-config.json` (address + ABI) is **generated** by the deploy script and read by the frontend.

## 3. Prerequisites

- **Node.js 18 or newer** (20/22 recommended) → <https://nodejs.org>. Check with `node -v`.
- **MetaMask** browser extension → <https://metamask.io>.
- A terminal (Terminal, PowerShell, Git Bash…).

## 4. Commands (copy & paste)

Run everything from inside the project folder.

```bash
# 1. Install dependencies
npm install

# 2. Compile the smart contract
npx hardhat compile

# 3. Run all unit tests
npx hardhat test
```

To run the app you need **three terminals** (keep 1 and 3 open):

```bash
# Terminal 1 - start the local blockchain (prints 20 test accounts + private keys)
npx hardhat node

# Terminal 2 - deploy the contract to that blockchain
npm run deploy

# Terminal 3 - start the frontend
npm run frontend
```

Then open **<http://localhost:3000>**.

> 📌 **A local deployment address is only valid for that one running blockchain.** The Hardhat node keeps everything in memory. If you stop and restart `npx hardhat node`, the chain is wiped: the old contract address no longer exists, so run `npm run deploy` again (and reset MetaMask, see Troubleshooting).

## 5. Connecting MetaMask to the local network

1. Open MetaMask → network dropdown → **Add network** → **Add a network manually**.
2. Enter:
   - **Network name:** Hardhat Local
   - **RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency symbol:** `ETH`
3. Import a funded test account: MetaMask → account menu → **Import account** → paste a **private key printed by `npx hardhat node`** (each test account has 10,000 test ETH). Import two or three to play different roles (creator, contributors).
4. In the web page click **Connect MetaMask**. If you are on the wrong network, a **Switch network** button appears (it can also add the network for you).

> 🔐 The Hardhat private keys are public knowledge. Use them **only** on your local network and never send real funds to those addresses.

## 6. Smart Contract Functionality

| Function | Who | What it does |
|---|---|---|
| `createCampaign(goal, duration)` | anyone | `goal` in wei (> 0), `duration` in seconds (60 s – 365 days). Returns the new ID (1, 2, 3 …). |
| `contribute(campaignId)` *payable* | anyone | Adds `msg.value` to the campaign. Rejects zero value and anything at/after the deadline. |
| `withdrawFunds(campaignId)` | creator only | After the deadline **and** goal reached. Only once. |
| `claimRefund(campaignId)` | contributors | After the deadline **and** goal NOT reached. Refunds the caller's whole contribution, once. |
| `getCampaign(campaignId)` | view | `creator, goal, deadline, totalRaised, withdrawn, status` |
| `getContribution(campaignId, address)` | view | Amount an address currently has in a campaign. |
| `getStatus(campaignId)` | view | `0 = Active`, `1 = Successful`, `2 = Failed` |
| `campaignCount()` | view | Number of campaigns created. |

**Status rules:** `Active` until the deadline. After it: `Successful` if `totalRaised >= goal`, otherwise `Failed`. Reaching the goal early does **not** end the campaign; people can keep contributing until the deadline.

**Events:** `CampaignCreated`, `ContributionReceived`, `FundsWithdrawn`, `RefundClaimed`.

**Custom errors:** `InvalidGoal`, `InvalidDuration`, `CampaignDoesNotExist`, `CampaignEnded`, `CampaignNotEnded`, `ZeroContribution`, `NotCreator`, `GoalNotReached`, `GoalReached`, `AlreadyWithdrawn`, `NothingToRefund`, `TransferFailed`, `ReentrantCall`.

## 7. Unit Tests

Run: `npx hardhat test` — expected result: **49 passing, 0 failing**.

Time-dependent behaviour is tested with Hardhat's `time` helpers (`time.increase`, `time.increaseTo`, `time.setNextBlockTimestamp`), and `loadFixture` snapshots make every test start from an identical state, so tests are deterministic and run entirely locally.

| Group | Covers |
|---|---|
| Deployment | initial state, duration limits |
| Create campaign | stored data, event, unique IDs, zero goal, too-short / too-long duration, boundary durations |
| Contribute | balances, records, event, repeated contributions, many contributors, separate campaigns, zero value, after deadline, last second before deadline, unknown campaign, over-funding, plain ETH transfer rejected |
| Campaign status | Active / Successful / Failed, exact-goal edge case, unknown IDs |
| Withdraw | success + event + balances, non-creator, before deadline, goal missed, duplicate, isolation between campaigns, unknown ID, refund blocked after success |
| Refund | success + event + balances, multiple contributions summed, before deadline, duplicate, non-contributor, no-contributions campaign |
| Reentrancy & failed transfers | attacker contract re-entering `claimRefund` and `withdrawFunds` is blocked; `TransferFailed` for creators/contributors that cannot receive ETH (state rolls back) |
| End-to-end | full success flow and full failure flow |

## 8. Example Workflow (try it in the browser)

Use three imported accounts: **Creator**, **Alice**, **Bob**.

**A) Successful campaign**
1. As **Creator**: goal `2`, duration `5` **minutes** → *Create campaign* → confirm in MetaMask. Wait for the green "confirmed" message.
2. As **Alice**: contribute `1.5`. As **Bob**: contribute `0.5`. The progress bar reaches 100%.
3. Let the deadline pass. Either wait 5 minutes, or fast-forward the local clock:
   ```bash
   npx hardhat fast-forward --seconds 301 --network localhost
   ```
4. The badge turns **Successful** automatically. As **Creator**, click **Withdraw**. 🎉

**B) Failed campaign**
1. Create another campaign (goal `10`, 5 minutes) and contribute only `1` from Alice.
2. Fast-forward as above. The badge turns **Failed**.
3. As **Alice**, click **Claim refund**.

## 9. Security Considerations

- **Checks-Effects-Interactions:** state is updated *before* ETH is sent in `withdrawFunds` and `claimRefund`.
- **Re-entrancy guard:** `nonReentrant` on both functions that send ETH (verified with an attacker contract in the tests).
- **Safe transfers:** ETH is sent with `call{value: ...}("")` (no 2300-gas limit) and the return value is checked → `TransferFailed` reverts the whole transaction.
- **Access control:** only the creator can withdraw; only recorded contributors can refund their own funds.
- **Input validation:** goal > 0, duration within 1 minute – 365 days, non-zero contributions.
- **No `receive()`/`fallback()`:** ETH sent directly to the contract (not via `contribute`) is rejected, so the accounting can't be bypassed.
- Solidity 0.8 has built-in overflow/underflow checks.

### Known limitations (good discussion points / extensions)

- **Block timestamps** can be slightly manipulated by validators on real networks (seconds, not hours). Acceptable here, but keep it in mind for very short durations.
- **A creator contract that cannot receive ETH** can never withdraw (the call reverts safely and funds stay in the contract). A production version could allow a separate payout address.
- Contributors to a **successful** campaign cannot get refunds (by design).
- No campaign titles/descriptions, cancellation, platform fee, or milestone payouts.
- The frontend reads campaigns by looping over IDs (fine for learning, not for thousands of campaigns; use events/indexers such as The Graph in production).
- **Live updates** use block polling (every ~1 second) from the local node, not WebSockets. Countdowns are synced to the blockchain's clock on every block, and the campaign status flips automatically when a deadline passes. The **Refresh** button is only a fallback.
- The contract has **not been audited**.

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `npx hardhat compile` fails with a download error (e.g. `ENOTFOUND binaries.soliditylang.org`) | Your network blocks the Solidity compiler download. Use the bundled JS compiler: macOS/Linux `USE_SOLCJS=true npx hardhat test` · Windows PowerShell `$env:USE_SOLCJS="true"; npx hardhat test`. (Or put `USE_SOLCJS=true` in a `.env` file.) |
| Page says *contract-config.json not found* | Run `npm run deploy` while `npx hardhat node` is running, then reload. |
| Page says *No contract found at the saved address* | You restarted the node. Run `npm run deploy` again, then reload. |
| Page says *Cannot reach the local blockchain* | Start `npx hardhat node` and keep it running. |
| MetaMask transactions fail / "nonce too high" after restarting the node | MetaMask → Settings → Advanced → **Clear activity tab data** (older versions: *Reset account*). |
| "Wrong network" banner | Click **Switch network**, or select *Hardhat Local* in MetaMask. |
| Balance shows `—` | Wallet not connected or on the wrong network. |
| Port 3000/8545 already in use | Close the other program, or use another port (`npx http-server public -p 3001`). |
| `npm install` errors | Make sure Node is v18+; delete `node_modules` and `package-lock.json`, then retry. |
| Deadline hasn't "passed" in the UI | Wait, or run `npx hardhat fast-forward --seconds N --network localhost`; the page updates by itself within a second or two. |
| Indicator shows "● reconnecting…" | The page cannot reach the node. Make sure the local node is running. |

## 11. Other useful commands

```bash
npx hardhat coverage    # test coverage report
npx hardhat clean       # delete compiled artifacts
```

Optional public test network (Sepolia): copy `.env.example` to `.env`, fill in `SEPOLIA_RPC_URL` and a **test-only** `PRIVATE_KEY`, then `npx hardhat run scripts/deploy.js --network sepolia`. The frontend is configured for local use; adjust the RPC/chain handling in `public/app.js` if you want it on Sepolia.

## License

MIT
