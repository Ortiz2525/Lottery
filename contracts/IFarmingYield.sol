// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFarmingYield {
    function setRewardPerBlock(uint256 _reward1PerBlock) external;
    function setTreasury(address _treasury) external;
    function setStakingToken(address _token) external;
    function setRewardToken(address _token) external;
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function claim() external;
    function getTopStakers() external returns (address[] memory);
    function getAmount(address _user) external returns (uint256);
}