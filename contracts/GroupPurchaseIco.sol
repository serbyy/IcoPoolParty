pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract GroupPurchaseIco is Ownable, Pausable {
	using SafeMath for uint256;

	uint256 public waterMark;
	uint256 public totalCurrentInvestments;
	uint256 public groupTokenPrice;
	uint256 public directTokenPrice;
	uint256 public subsidy;

	address public icoSaleAddress;
	address public icoTokenAddress;

	Status public contractStatus;

	uint256 feePercentage;

	mapping(address => uint256) public investments;

	enum Status { Open, InReview, Approved, ClaimTokens }

	function GroupPurchaseIco(
		uint256 _waterMark,
		uint256 _groupTokenPrice,
		uint256 _directTokenPrice,
		uint256 _feePercentage,
		address _icoSaleAddress,
		address _icoTokenAddress
	) public
	{
		waterMark = _waterMark;
		groupTokenPrice = _groupTokenPrice;
		directTokenPrice = _directTokenPrice;
		feePercentage = _feePercentage;
		icoSaleAddress = _icoSaleAddress;
		icoTokenAddress = _icoTokenAddress;

		subsidy = directTokenPrice.sub(groupTokenPrice);
		require(subsidy > 0);
	}

	/* Can only contribute during open status */
	function addFundsToPool() public payable {
		require(contractStatus == Status.Open);

		uint256 _amountInvested = msg.value;
		investments[msg.sender] = investments[msg.sender].add(_amountInvested);
		totalCurrentInvestments = totalCurrentInvestments.add(_amountInvested);
	}

	/* Can call anytime without penalty */
	function withdrawFundsFromPool() public {
		uint256 _amountToRefund = investments[msg.sender];
		investments[msg.sender] = 0;
		msg.sender.transfer(_amountToRefund);
	}

	/* Release balance of contract to the ICO */
	function releaseFundsToIco() public payable {
		require (contractStatus == Status.Approved);
		contractStatus = Status.ClaimTokens;

	}

	/* Allows investors to withdraw tokens once they have been released by ICO */
	function withDrawTokens() public {
		//icoTokenAddress.transferFrom();
	}

	/* Once token are released by ICO, claim tokens. Tokens are released to this contract */
	function claimTokensFromIco() public {

	}

	/* If sale is unsuccessful even with pool amount, withdraw funds from ICO back to this contract */
	function claimRefundFromIco() public {
		//Change state to Status.open so that investors can withdraw
	}
}
