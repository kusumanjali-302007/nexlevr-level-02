# Recording the demo video

No video has been recorded for this project. This guide shows you how to record one yourself.

## Before you record

1. Close other apps and turn on Do Not Disturb (Windows: Focus assist).
2. Use a clean browser profile or window with only MetaMask and the app.
3. **Never show a real seed phrase or real private key.** Only use the Hardhat test account. Blur or avoid showing any key.
4. Start fresh: stop any running node, then run through the steps once without recording.
5. Open three PowerShell windows in the project folder, and make text bigger (Ctrl + mouse wheel).
6. Set the screen to 1920x1080 if you can.

## Recommended screen-recording tools

| Tool | Notes |
|---|---|
| **OBS Studio** (free, Windows/Mac/Linux) | Best quality. Settings -> Output -> Recording Format: **mp4**. |
| **Xbox Game Bar** (built into Windows) | Press `Win + G`, then record. Saves MP4 in `Videos\Captures`. Records one app window at a time. |
| **Clipchamp** (built into Windows 11) | Screen and camera recording with simple trimming. |

## Scenes and narration script

Aim for 3 to 4 minutes. Read slowly.

| # | What to show | Say |
|---|---|---|
| 1 | Window 1: run `npm run node` | "I'm starting a local Ethereum blockchain with Hardhat. It gives me test accounts with fake ETH." |
| 2 | Window 2: run `npm test`, then `npm run deploy:local` | "First I run the contract tests. They pass. Now I deploy my ERC-20 token. The terminal shows its address, and the script saves it into the app's config file." |
| 3 | Window 3: `npm start`, open http://localhost:3000 | "Now I start the website. It is not connected to a wallet yet." |
| 4 | Click **Connect wallet**, approve in MetaMask | "I click Connect wallet and approve the request in MetaMask." |
| 5 | Point at the address, network card and ETH balance | "Here is my shortened address, the network, Hardhat Local with chain ID 31337, and my ETH balance." |
| 6 | Point at the token balance and token details | "This is my token balance: one million My Token, symbol MTK, 18 decimals." |
| 7 | Click **Refresh balances**; optionally send a few tokens to another account in MetaMask, then refresh | "Refresh reloads both balances from the blockchain." |
| 8 | In MetaMask switch to another network (for example Ethereum Mainnet) | "If I switch to an unsupported network, the app shows a clear warning and buttons to switch back." |
| 9 | Switch back to Hardhat Local | "Back on the right network, the dashboard updates by itself. That is the finished dashboard." |

Optional extra: reject the connection popup once to show the error message.

## Save as MP4

- **OBS:** if you recorded as MKV, use File -> Remux Recordings, pick the file and click Remux. Or set the format to mp4 before recording.
- **Xbox Game Bar / Clipchamp:** already MP4. In Clipchamp, Export -> 1080p.
- Keep the file under 100 MB for GitHub (OBS Settings -> Output: lower the bitrate to about 4000 Kbps if it's too big).

## Upload to GitHub

1. Open your repo's `README.md` on github.com and click the pencil (Edit).
2. Drag your `.mp4` into the editor. GitHub uploads it and inserts a link (limit 100 MB on free accounts).
3. Move that link under the "Video demonstration" heading, then commit.

You can also drag the video into a GitHub Issue comment, copy the generated link, and paste it into the README.

## Upload to LinkedIn

1. Click **Start a post**, then the media (video) icon, and choose your MP4.
2. Add a short caption, for example: "I built a dapp that connects MetaMask and shows ETH and ERC-20 balances, using Solidity, Hardhat and ethers.js. Code: <your GitHub link>".
3. Add hashtags such as #blockchain #ethereum #web3 and publish.
