pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./interfaces/IErc20Token.sol";

contract IcoPoolParty is Ownable {
    using SafeMath for uint256;

    bytes32 public icoUrl;
    bytes32 public buyFunctionName;
    bytes32 public refundFunctionName;
    bytes32 public claimFunctionName;

    uint256 public waterMark;
    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public groupDiscountPercent;
    uint256 public totalPoolInvestments;
    uint256 public totalTokensReceived;

    address public saleAddress;
    address public saleContractOwner;
    address public poolPartyOwnerAddress;

    address serviceAccount;

    mapping(address => uint256) public investments;

    IErc20Token public tokenAddress;

    Status public contractStatus;

    enum Status {Open, InReview, Approved, Refunding, ClaimTokens, WaterMarkReached}

    event SaleDetailsConfigured(address configurer, uint256 date);
    event FundsAdded(address indexed investor, uint256 amount, uint256 date);
    event FundsWithdrawn(address indexed investor, uint256 amount, uint256 date);
    event FundReleasedToIco(uint256 totalInvestmentAmount, uint256 subsidyAmount, uint256 feeAmount,  address tokenSaleAddress, uint256 date);
    event TokensClaimed(address indexed investor, uint256 investmentAmount, uint256 tokensTransferred, uint256 date);
    event InvestorEjected(address indexed investor, uint256 fee, uint256 amount, uint256 date);

    event ClaimedTokensFromIco(address indexed owner, uint256 tokenBalance, uint256 date);
    event ClaimedRefundFromIco(address indexed owner, uint256 date);

    /**
     * @notice Only our backend service account can update
     */
    modifier onlyServiceAccount() {
        require(msg.sender == serviceAccount);
        _;
    }

    /**
     * @notice Check to see if water mark has been exceeded
     */
    modifier assessWaterMark {
        // If total investment is below the watermark, reopen the pool
        if (totalPoolInvestments < waterMark) {
            contractStatus = Status.Open;
        }
        _;
    }

    function IcoPoolParty(
        bytes32 _icoUrl,
        uint256 _waterMark,
        uint256 _feePercentage,
        uint256 _withdrawalFee,
        uint256 _groupDiscountPercent,
        address _poolPartyOwnerAddress,
        address _serviceAccount
    )
        public
    {
        icoUrl = _icoUrl;
        waterMark = _waterMark;
        feePercentage = _feePercentage;
        withdrawalFee = _withdrawalFee;
        groupDiscountPercent = _groupDiscountPercent;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        serviceAccount = _serviceAccount;
    }

    /**
     * @notice Default fallback function, reverts if called
     */
    function () public payable {
        revert();
    }

    /**
     * @dev Sale address will be set by backend service once address is has been made available by ICO in their official page. Address is received by making service call to URL
     */
    function setSaleDetails(
        address _saleAddress,
        address _tokenAddress,
        address _saleOwnerAddress,
        bytes32 _buyFunction,
        bytes32 _refundFunction,
        bytes32 _claimFunction
    )
        public
        onlyServiceAccount
    {
        require(_saleAddress != 0x0 && _tokenAddress != 0x0 && _saleOwnerAddress != 0x0);
        require(_refundFunction.length != 0);
        require(_claimFunction.length != 0);
        //TODO: what do we do when any of the functions take parameters?
        saleAddress = _saleAddress;
        tokenAddress = IErc20Token(_tokenAddress);
        saleContractOwner = _saleOwnerAddress;
        buyFunctionName = _buyFunction;
        refundFunctionName = _refundFunction;
        claimFunctionName = _claimFunction;

        SaleDetailsConfigured(msg.sender, now);
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
        totalPoolInvestments = totalPoolInvestments.add(_amountInvested);

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
        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);
        msg.sender.transfer(_amountToRefund);

        FundsWithdrawn(msg.sender, _amountToRefund, now);
    }

    /**
     * @notice Once the watermark has been reached and the participants approved, the pool funds can be released to the Sale contract in exchange for tokens
     * @dev Subsidy amount is validated by checking to see if we will receive the correct number of tokens based on the configured parameters
     *      address.call is used to get around the fact that the minimum gas amount is sent with a .send or .transfer - this call needs more than the minimum
     */
    function releaseFundsToSale() public payable {
        require(msg.sender == saleContractOwner);
        require(contractStatus == Status.Approved);
        require(totalPoolInvestments >= waterMark);
        require(msg.value > 0);

        uint256 _feeAmount = totalPoolInvestments.mul(feePercentage).div(100);

        uint256 _groupContributionPercent = uint256(100).sub(groupDiscountPercent);
        //TODO: Check for re-rentrancy
        uint256 _amountToRelease = totalPoolInvestments.div(_groupContributionPercent).mul(100);

        uint256 _actualSubsidy = _amountToRelease.sub(totalPoolInvestments);
        uint256 _expectedSubsidyWithFee = _actualSubsidy.add(_feeAmount);
        assert(_expectedSubsidyWithFee == msg.value);

        //Release funds to sale contract
        if (buyFunctionName.length == 0) { //Call fallback function
            assert(saleAddress.call.gas(300000).value(_amountToRelease)());
        } else { //Call function specified during creation
            assert(saleAddress.call.gas(300000).value(_amountToRelease)(bytes4(keccak256(buyFunctionName))));
        }

        //If there is no claim function then assume tokens are minted at time they are bought (for example TokenMarketCrowdSale)
        if (claimFunctionName.length == 0) {
            totalTokensReceived = tokenAddress.balanceOf(address(this));
            assert(totalTokensReceived > 0);
            contractStatus = Status.ClaimTokens;
            ClaimedTokensFromIco(address(this), totalTokensReceived, now);
        }

        assert(this.balance >= _feeAmount);

        //Transfer the fee
        assert(poolPartyOwnerAddress.call.value(_feeAmount)());

        contractStatus = Status.ClaimTokens;
        FundReleasedToIco(totalPoolInvestments, _actualSubsidy, _feeAmount, saleAddress, now);
    }

    /*
	 * INTEGRATION POINT WITH SALE CONTRACT
	 * @notice In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for investors to claim their refund
	 * @dev Integration with Token Sale contract - get a refund of all funds submitted
     */
    function claimRefundFromIco() public {
        contractStatus = Status.Refunding;
        assert(saleAddress.call(bytes4(keccak256(refundFunctionName))));
        ClaimedRefundFromIco(address(this), now);
    }

    /*
     * INTEGRATION POINT WITH SALE CONTRACT
     * @notice If tokens are not minted by ICO at time of purchase, they need to be claimed once the sale is over. Tokens are released to this contract - called once by anyone
     * @dev Integration with Token Sale contract - claim tokens
     */
    function claimTokensFromIco() public {
        require(claimFunctionName.length > 0);
        assert(saleAddress.call(bytes4(keccak256(claimFunctionName))));
        totalTokensReceived = tokenAddress.balanceOf(address(this));
        //Ensure we have received, and have ownership of the tokens
        assert(totalTokensReceived > 0);

        ClaimedTokensFromIco(address(this), totalTokensReceived, now);
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

        tokenAddress.transfer(msg.sender, _tokensDue);

        TokensClaimed(msg.sender, _totalContribution, _tokensDue, now);
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
        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);
        uint256 _fee = 0;
        if (_amountToRefund >= withdrawalFee) {
            _fee = withdrawalFee;
            //0.0015eth fee to cover gas costs for being kicked - taken from investor
            owner.transfer(withdrawalFee);
        }
        _ejectedInvestor.transfer(_amountToRefund.sub(_fee));

        InvestorEjected(_ejectedInvestor, _fee, _amountToRefund.sub(_fee), now);
    }

    /**
     * @notice Returns all relevant pool details in 1 function
     */
    function getPoolDetails()
    public
    view
    returns (bytes32,  uint256, uint256, uint256, uint256, uint256, address, address, Status)
    {
        return(icoUrl, waterMark, feePercentage, withdrawalFee, groupDiscountPercent, totalPoolInvestments, saleAddress, tokenAddress,  contractStatus);
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
        uint256 _contributionPercentage = _userInvestmentAmount.mul(100).div(totalPoolInvestments);
        return totalTokensReceived.mul(_contributionPercentage).div(100);
    }

}
