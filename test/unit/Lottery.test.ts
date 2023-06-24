import { expect } from "chai";
import { BigNumber, Signer } from "ethers";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { developmentChains, networkConfig } from "../../helper-hardhat-config";
import { Lottery, VRFCoordinatorV2Mock } from "../../typechain-types";
import { Contract } from "ethers";

const chainId = network.config.chainId || 31337;

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery unit tests", () => {
          let lottery: Lottery,
              vrfCoordinatorV2Mock: VRFCoordinatorV2Mock,
              lotteryEntranceFee: BigNumber,
              interval: BigNumber;
          let deployer, player: string, playerSigner: Signer;
          let FarmingYield: Contract;
          let stakingToken: Contract;
          let rewardToken1: Contract;

          beforeEach(async () => {
              ({ deployer, player } = await getNamedAccounts());
              playerSigner = await ethers.getSigner(player);
              await deployments.fixture(["all"]);
              lottery = await ethers.getContract("Lottery", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
              lotteryEntranceFee = await lottery.getEntranceFee();
              interval = await lottery.getInterval();

              const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock",deployer);
              stakingToken = await ERC20MockFactory.deploy("Staking Token", "STK");
              rewardToken1 = await ERC20MockFactory.deploy("Reward Token 1", "RT1");
          
              const FarmingYieldFactory = await ethers.getContractFactory("FarmingYield",deployer);
              const lockPeriod = 30 * 24 * 60 * 60;
              FarmingYield = await FarmingYieldFactory.deploy(10, 1000,lockPeriod);
              await FarmingYield.setStakingToken(stakingToken.address);
              await FarmingYield.setRewardToken(rewardToken1.address);
              await FarmingYield.setTreasury(lottery.address);
              await lottery.setFarmingYield(FarmingYield.address);
              await lottery.setRewardToken(rewardToken1.address);
              await lottery.setStakingToken(stakingToken.address);
          });

          describe("constructor", () => {
              it("should initialize the lottery correctly", async () => {
                  const lotteryState = await lottery.getLotteryState();
                  interval = await lottery.getInterval();
                  expect(lotteryState).to.eq(0);
                  expect(interval.toString()).to.eq(networkConfig[chainId].interval);
              });
          });

          describe("enterLottery", () => {

              it("reverts when the state is not opened", async () => {
                await stakingToken.mint(await playerSigner.getAddress(), 1000);
                await stakingToken.connect(playerSigner).approve(FarmingYield.address, 1000);
                await FarmingYield.connect(playerSigner).deposit(1000);
                  // We need to trigger performUpkeep in place of chainlink
                  // to change the state from OPEN to CALCULATING
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(playerSigner).claim();
                  // We pretend to be a chainlink keeper
                  await lottery.performUpkeep([]);
              });
          });

          describe("checkUpkeep", () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  // callStatic simulate a transaction
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(upkeepNeeded).to.be.false;
              });

              it("returns false if lottery isn't open", async () => {
                await stakingToken.mint(await playerSigner.getAddress(), 1000);
                await stakingToken.connect(playerSigner).approve(FarmingYield.address, 1000);
                await FarmingYield.connect(playerSigner).deposit(1000);
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(playerSigner).claim();
                  await lottery.performUpkeep([]); // changes the state to calculating
                  const lotteryState = await lottery.getLotteryState();
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(lotteryState).to.eq(1); // CALCULATING
                  expect(upkeepNeeded).to.be.false;
              });

              it("returns false if enough time hasn't passed", async () => {
                  const accounts = await ethers.getSigners();
                  for(let i= 0; i<10;i++)
                  {
                    await stakingToken.mint(await accounts[i].getAddress(), 1000);
                    await stakingToken.connect(accounts[i]).approve(FarmingYield.address, 1000);
                    await FarmingYield.connect(accounts[i]).deposit(1000);
                  }
                  await network.provider.send("evm_increaseTime", [interval.sub(100).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(playerSigner).claim();                  
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(upkeepNeeded).to.be.false;
              });

              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                 
                  const accounts = await ethers.getSigners();
                  for(let i= 0; i<10;i++)
                  {
                    await stakingToken.mint(await accounts[i].getAddress(), 1000);
                    await stakingToken.connect(accounts[i]).approve(FarmingYield.address, 1000);
                    await FarmingYield.connect(accounts[i]).deposit(1000);
                  }
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(playerSigner).claim();
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(upkeepNeeded).to.be.true;
              });
          });

          describe("performUpkeep", () => {
              it("reverts if checkupkeep is false", async () => {
                await stakingToken.mint(await playerSigner.getAddress(), 1000);
                await stakingToken.connect(playerSigner).approve(FarmingYield.address, 1000);
                await FarmingYield.connect(playerSigner).deposit(1000);
                  await network.provider.send("evm_increaseTime", [interval.sub(100).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(playerSigner).claim();

                  await expect(lottery.performUpkeep([]))
                      .to.be.revertedWithCustomError(lottery, "Lottery_UpkeepNotNeeded")
                      .withArgs(0, 1, 0);
              });

              it("changes the state to CALCULATING, and call the vrf coordinator to get a request id", async () => {
                await stakingToken.mint(await playerSigner.getAddress(), 1000);
                await stakingToken.connect(playerSigner).approve(FarmingYield.address, 1000);
                await FarmingYield.connect(playerSigner).deposit(1000);
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(playerSigner).claim();
                  const txResponse = await lottery.performUpkeep([]);

                  const txReceipt = await txResponse.wait(1);
                  const events = txReceipt.events || Array();
                  const requestId = events[1].args["requestId"];
                  expect(requestId).to.be.greaterThan(0);

                  const state = await lottery.getLotteryState();
                  expect(state).to.eq(1);
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
              });
              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address) // reverts if not fulfilled
                  ).to.be.revertedWith("nonexistent request");
              });

              it("picks a winner, resets, and sends money", async () => {
                  let lotteryConnect: Lottery;
                  const accounts = await ethers.getSigners();
                  for (let i = 0; i < 11; i++) {
                      lotteryConnect = lottery.connect(accounts[i]); // Returns a new instance of the Lottery contract connected to player
                    //   await lotteryConnect.enterLottery({ value: lotteryEntranceFee });
                    await stakingToken.mint(await accounts[i].getAddress(), 1000+i*100);
                    await stakingToken.connect(accounts[i]).approve(FarmingYield.address, 1000+i*100);
                    await FarmingYield.connect(accounts[i]).deposit(1000+i*100);
                      
                  }
                  await network.provider.send("evm_mine", []);
                  await network.provider.send("evm_mine", []);
                  await network.provider.send("evm_mine", []);
                  await FarmingYield.connect(accounts[6]).claim();
                  const startingTimeStamp = await lottery.getLastTimestamp(); // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise<void>(async (resolve, reject) => {
                      lotteryConnect.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!");
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await lotteryConnect.getRecentWinner();
                              const lotteryState = await lotteryConnect.getLotteryState();
                              const winnerBalance = await rewardToken1.balanceOf(accounts[6].address);
                              const endingTimeStamp = await lotteryConnect.getLastTimestamp();
                              await expect(lottery.getPlayer(0)).to.be.reverted;
                              expect(recentWinner).to.eq(accounts[6].address);
                              expect(lotteryState).to.eq(0);
                              expect(winnerBalance).to.gt(startingBalance);
                              expect(endingTimeStamp).to.be.greaterThan(startingTimeStamp);
                              resolve(); // if try passes, resolves the promise
                          } catch (e) {
                              reject(e); // if try fails, rejects the promise
                          }
                      });

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await lottery.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      
                      const startingBalance =await rewardToken1.balanceOf(accounts[6].address);
                      const reward = await rewardToken1.balanceOf(lottery.address);
                    //   console.log(reward);
                       console.log(startingBalance);
                      const events = txReceipt.events || Array();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          events[1].args.requestId,
                          lottery.address,
                      );
                  });
              });
          });
      });
      
