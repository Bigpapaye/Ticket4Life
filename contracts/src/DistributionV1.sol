// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DistributionV1 is Ownable, ReentrancyGuard {
    address public treasury;
    // percentages in basis points: 7000, 2000, 1000
    uint256 public constant P1_BPS = 7000;
    uint256 public constant P2_BPS = 2000;
    uint256 public constant P3_BPS = 1000;

    event Distributed(address w1, uint256 a1, address w2, uint256 a2, address w3, uint256 a3, bytes32 seed, uint256 total);

    constructor(address _owner, address _treasury) Ownable(_owner) {
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner { treasury = _treasury; }

    function distribute(address payable w1, address payable w2, address payable w3, bytes32 seed) external payable onlyOwner nonReentrant {
        // msg.value is the total distribution amount pulled from prize pool off-chain for V1
        require(msg.value > 0, "NO_FUNDS");
        require(w1 != address(0) && w2 != address(0) && w3 != address(0), "ZERO_WINNER");
        uint256 total = msg.value;
        uint256 a1 = (total * P1_BPS) / 10_000;
        uint256 a2 = (total * P2_BPS) / 10_000;
        uint256 a3 = total - a1 - a2;
        (bool ok1,) = w1.call{value: a1}(""); require(ok1, "W1_FAIL");
        (bool ok2,) = w2.call{value: a2}(""); require(ok2, "W2_FAIL");
        (bool ok3,) = w3.call{value: a3}(""); require(ok3, "W3_FAIL");
        emit Distributed(w1, a1, w2, a2, w3, a3, seed, total);
    }

    receive() external payable {}
}
