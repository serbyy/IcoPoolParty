pragma solidity ^0.4.18;

import "./IcoPoolPartyParent.sol";
import "./interfaces/IForegroundTokenSale.sol";

contract ForegroundPoolParty is IcoPoolPartyParent {

	string public poolPartyName = "Foreground Pool Party";

	IForegroundTokenSale public icoSaleAddress;

	function ForegroundPoolParty (
		uint256 _waterMark,
		uint256 _groupTokenPrice,
        address _icoSaleAddress,
		address _icoTokenAddress
	)
        public
        IcoPoolPartyParent(
            _waterMark,
            _groupTokenPrice,
            _icoTokenAddress
        )
	{
		icoSaleAddress = IForegroundTokenSale(_icoSaleAddress);
	}

	/**
     * @notice Once the watermark has been reached and the participants approved, the pool funds can be released to the Sale contract in exchange for tokens
     * @dev Subsidy amount is validated by checking to see if we will receive the correct number of tokens based on the configured parameters
     *      address.call is used to get around the fact that the minimum gas amount is sent with a .send or .transfer - this call needs more than the minimum
     */
	function releaseFundsToSale() public payable {
		require(contractStatus == Status.Approved);
		require(totalCurrentInvestments >= waterMark);
		require(msg.value > 0);

		uint256 _expectedTokenBalance = totalCurrentInvestments.div(groupTokenPrice);
		uint256 _feeAmount = totalCurrentInvestments.mul(FEE_PERCENTAGE).div(100);

		//TODO: Check for re-entrancy
		uint256 _amountToRelease = totalCurrentInvestments.add(msg.value.sub(_feeAmount));

		//Release funds to sale contract
		assert(address(icoSaleAddress).call.gas(300000).value(_amountToRelease)());

		var (actualTokenBalance,) = icoSaleAddress.purchases(address(this));
		assert(_expectedTokenBalance == actualTokenBalance);
		assert(this.balance >= _feeAmount);

		//Transfer the fee
		assert(owner.call.value(_feeAmount)());
		//???assert(owner.call.gas(100000).value(this.balance)());

		contractStatus = Status.ClaimTokens;
		TokensBought(totalCurrentInvestments, msg.value, icoSaleAddress, now);
	}


	/*
     * INTEGRATION POINT WITH SALE CONTRACT
     * @notice Once token are released by ICO, claim tokens. Tokens are released to this contract - called once by anyone
     * @dev Integration with Token Sale contract - claim tokens
     */
	function claimTokensFromIco() public {
		icoSaleAddress.claimToken();
		totalTokensReceived = icoTokenAddress.balanceOf(address(this));
		//Ensure we have received, and have ownership of the tokens
		require(totalTokensReceived > 0);

		ClaimedTokensFromIco(address(this), totalTokensReceived, now);
	}

	/*
	 * INTEGRATION POINT WITH SALE CONTRACT
	 * @notice In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for investors to claim their refund
	 * @dev Integration with Token Sale contract - get a refund of all funds submitted
     */
	function claimRefundFromIco() public {
		contractStatus = Status.Refunding;
		icoSaleAddress.claimRefund();
		//require(this.balance == totalCurrentInvestments);
		ClaimedRefundFromIco(address(this), now);
	}
}
