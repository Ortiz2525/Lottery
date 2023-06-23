import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();
const GOERLI_SUBSCRIPTION_ID =
    process.env.GOERLI_SUBSCRIPTION_ID || "set-goerli-subscription-id-in-dotenv";
const MUMBAI_SUBSCRIPTION_ID =
    process.env.MUMBAI_SUBSCRIPTION_ID || "set-mumbai-subscription-id-in-dotenv";

const networkConfig: ExtraConfig = {
    31337: {
        name: "hardhat",
        vrfCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        verifyContract: false,
        blockConfirmations: 1,
        callbackGasLimit: "500000",
        interval: "3000",
    },
    5: {
        name: "goerli",
        vrfCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: GOERLI_SUBSCRIPTION_ID,
        verifyContract: true,
        blockConfirmations: 6,
        callbackGasLimit: "500000",
        interval: "3000",
    },
    80001: {
        name: "mumbai",
        vrfCoordinatorV2: "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x4b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f",
        subscriptionId: MUMBAI_SUBSCRIPTION_ID,
        verifyContract: true,
        blockConfirmations: 6,
        callbackGasLimit: "500000",
        interval: "120",
    },
};

const developmentChains = ["hardhat", "localhost"];

interface ExtraConfig {
    [key: number]: {
        name: string;
        vrfCoordinatorV2: string;
        entranceFee: BigNumber;
        gasLane: string;
        subscriptionId?: string;
        verifyContract: boolean;
        blockConfirmations: number;
        callbackGasLimit: string;
        interval: string;
    };
}

export { networkConfig, developmentChains };
