pragma solidity ^0.4.18;

import "./IcoPoolPartyBase.sol";
import "./interfaces/ITokenMarketCrowdSale.sol";

contract TokenMarketPoolParty is IcoPoolPartyBase {

    string public poolPartyName = "TokenMarket Pool Party";

    ITokenMarketCrowdSale public icoSaleAddress;

    function TokenMarketPoolParty(
        uint256 _waterMark,
        uint256 _groupTokenPrice,
        address _icoSaleAddress,
        address _icoTokenAddress
    )
    public
    IcoPoolPartyBase(
        _waterMark,
        _groupTokenPrice,
        _icoTokenAddress
    )
    {
        icoSaleAddress = ITokenMarketCrowdSale(_icoSaleAddress);
    }

    function releaseFundsToSale() public payable {
        var (_amountToRelease, _expectedTokenBalance, _feeAmount) = calculatePreReleaseValues();
        //Release funds to sale contract
        //icoSaleAddress.call(bytes4(sha3("invest(string)")), _stringValue);
        //assert(icoSaleAddress.value(_amountToRelease).buy());
        assert(icoSaleAddress.call.gas(300000).value(_amountToRelease)(bytes4(keccak256("buy()"))));

        uint256 actualTokenBalance = icoSaleAddress.tokenAmountOf(address(this));
        assert(_expectedTokenBalance == actualTokenBalance);
        assert(this.balance >= _feeAmount);

        totalTokensReceived = icoTokenAddress.balanceOf(address(this));
        //Ensure we have received, and have ownership of the tokens
        assert(totalTokensReceived > 0);

        //Transfer the fee¬
        assert(owner.call.value(_feeAmount)());
        //???assert(owner.call.gas(100000).value(this.balance)());

        contractStatus = Status.ClaimTokens;
        TokensBought(totalCurrentInvestments, msg.value, icoSaleAddress, now);
    }

    //Token Market mint and distribute tokens as soon as they are bought - so no need to claim then in a separate step

    /*
	 * INTEGRATION POINT WITH SALE CONTRACT
	 * @notice In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for investors to claim their refund
	 * @dev Integration with Token Sale contract - get a refund of all funds submitted
     */
    function claimRefundFromIco() public {
        contractStatus = Status.Refunding;
        icoSaleAddress.refund();
        //require(this.balance == totalCurrentInvestments);
        ClaimedRefundFromIco(address(this), now);
    }
}
