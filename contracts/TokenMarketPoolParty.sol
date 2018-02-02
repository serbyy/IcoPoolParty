pragma solidity ^0.4.18;

import "./IcoPoolPartyParent.sol";
import "./interfaces/ITokenMarketCrowdSale.sol";

contract TokenMarketPoolParty is IcoPoolPartyParent {

    string public poolPartyName = "TokenMarket Pool Party";

    ITokenMarketCrowdSale public icoSaleAddress;

    function TokenMarketPoolParty(
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
        icoSaleAddress = ITokenMarketCrowdSale(_icoSaleAddress);
    }

    function releaseFundsToSale() public payable {
        TokensBought(totalCurrentInvestments, msg.value, icoSaleAddress, now);
    }

    /*
     * INTEGRATION POINT WITH SALE CONTRACT
     * @notice Once token are released by ICO, claim tokens. Tokens are released to this contract - called once by anyone
     * @dev Integration with Token Sale contract - claim tokens
     */
    function claimTokensFromIco() public {
        totalTokensReceived = 0;
        ClaimedTokensFromIco(address(this), totalTokensReceived, now);
    }

    /*
	 * INTEGRATION POINT WITH SALE CONTRACT
	 * @notice In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for investors to claim their refund
	 * @dev Integration with Token Sale contract - get a refund of all funds submitted
     */
    function claimRefundFromIco() public {
        ClaimedRefundFromIco(address(this), now);
    }
}
