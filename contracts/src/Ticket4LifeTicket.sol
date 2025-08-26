// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Ticket4LifeTicket is ERC721, Ownable, ReentrancyGuard {
    uint256 public constant MINT_PRICE = 0.002 ether;
    uint256 public nextId;

    address public treasury; // receives mint proceeds

    event Minted(address indexed to, uint256 indexed tokenId, uint256 price);

    constructor(address _owner, address _treasury) ERC721("Ticket4Life", "T4L") Ownable(_owner) {
        treasury = _treasury;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "ZERO_TREASURY");
        treasury = _treasury;
    }

    function mint() external payable nonReentrant {
        // Restriction: 1 ticket par wallet en même temps, sauf OWNER (admin) qui peut minter sans limite.
        if (msg.sender != owner()) {
            require(balanceOf(msg.sender) == 0, "ONE_PER_WALLET");
        }
        require(msg.value == MINT_PRICE, "BAD_PRICE");
        uint256 tokenId = ++nextId;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, msg.value);
        if (treasury != address(0)) {
            (bool ok, ) = payable(treasury).call{value: msg.value}("");
            require(ok, "TREASURY_TRANSFER_FAIL");
        }
    }
}
