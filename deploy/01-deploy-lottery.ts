import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { developmentChains, networkConfig } from "../helper-hardhat-config";
import { ethers } from "hardhat";
import { verify } from "../utils/verify";
import { log } from "console";

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30");

const deployLottery: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    let vrfCoordinatorV2Mock, vrfCoordinatorV2Address, subscriptionId;
    const chainId = network.config.chainId || 31337;

    if (developmentChains.includes(network.name)) {
        const deployerSigner = await ethers.getSigner(deployer);
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription();
        const receipt = await transactionResponse.wait(1);
        subscriptionId = receipt.events[0].args.subId;
        // Fund the subscription
        // Usually, need the link token on a real network
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2;
        subscriptionId = networkConfig[chainId].subscriptionId;
    }

    const blockConfirmations = networkConfig[chainId].blockConfirmations;
    const gasLane = networkConfig[chainId].gasLane;
    const callbackGasLimit = networkConfig[chainId].callbackGasLimit;
    const interval = networkConfig[chainId].interval;

    const args = [
        vrfCoordinatorV2Address,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const lottery = await deploy("Lottery", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: blockConfirmations,
    });
    
    console.log(lottery.address);
    if (developmentChains.includes(network.name) && vrfCoordinatorV2Mock) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, lottery.address);
        console.log("Consumer is added");
    }
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        console.log("Verifying...");
        await verify(lottery.address, args);
    }
};

export default deployLottery;
deployLottery.tags = ["all", "lottery"];
