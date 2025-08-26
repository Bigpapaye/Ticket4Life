// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ITreasuryV2 {
    function depositToSale() external payable;
}

interface ITicketLike {
    function balanceOf(address) external view returns (uint256);
}

/**
 * MarketplaceV2
 * - Escrow NFT on list (transferFrom seller -> this)
 * - Buy enforces: listing active, correct price, buyer != seller, buyer has no ticket, treasury set
 * - Fee: 10% to Treasury.salePool via depositToSale(), 90% payout to seller
 * - NonReentrant
 * - Restricts listings to a single collection `ticket`
 */
contract MarketplaceV2 is Ownable, ReentrancyGuard {
    struct Listing { address seller; address nft; uint256 tokenId; uint256 price; bool active; }

    uint256 public constant FEE_BPS = 1000; // 10%
    address public immutable ticket; // allowed NFT collection
    address public treasury; // receives fees (sale pool)

    mapping(bytes32 => Listing) public listings;

    event Listed(bytes32 id, address indexed seller, address indexed nft, uint256 tokenId, uint256 price);
    event Cancelled(bytes32 id);
    event Bought(
        bytes32 id,
        address indexed buyer,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 price
    );
    event SaleSettled(
        bytes32 id,
        address indexed buyer,
        address indexed seller,
        address indexed nft,
        uint256 tokenId,
        uint256 price,
        uint256 fee,
        uint256 payout
    );

    constructor(address _owner, address _treasury, address _ticket) Ownable(_owner) {
        require(_treasury != address(0), "TREASURY_0");
        require(_ticket != address(0), "TICKET_0");
        treasury = _treasury;
        ticket = _ticket;
    }

    function setTreasury(address _treasury) external onlyOwner { require(_treasury != address(0), "TREASURY_0"); treasury = _treasury; }

    function _lid(address nft, uint256 tokenId, address seller) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(nft, tokenId, seller));
    }

    function list(address nft, uint256 tokenId, uint256 price) external nonReentrant {
        require(nft == ticket, "BAD_NFT");
        require(price > 0, "BAD_PRICE");
        // Escrow NFT into marketplace
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        bytes32 id = _lid(nft, tokenId, msg.sender);
        listings[id] = Listing({ seller: msg.sender, nft: nft, tokenId: tokenId, price: price, active: true });
        emit Listed(id, msg.sender, nft, tokenId, price);
    }

    function cancel(address nft, uint256 tokenId) external nonReentrant {
        bytes32 id = _lid(nft, tokenId, msg.sender);
        Listing storage l = listings[id];
        require(l.active && l.seller == msg.sender, "NOT_OWNER_OR_INACTIVE");
        l.active = false;
        IERC721(l.nft).safeTransferFrom(address(this), l.seller, l.tokenId);
        emit Cancelled(id);
    }

    function buy(address nft, uint256 tokenId, address seller) external payable nonReentrant {
        bytes32 id = _lid(nft, tokenId, seller);
        Listing storage l = listings[id];
        require(l.active, "NOT_ACTIVE");
        require(nft == ticket, "BAD_NFT");
        require(msg.value == l.price, "BAD_PRICE");
        require(treasury != address(0), "TREASURY_NOT_SET");
        require(msg.sender != l.seller, "SELF_BUY");
        // Enforce one ticket per wallet at buy time
        require(ITicketLike(ticket).balanceOf(msg.sender) == 0, "ONE_PER_WALLET");

        l.active = false;
        uint256 fee = (msg.value * FEE_BPS) / 10_000; // 10%
        uint256 payout = msg.value - fee;
        // send fee to treasury.salePool via depositToSale()
        if (fee > 0) {
            ITreasuryV2(treasury).depositToSale{value: fee}();
        }
        (bool ok2, ) = payable(l.seller).call{value: payout}("");
        require(ok2, "SELLER_PAYOUT_FAIL");
        IERC721(l.nft).safeTransferFrom(address(this), msg.sender, l.tokenId);
        emit Bought(id, msg.sender, l.seller, l.nft, l.tokenId, msg.value);
        emit SaleSettled(id, msg.sender, l.seller, l.nft, l.tokenId, msg.value, fee, payout);
    }
}
