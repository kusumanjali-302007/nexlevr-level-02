// Frontend logic: connect MetaMask, check the network, call the contract.
// Ethers v6 is loaded globally as `ethers`; contract details come from contract-config.js.
(function () {
  "use strict";

  const cfg = window.CONTRACT_CONFIG || {};
  const NETWORKS = {
    31337: {
      name: "Hardhat Local",
      add: {
        chainId: "0x7a69",
        chainName: "Hardhat Local",
        rpcUrls: ["http://127.0.0.1:8545"],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      },
    },
    11155111: { name: "Sepolia", add: null },
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    noWallet: $("no-wallet"), help: $("connect-help"),
    connect: $("connect-btn"), account: $("account"),
    networkDot: document.querySelector("#network .dot"), networkText: $("network-text"),
    contractAddr: $("contract-addr"), switchBtn: $("switch-btn"),
    input: $("number-input"), store: $("store-btn"),
    retrieve: $("retrieve-btn"), value: $("stored-value"),
    status: $("status"), spinner: $("spinner"), statusText: $("status-text"), statusExtra: $("status-extra"),
  };

  let provider = null;
  let signer = null;
  let contract = null;
  let account = null;
  let chainId = null;
  let busy = false;

  const targetName = () => (NETWORKS[cfg.chainId] ? NETWORKS[cfg.chainId].name : "chain " + cfg.chainId);
  const configured = () => Boolean(cfg.address) && ethers.isAddress(cfg.address);
  const onRightNetwork = () => chainId === cfg.chainId;
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

  function setStatus(kind, text, extra, loading) {
    el.status.hidden = false;
    el.status.dataset.kind = kind;
    el.spinner.hidden = !loading;
    el.statusText.textContent = text;
    el.statusExtra.textContent = extra || "";
  }

  function render() {
    el.account.textContent = account || "Not connected";
    el.connect.textContent = account ? "Wallet connected" : "Connect wallet";
    el.connect.disabled = Boolean(account) || busy;
    el.help.hidden = Boolean(account);
    el.contractAddr.textContent = configured() ? cfg.address : "Not configured. Run a deploy script first.";

    if (!account) {
      el.networkDot.className = "dot dot-off";
      el.networkText.textContent = "Not connected";
    } else if (onRightNetwork()) {
      el.networkDot.className = "dot dot-ok";
      el.networkText.textContent = targetName() + " (chain " + chainId + ")";
    } else {
      el.networkDot.className = "dot dot-bad";
      el.networkText.textContent = "Wrong network (chain " + chainId + "). Switch to " + targetName() + ".";
    }
    el.switchBtn.hidden = !(account && !onRightNetwork());
    const ready = Boolean(account) && onRightNetwork() && configured() && !busy;
    el.store.disabled = !ready;
    el.retrieve.disabled = !ready;
  }

  function setBusy(v) { busy = v; render(); }

  // Turn any wallet / ethers error into a message a beginner can act on.
  function explain(err) {
    const code = err && (err.code || (err.info && err.info.error && err.info.error.code));
    if (code === "ACTION_REJECTED" || code === 4001) return "You rejected the request in MetaMask. Nothing was sent.";
    if (code === -32002) return "MetaMask already has a pending request. Open the MetaMask window and finish it.";
    if (code === "INSUFFICIENT_FUNDS") return "Not enough ETH to pay the gas fee. Use a funded account or a faucet.";
    if (code === "NETWORK_ERROR" || code === "BAD_DATA" || code === "CALL_EXCEPTION")
      return "Could not read the contract. Check that MetaMask is on " + targetName() + " and that the contract is deployed at the configured address.";
    return (err && (err.shortMessage || err.reason || err.message)) || "Something went wrong.";
  }

  async function refreshChain() {
    const net = await provider.getNetwork();
    chainId = Number(net.chainId);
  }

  async function setup(accounts) {
    if (!accounts || accounts.length === 0) {
      account = signer = contract = null;
      render();
      setStatus("info", "Wallet disconnected. Click Connect wallet to continue.");
      return;
    }
    provider = new ethers.BrowserProvider(window.ethereum);
    await refreshChain();
    signer = await provider.getSigner();
    account = await signer.getAddress();
    contract = configured() ? new ethers.Contract(cfg.address, cfg.abi, signer) : null;
    render();
  }

  // Confirms there is really a contract at the address on the current network.
  async function contractExists() {
    const code = await provider.getCode(cfg.address);
    return code && code !== "0x";
  }

  async function connect() {
    if (!window.ethereum) { el.noWallet.hidden = false; return; }
    try {
      setBusy(true);
      setStatus("pending", "Waiting for you to approve the connection in MetaMask…", "", true);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      await setup(accounts);
      if (!configured()) {
        setStatus("err", "No contract address is configured.", "Run npm run deploy:local (or deploy:sepolia), then reload.");
      } else if (!onRightNetwork()) {
        setStatus("err", "Wrong network. Please switch MetaMask to " + targetName() + ".");
      } else {
        setStatus("ok", "Connected as " + short(account) + " on " + targetName() + ".");
      }
    } catch (err) {
      setStatus("err", explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function switchNetwork() {
    const hex = "0x" + cfg.chainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (err) {
      // 4902 = network not yet added to MetaMask
      if (err && err.code === 4902 && NETWORKS[cfg.chainId] && NETWORKS[cfg.chainId].add) {
        try {
          await window.ethereum.request({ method: "wallet_addEthereumChain", params: [NETWORKS[cfg.chainId].add] });
        } catch (e) { setStatus("err", explain(e)); }
      } else {
        setStatus("err", explain(err));
      }
    }
  }

  function parseNumber(raw) {
    const text = raw.trim();
    if (text === "") throw new Error("Enter a number first.");
    if (!/^\d+$/.test(text)) throw new Error("Use whole numbers only: digits 0-9, no minus sign, decimals or spaces.");
    const n = BigInt(text);
    if (n > ethers.MaxUint256) throw new Error("That number is too large for a uint256.");
    return n;
  }

  async function storeNumber() {
    let n;
    try { n = parseNumber(el.input.value); } catch (e) { setStatus("err", e.message); return; }
    try {
      setBusy(true);
      await refreshChain();
      if (!onRightNetwork()) { render(); throw new Error("Wrong network. Switch MetaMask to " + targetName() + "."); }
      if (!(await contractExists())) throw new Error("No contract found at " + cfg.address + " on this network. Redeploy and reload.");
      setStatus("pending", "Confirm the transaction in MetaMask…", "", true);
      const tx = await contract.store(n);
      setStatus("pending", "Transaction sent. Waiting for it to be mined…", "Hash: " + tx.hash, true);
      const receipt = await tx.wait();
      if (receipt.status !== 1) throw new Error("The transaction failed on-chain.");
      setStatus("ok", "Stored " + n.toString() + " on the blockchain.", "Hash: " + tx.hash);
      el.input.value = "";
      el.value.textContent = n.toString();
    } catch (err) {
      setStatus("err", err instanceof Error && !err.code ? err.message : explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function retrieveNumber() {
    try {
      setBusy(true);
      await refreshChain();
      if (!onRightNetwork()) { render(); throw new Error("Wrong network. Switch MetaMask to " + targetName() + "."); }
      if (!(await contractExists())) throw new Error("No contract found at " + cfg.address + " on this network. Redeploy and reload.");
      setStatus("pending", "Reading from the blockchain…", "", true);
      const v = await contract.retrieve();
      el.value.textContent = v.toString();
      setStatus("ok", "Read the stored number: " + v.toString() + ".");
    } catch (err) {
      setStatus("err", err instanceof Error && !err.code ? err.message : explain(err));
    } finally {
      setBusy(false);
    }
  }

  function init() {
    render();
    if (!window.ethereum) {
      el.noWallet.hidden = false;
      el.connect.disabled = true;
      return;
    }
    el.connect.addEventListener("click", connect);
    el.switchBtn.addEventListener("click", switchNetwork);
    el.store.addEventListener("click", storeNumber);
    el.retrieve.addEventListener("click", retrieveNumber);
    el.input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !el.store.disabled) storeNumber(); });

    window.ethereum.on("accountsChanged", (accs) => setup(accs).catch((e) => setStatus("err", explain(e))));
    // Reloading on network change is the approach MetaMask recommends.
    window.ethereum.on("chainChanged", () => window.location.reload());

    // Restore an already-approved connection without a popup.
    window.ethereum.request({ method: "eth_accounts" })
      .then((accs) => (accs.length ? setup(accs) : null))
      .then(() => { if (account && !onRightNetwork()) setStatus("err", "Wrong network. Please switch MetaMask to " + targetName() + "."); })
      .catch(() => {});
  }

  init();
})();
