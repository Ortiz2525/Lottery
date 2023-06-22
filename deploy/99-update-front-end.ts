import { ethers, network } from "hardhat"
import * as fs from "fs"
import path from "path"
import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"

const FRONT_END_ADDRESSES_FILE = path.join(
    __dirname,
    "../../nextjs-smartcontract-lottery/constants/contractAddresses.json"
)
const FRONT_END_ABI_FILE = path.join(
    __dirname,
    "../../nextjs-smartcontract-lottery/constants/abi.json"
)

const deployFrontendContracts: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Deploy front end contracts...")
        await updateContractAddresses()
        await updateAbi()
    }
}

async function updateContractAddresses() {
    const lottery = await ethers.getContract("Lottery")
    const chainId = network.config.chainId || 31337
    const contractAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf-8"))
    if (chainId.toString() in contractAddresses) {
        if (!contractAddresses[chainId.toString()].includes(lottery.address)) {
            contractAddresses[chainId.toString()].push(lottery.address)
        }
    } else {
        contractAddresses[chainId.toString()] = [lottery.address]
    }

    const addresses = JSON.stringify(contractAddresses) as string
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, addresses)
}

async function updateAbi() {
    const lottery = await ethers.getContract("Lottery")
    const abi = lottery.interface.format(ethers.utils.FormatTypes.json) as string
    fs.writeFileSync(FRONT_END_ABI_FILE, abi)
}

export default deployFrontendContracts
deployFrontendContracts.tags = ["all", "frontend"]
