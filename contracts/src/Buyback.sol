// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Buyback is Ownable, ReentrancyGuard {
    address public immutable nft;
    address public treasury; // pays from buyback pool externally funded
    uint256 public priceWei;  // 90% of mint price (configurable)

    event BuybackExecuted(address indexed seller, uint256 tokenId, uint256 paidWei);
    event NftWithdrawn(address indexed to, uint256 tokenId);

    constructor(address _owner, address _nft, address _treasury, uint256 _priceWei) Ownable(_owner) {
        nft = _nft;
        treasury = _treasury;
        priceWei = _priceWei; // e.g., 0.0009 ether
    }

    function setPrice(uint256 _priceWei) external onlyOwner { priceWei = _priceWei; }
    function setTreasury(address _treasury) external onlyOwner { treasury = _treasury; }

    function sell(uint256 tokenId) external nonReentrant {
        require(priceWei > 0, "PRICE_0");
        require(address(this).balance >= priceWei, "INSUFFICIENT_BUYBACK_LIQ");
        // transfer NFT to this contract
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        // pay seller from contract balance
        (bool ok,) = payable(msg.sender).call{value: priceWei}("");
        require(ok, "PAYOUT_FAIL");
        emit BuybackExecuted(msg.sender, tokenId, priceWei);
    }

    function withdrawNFT(uint256 tokenId, address to) external onlyOwner nonReentrant {
        IERC721(nft).safeTransferFrom(address(this), to, tokenId);
        emit NftWithdrawn(to, tokenId);
    }

    // allow funding via plain transfers
    receive() external payable {}
}
