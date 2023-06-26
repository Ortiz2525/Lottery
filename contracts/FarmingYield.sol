// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";
import "./ERC20Mock.sol";
import "./IFarmingYield.sol";

contract FarmingYield is Ownable, IFarmingYield {
    using SafeMath for uint256;
    // token addresses
    ERC20Mock public stakingToken;
    ERC20Mock public rewardToken1;
    // fee percent
    uint256 public depositFee;
    //  total Staked amount
    uint256 public totalStaked;
    // staker can withdraw after locked period
    uint256 public lockPeriod = 30 days;
    //reward tokens created per block
    uint256 public reward1PerBlock;
    // depositFee will be send to treasury address.
    address public treasury;
    address public restMaxAddress;
    uint256 public lastRewardBlock;
    uint256 public accReward1PerShare;

    struct FundInfo {
        uint256 amount;
        uint256 timestamps;
    }

    struct UserInfo {
        uint256 amount; // How many staking tokens the user has provided.
        uint256 unLockAmount;
        // Reward debt.
        uint256 reward1Debt;
        bool isTopStaker;
        FundInfo[] fundInfo;
    }

    address[] public topStakers;
    address[] public stakers;
    mapping(address => UserInfo) public userInfo;
    mapping(address => uint256) public lockIndex;
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 amount1);

    constructor(uint256 _depositFee, uint256 _reward1PerBlock, uint256 _lockPeriod) {
        depositFee = _depositFee;
        reward1PerBlock = _reward1PerBlock;
        lastRewardBlock = block.number;
        accReward1PerShare = 0;
        lockPeriod = _lockPeriod;
    }

    function setRewardPerBlock(uint256 _reward1PerBlock) public override onlyOwner {
        reward1PerBlock = _reward1PerBlock;
    }

    function setTreasury(address _treasury) public override onlyOwner {
        treasury = _treasury;
    }

    function setStakingToken(address _token) public override onlyOwner {
        stakingToken = ERC20Mock(_token);
    }

    function setRewardToken(address _token) public override onlyOwner {
        rewardToken1 = ERC20Mock(_token);
    }

    function update() private {
        uint256 stakingSupply = stakingToken.balanceOf(address(this));

        if (stakingSupply == 0) {
            lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = block.number - lastRewardBlock;
        uint256 reward1 = multiplier * reward1PerBlock;

        rewardToken1.mint(address(this), reward1);
        accReward1PerShare = accReward1PerShare + (reward1 * 1e12) / stakingSupply;
        lastRewardBlock = block.number;
    }

    function depositUpdateTopStakers(address staker) private {
        UserInfo storage user = userInfo[staker];
        if (user.fundInfo.length == 1 && topStakers.length < 10) {
            topStakers.push(staker);
            user.isTopStaker = true;
        } else if (
                user.isTopStaker == false &&
                topStakers.length >= 10 &&
                userInfo[topStakers[9]].amount < user.amount)
        {
            userInfo[topStakers[9]].isTopStaker = false;
            topStakers[9] = staker;
            user.isTopStaker = true;
        }
        sortTopStakers();
    }
    function withdrawUpdateTopStakers(address staker) private {
        UserInfo storage user = userInfo[staker];
        
        uint8 i;
        if(topStakers.length >= 10 &&  user.isTopStaker == true)
        {
            if(user.amount < userInfo[topStakers[9]].amount && user.amount < restMaxAmount()) {
                    for(i=0;i<10;i++) if(staker == topStakers[i]) break;
                    if(i==10) return;
                    user.isTopStaker = false;
                    userInfo[restMaxAddress].isTopStaker = true;
                    topStakers[i] = restMaxAddress;
            }
        }
        sortTopStakers();
    }
    function restMaxAmount() private returns (uint256)
    {
        uint256 maxAmount=0;
        for(uint256 i=0; i<stakers.length; i++) 
        if(userInfo[stakers[i]].isTopStaker==false && userInfo[stakers[i]].amount > maxAmount)
            {maxAmount=userInfo[stakers[i]].amount; restMaxAddress=stakers[i];}
        return maxAmount; 
    }

    function sortTopStakers() private {
        uint256 n = topStakers.length > 10 ? 10 : topStakers.length ;
        for(uint8 i=0; i<n-1; i++)
            for(uint8 j=i+1; j<n; j++)
                if(userInfo[topStakers[i]].amount < userInfo[topStakers[j]].amount)
                {
                    address temp;
                    temp=topStakers[i];
                    topStakers[i]=topStakers[j];
                    topStakers[j]=temp;
                }
    }

    function deposit(uint256 amount) external override {
        require(amount > 0, "Amount must be greater than 0");
        UserInfo storage user = userInfo[msg.sender];
        update();

        if (user.amount > 0) {
            uint256 pendingReward1 = pendingReward(msg.sender);
            rewardToken1.transfer(treasury, (pendingReward1 * 10) / 100);
            rewardToken1.transfer(msg.sender, pendingReward1 - (pendingReward1 * 10) / 100);
        }
        uint256 fee = (amount * depositFee) / 100;
        uint256 netAmount = amount - fee;
        stakingToken.transferFrom(msg.sender, address(this), amount);

        stakingToken.transfer(treasury, fee);

        user.amount = user.amount + netAmount;
        user.reward1Debt = (user.amount * accReward1PerShare) / 1e12;
        user.fundInfo.push(FundInfo(netAmount, block.timestamp));
        if(user.fundInfo.length == 1) stakers.push(msg.sender);
        depositUpdateTopStakers(msg.sender);
        emit Deposit(msg.sender, netAmount);
    }

    function withdraw(uint256 amount) external override{
        require(amount > 0, "Amount must be greater than 0");
        UserInfo storage user = userInfo[msg.sender];
        (, uint withdrawableAmount) = getFundInfo(msg.sender);
        require(amount <= withdrawableAmount, "Amount must be less than withdrawable amount");

        update();
        uint256 pendingReward1 = pendingReward(msg.sender);
        rewardToken1.transfer(treasury, (pendingReward1 * 10) / 100);
        rewardToken1.transfer(msg.sender, pendingReward1 - (pendingReward1 * 10) / 100);

        user.amount = user.amount - amount;
        user.unLockAmount -= amount;
        user.reward1Debt = (user.amount * accReward1PerShare) / 1e12;
        stakingToken.transfer(msg.sender, amount);
        withdrawUpdateTopStakers(msg.sender);
        emit Withdraw(msg.sender, amount);
    }

    function claim() external override {
        UserInfo storage user = userInfo[msg.sender];
        update();
        uint256 pendingReward1 = pendingReward(msg.sender);
        //send pending amount
        rewardToken1.transfer(treasury, (pendingReward1 * 10) / 100);
        pendingReward1 = pendingReward1 - (pendingReward1 * 10) / 100;
        rewardToken1.transfer(msg.sender, pendingReward1);

        user.reward1Debt = (user.amount * accReward1PerShare) / 1e12;
        emit Claim(msg.sender, pendingReward1);
    }

    function getFundInfo(address _user) private returns (uint256, uint256) {
        UserInfo storage user = userInfo[_user];
        uint256 i;
        for (i = lockIndex[_user]; i < user.fundInfo.length; i++) {
            uint256 elapsedTime = block.timestamp - user.fundInfo[i].timestamps;
            if (elapsedTime >= lockPeriod) user.unLockAmount += user.fundInfo[i].amount;
            else {
                lockIndex[_user] = i;
                break;
            }
        }
        if (i == user.fundInfo.length) lockIndex[_user] = i;
        return (user.amount - user.unLockAmount, user.unLockAmount);
    }

    function pendingReward(address _user) private view returns (uint256) {
        UserInfo storage user = userInfo[_user];
        return ((user.amount * accReward1PerShare) / 1e12 - user.reward1Debt);
    }

    function getTopStakers() public override returns (address[] memory) {
        return topStakers;
    }

    function getAmount(address _user) public override returns (uint256) {
        return userInfo[_user].amount;
    }
}
