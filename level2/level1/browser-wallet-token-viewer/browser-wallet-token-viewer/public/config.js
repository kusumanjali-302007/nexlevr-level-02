// Frontend settings. No secrets belong in this file: everything here is public.
//
// tokenAddresses: the deployed ERC-20 contract address for each chain ID.
//   `npm run deploy:local` fills in the 31337 entry for you.
//   `npm run deploy:sepolia` fills in the 11155111 entry for you.
//   You can also paste an address between the quotes by hand.
window.APP_CONFIG = {
  tokenAddresses: {
    31337: "",
    11155111: "",
  },

  // Networks this app supports. Any other chain shows a warning.
  networks: {
    31337: {
      name: "Hardhat Local",
      rpcUrl: "http://127.0.0.1:8545",
      currency: { name: "Ether", symbol: "ETH", decimals: 18 },
      explorer: null,
    },
    11155111: {
      name: "Sepolia Testnet",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
      explorer: "https://sepolia.etherscan.io",
    },
  },
};
