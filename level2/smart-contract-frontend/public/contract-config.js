// Placeholder. Running `npm run deploy:local` or `npm run deploy:sepolia`
// overwrites this file with the real address, chain id and ABI.
window.CONTRACT_CONFIG = {
  address: "",
  chainId: 31337,
  networkName: "localhost",
  abi: [
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "address", name: "by", type: "address" },
        { indexed: false, internalType: "uint256", name: "newValue", type: "uint256" }
      ],
      name: "NumberStored",
      type: "event"
    },
    {
      inputs: [],
      name: "retrieve",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ internalType: "uint256", name: "_number", type: "uint256" }],
      name: "store",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    }
  ]
};
