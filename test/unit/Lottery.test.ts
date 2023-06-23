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
              FarmingYield = await FarmingYieldFactory.deploy(
                stakingToken.address,
                rewardToken1.address,
                10, 
                lottery.address,
                1000,
                lockPeriod
              );
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
              it("reverts when you don't pay enough", async () => {
                  await expect(
                      lottery.enterLottery({ value: ethers.utils.parseEther("0") })
                  ).to.be.revertedWithCustomError(lottery, "Lottery__NotEnoughETHEntered");
              });

              it("records players when they enter", async () => {
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  const playerFromContract = await lottery.getPlayer(0);
                  expect(playerFromContract).to.eq(player);
              });

              it("emits a LotteryEntered event", async () => {
                  await expect(
                      lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee })
                  )
                      .to.emit(lottery, "LotteryEntered")
                      .withArgs(player);
              });

              it("reverts when the state is not opened", async () => {
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  // We need to trigger performUpkeep in place of chainlink
                  // to change the state from OPEN to CALCULATING

                  // increase time of the blockchain to be able to call and pass checkUpkeep
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  // mine a block
                  await network.provider.send("evm_mine", []);

                  // We pretend to be a chainlink keeper
                  await lottery.performUpkeep([]);

                  // Now if we try to enter the lottery, the state should not be opened and we expect a revert
                  await expect(
                      lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWithCustomError(lottery, "Lottery_NotOpen");
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
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  await lottery.performUpkeep([]); // changes the state to calculating
                  const lotteryState = await lottery.getLotteryState();
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(lotteryState).to.eq(1); // CALCULATING
                  expect(upkeepNeeded).to.be.false;
              });

              it("returns false if enough time hasn't passed", async () => {
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.sub(10).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(upkeepNeeded).to.be.false;
              });

              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
                  expect(upkeepNeeded).to.be.true;
              });
          });

          describe("performUpkeep", () => {
              it("reverts if checkupkeep is false", async () => {
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.sub(10).toNumber()]);
                  await network.provider.send("evm_mine", []);

                  await expect(lottery.performUpkeep([]))
                      .to.be.revertedWithCustomError(lottery, "Lottery_UpkeepNotNeeded")
                      .withArgs(lotteryEntranceFee, 1, 0);
              });

              it("changes the state to CALCULATING, and call the vrf coordinator to get a request id", async () => {
                  await lottery.connect(playerSigner).enterLottery({ value: lotteryEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.add(1).toNumber()]);
                  await network.provider.send("evm_mine", []);

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
                  await lottery.enterLottery({ value: lotteryEntranceFee });
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

              // This test is too big...
              // This test simulates users entering the lottery and wraps the entire functionality of the lottery
              // inside a promise that will resolve if everything is successful.
              // An event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // All the assertions are done once the WinnerPicked event is fired
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3; // to test
                  const startingIndex = 2;
                  let lotteryConnect: Lottery;
                  const accounts = await ethers.getSigners();
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      // i = 2; i < 5; i=i+1
                      lotteryConnect = lottery.connect(accounts[i]); // Returns a new instance of the Lottery contract connected to player
                      await lotteryConnect.enterLottery({ value: lotteryEntranceFee });
                      
                  }
                 
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
                              const winnerBalance = await accounts[2].getBalance();
                              const endingTimeStamp = await lotteryConnect.getLastTimestamp();
                              await expect(lottery.getPlayer(0)).to.be.reverted;
                              // Comparisons to check if our ending values are correct:
                              expect(recentWinner).to.eq(accounts[2].address);
                              expect(lotteryState).to.eq(0);
                              expect(winnerBalance).to.eq(
                                  startingBalance // startingBalance + ( (lotteryEntranceFee * additionalEntrances) + lotteryEntranceFee )
                                      .add(
                                          lotteryEntranceFee
                                              .mul(additionalEntrances)
                                              .add(lotteryEntranceFee)
                                      )
                              );
                              expect(endingTimeStamp).to.be.greaterThan(startingTimeStamp);
                              resolve(); // if try passes, resolves the promise
                          } catch (e) {
                              reject(e); // if try fails, rejects the promise
                          }
                      });

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await lottery.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      
                      const startingBalance = await accounts[2].getBalance();
                      const events = txReceipt.events || Array();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          events[1].args.requestId,
                          lottery.address,
                      );
                  });
              });
          });
          
        //   describe("FarmingYield", () => {
        //     let FarmingYield: Contract;
        //     let stakingToken: Contract;
        //     let rewardToken1: Contract;
        //     let owner: Signer;
        //     let addr1: Signer;
        //     let addr2: Signer;
        //     let treasury: Signer;
          
        //     beforeEach(async () => {
        //       [owner, addr1, addr2, treasury] = await ethers.getSigners();
          
        //       const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
        //       stakingToken = await ERC20MockFactory.deploy("Staking Token", "STK");
        //       rewardToken1 = await ERC20MockFactory.deploy("Reward Token 1", "RT1");
          
        //       const FarmingYieldFactory = await ethers.getContractFactory("FarmingYield");
        //       const lockPeriod = 30 * 24 * 60 * 60;
        //       FarmingYield = await FarmingYieldFactory.deploy(
        //         stakingToken.address,
        //         rewardToken1.address,
        //         10, // depositFeePercent
        //         await treasury.getAddress(), // treasury
        //         1000, // reward1PerBlock
        //         lockPeriod
        //       );
        //     });
        //     describe("Deposit", () => {
        //       it("Should deposit staking tokens", async () => {
        //         await stakingToken.connect(owner).mint(await addr1.getAddress(), 1000);
        //         await stakingToken.connect(addr1).approve(FarmingYield.address, 1000);
        //         await FarmingYield.connect(addr1).deposit(1000);
        //         const userInfo = await FarmingYield.userInfo(await addr1.getAddress());
        //         expect(userInfo.amount).to.equal(990); // 1000 - 1% deposit fee
        //       });
        //       it("get Reward tokens from deposit", async () => {
        //         await stakingToken.connect(owner).mint(await addr1.getAddress(), 2020);
        //         await stakingToken.connect(addr1).approve(FarmingYield.address, 2020);
        //         await FarmingYield.connect(addr1).deposit(1010);
        //         await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
        //         await ethers.provider.send("evm_mine",[]);
        //         await FarmingYield.connect(addr1).deposit(1010);
        //         const userInfo = await FarmingYield.userInfo(await addr1.getAddress());
        //         await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("1800")); // ({blockpass = 2}*1000)*90/100
        //         await expect (await rewardToken1.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("200"));
        //         expect(userInfo.amount).to.equal(2000);
        //       });
        //     });
        //   });
      });
      
