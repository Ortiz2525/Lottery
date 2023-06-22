import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { developmentChains } from "../helper-hardhat-config";

const BASE_FEES = ethers.utils.parseEther("0.25"); // chainlink premium. It costs 0.25 LINK per request.
const GAS_PRICE_LINK = 1e9; // calculated value based on the gas price of the chain

const deployMocks: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log } = deployments;
    
    if (developmentChains.includes(network.name)) {
        
        const { deployer } = await getNamedAccounts();
        //console.log(deployer);
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: [BASE_FEES, GAS_PRICE_LINK],
            log: true,
        });
        console.log("Mocks deployed!");
        console.log("--------------------------------");
    }
};

export default deployMocks;
deployMocks.tags = ["all", "mocks"];
