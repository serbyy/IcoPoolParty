pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./interfaces/IErc20Token.sol";
import "./interfaces/IForegroundTokenSale.sol";

/**
 * @author Shane van Coller 1/24/2018
 * @title Group Purchase for ICO contract
 */
contract IcoPoolParty is Ownable, Pausable {
	using SafeMath for uint256;

	uint256 public waterMark;
	uint256 public totalCurrentInvestments;
	uint256 public groupTokenPrice;
	uint256 public totalTokensReceived;

	/* Token Sale specific variables */
	IForegroundTokenSale public icoSaleAddress;
	IErc20Token public icoTokenAddress;

	Status public contractStatus;

	uint256 constant FEE_PERCENTAGE = 5;
	uint256 constant WITHDRAWAL_FEE = 0.0015 ether;

	mapping(address => uint256) public investments;

	enum Status {Open, InReview, Approved, Refunding, ClaimTokens}

	event FundsAdded(address indexed investor, uint256 amount, uint256 date);
	event FundsWithdrawn(address indexed investor, uint256 amount, uint256 date);
	event InvestorEjected(address indexed investor, uint256 fee, uint256 amount, uint256 date);
	event TokensTransferred(address indexed investor, uint256 investmentAmount, uint256 tokensTransferred, uint256 date);
	event TokensBought(uint256 totalInvestmentAmount, uint256 subsidyAmount, address tokenSaleAddress, uint256 date);

	event ClaimedTokensFromIco(address indexed owner, uint256 tokenBalance, uint256 date);
	event ClaimedRefundFromIco(address indexed owner, uint256 date);

	/**
	 * @notice Check to see if water mark has been exceeded
	 */
	modifier assessWaterMark {
		// If total investment is below the watermark, reopen the pool
		if (totalCurrentInvestments < waterMark) {
			contractStatus = Status.Open;
		}
		_;
	}

	/**
	 * @notice Constructor accepting initial values for the contract
	 * @param _waterMark Minimum value contract should reach before funds released to ICO
	 * @param _groupTokenPrice Discounted price per token
	 * @param _icoSaleAddress Address of the token sale -> used to buy the tokens
	 * @param _icoTokenAddress Address of the token being sold -> used to transfer tokens to investors once received
	 */
	function IcoPoolParty(
		uint256 _waterMark,
		uint256 _groupTokenPrice,
		IForegroundTokenSale _icoSaleAddress,
		IErc20Token _icoTokenAddress
	)
		public
	{
		waterMark = _waterMark;
		groupTokenPrice = _groupTokenPrice;
		icoSaleAddress = _icoSaleAddress;
		icoTokenAddress = _icoTokenAddress;
	}

	/**
	 * @notice Default fallback function, reverts if called
	 */
	function() public payable {
		revert();
	}

	/**
	 * @notice Add funds to the group purchases pool
	 * @dev Contract status needs to be 'Open' in order to contribute additional funds
	 */
	function addFundsToPool()
		public
		assessWaterMark
		payable
	{
		require(contractStatus == Status.Open);

		uint256 _amountInvested = msg.value;
		investments[msg.sender] = investments[msg.sender].add(_amountInvested);
		totalCurrentInvestments = totalCurrentInvestments.add(_amountInvested);

		FundsAdded(msg.sender, msg.value, now);
	}

	/**
	 * @notice Can withdraw funds from the group purchase pool at any time
	 * @dev There is no penalty for user withdrawing their contribution - only pay the gas fee for the transaction
	 */
	function withdrawFundsFromPool()
		public
		assessWaterMark
	{
		uint256 _amountToRefund = investments[msg.sender];
		investments[msg.sender] = 0;
		totalCurrentInvestments = totalCurrentInvestments.sub(_amountToRefund);
		msg.sender.transfer(_amountToRefund);

		FundsWithdrawn(msg.sender, _amountToRefund, now);
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

	/**
	 * @notice Allows participants to claim tokens once they have been received from the token sale
	 * @dev Tokens are distributed proportionately to how much they contributed
	 */
	function claimTokens() public {
		require(contractStatus == Status.ClaimTokens);
		require(investments[msg.sender] > 0);
		require(totalTokensReceived > 0);

		uint256 _totalContribution = investments[msg.sender];
		investments[msg.sender] = 0;

		uint256 _tokensDue = getUserTokensDueForAmount(_totalContribution);

		icoTokenAddress.transfer(msg.sender, _tokensDue);

		TokensTransferred(msg.sender, _totalContribution, _tokensDue, now);
	}

	/**
	 * @notice Allows anyone to query the number of tokens due for a given address
	 * @dev Returns 0 unless the tokens have been released by the sale contract (totalTokensReceived > 0)
	 * @param _user The user address of the account to look up
	 */
	function getTotalTokensDue(address _user)
		public
		view
		returns (uint256)
	{
		uint256 _tokensDue = 0;
		if (totalTokensReceived > 0) {
			_tokensDue = getUserTokensDueForAmount(investments[_user]);
		}
		return _tokensDue;
	}

	/**
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

	/**
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

	/**
	 * @notice Prevent any new funds being added to the pool - withdrawals are still allowed
	 * @dev Contract state is moved into 'InReview' for KYC compliance check.
	 */
	function updateState(Status _state)
		public
		onlyOwner
	{
		contractStatus = _state;
	}

	/**
	 * @notice Allows owners to remove investors who do not comply with KYC
	 * @dev A small fee is charged to the person being ejected from the pool (only enough to cover gas costs of the transaction) but only if the invested amount is greater than the fee.
	 * @param _ejectedInvestor Address of the person to eject from the pool.
	 */
	function ejectInvestor(address _ejectedInvestor)
		public
		onlyOwner
	{
		uint256 _amountToRefund = investments[_ejectedInvestor];
		require(_amountToRefund > 0);
		investments[_ejectedInvestor] = 0;
		totalCurrentInvestments = totalCurrentInvestments.sub(_amountToRefund);
		uint256 _fee = 0;
		if (_amountToRefund >= WITHDRAWAL_FEE) {
			_fee = WITHDRAWAL_FEE;
			//0.0015eth fee to cover gas costs for being kicked - taken from investor
			owner.transfer(WITHDRAWAL_FEE);
		}
		_ejectedInvestor.transfer(_amountToRefund.sub(_fee));

		InvestorEjected(_ejectedInvestor, _fee, _amountToRefund.sub(_fee), now);
	}

	/**
     * @notice Private function that returns the number of tokens due based on the user and account balance
     * @dev Reusable function that helps prevent re-entracy - see claimTokens()
     * @param _userInvestmentAmount The investment amount used to calculate the tokens due
     */
	function getUserTokensDueForAmount(uint256 _userInvestmentAmount)
		private
		view
		returns (uint256)
	{
		uint256 _contributionPercentage = _userInvestmentAmount.mul(100).div(totalCurrentInvestments);
		return totalTokensReceived.mul(_contributionPercentage).div(100);
	}

}
