import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, getNamedAccounts, network } from "hardhat";
import { developmentChains } from "../../helper-hardhat-config";
import { Lottery } from "../../typechain-types";

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery staging tests", () => {
          let lottery: Lottery, lotteryEntranceFee: BigNumber, deployer;

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer;
              lottery = await ethers.getContract("Lottery", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  // enter the lottery
                  console.log("Setting up test...");
                  const startingTimeStamp = await lottery.getLastTimestamp();
                  const accounts = await ethers.getSigners();

                  console.log("Setting up Listener...");
                  await new Promise<void>(async (resolve, reject) => {
                      // setup listener before we enter the lottery
                      // Just in case the blockchain moves REALLY fast
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              // add our asserts here
                              const recentWinner = await lottery.getRecentWinner();
                              const lotteryState = await lottery.getLotteryState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await lottery.getLastTimestamp();

                              expect(await lottery.getNumberOfPlayers()).to.eq(0);
                              expect(recentWinner).to.eq(accounts[0].address);
                              expect(lotteryState).to.eq(0);
                              expect(winnerEndingBalance).to.eq(
                                  winnerStartingBalance.add(lotteryEntranceFee)
                              );
                              expect(endingTimeStamp).to.be.greaterThan(startingTimeStamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });
                      // Then entering the lottery
                      console.log("Entering Lottery...");
                      const tx = await lottery.enterLottery({ value: lotteryEntranceFee });
                      await tx.wait(1);
                      console.log("Ok, time to wait...");
                      const winnerStartingBalance = await accounts[0].getBalance();

                      // and this code WONT complete until our listener has finished listening!
                  });
              });
          });
      });
