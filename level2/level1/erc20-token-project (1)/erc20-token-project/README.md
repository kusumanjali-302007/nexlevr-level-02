# ERC-20 Token Deployment on a Local Ethereum Network

A beginner-friendly blockchain project. It creates an **ERC-20 token called Campus Token (CAMP)**, tests it, deploys it to a **local Ethereum network** running on your own computer, and shows how to see the token in **MetaMask**.

Everything is free and runs offline: no real money, no test ETH and no private keys are needed.

---

## 1. Features

| Item | Value |
|---|---|
| Token name | Campus Token |
| Token symbol | CAMP |
| Decimals | 18 |
| Initial supply | 1,000,000 CAMP, minted to the deployer's wallet |
| Standard | ERC-20, using OpenZeppelin Contracts v5 |
| Tools | Solidity 0.8.24, Hardhat 2, ethers.js v6, Node.js |
| Network | Local Hardhat network (chain ID `31337`) |
| Tests | 24 unit tests (Mocha + Chai) |

Design and security choices:

- The contract **reuses OpenZeppelin's audited `ERC20`** code instead of re-writing token logic.
- **Fixed supply:** there is no `mint` or `burn` function, so the supply can never change.
- **No owner / admin:** nobody has special powers over the token.
- The deploy script reads the **real address and transaction hash from the blockchain**; nothing is hardcoded.
- No secrets are stored in the project (`.env` is git-ignored and optional).

## 2. Project structure

```
erc20-token-project/
├── contracts/
│   └── SimpleToken.sol      <- the ERC-20 token contract
├── scripts/
│   └── deploy.js            <- deploys the token and prints the real address
├── test/
│   └── SimpleToken.js       <- 24 unit tests
├── hardhat.config.js        <- Hardhat settings (Solidity version, networks)
├── package.json             <- dependencies and npm scripts
├── .gitignore               <- files that must not go to GitHub
├── .env.example             <- optional settings template (no secrets needed)
└── README.md                <- this file
```

Folders created automatically when you run commands: `node_modules/`, `artifacts/`, `cache/` (build output) and `deployments/` (saved deployment details). All are git-ignored.

## 3. Key concepts in simple words

- **ERC-20:** a standard "rulebook" for tokens on Ethereum (functions like `transfer`, `balanceOf`, `approve`). Any wallet that knows ERC-20, such as MetaMask, can show and send your token.
- **Smart contract:** a program stored on the blockchain. Our contract *is* the token: it keeps a table of who owns how many CAMP.
- **Hardhat:** a developer tool that compiles Solidity, runs tests and runs a local blockchain.
- **Local network:** a private test blockchain on your computer with 20 free accounts, each holding 10,000 fake ETH. Instant and free.
- **Decimals (18):** the token is stored as whole numbers. 1 CAMP = 1,000,000,000,000,000,000 smallest units. That is why the code writes `1_000_000 * 10 ** 18`.
- **Deployer:** the wallet that sends the deployment transaction. Our constructor gives it all 1,000,000 CAMP.

## 4. Prerequisites

1. **Node.js LTS** (version 20 or 22 recommended): <https://nodejs.org>. Choose the "LTS" download. Avoid odd-numbered "Current" versions: Hardhat 2 may warn or fail on them.
2. **A code editor** (optional): Visual Studio Code.
3. **MetaMask** browser extension (only for section 10): <https://metamask.io/download>. Check the web address carefully; fake sites exist.

Check Node.js in **PowerShell**:

```powershell
node --version
npm --version
```

Both should print version numbers.

## 5. Installation (Windows PowerShell)

Open PowerShell inside the project folder. In File Explorer, open `erc20-token-project`, click the address bar, type `powershell` and press Enter. Then run:

```powershell
npm install
```

This downloads Hardhat, OpenZeppelin, ethers.js and the test tools (1 to 3 minutes).

> If PowerShell says *"running scripts is disabled on this system"*, run this once and try again:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
> Or simply use **Command Prompt (cmd)** instead of PowerShell.

A `.env` file is **not needed**. (Optional: `copy .env.example .env`.)

## 6. Compile the contract

```powershell
npm run compile
```

Expected: a message such as `Compiled 1 Solidity file successfully` (OpenZeppelin files may be counted too, so the number can be larger). The first run downloads the Solidity compiler, so it needs internet once. A new `artifacts/` folder appears.

## 7. Run the unit tests

```powershell
npm test
```

The tests run on Hardhat's built-in in-memory blockchain, so you do **not** need to start a node first. All 24 tests should pass:

| Group | What is checked |
|---|---|
| Token details | name is `Campus Token`, symbol is `CAMP`, 18 decimals |
| Initial supply | total supply is 1,000,000 CAMP; `INITIAL_SUPPLY` constant; mint `Transfer` event |
| Deployer balance | deployer owns the full supply; other accounts own 0 |
| Transfers | tokens move; both balances update; `Transfer` event; total supply unchanged; chained transfers; send whole balance; zero-amount transfer |
| Failed transfers | no tokens; amount above balance; receiver sending too much; balances unchanged after failure; zero-address receiver |
| Allowances | `approve` + `transferFrom` works; exceeding the allowance fails |
| Security design | no `mint` function; no `owner` function |

## 8. Start the local blockchain

You need **two PowerShell windows** from now on.

**Window 1: the blockchain node** (leave it running):

```powershell
npm run node
```

You will see something like:

```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0x... (10000 ETH)
Private Key: 0x...
...
```

Keep this window open. It *is* your blockchain. Press `Ctrl + C` to stop it. **Every time you restart it, the blockchain starts empty again** and your token must be deployed again.

> The accounts and private keys printed here are **public test keys** shared by every Hardhat user. Use them only on this local network. Never send real money to them.

## 9. Deploy the contract

**Window 2** (a new PowerShell in the project folder):

```powershell
npm run deploy:localhost
```

The script prints the result of the real deployment:

```
Network          : localhost (chain ID 31337)
Deployer wallet  : <address of Account #0>
Sending deployment transaction...
Transaction hash : <hash>
-------------------- DEPLOYMENT RESULT -------------------
Contract address : <the real contract address>
Deployer wallet  : <address of Account #0>
Token name       : Campus Token
Token symbol     : CAMP
Decimals         : 18
Initial supply   : 1000000.0 CAMP
Deployer balance : 1000000.0 CAMP
Deployment tx    : <hash>
Block number     : <number>
```

(The `<...>` parts are filled in from your own blockchain when you run it.)

### How to retrieve and verify the deployment address

1. **Script output:** copy the `Contract address` line from Window 2.
2. **Saved file:** the script also writes the details to `deployments\localhost.json`:

   ```powershell
   Get-Content deployments\localhost.json
   ```

3. **Node log:** in Window 1 (the node), Hardhat prints the same address under `Contract deployment: SimpleToken`, together with the same transaction hash.
4. **Check the code exists:** open the Hardhat console and run the commands below (replace `PASTE_ADDRESS_HERE`):

   ```powershell
   npx hardhat console --network localhost
   ```

   ```js
   const code = await ethers.provider.getCode("PASTE_ADDRESS_HERE")
   code !== "0x"                  // true means a contract lives there
   const token = await ethers.getContractAt("SimpleToken", "PASTE_ADDRESS_HERE")
   await token.name()             // 'Campus Token'
   await token.symbol()           // 'CAMP'
   ethers.formatUnits(await token.totalSupply(), 18)   // '1000000.0'
   ```

   Type `.exit` to leave the console.

The deploy script already performs check 4 for you: it stops with an error if the address has no contract code or if the receipt and contract object disagree.

## 10. Connect MetaMask to the Hardhat Local network

Keep the node (Window 1) running.

### 10.1 Add the network

1. Click the MetaMask extension, then the **network drop-down** at the top-left.
2. Choose **Add a custom network** (in some versions: *Add network*, then *Add a network manually*).
3. Fill in:

| Field | Value |
|---|---|
| Network name | `Hardhat Local` |
| New RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |
| Block explorer URL | leave empty |

4. Click **Save** and switch to **Hardhat Local**.

### 10.2 Import the deployer account (so you can see the tokens)

The 1,000,000 CAMP belong to the **deployer = Account #0**, so MetaMask must have that account.

1. In Window 1, copy the **Private Key** shown under `Account #0`.
2. In MetaMask: account menu > **Add account or hardware wallet** > **Import account** > paste the private key > **Import**.
3. You should see about 10,000 ETH (fake test ETH). Never use this account on a real network.

### 10.3 Import the CAMP token

1. Make sure the network is **Hardhat Local** and the imported Account #0 is selected.
2. Open the **Tokens** tab and click **Import tokens** (or *Import* at the bottom of the token list).
3. Choose **Custom token**.
4. Paste the **Token contract address** printed by the deploy script.
5. MetaMask should fill **Token symbol** = `CAMP` and **Token decimals** = `18` automatically. If not, type them.
6. Click **Next / Import**. Your balance should show **1,000,000 CAMP**.

### 10.4 Send some CAMP to another account

1. Import a second account (for example Account #1's private key from Window 1), or copy its address.
2. In MetaMask, open CAMP and click **Send**, paste the receiver's address, enter an amount and confirm. Gas is paid in the fake local ETH.
3. The balances update in both accounts.

## 11. npm scripts

| Command | What it does |
|---|---|
| `npm run compile` | Compiles `contracts/SimpleToken.sol` |
| `npm test` | Runs all unit tests |
| `npm run node` | Starts the local blockchain at `http://127.0.0.1:8545` |
| `npm run deploy:localhost` | Deploys the token to the running local node |

## 12. How the code works

**`contracts/SimpleToken.sol`**

- `import {ERC20} ...` brings in OpenZeppelin's finished token logic.
- `contract SimpleToken is ERC20` means "our contract inherits everything from ERC20".
- `ERC20("Campus Token", "CAMP")` in the constructor sets the name and symbol.
- `_mint(msg.sender, INITIAL_SUPPLY)` creates 1,000,000 CAMP and gives them to the deployer. The constructor runs only once, so no more tokens are ever created.

**`scripts/deploy.js`**

1. Gets the deployer account from Hardhat.
2. Deploys the contract and prints the transaction hash.
3. Waits for the transaction to be mined (`waitForDeployment`, `wait`).
4. Reads the address from the blockchain, checks that code exists there, then asks the contract for its name, symbol, decimals and supply.
5. Prints everything and saves it to `deployments/<network>.json`.

**`test/SimpleToken.js`**

Each test deploys a clean contract (through `loadFixture`), performs an action and uses `expect(...)` to check the result. Failed transfers are checked with `revertedWithCustomError`, because OpenZeppelin v5 reports problems with named errors such as `ERC20InsufficientBalance`.

## 13. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `npm` or `npx` "cannot be loaded because running scripts is disabled" | Run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or use `cmd`. |
| `'node' is not recognized` | Node.js is not installed or the window was opened before installing. Install it, then open a **new** PowerShell. |
| Hardhat warns that your Node.js version is not supported | Install Node.js **LTS** (20 or 22). |
| `npm install` fails with network errors | Check your internet, proxy or VPN, then run `npm install` again. |
| Compile error: `Error HH502` / cannot download compiler | The Solidity compiler is downloaded on first use. Check your internet connection and retry. |
| Compile error: `Source "@openzeppelin/contracts/..." not found` | Dependencies are missing. Run `npm install` in the project folder. |
| Deploy error: `HH108` / `ECONNREFUSED` / "Cannot connect to the network localhost" | The node is not running. Start `npm run node` in another window and keep it open. |
| `Error: listen EADDRINUSE 127.0.0.1:8545` when starting the node | A node is already running on that port (maybe in another window). Close it or reuse it. |
| MetaMask says it cannot connect / "Could not fetch chain ID" | The node is not running, or the RPC URL or Chain ID is wrong. Use exactly `http://127.0.0.1:8545` and `31337`. |
| MetaMask shows 0 CAMP | Wrong network or account selected, wrong token address, or the node was restarted without deploying again. |
| Token disappears after restarting the node | The local blockchain resets on restart. Run `npm run deploy:localhost` again and import the **new** address. |
| MetaMask transactions are stuck, or nonce errors appear after restarting the node | MetaMask > Settings > Advanced > **Clear activity tab data** (older versions: *Reset account*). Then retry. |
| Tests fail with `Cannot find module '@nomicfoundation/hardhat-toolbox/network-helpers'` | The toolbox is not installed correctly. Delete `node_modules` and run `npm install` again. |
| Port or firewall prompts on Windows | Allow Node.js on private networks, or keep everything on `127.0.0.1`. |

## 14. Security notes

- **Never** put a real wallet's private key in this project, `.env` or GitHub.
- The private keys printed by `npm run node` are public. They only protect fake local money.
- This token is for learning. Before launching any real token, get a professional audit and decide on features carefully (minting, burning, pausing, access control).

## 15. Ideas to extend the project

- Add `ERC20Burnable` so holders can destroy their own tokens.
- Add a `mint` function protected by `Ownable`, with tests.
- Deploy to the Sepolia test network.
- Build a small web page that shows balances with ethers.js.

## License

MIT. Free to use for learning and portfolios.
