// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract Treasury is Ownable, ReentrancyGuard {
    // Pools
    uint256 public salePool;   // commissions marketplace
    uint256 public prizePool;  // prize distribution
    uint256 public buybackPool;// buyback liquidity

    event Received(address indexed from, uint256 amount);
    event PoolMoved(string indexed pool, int256 amount);

    constructor(address _owner) Ownable(_owner) {}

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function depositToPrize() external payable {
        prizePool += msg.value;
        emit PoolMoved("prize", int256(uint256(msg.value)));
    }

    function depositToSale() external payable {
        salePool += msg.value;
        emit PoolMoved("sale", int256(uint256(msg.value)));
    }

    function depositToBuyback() external payable {
        buybackPool += msg.value;
        emit PoolMoved("buyback", int256(uint256(msg.value)));
    }

    function spendPrize(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(prizePool >= amount, "INSUFFICIENT_PRIZE");
        prizePool -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "PRIZE_SEND_FAIL");
    }

    function spendSale(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(salePool >= amount, "INSUFFICIENT_SALE");
        salePool -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "SALE_SEND_FAIL");
    }

    function spendBuyback(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(buybackPool >= amount, "INSUFFICIENT_BUYBACK");
        buybackPool -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "BUYBACK_SEND_FAIL");
    }

    /**
     * @notice Atomic admin buy of a marketplace listing using buyback pool funds.
     *         This contract pays the listing price from its balance (debited from buybackPool),
     *         receives the NFT, then transfers it to the desired recipient `to`.
     * @param market Marketplace contract address
     * @param nft NFT contract address
     * @param tokenId Token ID listed on the marketplace
     * @param seller Expected seller (to compute the listing id on-marketplace)
     * @param to Final recipient of the NFT after purchase (admin wallet)
     * @param price Listing price (wei) to pay
     */
    function buyFromMarketplace(
        address market,
        address nft,
        uint256 tokenId,
        address seller,
        address to,
        uint256 price
    ) external onlyOwner nonReentrant {
        require(price > 0, "PRICE_0");
        require(buybackPool >= price, "INSUFFICIENT_BUYBACK");
        // debit pool first (accounting) then perform external call
        buybackPool -= price;
        // call Marketplace.buy(nft, tokenId, seller) with ETH from treasury balance
        (bool ok, ) = market.call{ value: price }(
            abi.encodeWithSignature("buy(address,uint256,address)", nft, tokenId, seller)
        );
        require(ok, "MARKET_BUY_FAIL");
        // Ensure NFT custody is held by Treasury before forwarding
        require(IERC721(nft).ownerOf(tokenId) == address(this), "NFT_NOT_RECEIVED");
        // transfer NFT custody from Treasury to admin recipient (safer)
        IERC721(nft).safeTransferFrom(address(this), to, tokenId);
    }
}
