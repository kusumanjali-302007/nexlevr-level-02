# Browser Wallet Token Viewer

A beginner-friendly blockchain web app. It connects to MetaMask, then shows the connected wallet's address, network, native ETH balance and an ERC-20 token balance. The token is deployed to a local Hardhat blockchain (Sepolia testnet is optional).

> **Status:** Fill this in after you test. See the [testing checklist](#testing-checklist).

## Features

- Connect wallet button using ethers.js v6, with a shortened address (`0x1234...abcd`)
- Clear errors for: MetaMask not installed, rejected connection, wrong network, invalid token address, no contract at the address, RPC node offline
- ETH balance, plus ERC-20 balance, name, symbol and decimals
- Refresh button, and automatic updates when you change account or network
- Network name and chain ID, with an "unsupported network" warning and one-click switch buttons
- "Add token to MetaMask" button
- Responsive dashboard with loading indicator and success/error messages
- Fixed-supply ERC-20 contract (OpenZeppelin), with Hardhat tests

## Technologies

HTML, CSS, JavaScript - ethers.js v6 (loaded from the jsDelivr CDN) - Solidity 0.8.24 + OpenZeppelin Contracts 5 - Hardhat 2 - MetaMask - Node.js

## Project structure

```
browser-wallet-token-viewer/
├── contracts/MyToken.sol      ERC-20 token (1,000,000 MTK to the deployer)
├── scripts/deploy.js          Deploys the token and writes its address to public/config.js
├── test/MyToken.test.js       Smart contract tests
├── public/                    The website (index.html, style.css, app.js, config.js)
├── docs/VIDEO_GUIDE.md        How to record the demo video
├── hardhat.config.js
├── package.json
├── .env.example               Only needed for Sepolia
└── README.md
```

## Prerequisites

1. **Node.js 20 LTS** (from https://nodejs.org). Check in PowerShell:
   ```powershell
   node -v
   npm -v
   ```
2. **MetaMask** browser extension (https://metamask.io/download/)
3. **Git** (only needed to upload to GitHub)

## Installation (Windows PowerShell)

Extract the ZIP, open PowerShell in the extracted folder, and install:

```powershell
Expand-Archive .\browser-wallet-token-viewer.zip -DestinationPath .
cd .\browser-wallet-token-viewer
npm install
```

If PowerShell says *"running scripts is disabled on this system"*, run this once, then try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## Run the project

You need **three PowerShell windows**, all opened in the project folder.

**Window 1 - start the local blockchain** (leave it running):

```powershell
npm run node
```

It prints 20 test accounts, each with 10,000 fake ETH, and their private keys. These keys are public and only for local testing. **Never send real money to them.**

**Window 2 - run tests, then deploy the token:**

```powershell
npm test
npm run deploy:local
```

The deploy command prints the token address and saves it into `public/config.js` automatically.

**Window 3 - start the website:**

```powershell
npm start
```

Open http://localhost:3000 in the browser that has MetaMask.

## MetaMask setup

1. **Add the local network.** MetaMask -> network picker -> *Add a custom network*:

   | Field | Value |
   |---|---|
   | Network name | Hardhat Local |
   | RPC URL | `http://127.0.0.1:8545` |
   | Chain ID | `31337` |
   | Currency symbol | `ETH` |

   (The website's switch button can add this network for you.)

2. **Import the deployer account.** The token supply goes to Hardhat account #0. In Window 1, copy the private key shown under `Account #0`. In MetaMask: account menu -> *Add account or hardware wallet* -> *Private key* -> paste it. Use this only with the local network.

3. **Connect.** Open the website, click **Connect wallet**, and approve.

4. **Optional: show the token inside MetaMask.** Click **Add token to MetaMask** on the dashboard, or in MetaMask choose *Import tokens* and paste the token address.

## Configure the contract address

`public/config.js` has one address per chain ID:

```js
tokenAddresses: {
  31337: "",        // Hardhat Local  (filled by npm run deploy:local)
  11155111: "",     // Sepolia        (filled by npm run deploy:sepolia)
},
```

Deploying fills these in. You can also paste an address between the quotes by hand. The file is public, so never put secrets in it.

## Optional: Sepolia testnet

1. Copy `.env.example` to `.env` and fill in `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` (a throwaway wallet only). `.env` is git-ignored.
2. Get free Sepolia ETH from a faucet.
3. Run `npm run deploy:sepolia`, then switch MetaMask to Sepolia.

```powershell
Copy-Item .env.example .env
npm run deploy:sepolia
```

## Testing guide

**Smart contract tests** (`npm test`) check: name, symbol and decimals; total supply of 1,000,000 tokens; whole supply goes to the deployer; no mint function exists; `balanceOf` is 0 for new accounts; `balanceOf` updates after a transfer; over-sized transfers revert.

**Check the frontend by hand.** With the node running, the token deployed and the account #0 imported, the dashboard should show:

- ETH balance a little under **10,000 ETH** (deploying costs a small amount of fake gas)
- Token balance of **1,000,000 MTK**, name **My Token**, symbol **MTK**, decimals **18**
- Network **Hardhat Local**, chain ID **31337**

Then try the error cases: switch MetaMask to Ethereum Mainnet (you should see the unsupported-network warning), reject the connection popup, stop the node and press Refresh, and put a wrong address in `config.js`.

### Testing checklist

Before uploading to GitHub, tick every box:

- [ ] `npm install` finishes without errors
- [ ] `npm test` shows all tests passing
- [ ] `npm run node` runs and `npm run deploy:local` prints a token address
- [ ] `public/config.js` now contains that address
- [ ] The dashboard shows the correct ETH and MTK balances
- [ ] Refresh balances works
- [ ] Switching account or network in MetaMask updates the page
- [ ] Unsupported network warning appears on a different chain
- [ ] Rejecting the connection shows a readable message
- [ ] Page looks right on a narrow window (about 400 px wide)
- [ ] `.env` does **not** appear in `git status`
- [ ] No private keys in any committed file
- [ ] Screenshots and demo video link added below

## Screenshots

Add your own screenshots to `docs/screenshots/` and link them here:

<!-- ![Dashboard](docs/screenshots/dashboard.png) -->
_Screenshots not added yet._

## Video demonstration

Step-by-step recording instructions and a narration script are in [docs/VIDEO_GUIDE.md](docs/VIDEO_GUIDE.md).

Video link: **_add your link here after recording_**

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` is blocked in PowerShell | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or use `npm.cmd` instead of `npm`. |
| "MetaMask was not found" | Install MetaMask and reload. Open the page in the browser where it is installed. |
| Port 8545 already in use | Another node is running. Find it with `netstat -ano \| findstr :8545`, stop it with `taskkill /PID <pid> /F`. |
| Port 3000 already in use | Run `npx http-server public -p 3001` and open `http://localhost:3001`. |
| "Can't reach the blockchain node" | Make sure `npm run node` is still running, and MetaMask's RPC URL is `http://127.0.0.1:8545`. |
| "No contract exists at the configured token address" | You restarted the node. It forgets everything. Run `npm run deploy:local` again and reload the page. |
| MetaMask transactions fail after restarting the node | MetaMask -> Settings -> Advanced -> *Clear activity tab data*. |
| ETH balance looks wrong after restarting the node | Same fix: clear activity tab data, then press Refresh. |
| "Unsupported network" | Click a switch button, or pick the network in MetaMask. |
| "Token address not configured" | Run the deploy command, or paste the address into `public/config.js`. |
| "Invalid token contract address" | The address in `config.js` has a typo. It must start with `0x` and have 40 hex characters. |
| ethers.js did not load | The page loads ethers from a CDN, so you need internet access. |
| `network "sepolia" doesn't exist` | Fill in both values in `.env` first. |
| Connect popup never appears | MetaMask may already have a pending request. Click the MetaMask icon and finish it. |
| `npm install` fails | Use Node 20 LTS, delete `node_modules`, and run it again. |

## Upload to GitHub

```powershell
git init
git add .
git commit -m "Browser wallet token viewer"
git branch -M main
git remote add origin https://github.com/<your-username>/browser-wallet-token-viewer.git
git push -u origin main
```

Create the empty repository on github.com first. Run `git status` before committing and confirm `.env` and `node_modules` are not listed.

## Security notes

- The frontend contains no private keys. MetaMask signs everything.
- Hardhat's built-in account keys are public. Use them only on the local network.
- Use a throwaway wallet for Sepolia and never commit `.env`.

## License

MIT
