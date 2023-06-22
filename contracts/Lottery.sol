// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
import "hardhat/console.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery_NotOpen();
error Lottery_UpkeepNotNeeded(uint256 balance, uint256 numberOfPlayers, uint256 lotteryState);

/**
 * @title Lottery Contract
 * @author Guillaume Debavelaere
 * @notice This contract is for creating an untamperable decentralized smart contract.
 * @dev This implements Chainlink VRF V2 and Chainlink Automation.
 */
contract Lottery is VRFConsumerBaseV2, AutomationCompatibleInterface {
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    uint256 private immutable _entranceFee;
    address payable[] private _players;

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
    uint256 private immutable _interval;

    event LotteryEntered(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        _entranceFee = entranceFee;
        _vrfCoordinatorV2 = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        _gasLane = gasLane;
        _subscriptionId = subscriptionId;
        _callbackGasLimit = callbackGasLimit;
        _lastTimestamp = block.timestamp;
        _interval = interval;
    }

    function enterLottery() external payable {
        if (msg.value < _entranceFee) {
            revert Lottery__NotEnoughETHEntered();
        }
        if (_lotteryState != LotteryState.OPEN) {
            revert Lottery_NotOpen();
        }
        _players.push(payable(msg.sender));

        emit LotteryEntered(msg.sender);
    }

    /**
     * @dev This is the function chainlink automation nodes call
     * they look for the upkeepNeeded to return true.
     * The following should be true in order to return true:
     * 1. Our time interval should have passed.
     * 2. The lottery should have at least one player and have some eth.
     * 3. Our subscription is funded with LINK
     * 4. The lottery should be in an open state.
     */
     
    function checkUpkeep(
        bytes memory /* checkData */
    ) public override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = _lotteryState == LotteryState.OPEN;
        bool timePassed = (block.timestamp - _lastTimestamp) > _interval;
        bool hasPlayers = _players.length > 0;
        bool hasBalance = address(this).balance > 0;
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
        uint256 indexOfWinner = randomWords[0] % _players.length;
        _recentWinner = _players[indexOfWinner];

        // Reset state and players array
        _lotteryState = LotteryState.OPEN;
        _players = new address payable[](0);
        _lastTimestamp = block.timestamp;

        (bool success, ) = _recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(_recentWinner);
    }

    function getEntranceFee() external view returns (uint256) {
        return _entranceFee;
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

    function getRecentWinner() public view returns (address) {
        return _recentWinner;
    }
}
