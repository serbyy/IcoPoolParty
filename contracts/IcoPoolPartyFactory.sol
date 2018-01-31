pragma solidity ^0.4.18;

import "./IcoPoolParty.sol";

contract IcoPoolPartyFactory is Ownable {

	address[] public partyList;
	uint256 public feePercentage;
	uint256 public withdrawalFee;

	enum PoolPartyType {None, Foreground, TokenMarket, OpenZepplin}

	event NewPoolParty(PoolPartyType poolPartyType, address saleAddress, address, tokenAddress, uint256 date);

	function IcoPoolPartyFactory() {
		feePercentage = 5;
		withdrawalFee = 0.0015 ether;
	}

	function createNewPoolParty(
		PoolPartyType _partyType,
		address _tokenSaleAddress,
		address _tokenAddress,
		uint256 _waterMark,
		uint256 _groupTokenPrice
	)
		public
	{
		IcoPoolParty icoPoolParty;

		if (_partyType == PoolPartyType.Foreground) {
			icoPoolParty = new ForegroundPoolParty(_waterMark, _groupTokenPrice, _tokenSaleAddress, _tokenAddress);
		} else if (_partyType == PoolPartyType.TokenMarket) {
			icoPoolParty = new TokenMarketPoolParty(_waterMark, _groupTokenPrice, _tokenSaleAddress, _tokenAddress);
		} else if (_partyType == PoolPartyType.OpenZepplin) {
			icoPoolParty = new OpenZepplinPoolParty(_waterMark, _groupTokenPrice, _tokenSaleAddress, _tokenAddress);
		}

		partyList.push(address(icoPoolParty));
		NewPoolParty(_partyType, _tokenSaleAddress, _tokenAddress, now);
	}

	function setFeePercentage(uint256 _feePercentage) public onlyOwner {
		feePercentage = _feePercentage;
	}

	function setWithdrawalFee(uint256 _withdrawalFee) public onlyOwner {
		withdrawalFee = _withdrawalFee;
	}
}
