pragma solidity ^0.4.18;

import "./ForegroundPoolParty.sol";
import "./TokenMarketPoolParty.sol";

contract IcoPoolPartyFactory is Ownable {

	uint256 public feePercentage;
	uint256 public withdrawalFee;

    address[] public partyList;
    mapping(address => PoolParty) public poolParties;

    struct PoolParty {
        PoolPartyType partyType;
    }

    enum PoolPartyType {None, Foreground, TokenMarket, OpenZeppelin}

	event NewPoolParty(PoolPartyType poolPartyType, address saleAddress, address tokenAddress, uint256 date);

	function IcoPoolPartyFactory() public {
		feePercentage = 5;
		withdrawalFee = 0.0015 ether;
	}

	function createNewPoolParty(
		PoolPartyType _partyType,
        uint256 _waterMark,
        uint256 _groupTokenPrice,
        address _tokenSaleAddress,
		address _tokenAddress
	)
		public
	{
        address _createdAddress;
		if (_partyType == PoolPartyType.Foreground) {
			ForegroundPoolParty foregroundPoolParty = new ForegroundPoolParty(_waterMark, _groupTokenPrice, _tokenSaleAddress, _tokenAddress);
            foregroundPoolParty.transferOwnership(msg.sender);
            _createdAddress = address(foregroundPoolParty);
            poolParties[_createdAddress].partyType = PoolPartyType.Foreground;
		} else if (_partyType == PoolPartyType.TokenMarket) {
            TokenMarketPoolParty tokenMarketPoolParty = new TokenMarketPoolParty(_waterMark, _groupTokenPrice, _tokenSaleAddress, _tokenAddress);
            tokenMarketPoolParty.transferOwnership(msg.sender);
            _createdAddress = address(tokenMarketPoolParty);
            poolParties[_createdAddress].partyType = PoolPartyType.TokenMarket;
        }

        partyList.push(_createdAddress);
        NewPoolParty(_partyType, _tokenSaleAddress, _tokenAddress, now);
    }

	function setFeePercentage(uint256 _feePercentage) public onlyOwner {
		feePercentage = _feePercentage;
	}

	function setWithdrawalFee(uint256 _withdrawalFee) public onlyOwner {
		withdrawalFee = _withdrawalFee;
	}
}
