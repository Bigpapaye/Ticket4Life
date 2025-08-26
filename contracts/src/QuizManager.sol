// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/dev/vrf/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/dev/vrf/libraries/VRFV2PlusClient.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IQuizRegistry {
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
    ) external;
}

/**
 * @title QuizManager v2
 * @notice On-chain quiz manager with stats and history for Ticket4Life.
 *         - Owner creates a quiz, updates Q&A, toggles active, and can end the quiz.
 *         - Users submit a single answer per quiz version (enforced by quizId).
 *         - Maintains participants/correct counters and an archive of ended quizzes.
 */
contract QuizManager is VRFConsumerBaseV2Plus {
    struct Quiz {
        string title;
        string question;
        string[] options;
        uint8 correctIndex; // 0-based
        bool active;
        bool exists;
    }

    struct QuizStats { uint256 participants; uint256 correct; }

    struct QuizSnapshot {
        uint256 id;
        string title;
        string question;
        string[] options;
        uint8 correctIndex;
        uint256 participants;
        uint256 correct;
        uint256 endedAt;
    }

    address public ticket; // Ticket4Life ERC721 required to participate
    address public registry; // optional registry for immutable history
    uint256 public quizId; // increments each create()
    Quiz private _current;

    // last quizId a given address has submitted for
    mapping(address => uint256) public lastSubmittedQuizId;
    mapping(uint256 => QuizStats) public stats; // stats per quizId
    QuizSnapshot[] private _history;

    // Eligible players for current quiz (unique addresses with correct submission)
    address[] private _eligible;
    mapping(address => bool) private _isEligible;

    // Last winners for current quiz draw (for UI readback)
    address[3] private _lastWinners;
    bytes32 private _lastDrawSeed;

    event QuizCreated(uint256 indexed id, string title);
    event QuizUpdated(string title, string question, string[] options, uint8 correctIndex, bool active);
    event QuizActivationChanged(bool active);
    event QuizEnded(uint256 indexed id, string title, uint256 participants, uint256 correct);
    event AnswerSubmitted(address indexed player, uint8 answer, bool correct);
    event WinnersDrawn(uint256 indexed id, address w1, address w2, address w3, bytes32 seed);
    event VRFRequested(uint256 indexed id, uint256 requestId);
    event AdminTicketsMarked(address indexed who, uint256 count);
    event RegistrySet(address indexed registry);

    // Safety cap to limit the number of eligibility entries pushed in one tx
    uint256 public constant MAX_ELIGIBILITY_PUSH = 5000;

    // Chainlink VRF v2.5 (Plus)
    bytes32 public keyHash; // gas lane
    uint256 public subscriptionId;
    uint32 public callbackGasLimit = 350000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    uint256 private _lastRequestId;

    constructor(address _owner, address _ticket, address _vrfCoordinator, bytes32 _keyHash, uint256 _subId)
        VRFConsumerBaseV2Plus(_vrfCoordinator)
    {
        require(_ticket != address(0), "TICKET_ZERO");
        ticket = _ticket;
        keyHash = _keyHash;
        subscriptionId = _subId;
        if (_owner != address(0) && _owner != msg.sender) {
            // Inherit ConfirmedOwner's transferOwnership
            transferOwnership(_owner);
        }
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
        emit RegistrySet(_registry);
    }

    function create(string calldata title) external onlyOwner {
        require(bytes(title).length > 0, "Empty title");
        // start a new quiz version
        quizId += 1;
        delete _current.options; // clear dynamic array storage
        _current = Quiz({
            title: title,
            question: "",
            options: new string[](0),
            correctIndex: 0,
            active: false,
            exists: true
        });
        // reset eligibility data for the new quiz version
        _clearEligibility();
        // stats[quizId] is zero-initialized
        emit QuizCreated(quizId, title);
        emit QuizUpdated(_current.title, _current.question, _current.options, _current.correctIndex, _current.active);
    }

    function setActive(bool active_) external onlyOwner {
        require(_current.exists, "No quiz");
        _current.active = active_;
        emit QuizActivationChanged(active_);
    }

    function setQA(
        string calldata question,
        string[] calldata options,
        uint8 correctIndex
    ) external onlyOwner {
        require(_current.exists, "No quiz");
        require(bytes(question).length > 0, "Empty question");
        require(options.length >= 2 && options.length <= 8, "Bad options");
        require(correctIndex < options.length, "Bad index");

        delete _current.options;
        for (uint256 i = 0; i < options.length; i++) {
            _current.options.push(options[i]);
        }
        _current.question = question;
        _current.correctIndex = correctIndex;
        emit QuizUpdated(_current.title, _current.question, _current.options, _current.correctIndex, _current.active);
    }

    function endQuiz() external onlyOwner {
        require(_current.exists, "No quiz");
        QuizStats memory s = stats[quizId];
        // snapshot and archive
        _history.push(QuizSnapshot({
            id: quizId,
            title: _current.title,
            question: _current.question,
            options: _current.options,
            correctIndex: _current.correctIndex,
            participants: s.participants,
            correct: s.correct,
            endedAt: block.timestamp
        }));
        // optional canonical registry record
        if (registry != address(0)) {
            // load winners and seed set by last draw (may be zero if not drawn)
            address w1 = _lastWinners[0];
            address w2 = _lastWinners[1];
            address w3 = _lastWinners[2];
            bytes32 seed = _lastDrawSeed;
            // best-effort; ignore failure to avoid blocking endQuiz
            try IQuizRegistry(registry).recordQuizEnd(
                quizId,
                _current.title,
                _current.question,
                _current.options,
                _current.correctIndex,
                s.participants,
                s.correct,
                w1,
                w2,
                w3,
                seed,
                block.timestamp,
                address(this)
            ) { } catch { }
        }
        emit QuizEnded(quizId, _current.title, s.participants, s.correct);
        // mark no current quiz (UI shows config again)
        _current.exists = false;
        _current.active = false;
        // clear eligibility for the ended quiz
        _clearEligibility();
    }

    function submit(uint8 answer) external {
        require(_current.exists && _current.active, "Quiz inactive");
        require(lastSubmittedQuizId[msg.sender] != quizId, "Already submitted");
        require(answer < _current.options.length, "Bad answer");
        // Require holder of Ticket4Life
        require(ticket != address(0) && IERC721(ticket).balanceOf(msg.sender) > 0, "NO_TICKET");
        lastSubmittedQuizId[msg.sender] = quizId;
        bool correct = (answer == _current.correctIndex);
        // update stats
        stats[quizId].participants += 1;
        if (correct) {
            stats[quizId].correct += 1;
            if (!_isEligible[msg.sender]) {
                _isEligible[msg.sender] = true;
                _eligible.push(msg.sender);
            }
        }
        emit AnswerSubmitted(msg.sender, answer, correct);
    }

    /**
     * @notice Admin-only helper to mark all tickets owned by `who` as eligible in one tx.
     *         This preserves the address-based eligibility model by pushing the address `count` times
     *         into the eligible pool, where `count` is the number of tickets owned (capped by `cap` if non-zero).
     *         Updates stats accordingly and marks `who` as having submitted for this quiz version.
     * @param who target address (e.g., admin wallet)
     * @param cap optional cap (0 means no cap)
     */
    function adminMarkOwnedTicketsEligible(address who, uint256 cap) external onlyOwner {
        require(_current.exists && _current.active, "Quiz inactive");
        require(ticket != address(0), "NO_TICKET");
        uint256 bal = IERC721(ticket).balanceOf(who);
        require(bal > 0, "NO_TICKETS");
        uint256 cnt = bal;
        if (cap != 0 && cnt > cap) cnt = cap;
        require(cnt <= MAX_ELIGIBILITY_PUSH, "CAP_TOO_LARGE");
        // mark submitted for this quiz
        if (lastSubmittedQuizId[who] != quizId) {
            lastSubmittedQuizId[who] = quizId;
        }
        // update stats
        stats[quizId].participants += cnt;
        stats[quizId].correct += cnt;
        // push eligibility entries (address-based pool)
        if (!_isEligible[who]) {
            _isEligible[who] = true; // also mark as eligible in address set
        }
        for (uint256 i = 0; i < cnt; i++) {
            _eligible.push(who);
        }
        emit AdminTicketsMarked(who, cnt);
    }

    function _clearEligibility() internal {
        for (uint256 i = 0; i < _eligible.length; i++) {
            _isEligible[_eligible[i]] = false;
        }
        delete _eligible;
        _lastWinners = [address(0), address(0), address(0)];
        _lastDrawSeed = bytes32(0);
    }

    // Request randomness; winners will be set in fulfillRandomWords
    function drawWinners() external onlyOwner {
        require(_current.exists, "No quiz");
        require(_eligible.length > 0, "No eligible players");
        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: keyHash,
            subId: subscriptionId,
            requestConfirmations: requestConfirmations,
            callbackGasLimit: callbackGasLimit,
            numWords: numWords,
            extraArgs: VRFV2PlusClient._argsToBytes(
                VRFV2PlusClient.ExtraArgsV1({nativePayment: true})
            )
        });
        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);
        _lastRequestId = requestId;
        emit VRFRequested(quizId, requestId);
    }

    function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
        // Use the first random word
        uint256 rand = randomWords[0];
        _lastDrawSeed = bytes32(rand);
        address[] memory pool = _eligible;
        uint256 n = pool.length;
        uint256 picks = n >= 3 ? 3 : n;
        address[3] memory winners;
        for (uint256 k = 0; k < picks; k++) {
            uint256 j = k + (rand % (n - k));
            (pool[k], pool[j]) = (pool[j], pool[k]);
            winners[k] = pool[k];
            rand = uint256(keccak256(abi.encodePacked(rand, k)));
        }
        _lastWinners = winners;
        emit WinnersDrawn(quizId, winners[0], winners[1], winners[2], _lastDrawSeed);
    }

    // Admin controls for VRF params
    function setVRFParams(address _coord, bytes32 _keyHash, uint256 _subId, uint32 _cbGas, uint16 _conf, uint32 _numWords) external onlyOwner {
        keyHash = _keyHash;
        subscriptionId = _subId;
        if (_cbGas != 0) callbackGasLimit = _cbGas;
        if (_conf != 0) requestConfirmations = _conf;
        if (_numWords != 0) numWords = _numWords;
    }

    function setTicket(address _ticket) external onlyOwner {
        require(_ticket != address(0), "TICKET_ZERO");
        ticket = _ticket;
    }

    // Views
    function hasQuiz() external view returns (bool) { return _current.exists; }

    function get()
        external
        view
        returns (
            string memory title,
            string memory question,
            string[] memory options,
            bool active
        )
    { return (_current.title, _current.question, _current.options, _current.active); }

    function correctIndex() external view returns (uint8) { return _current.correctIndex; }

    // Back-compat helper: whether caller has submitted for current quiz
    function hasSubmitted(address addr) external view returns (bool) {
        return lastSubmittedQuizId[addr] == quizId && _current.exists;
    }

    // Stats for current quiz
    function getStats() external view returns (uint256 participants, uint256 correct) {
        QuizStats memory s = stats[quizId];
        return (s.participants, s.correct);
    }

    function eligibleCount() external view returns (uint256) { return _eligible.length; }
    function isEligible(address a) external view returns (bool) { return _isEligible[a]; }
    function getLastWinners() external view returns (address w1, address w2, address w3, bytes32 seed) {
        return (_lastWinners[0], _lastWinners[1], _lastWinners[2], _lastDrawSeed);
    }

    // History
    function historyLength() external view returns (uint256) { return _history.length; }

    function getHistory(uint256 index)
        external
        view
        returns (
            uint256 id,
            string memory title,
            string memory question,
            string[] memory options,
            uint8 correctIdx,
            uint256 participants,
            uint256 correct,
            uint256 endedAt
        )
    {
        require(index < _history.length, "OOB");
        QuizSnapshot storage h = _history[index];
        return (h.id, h.title, h.question, h.options, h.correctIndex, h.participants, h.correct, h.endedAt);
    }
}
