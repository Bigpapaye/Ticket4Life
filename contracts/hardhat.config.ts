import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: "src",
    tests: "test",
    cache: "cache",
    artifacts: "artifacts",
  },
  networks: {
    "base-sepolia": {
      url:
        process.env.RPC_BASE_SEPOLIA ||
        process.env.BASE_SEPOLIA_INFURA_RPC_URL ||
        process.env.BASE_SEPOLIA_RPC_URL ||
        "https://sepolia.base.org",
      accounts:
        process.env.DEPLOYER_KEY
          ? [process.env.DEPLOYER_KEY]
          : process.env.PRIVATE_KEY
          ? [process.env.PRIVATE_KEY]
          : [],
    },
  },
};

export default config;
