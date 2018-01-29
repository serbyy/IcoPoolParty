pragma solidity ^0.4.18;

import "./IErc20Token.sol";

contract IForegroundTokenSale {
	IErc20Token public dealToken;
	mapping (address => PurchaseDetails) public purchases;

	struct PurchaseDetails {
		uint256 tokenBalance;
		uint256 weiBalance;
	}

	function claimToken() public;
	function claimRefund() public;
	function () public payable;

}
