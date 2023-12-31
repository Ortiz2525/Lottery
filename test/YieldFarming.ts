import { ethers } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

describe("FarmingYield", () => {
  let FarmingYield: Contract;
  let ERC20Mock: Contract;
  let stakingToken: Contract;
  let rewardToken1: Contract;
  let owner: Signer;
  let addr1: Signer;
  let addr2: Signer;
  let treasury: Signer;

  beforeEach(async () => {
    [owner, addr1, addr2, treasury] = await ethers.getSigners();

    const ERC20MockFactory = await ethers.getContractFactory("ERC20Mock");
    stakingToken = await ERC20MockFactory.deploy("Staking Token", "STK");
    rewardToken1 = await ERC20MockFactory.deploy("Reward Token 1", "RT1");

    const FarmingYieldFactory = await ethers.getContractFactory("FarmingYield");
    const lockPeriod = 30 * 24 * 60 * 60;
    FarmingYield = await FarmingYieldFactory.deploy(
      1, // depositFeePercent
      1000, // reward1PerBlock
      lockPeriod
    );
    await FarmingYield.setTreasury(treasury.getAddress());
    await FarmingYield.setStakingToken(stakingToken.address);
    await FarmingYield.setRewardToken(rewardToken1.address);
  });

  describe("Deployment", () => {
    it("Should set the correct staking token", async () => {
      expect(await FarmingYield.stakingToken()).to.equal(stakingToken.address);
    });

    it("Should set the correct reward tokens", async () => {
      expect(await FarmingYield.rewardToken1()).to.equal(rewardToken1.address);
    });
  });

  describe("Deposit", () => {
    it("Deposit amount should be greater than 0", async() => {
      await expect(FarmingYield.connect(addr1).deposit(0)).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should deposit staking tokens", async () => {
      // Mint some staking tokens for addr1
      await stakingToken.connect(owner).mint(await addr1.getAddress(), 1000);

      // Approve FarmingYield contract to spend addr1's staking tokens
      await stakingToken.connect(addr1).approve(FarmingYield.address, 1000);

      // Deposit staking tokens
      await FarmingYield.connect(addr1).deposit(1000);

      // Check if the deposit was successful
      const userInfo = await FarmingYield.userInfo(await addr1.getAddress());
      expect(userInfo.amount).to.equal(990); // 1000 - 1% deposit fee
    });
    it("get Reward tokens from deposit", async () => {
      // Mint some staking tokens for addr1
      await stakingToken.connect(owner).mint(await addr1.getAddress(), 2020);
      // Approve FarmingYield contract to spend addr1's staking tokens
      await stakingToken.connect(addr1).approve(FarmingYield.address, 2020);
      // Deposit staking tokens
      await FarmingYield.connect(addr1).deposit(1010);
      
      await ethers.provider.send("evm_increaseTime", [10]);
      await ethers.provider.send("evm_mine",[]);
      //2 blocks are minted

      await FarmingYield.connect(addr1).deposit(1010);
      // Check if the deposit was successful
      const userInfo = await FarmingYield.userInfo(await addr1.getAddress());
      //console.log(await rewardToken1.balanceOf(await addr1.getAddress()));
      
      //amount of rewardtokens based on share from staking amount in 90% total reward token.
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("1800")); // ({blockpass = 2}*1000)*90/100
     //amount of tokens in treasury. depositfee = 1%
      await expect (await stakingToken.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("20"));
      await expect (await rewardToken1.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("200"));
      expect(userInfo.amount).to.equal(2000); //  2020 - fee
    });
    it("multi deposit", async () => {
      const accounts = await ethers.getSigners();
      for(let i= 0; i<15;i++)
      {
        await stakingToken.mint(await accounts[i].getAddress(), 1000);
        await stakingToken.connect(accounts[i]).approve(FarmingYield.address, 1000);
      }
      await FarmingYield.connect(accounts[0]).deposit(200);
      await FarmingYield.connect(accounts[1]).deposit(300);
      await FarmingYield.connect(accounts[2]).deposit(500);
      await FarmingYield.connect(accounts[3]).deposit(100);
      await FarmingYield.connect(accounts[4]).deposit(200);
      await FarmingYield.connect(accounts[5]).deposit(150);
      await FarmingYield.connect(accounts[6]).deposit(750);
      await FarmingYield.connect(accounts[7]).deposit(840);
      await FarmingYield.connect(accounts[8]).deposit(640);
      await FarmingYield.connect(accounts[9]).deposit(620);
      await FarmingYield.connect(accounts[10]).deposit(630);
      await FarmingYield.connect(accounts[11]).deposit(650);
      await FarmingYield.connect(accounts[12]).deposit(110);
      await FarmingYield.getTopStakers();
      await ethers.provider.send("evm_increaseTime", [31 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      console.log("");     
      await FarmingYield.connect(accounts[7]).withdraw(500);
      await FarmingYield.getTopStakers();
      await FarmingYield.connect(accounts[6]).withdraw(730);
      await FarmingYield.getTopStakers();
    });
  });

  describe("Withdraw", () => {
 /*   beforeEach(async () => {
      // Mint some staking tokens for addr1 and deposit them
      await stakingToken.connect(owner).mint(await addr1.getAddress(), 112);
      await stakingToken.connect(addr1).approve(FarmingYield.address, 112);
      await FarmingYield.connect(addr1).deposit(101);
    });
    it("Withdraw amount should be less than withdrawable amount", async () => {
      await ethers.provider.send("evm_increaseTime", [1 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(11);
      // Withdraw staking tokens
      await FarmingYield.connect(addr1).withdraw(100);
      await expect(FarmingYield.connect(addr1).withdraw(10)).to.be.revertedWith("Amount must be less than withdrawable amount");
    });
*/
    beforeEach(async () => {
      // Mint some staking tokens for addr1 and deposit them
      await stakingToken.connect(owner).mint(await addr1.getAddress(), 4040);
      await stakingToken.connect(addr1).approve(FarmingYield.address, 4040);
      await stakingToken.connect(owner).mint(await addr2.getAddress(), 2040);
      await stakingToken.connect(addr2).approve(FarmingYield.address, 2040);
      await FarmingYield.connect(addr1).deposit(1010);
    });
  
    it("Deposit amount should be greater than 0", async() => {
      await expect(FarmingYield.connect(addr1).withdraw(0)).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Withdraw amount should be less than withdrawable amount", async () => {
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(1010);
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      // Withdraw staking tokens
      await expect(FarmingYield.connect(addr1).withdraw(1500)).to.be.revertedWith("Amount must be less than withdrawable amount");
    });

    it("test optimization of deposit log", async () => {

      await FarmingYield.connect(addr1).deposit(101);
      await FarmingYield.connect(addr1).deposit(101);
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("1800")); // ({blockpass = 2}*1000)*90/100

      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(101);
      await FarmingYield.connect(addr1).deposit(101);
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("4500")); // 1800 + ({blockpass = 3}*1000)*90/100
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(101);
      await FarmingYield.connect(addr1).deposit(101);
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("7200")); // 4500 + ({blockpass = 3}*1000)*90/100
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await FarmingYield.connect(addr1).withdraw(1200);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(101);
      await FarmingYield.connect(addr1).deposit(101);
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("10800")); // 7200 + ({blockpass = 4}*1000)*90/100

      await FarmingYield.connect(addr2).deposit(1010); 

      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      const userInfo = await FarmingYield.userInfo(await addr1.getAddress());
       expect(userInfo.amount).to.equal(600); // 1800 - 1200
       await expect (await stakingToken.balanceOf(FarmingYield.address)).to.be.equal(ethers.BigNumber.from("1600")); //addr->600  addr->1000
      await FarmingYield.connect(addr1).deposit(101);

      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("12375")); // 10800 + (1000*1 + 2000*600/1600)*90/100
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(101);
      
      await FarmingYield.connect(addr1).withdraw(400);
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).withdraw(400);
      await FarmingYield.connect(addr1).deposit(505);
      await FarmingYield.connect(addr1).deposit(505);
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(505);
      await FarmingYield.connect(addr1).deposit(505);
      await ethers.provider.send("evm_increaseTime", [15 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).withdraw(1000);
    });

    it("multi stakers", async () => {
      await FarmingYield.connect(addr2).deposit(1010);
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
 //     await ethers.provider.send("evm_mine",[]);
 //     await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(101);
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("1800")); // 900 + 450*2 
    });

    
    it("Should withdraw staking tokens after lock period", async () => {
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).deposit(1010);
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine",[]);
  
      // Withdraw staking tokens
      await FarmingYield.connect(addr1).withdraw(1500);
  
      // Check if the withdraw was successful
      const userInfo = await FarmingYield.userInfo(await addr1.getAddress());
      expect(userInfo.amount).to.equal(500); // 1980 - 1500
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("3600")); // ({blockpass = 4}*1000)*90/100
      await expect (await stakingToken.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("20"));
      await expect (await rewardToken1.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("400"));
     await ethers.provider.send("evm_mine",[]);
      await ethers.provider.send("evm_mine",[]);
      await FarmingYield.connect(addr1).withdraw(200);
      await expect (await rewardToken1.balanceOf(await addr1.getAddress())).to.be.equal(ethers.BigNumber.from("6300")); // 3600+({blockpass = 3}*1000)*90/100
      await expect (await stakingToken.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("20"));
      await expect (await rewardToken1.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("700")); //400+({blockpass = 3}*1000)*10/100
    });
  
    it("Should emit Withdraw event", async () => {
      // Increase time to pass the lock period
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
  
      // Check if the Withdraw event is emitted
      await expect(FarmingYield.connect(addr1).withdraw(500))
        .to.emit(FarmingYield, "Withdraw")
        .withArgs(await addr1.getAddress(), 500);
    });
  });
  
  describe("Claim", () => {
    beforeEach(async () => {
      // Mint some staking tokens for addr1 and deposit them
      await stakingToken.connect(owner).mint(await addr1.getAddress(), 1010);
      await stakingToken.connect(addr1).approve(FarmingYield.address, 1010);
      await FarmingYield.connect(addr1).deposit(1010);
    });
  
    it("Should claim pending rewards", async () => {
      // Increase time to generate some rewards
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine", []);
  
      // Claim rewards
      await FarmingYield.connect(addr1).claim();
  
      // Check if the claim was successful
      const reward1Balance = await rewardToken1.balanceOf(await addr1.getAddress());
      expect(reward1Balance).to.be.equal(ethers.BigNumber.from(1800));  //blockpass=2  1000*2*90/100
   });
  
    it("Should emit Claim event", async () => {
      // Increase time to generate some rewards
      await ethers.provider.send("evm_increaseTime", [1000]);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      // 4 blocks are minted
        
      // Check if the Claim event is emitted
      await expect(FarmingYield.connect(addr1).claim())
        .to.emit(FarmingYield, "Claim")
       .withArgs(await addr1.getAddress(), 3600); //blockpass = 4
       await expect (await stakingToken.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("10"));
       await expect (await rewardToken1.balanceOf(await treasury.getAddress())).to.be.equal(ethers.BigNumber.from("400"));
    });
    
  });
});