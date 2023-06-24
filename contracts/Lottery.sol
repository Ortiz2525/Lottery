// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
import "hardhat/console.sol";
import "./FarmingYield.sol";
import "./ERC20Mock.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery_NotOpen();
error Lottery_UpkeepNotNeeded(uint256 balance, uint256 numberOfPlayers, uint256 lotteryState);

contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface, Ownable {
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    struct StakerInfo {
        uint256 amount;
        address staker;
    }

    uint256 private topStakingAmount;
    address[] private _players;
    uint256[] private _amounts;
    FarmingYield public farmingYield;
    IERC20 public stakingToken;
    ERC20Mock public rewardToken;
    /**
     * Chainlink state variables
     */
    VRFCoordinatorV2Interface private immutable _vrfCoordinatorV2;
    bytes32 private immutable _gasLane; //  the maximum gas price you are willing to pay for a request in wei.
    uint64 private immutable _subscriptionId;
    // gas limit to use for the callback request to your contract's fullfillRandomWords()
    uint32 private immutable _callbackGasLimit;

    // Number of confirmations the chainlink nodes should wait before responding.
    // The longest the node waits, the most secure the random value is.
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1; // number of random numbers we want to generate

    /**
     * Lottery variables
     */
    address private _recentWinner;
    LotteryState private _lotteryState;
    uint256 private _lastTimestamp;
    uint256 private _interval;

    event LotteryEntered(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        _vrfCoordinatorV2 = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        _gasLane = gasLane;
        _subscriptionId = subscriptionId;
        _callbackGasLimit = callbackGasLimit;
        _lastTimestamp = block.timestamp;
        _interval = interval;
    }

    function checkUpkeep(
        bytes memory /* checkData */
    ) public override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = _lotteryState == LotteryState.OPEN;
        bool timePassed = (block.timestamp - _lastTimestamp) > _interval;
        address zeroAddress = 0x0000000000000000000000000000000000000000;
        if (address(farmingYield) != zeroAddress) {
            address[] memory stakers = farmingYield.getStakers();
            uint256 k = stakers.length < 10 ? stakers.length : 10;
            uint256 n = stakers.length;
            for (uint256 i = 0; i < k; i++) {
                uint256 maxIndex = i;
                for (uint256 j = i + 1; j < n; j++) {
                    if (
                        farmingYield.getAmount(stakers[j]) >
                        farmingYield.getAmount(stakers[maxIndex])
                    ) {
                        maxIndex = j;
                    }
                }
                address temp = stakers[i];
                stakers[i] = stakers[maxIndex];
                stakers[maxIndex] = temp;
            }
            _players = new address[](0);
            _amounts = new uint256[](0);
            topStakingAmount = 0;
            for (uint256 i = 0; i < k; i++) {
                _players.push(stakers[i]);
                _amounts.push(farmingYield.getAmount(stakers[i]));
                topStakingAmount += farmingYield.getAmount(stakers[i]);
            }
        }
        bool hasPlayers = _players.length > 0;
        bool hasBalance = rewardToken.balanceOf(address(this)) > 0;
        upkeepNeeded = isOpen && hasPlayers && timePassed && hasBalance;
    }

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");

        if (!upkeepNeeded) {
            revert Lottery_UpkeepNotNeeded(
                address(this).balance,
                _players.length,
                uint256(_lotteryState)
            );
        }
        _lotteryState = LotteryState.CALCULATING;
        uint256 requestId = _vrfCoordinatorV2.requestRandomWords(
            _gasLane,
            _subscriptionId,
            REQUEST_CONFIRMATIONS,
            _callbackGasLimit,
            NUM_WORDS
        );
        emit RequestedLotteryWinner(requestId);
    }

    /**
     * @dev Callback called by chainlink vrf.
     * Will pick the winner based on the random number provided and transfer him the smart contract balance
     */
    function fulfillRandomWords(
        uint256 /* requestId */,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner;
        uint256 rNumber = randomWords[0] % topStakingAmount;
        for (uint256 i = 0; i < _players.length; i++) {
            if (rNumber < _amounts[i]) {
                indexOfWinner = i;
                break;
            } else {
                rNumber -= _amounts[i];
            }
        }
     //   console.log(indexOfWinner);
        _recentWinner = _players[indexOfWinner];

        // Reset state and players array
        _lotteryState = LotteryState.OPEN;
        _players = new address[](0);
        _amounts = new uint256[](0);
        topStakingAmount = 0;
        _lastTimestamp = block.timestamp;

        rewardToken.transfer(_recentWinner, rewardToken.balanceOf(address(this)));
        emit WinnerPicked(_recentWinner);
    }

    function getPlayer(uint256 index) external view returns (address) {
        return _players[index];
    }

    function getLotteryState() external view returns (LotteryState) {
        return _lotteryState;
    }

    function getNumberOfWords() external pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() external view returns (uint256) {
        return _players.length;
    }

    function getLastTimestamp() external view returns (uint256) {
        return _lastTimestamp;
    }

    function getRequestConfirmations() external pure returns (uint256) {
        return REQUEST_CONFIRMATIONS;
    }

    function getInterval() external view returns (uint256) {
        return _interval;
    }

    function getTopStakersTotalAmount() external view returns (uint256) {
        return topStakingAmount;
    }

    function getRecentWinner() public view returns (address) {
        return _recentWinner;
    }

    function setFarmingYield(address _yield) public onlyOwner {
        farmingYield = FarmingYield(_yield);
    }

    function setRewardToken(address _yield) public onlyOwner {
        rewardToken = ERC20Mock(_yield);
    }

    function setStakingToken(address _yield) public onlyOwner {
        stakingToken = ERC20Mock(_yield);
    }

    function setInterval(uint256 time) public onlyOwner {
        _interval = time;
    }
}
