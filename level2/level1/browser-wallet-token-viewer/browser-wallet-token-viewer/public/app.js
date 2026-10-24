// Wallet token viewer: connects MetaMask (ethers.js v6) and shows ETH + ERC-20 balances.
(() => {
  "use strict";

  const cfg = window.APP_CONFIG;
  const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
  ];

  const $ = (id) => document.getElementById(id);
  const el = {
    status: $("status"), connectBtn: $("connectBtn"), refreshBtn: $("refreshBtn"), watchBtn: $("watchBtn"),
    spinner: $("spinner"), refreshLabel: $("refreshLabel"),
    banner: $("banner"), message: $("message"),
    tokenName: $("tokenName"), tokenBalance: $("tokenBalance"), tokenSymbol: $("tokenSymbol"), tokenHint: $("tokenHint"),
    addressShort: $("addressShort"), addressFull: $("addressFull"),
    networkName: $("networkName"), chainId: $("chainId"),
    ethBalance: $("ethBalance"), ethSymbol: $("ethSymbol"),
    dName: $("dName"), dSymbol: $("dSymbol"), dDecimals: $("dDecimals"), dContract: $("dContract"),
  };

  let account = null;       // connected address, or null
  let currentToken = null;  // { address, symbol, decimals } once a token loaded
  let refreshId = 0;        // ignores out-of-date results when refreshes overlap
  let messageTimer = null;

  // ---------- helpers ----------
  const shorten = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  function withCommas(numberString) {
    const [whole, frac] = numberString.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return frac && frac !== "0" ? `${grouped}.${frac}` : grouped;
  }

  function formatEth(wei) {
    const [whole, frac = ""] = ethers.formatEther(wei).split(".");
    const trimmed = frac.slice(0, 4).replace(/0+$/, "");
    return withCommas(trimmed ? `${whole}.${trimmed}` : whole);
  }

  function describeError(err) {
    const code = err && err.code;
    if (code === 4001 || code === "ACTION_REJECTED") {
      return "You rejected the request in MetaMask. Click \"Connect wallet\" to try again.";
    }
    if (code === -32002) {
      return "MetaMask already has a request waiting. Open the MetaMask window and finish it.";
    }
    const raw = String((err && (err.shortMessage || err.message)) || err);
    if (
      code === "NETWORK_ERROR" || code === "TIMEOUT" || code === "SERVER_ERROR" ||
      /failed to fetch|could not coalesce|network error|econnrefused|rpc endpoint|internal json-rpc/i.test(raw)
    ) {
      return "Can't reach the blockchain node. If you use Hardhat, check that 'npm run node' is still running, then press Refresh balances.";
    }
    return raw;
  }

  function showMessage(type, text, linkHref, linkText) {
    clearTimeout(messageTimer);
    el.message.className = `message message-${type}`;
    el.message.textContent = text;
    if (linkHref) {
      el.message.append(" ");
      const a = document.createElement("a");
      a.href = linkHref; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = linkText;
      el.message.append(a);
    }
    el.message.hidden = false;
    if (type === "success") messageTimer = setTimeout(hideMessage, 4000);
  }
  function hideMessage() { el.message.hidden = true; }

  function setLoading(on) {
    el.spinner.hidden = !on;
    el.refreshLabel.textContent = on ? "Loading..." : "Refresh balances";
    el.refreshBtn.disabled = on || !account;
    el.connectBtn.disabled = on;
  }

  function clearToken(hint) {
    currentToken = null;
    el.tokenName.textContent = "Token balance unavailable";
    el.tokenBalance.textContent = "\u2013";
    el.tokenSymbol.textContent = "";
    el.tokenHint.textContent = hint || "";
    el.dName.textContent = el.dSymbol.textContent = el.dDecimals.textContent = el.dContract.textContent = "\u2013";
    el.watchBtn.disabled = true;
  }

  function renderDisconnected() {
    account = null;
    el.status.textContent = "Not connected";
    el.status.className = "pill pill-off";
    el.connectBtn.textContent = "Connect wallet";
    el.refreshBtn.disabled = true;
    el.addressShort.textContent = "\u2013";
    el.addressFull.textContent = "No wallet connected";
    el.ethBalance.textContent = "\u2013";
    clearToken("");
    el.tokenName.textContent = "Connect a wallet to see your balance.";
  }

  function renderConnected(address) {
    account = address;
    el.status.textContent = `Connected: ${shorten(address)}`;
    el.status.className = "pill pill-on";
    el.connectBtn.textContent = "Connected";
    el.addressShort.textContent = shorten(address);
    el.addressFull.textContent = address;
    el.refreshBtn.disabled = false;
  }

  // ---------- network ----------
  function renderNetwork(chainId) {
    const known = cfg.networks[chainId];
    el.networkName.textContent = known ? known.name : "Unsupported network";
    el.chainId.textContent = String(chainId);
    el.ethSymbol.textContent = known ? known.currency.symbol : "ETH";

    if (known) { el.banner.hidden = true; return; }

    el.banner.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = `Unsupported network (chain ID ${chainId})`;
    const p = document.createElement("p");
    const list = Object.entries(cfg.networks).map(([id, n]) => `${n.name} (${id})`).join(" or ");
    p.textContent = `This app works on ${list}. In MetaMask, open the network picker and choose one of them, or use a button below.`;
    const actions = document.createElement("div");
    actions.className = "banner-actions";
    for (const [id, n] of Object.entries(cfg.networks)) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = `Switch to ${n.name}`;
      b.addEventListener("click", () => switchNetwork(Number(id)));
      actions.append(b);
    }
    el.banner.append(title, p, actions);
    el.banner.hidden = false;
  }

  async function switchNetwork(chainId) {
    const net = cfg.networks[chainId];
    const hex = "0x" + chainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (err) {
      const notAdded = err && (err.code === 4902 || (err.data && err.data.originalError && err.data.originalError.code === 4902));
      if (!notAdded) { showMessage("error", describeError(err)); return; }
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: hex, chainName: net.name, rpcUrls: [net.rpcUrl],
            nativeCurrency: net.currency,
            ...(net.explorer ? { blockExplorerUrls: [net.explorer] } : {}),
          }],
        });
      } catch (addErr) { showMessage("error", describeError(addErr)); }
    }
  }

  // ---------- reading balances ----------
  async function loadToken(provider, chainId) {
    const address = cfg.tokenAddresses[chainId];

    if (!address) {
      clearToken(`No token address is set for chain ID ${chainId}. Deploy the token, or add its address to public/config.js.`);
      showMessage("warn", "Token address not configured for this network. Run 'npm run deploy:local' and reload the page.");
      return false;
    }
    if (!ethers.isAddress(address)) {
      clearToken("The token address in public/config.js is not valid.");
      showMessage("error", `Invalid token contract address in config.js: "${address}". Check for typos.`);
      return false;
    }
    const code = await provider.getCode(address);
    if (code === "0x") {
      clearToken("No contract found at the configured address.");
      showMessage("error", "No contract exists at the configured token address on this network. If you restarted the Hardhat node, deploy again with 'npm run deploy:local'.");
      return false;
    }

    try {
      const token = new ethers.Contract(address, ERC20_ABI, provider);
      const [name, symbol, decimals, raw] = await Promise.all([
        token.name(), token.symbol(), token.decimals(), token.balanceOf(account),
      ]);
      const dec = Number(decimals);
      currentToken = { address, symbol, decimals: dec };
      el.tokenName.textContent = name;
      el.tokenBalance.textContent = withCommas(ethers.formatUnits(raw, dec));
      el.tokenSymbol.textContent = symbol;
      el.tokenHint.textContent = "";
      el.dName.textContent = name;
      el.dSymbol.textContent = symbol;
      el.dDecimals.textContent = String(dec);
      el.dContract.textContent = shorten(address);
      el.dContract.title = address;
      el.watchBtn.disabled = false;
      return true;
    } catch (err) {
      if (err && (err.code === "CALL_EXCEPTION" || err.code === "BAD_DATA")) {
        clearToken("The contract at this address does not look like an ERC-20 token.");
        showMessage("error", "A contract exists at that address, but it did not answer like an ERC-20 token.");
        return false;
      }
      throw err;
    }
  }

  async function refresh({ quiet = false } = {}) {
    if (!account) return;
    const id = ++refreshId;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum); // new provider = fresh network info
      const chainId = Number((await provider.getNetwork()).chainId);
      if (id !== refreshId) return;
      renderNetwork(chainId);

      const ethWei = await provider.getBalance(account);
      if (id !== refreshId) return;
      el.ethBalance.textContent = formatEth(ethWei);

      if (!cfg.networks[chainId]) {
        clearToken("Switch to a supported network to see your token balance.");
        showMessage("warn", `Chain ID ${chainId} is not supported. Switch network to see your token balance.`);
        return;
      }
      const ok = await loadToken(provider, chainId);
      if (id !== refreshId) return;
      if (ok) {
        if (quiet) hideMessage(); else showMessage("success", "Balances updated.");
      }
    } catch (err) {
      if (id === refreshId) showMessage("error", describeError(err));
    } finally {
      if (id === refreshId) setLoading(false);
    }
  }

  // ---------- wallet actions ----------
  const hasWallet = () => typeof window.ethereum !== "undefined";

  function showNoWallet() {
    showMessage("error", "MetaMask was not found in this browser. Install it, then reload this page.", "https://metamask.io/download/", "Get MetaMask");
  }

  async function connect() {
    if (!hasWallet()) { showNoWallet(); return; }
    el.connectBtn.disabled = true;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      await handleAccounts(accounts);
    } catch (err) {
      showMessage("error", describeError(err));
    } finally {
      el.connectBtn.disabled = false;
    }
  }

  async function handleAccounts(accounts) {
    if (!accounts || accounts.length === 0) {
      renderDisconnected();
      showMessage("warn", "Wallet disconnected. Click \"Connect wallet\" to connect again.");
      return;
    }
    renderConnected(ethers.getAddress(accounts[0]));
    await refresh({ quiet: true });
  }

  async function watchToken() {
    if (!currentToken) return;
    try {
      await window.ethereum.request({
        method: "wallet_watchAsset",
        params: { type: "ERC20", options: { address: currentToken.address, symbol: currentToken.symbol, decimals: currentToken.decimals } },
      });
    } catch (err) { showMessage("error", describeError(err)); }
  }

  // ---------- start-up ----------
  async function init() {
    el.connectBtn.addEventListener("click", connect);
    el.refreshBtn.addEventListener("click", () => refresh());
    el.watchBtn.addEventListener("click", watchToken);

    if (typeof ethers === "undefined") {
      showMessage("error", "ethers.js did not load. Check your internet connection and reload the page.");
      el.connectBtn.disabled = true;
      return;
    }
    if (!hasWallet()) { showNoWallet(); return; }

    window.ethereum.on("accountsChanged", (accounts) => handleAccounts(accounts));
    window.ethereum.on("chainChanged", (hexId) => {
      if (account) refresh({ quiet: true }); else renderNetwork(parseInt(hexId, 16));
    });

    try {
      renderNetwork(parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16));
      const accounts = await window.ethereum.request({ method: "eth_accounts" }); // no popup
      if (accounts.length > 0) await handleAccounts(accounts);
    } catch (err) {
      showMessage("error", describeError(err));
    }
  }

  init();
})();
