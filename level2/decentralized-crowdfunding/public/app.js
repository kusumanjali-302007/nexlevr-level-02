/* Decentralized Crowdfunding - frontend (plain JavaScript + Ethers.js v6) */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STATUS_NAMES = ["Active", "Successful", "Failed"];
  const LOCAL_RPC = "http://127.0.0.1:8545";
  const MIN_DURATION = 60; // seconds (must match the contract)
  const MAX_DURATION = 365 * 24 * 60 * 60;

  let config = null;
  let readContract = null; // read-only (talks to the local node directly)
  let writeContract = null; // signer-connected (MetaMask)
  let browserProvider = null;
  let account = null;
  let wrongNetwork = false;
  let busy = false;
  let campaigns = [];
  let chainOffset = 0; // chainTime - browserTime (seconds); keeps countdowns in sync with the blockchain clock
  let refreshing = false, refreshQueued = false;

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);
  const fmtEth = (wei) => {
    const s = ethers.formatEther(wei);
    const [i, d = ""] = s.split(".");
    const dec = d.replace(/0+$/, "").slice(0, 4);
    return dec ? i + "." + dec : i;
  };
  const sameAddr = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

  function setStatus(kind, text) {
    const box = $("status");
    box.className = "status " + kind;
    $("statusText").textContent = text;
    $("spinner").classList.toggle("hidden", kind !== "pending");
  }
  function clearStatus() { $("status").className = "status hidden"; }

  function setBusy(value) {
    busy = value;
    document.querySelectorAll("button[data-action], #createBtn").forEach((b) => (b.disabled = value));
  }

  function formatCountdown(deadline) {
    let left = deadline - (Math.floor(Date.now() / 1000) + chainOffset);
    if (left <= 0) return "Ended";
    const d = Math.floor(left / 86400); left -= d * 86400;
    const h = Math.floor(left / 3600); left -= h * 3600;
    const m = Math.floor(left / 60); const s = left - m * 60;
    return (d ? d + "d " : "") + (d || h ? h + "h " : "") + m + "m " + s + "s left";
  }

  const FRIENDLY = {
    InvalidGoal: "The funding goal must be greater than zero.",
    InvalidDuration: "Duration must be between 1 minute and 365 days.",
    CampaignDoesNotExist: "That campaign does not exist.",
    CampaignEnded: "This campaign has already ended.",
    CampaignNotEnded: "The campaign deadline has not passed yet.",
    ZeroContribution: "Contribution must be greater than zero.",
    NotCreator: "Only the campaign creator can do this.",
    GoalNotReached: "The funding goal was not reached.",
    GoalReached: "The goal was reached, so refunds are not available.",
    AlreadyWithdrawn: "Funds were already withdrawn.",
    NothingToRefund: "You have nothing to refund for this campaign.",
    TransferFailed: "The ETH transfer failed.",
    ReentrantCall: "Re-entrant call blocked.",
  };

  function friendlyError(e) {
    if (e?.code === "ACTION_REJECTED" || e?.code === 4001 || e?.info?.error?.code === 4001) {
      return "You rejected the request in your wallet.";
    }
    if (e?.revert?.name && FRIENDLY[e.revert.name]) return FRIENDLY[e.revert.name];
    const data = e?.data || e?.error?.data || e?.info?.error?.data;
    if (typeof data === "string" && data.startsWith("0x") && config) {
      try {
        const parsed = new ethers.Interface(config.abi).parseError(data);
        if (parsed && FRIENDLY[parsed.name]) return FRIENDLY[parsed.name];
      } catch (_) { /* fall through */ }
    }
    if (e?.code === "INSUFFICIENT_FUNDS") return "Not enough ETH in your wallet to pay for this.";
    return e?.shortMessage || e?.reason || e?.message || "Unknown error";
  }

  // ------------------------------------------------------------------
  // Wallet
  // ------------------------------------------------------------------
  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("error", "MetaMask was not found. Install the MetaMask browser extension and reload this page.");
      return;
    }
    try {
      setStatus("pending", "Waiting for you to approve the connection in MetaMask…");
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await setupSigner();
      clearStatus();
      await refreshAll();
    } catch (e) {
      setStatus("error", "Could not connect: " + friendlyError(e));
    }
  }

  async function setupSigner() {
    browserProvider = new ethers.BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner();
    account = await signer.getAddress();
    const net = await browserProvider.getNetwork();
    wrongNetwork = Number(net.chainId) !== config.chainId;
    writeContract = new ethers.Contract(config.address, config.abi, signer);

    $("connectBtn").classList.add("hidden");
    $("walletInfo").classList.remove("hidden");
    $("accountShort").textContent = shortAddr(account);
    $("accountShort").title = account;
    $("networkWarning").classList.toggle("hidden", !wrongNetwork);
    await updateBalance();
  }

  async function updateBalance() {
    if (!account || wrongNetwork) { $("balance").textContent = "—"; return; }
    try {
      const bal = await browserProvider.getBalance(account);
      $("balance").textContent = fmtEth(bal) + " ETH";
    } catch (_) { $("balance").textContent = "—"; }
  }

  async function switchNetwork() {
    const chainIdHex = "0x" + config.chainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch (e) {
      if (e?.code === 4902 || e?.data?.originalError?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chainIdHex,
            chainName: "Hardhat Local",
            rpcUrls: [config.rpcUrl || LOCAL_RPC],
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          }],
        });
      } else {
        setStatus("error", "Could not switch network: " + friendlyError(e));
      }
    }
  }

  // ------------------------------------------------------------------
  // Transactions (never report success before the receipt is confirmed)
  // ------------------------------------------------------------------
  async function runTx(label, sendFn) {
    if (busy) return;
    if (!account) { setStatus("error", "Please connect your wallet first."); return; }
    if (wrongNetwork) { setStatus("error", "Please switch your wallet to the local Hardhat network first."); return; }

    setBusy(true);
    try {
      setStatus("pending", label + ": please confirm the transaction in your wallet…");
      const tx = await sendFn(writeContract);
      setStatus("pending", label + ": submitted (" + shortAddr(tx.hash) + "). Waiting for confirmation…");
      const receipt = await tx.wait(); // resolves only once the tx is mined
      if (!receipt || receipt.status !== 1) throw new Error("Transaction failed on-chain.");
      setStatus("success", label + ": confirmed in block " + receipt.blockNumber + " ✔");
      await refreshAll();
    } catch (e) {
      setStatus("error", label + " failed: " + friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign() {
    let goal;
    try { goal = ethers.parseEther(($("goalInput").value || "").trim()); }
    catch (_) { setStatus("error", "Enter a valid funding goal in ETH (e.g. 10)."); return; }
    if (goal <= 0n) { setStatus("error", "The funding goal must be greater than zero."); return; }

    const amount = parseFloat($("durationInput").value);
    const seconds = Math.floor(amount * parseInt($("durationUnit").value, 10));
    if (!Number.isFinite(seconds) || seconds < MIN_DURATION || seconds > MAX_DURATION) {
      setStatus("error", "Duration must be between 1 minute and 365 days.");
      return;
    }
    await runTx("Create campaign", (c) => c.createCampaign(goal, seconds));
    if ($("status").classList.contains("success")) { $("goalInput").value = ""; $("durationInput").value = ""; }
  }

  async function contribute(id) {
    const input = document.querySelector('input[data-input="' + id + '"]');
    let value;
    try { value = ethers.parseEther((input.value || "").trim()); }
    catch (_) { setStatus("error", "Enter a valid amount in ETH."); return; }
    if (value <= 0n) { setStatus("error", "Contribution must be greater than zero."); return; }
    await runTx("Contribute to #" + id, (c) => c.contribute(id, { value }));
  }

  // ------------------------------------------------------------------
  // Reading & rendering
  // ------------------------------------------------------------------
  async function loadCampaigns() {
    const count = Number(await readContract.campaignCount());
    const ids = Array.from({ length: count }, (_, i) => count - i); // newest first
    campaigns = await Promise.all(ids.map(async (id) => {
      const c = await readContract.getCampaign(id);
      const mine = account ? await readContract.getContribution(id, account) : 0n;
      return {
        id, creator: c.creator, goal: c.goal, deadline: Number(c.deadline),
        raised: c.totalRaised, withdrawn: c.withdrawn, status: Number(c.status), mine,
      };
    }));
  }

  function cardHtml(c) {
    const statusName = STATUS_NAMES[c.status];
    const pct = Math.min(100, Number((c.raised * 10000n) / c.goal) / 100);
    const isCreator = sameAddr(c.creator, account);
    const deadlineDate = new Date(c.deadline * 1000).toLocaleString();

    let actions = "";
    if (c.status === 0) {
      actions += '<div class="inline"><input type="number" min="0" step="any" placeholder="Amount in ETH" class="contrib-input" data-input="' + c.id + '" />' +
        '<button class="btn primary" data-action="contribute" data-id="' + c.id + '">Contribute</button></div>';
    }
    if (c.status === 1 && isCreator && !c.withdrawn) {
      actions += '<button class="btn ok" data-action="withdraw" data-id="' + c.id + '">Withdraw ' + fmtEth(c.raised) + ' ETH</button>';
    }
    if (c.status === 2 && c.mine > 0n) {
      actions += '<button class="btn" data-action="refund" data-id="' + c.id + '">Claim refund (' + fmtEth(c.mine) + ' ETH)</button>';
    }
    if (c.status === 1 && c.withdrawn) actions += '<span class="muted small">Funds withdrawn by the creator ✔</span>';
    if (c.status === 1 && !c.withdrawn && !isCreator) actions += '<span class="muted small">Goal reached! Waiting for the creator to withdraw.</span>';
    if (c.status === 2 && c.mine === 0n) actions += '<span class="muted small">Goal missed. Contributors can claim refunds.</span>';

    return '<article class="campaign">' +
      '<div class="campaign-head"><h3>Campaign #' + c.id + '</h3><span class="badge ' + statusName.toLowerCase() + '">' + statusName + '</span></div>' +
      '<div class="bar ' + (c.raised >= c.goal ? "done" : "") + '"><div style="width:' + pct + '%"></div></div>' +
      '<div class="row"><span>Raised</span><span><b>' + fmtEth(c.raised) + '</b> / ' + fmtEth(c.goal) + ' ETH (' + Math.floor(pct) + '%)</span></div>' +
      '<div class="row"><span>Creator</span><span class="mono" title="' + c.creator + '">' + shortAddr(c.creator) + (isCreator ? '<span class="you">you</span>' : "") + '</span></div>' +
      '<div class="row"><span>Deadline</span><span>' + deadlineDate + '</span></div>' +
      '<div class="row"><span>Time</span><span data-deadline="' + c.deadline + '">' + formatCountdown(c.deadline) + '</span></div>' +
      (account ? '<div class="row"><span>Your contribution</span><span>' + fmtEth(c.mine) + ' ETH</span></div>' : "") +
      '<div class="actions">' + actions + '</div></article>';
  }

  function render() {
    // Preserve whatever the user was typing / focusing during auto-refresh
    const typed = {};
    document.querySelectorAll(".contrib-input").forEach((el) => { typed[el.dataset.input] = el.value; });
    const focusedId = document.activeElement?.dataset?.input;

    $("campaigns").innerHTML = campaigns.map(cardHtml).join("");
    $("emptyMsg").classList.toggle("hidden", campaigns.length > 0);

    document.querySelectorAll(".contrib-input").forEach((el) => {
      if (typed[el.dataset.input] !== undefined) el.value = typed[el.dataset.input];
      if (el.dataset.input === focusedId) el.focus();
    });
    setBusy(busy);
  }

  async function refreshAll() {
    if (refreshing) { refreshQueued = true; return; }
    refreshing = true;
    try {
      await loadCampaigns();
      render();
      await updateBalance();
    } catch (e) {
      setStatus("error", "Could not read the blockchain: " + friendlyError(e));
    } finally {
      refreshing = false;
      if (refreshQueued) { refreshQueued = false; refreshAll(); }
    }
  }

  // ------------------------------------------------------------------
  // Live updates: react to every new block (about once per second)
  // ------------------------------------------------------------------
  function setLive(on) {
    const el = $("liveDot");
    el.className = "live " + (on ? "on" : "off");
    el.textContent = on ? "● Live" : "● reconnecting…";
  }

  function describeEvent(ev) {
    const a = ev.args;
    switch (ev.name) {
      case "CampaignCreated": return "🆕 " + shortAddr(a.creator) + " created campaign #" + a.campaignId + " (goal " + fmtEth(a.goal) + " ETH)";
      case "ContributionReceived": return "💰 " + shortAddr(a.contributor) + " contributed " + fmtEth(a.amount) + " ETH to #" + a.campaignId;
      case "FundsWithdrawn": return "🏦 " + shortAddr(a.creator) + " withdrew " + fmtEth(a.amount) + " ETH from #" + a.campaignId;
      case "RefundClaimed": return "↩️ " + shortAddr(a.contributor) + " claimed a refund of " + fmtEth(a.amount) + " ETH from #" + a.campaignId;
      default: return ev.name;
    }
  }

  function addToFeed(text) {
    const feed = $("feed");
    if (feed.firstElementChild && feed.firstElementChild.classList.contains("muted")) feed.innerHTML = "";
    const li = document.createElement("li");
    li.className = "fresh";
    li.textContent = new Date().toLocaleTimeString() + " — " + text;
    feed.prepend(li);
    while (feed.children.length > 30) feed.lastElementChild.remove();
  }

  let lastBlockSeen = 0;
  async function onNewBlock(blockNumber) {
    if (blockNumber <= lastBlockSeen) return;
    const from = lastBlockSeen ? lastBlockSeen + 1 : blockNumber;
    lastBlockSeen = blockNumber;
    setLive(true);
    try {
      const block = await rpcProvider.getBlock(blockNumber);
      if (block) chainOffset = block.timestamp - Math.floor(Date.now() / 1000);
      const logs = await readContract.queryFilter("*", from, blockNumber);
      for (const log of logs) {
        const ev = readContract.interface.parseLog(log);
        if (ev) addToFeed(describeEvent(ev));
      }
    } catch (_) { /* feed is a nicety; the refresh below still runs */ }
    refreshAll();
  }

  let rpcProvider = null;
  function startLiveUpdates() {
    rpcProvider.pollingInterval = 1000;
    rpcProvider.on("block", onNewBlock);
    rpcProvider.on("error", () => setLive(false));
    rpcProvider.getBlockNumber().then((n) => { lastBlockSeen = n; setLive(true); }).catch(() => setLive(false));
  }

  function tickCountdowns() {
    let justEnded = false;
    document.querySelectorAll("[data-deadline]").forEach((el) => {
      const was = el.textContent;
      el.textContent = formatCountdown(Number(el.dataset.deadline));
      if (el.textContent === "Ended" && was !== "Ended") justEnded = true;
    });
    if (justEnded) refreshAll(); // status flips to Successful/Failed without clicking anything
  }

  // ------------------------------------------------------------------
  // Start-up
  // ------------------------------------------------------------------
  async function init() {
    $("connectBtn").addEventListener("click", connectWallet);
    $("switchBtn").addEventListener("click", switchNetwork);
    $("refreshBtn").addEventListener("click", refreshAll);
    $("createBtn").addEventListener("click", createCampaign);
    $("campaigns").addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === "contribute") contribute(id);
      if (btn.dataset.action === "withdraw") runTx("Withdraw from #" + id, (c) => c.withdrawFunds(id));
      if (btn.dataset.action === "refund") runTx("Refund from #" + id, (c) => c.claimRefund(id));
    });

    try {
      const res = await fetch("contract-config.json", { cache: "no-store" });
      if (!res.ok) throw new Error("missing");
      config = await res.json();
    } catch (_) {
      setStatus("error", "contract-config.json not found. Start the local node, then run: npm run deploy");
      return;
    }
    $("contractAddress").textContent = config.address;
    $("expectedChain").textContent = config.chainId;

    // Read-only connection straight to the local node (works without a wallet)
    rpcProvider = new ethers.JsonRpcProvider(config.rpcUrl || LOCAL_RPC, config.chainId, {
      staticNetwork: ethers.Network.from(config.chainId),
    });
    try {
      const code = await rpcProvider.getCode(config.address);
      if (code === "0x") {
        setStatus("error", "No contract found at the saved address. If you restarted the Hardhat node, run `npm run deploy` again and reload.");
        return;
      }
    } catch (_) {
      setStatus("error", "Cannot reach the local blockchain at " + (config.rpcUrl || LOCAL_RPC) + ". Is `npm run node` running?");
      return;
    }
    readContract = new ethers.Contract(config.address, config.abi, rpcProvider);

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged", () => window.location.reload());
      try {
        const accts = await window.ethereum.request({ method: "eth_accounts" });
        if (accts.length) await setupSigner();
      } catch (_) { /* user can click Connect */ }
    }

    await refreshAll();
    startLiveUpdates();
    setInterval(() => { if (!busy) refreshAll(); }, 30000); // safety net

    setInterval(tickCountdowns, 1000);
  }

  init();
})();
