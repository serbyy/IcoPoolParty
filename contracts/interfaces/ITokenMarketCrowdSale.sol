pragma solidity ^0.4.18;

contract ITokenMarketCrowdSale {
	uint public tokensSold = 0;
	mapping (address => uint256) public tokenAmountOf;

	function refund() public;
	function buy() public payable;
}
