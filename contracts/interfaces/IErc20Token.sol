pragma solidity ^0.4.18;

/* https://github.com/TokenMarketNet/ico/blob/master/contracts/CrowdsaleBase.sol */
/* https://github.com/TokenMarketNet/ico/blob/master/contracts/Crowdsale.sol */
contract IErc20Token {
	function transfer(address _to, uint256 _value) public returns (bool);
	function balanceOf(address _owner) public constant returns (uint256 balance);
}
