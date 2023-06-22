import { ethers } from "hardhat";
import { Lottery } from "../typechain-types";

async function enterLottery() {
    const lottery: Lottery = await ethers.getContract("Lottery");
    const entranceFee = await lottery.getEntranceFee();
    await lottery.enterLottery({ value: entranceFee.add(1) });
    console.log("Entered Lottery!");
}

enterLottery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error);
        process.exit(1);
    });
