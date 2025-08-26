// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title QuizRegistry
/// @notice Append-only registry of quiz lifecycle and prize distributions for transparency
contract QuizRegistry is Ownable {
    struct QuizEndRecord {
        uint256 id;
        string title;
        string question;
        string[] options;
        uint8 correctIdx;
        uint256 participants;
        uint256 correct;
        address w1;
        address w2;
        address w3;
        bytes32 seed;
        uint256 endedAt;
        address source; // the QuizManager contract that emitted/recorded
    }

    struct DistributionRecord {
        address w1;
        address w2;
        address w3;
        uint256 a1;
        uint256 a2;
        uint256 a3;
        bytes32 t1; // tx hash for payment to w1
        bytes32 t2; // tx hash for payment to w2
        bytes32 t3; // tx hash for payment to w3
        bytes32 seed;
        uint256 at;
        address source; // the Distribution contract or QuizManager that called
    }

    // authorized writers (e.g., QuizManager owner, Distribution owner)
    mapping(address => bool) public authorized;

    QuizEndRecord[] private _quizEnds;
    DistributionRecord[] private _distributions;

    event AuthorizedSet(address indexed who, bool allowed);
    event QuizEndRecorded(uint256 indexed index, uint256 id, address indexed source);
    event DistributionRecorded(
        uint256 indexed index,
        address indexed w1,
        address indexed w2,
        address w3,
        uint256 a1,
        uint256 a2,
        uint256 a3,
        bytes32 t1,
        bytes32 t2,
        bytes32 t3,
        address source
    );

    modifier onlyAuthorized() {
        require(authorized[msg.sender] || msg.sender == owner(), "not authorized");
        _;
    }

    constructor(address _owner) Ownable(_owner) {}

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorized[who] = allowed;
        emit AuthorizedSet(who, allowed);
    }

    function quizEndsLength() external view returns (uint256) { return _quizEnds.length; }
    function distributionsLength() external view returns (uint256) { return _distributions.length; }

    function getQuizEnd(uint256 index) external view returns (QuizEndRecord memory) { return _quizEnds[index]; }
    function getDistribution(uint256 index) external view returns (DistributionRecord memory) { return _distributions[index]; }

    function recordQuizEnd(
        uint256 id,
        string calldata title,
        string calldata question,
        string[] calldata options,
        uint8 correctIdx,
        uint256 participants,
        uint256 correct,
        address w1,
        address w2,
        address w3,
        bytes32 seed,
        uint256 endedAt,
        address source
    ) external onlyAuthorized {
        _quizEnds.push(QuizEndRecord({
            id: id,
            title: title,
            question: question,
            options: options,
            correctIdx: correctIdx,
            participants: participants,
            correct: correct,
            w1: w1,
            w2: w2,
            w3: w3,
            seed: seed,
            endedAt: endedAt,
            source: source
        }));
        emit QuizEndRecorded(_quizEnds.length - 1, id, source);
    }

    function recordDistribution(
        address w1,
        address w2,
        address w3,
        uint256 a1,
        uint256 a2,
        uint256 a3,
        bytes32 t1,
        bytes32 t2,
        bytes32 t3,
        bytes32 seed,
        uint256 at,
        address source
    ) external onlyAuthorized {
        _distributions.push(DistributionRecord({
            w1: w1,
            w2: w2,
            w3: w3,
            a1: a1,
            a2: a2,
            a3: a3,
            t1: t1,
            t2: t2,
            t3: t3,
            seed: seed,
            at: at,
            source: source
        }));
        emit DistributionRecorded(_distributions.length - 1, w1, w2, w3, a1, a2, a3, t1, t2, t3, source);
    }
}
