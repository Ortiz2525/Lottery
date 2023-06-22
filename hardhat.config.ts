import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import * as dotenv from "dotenv"
import "hardhat-deploy"

dotenv.config()

const PRIVATE_KEY = process.env.PRIVATE_KEY || "set-your-private-key-in-dotenv"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "set-your-etherscan-key-in-dotenv"
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "set-your-polygonscan-key-in-dotenv"

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        mumbai: {
            url: `https://rpc-mumbai.maticvigil.com`,
            accounts: [PRIVATE_KEY],
            chainId: 80001,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS == "true",
        token: "ETH",
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
        currency: "USD",
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
            polygonMumbai: POLYGONSCAN_API_KEY,
        },
    },
    mocha: {
        timeout: "200000", // 200 sec
    },
}

export default config
