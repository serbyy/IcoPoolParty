pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./interfaces/IErc20Token.sol";
import "./usingOraclize.sol";

contract IcoPoolParty is Ownable, usingOraclize {
    using SafeMath for uint256;

    /* Constants */
    uint256 constant VERSION = 1;
    uint256 constant DECIMAL_PRECISION = 10**18;

    /* Constructor parameters */
    string public icoUrl;
    uint256 public waterMark;
    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public expectedGroupDiscountPercent;
    address public poolPartyOwnerAddress;

    /* Pool configuration parameters */
    address public destinationAddress;
    IErc20Token public tokenAddress;
    address public saleOwnerAddress;
    bytes32 public buyFunctionName;
    bytes32 public refundFunctionName;
    bytes32 public claimFunctionName;
    uint256 public publicEthPricePerToken; //TODO: Should be price in WEI, code assumes WEI
    uint256 public groupEthPricePerToken; //TODO: Should be price in WEI, code assumes WEI
    bool public subsidyRequired;

    /* Oraclize queries */
    string oraclizeQueryDestinationAddress;
    string oraclizeQueryTokenAddress;
    string oraclizeQuerySaleOwnerAddress;
    string oraclizeQueryBuyFunction;
    string oraclizeQueryRefundFunction;
    string oraclizeQueryClaimFunction;
    string oraclizeQueryPublicEthPricePerToken;
    string oraclizeQueryGroupEthPricePerToken;
    string oraclizeQuerySubsidyRequired;

    /* Pool values */
    uint256 public expectedGroupTokenPrice;
    uint256 public actualGroupDiscountPercent;
    uint256 public totalPoolInvestments;
    uint256 public totalTokensReceived;
    uint256 public poolParticipants;
    uint256 public reviewPeriodStart;
    uint256 public balanceRemainingSnapshot;
    Status public poolStatus;
    address[] public investorList;
    mapping(address => Investor) public investors;

    struct Investor {
        uint256 investmentAmount;
        uint256 snapshotInvestmentAmount;
        uint256 percentageContribution;
        uint256 arrayIndex;
        bool canClaimRefund;
        bool active;
    }

    enum Status {Open, WaterMarkReached, DueDiligence, InReview, Claim, Refunding}

    event PoolCreated(string poolName, uint256 date);
    event SaleDetailsConfigured(address configurer, uint256 date);
    event FundsAdded(address indexed investor, uint256 amount, uint256 date);
    event FundsWithdrawn(address indexed investor, uint256 amount, uint256 date);
    event FundsReleasedToIco(uint256 totalInvestmentAmount, uint256 subsidyAmount, uint256 feeAmount,  address tokenSaleAddress, uint256 date);
    event TokensClaimed(address indexed investor, uint256 investmentAmount, uint256 tokensTransferred, uint256 date);
    event InvestorEjected(address indexed investor, uint256 fee, uint256 amount, uint256 date);
    event RefundClaimer(address indexed investor, uint256 amount, uint256 date);

    event ClaimedTokensFromIco(address indexed owner, uint256 tokenBalance, uint256 date);
    event ClaimedRefundFromIco(address indexed owner, address initiator, uint256 date);

    /**
     * @notice Check the state of the watermark only if the current state is OPEN or WATERMARKREACHED
     */
    modifier assessWaterMark {
        if (poolStatus == Status.Open || poolStatus == Status.WaterMarkReached) { //Only worry about the watermark before the ICO has configured the "sale"
            if (totalPoolInvestments < waterMark) { //If the pool total drops below watermark, change status to OPEN
                poolStatus = Status.Open;
            } else if (totalPoolInvestments >= waterMark) { //If the pool total equals watermark or more, change status to WATERMARKREACHED
                poolStatus = Status.WaterMarkReached;
            }
        }
        _;
    }

    /**
     * @notice Start the 7 day timer to once the sale is configured - this gives time for investors to review where their funds will go before they are released to the configured address
     */
    modifier timedTransition {
        if (
            poolStatus == Status.DueDiligence &&
            reviewPeriodStart != 0 &&
            //now >= reviewPeriodStart + 7 days
            now >= reviewPeriodStart + 3 seconds //TODO: CHANGE TO 7 DAYS ONCE TESTING IS DONE
        ) {
            poolStatus = Status.InReview;
        }
        _;
    }

    /**
     * @dev Constructor
     */
    function IcoPoolParty(
        string _icoUrl,
        uint256 _waterMark,
        uint256 _feePercentage,
        uint256 _withdrawalFee,
        uint256 _groupDiscountPercent,
        address _poolPartyOwnerAddress
    )
        public
    {
        icoUrl = _icoUrl;
        waterMark = _waterMark;
        feePercentage = _feePercentage;
        withdrawalFee = _withdrawalFee;
        expectedGroupDiscountPercent = _groupDiscountPercent;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        poolParticipants = 0;

        OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475); //TODO: ONLY USED FOR LOCAL TESTING
        //oraclizeQueryDestinationAddress = "json(http://".toSlice().concat(icoUrl.toSlice());
        /*oraclizeQueryDestinationAddress = strConcat("json(http://", icoUrl, "/pool/example?json=true).destinationAddress");
        oraclizeQueryTokenAddress = strConcat("json(http://", icoUrl, "/pool/example?json=true).tokenAddress");
        oraclizeQuerySaleOwnerAddress = strConcat("json(http://", icoUrl, "/pool/example?json=true).saleOwnerAddress");
        oraclizeQueryBuyFunction = strConcat("json(http://", icoUrl, "/pool/example?json=true).buyFunction");
        oraclizeQueryRefundFunction = strConcat("json(http://", icoUrl, "/pool/example?json=true).refundFunction");
        oraclizeQueryClaimFunction = strConcat("json(http://", icoUrl, "/pool/example?json=true).claimFunction");
        oraclizeQueryPublicEthPricePerToken = strConcat("json(http://", icoUrl, "/pool/example?json=true).publicETHPricePerToken");
        oraclizeQueryGroupEthPricePerToken = strConcat("json(http://", icoUrl, "/pool/example?json=true).groupETHPricePerToken");
        oraclizeQuerySubsidyRequired = strConcat("json(http://", icoUrl, "/pool/example?json=true).subsidyRequired");*/

        PoolCreated(icoUrl, now);
    }

    /**
     * @notice Default fallback function, only the sale address is allowed to send funds directly to this contract
     */
    function () public payable {
        require(msg.sender == destinationAddress);
        balanceRemainingSnapshot = this.balance;
    }

    /**
	 * @notice Add funds to the group purchases pool
	 * @dev Contract status needs to be 'Open' in order to contribute additional funds
	 */
    function addFundsToPool()
        public
        assessWaterMark
        timedTransition
        payable
    {
        require( //Can only add funds until the 7 day timer is up - timer starts when the "sale" is configured
            poolStatus == Status.Open ||
            poolStatus == Status.WaterMarkReached ||
            poolStatus == Status.DueDiligence
        );
        Investor storage _investor = investors[msg.sender];

        if(_investor.active == false) {
            poolParticipants = poolParticipants.add(1);
            investorList.push(msg.sender);
        }

        uint256 _amountInvested = msg.value;
        _investor.investmentAmount = investors[msg.sender].investmentAmount.add(_amountInvested);
        _investor.active = true;
        _investor.arrayIndex = investorList.length-1;
        totalPoolInvestments = totalPoolInvestments.add(_amountInvested);

        FundsAdded(msg.sender, msg.value, now);
    }

    /**
     * @notice Can withdraw funds from the group purchase pool at any time
     * @dev There is no penalty for user withdrawing their contribution - only pay the gas fee for the transaction
     */
    function leavePool()
        public
        assessWaterMark
        timedTransition
    {
        Investor storage _investor = investors[msg.sender];
        require(_investor.investmentAmount > 0);

        uint256 _amountToRefund = _investor.investmentAmount;
        uint256 _index = _investor.arrayIndex;
        _investor.investmentAmount = 0;
        _investor.arrayIndex = 0;
        _investor.active = false;

        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);
        removeInvestorFromList(_index);
        poolParticipants = poolParticipants.sub(1);
        FundsWithdrawn(msg.sender, _amountToRefund, now);

        msg.sender.transfer(_amountToRefund);
    }

    /* TODO: REMOVE THIS FUNCTION WHEN DEPLOYING - ONLY USED TO SHORTEN TIME IT TAKES TO RUN TESTS */
    function configurePoolTest(address _destination, address _token, address _owner) public {
        require(poolStatus == Status.WaterMarkReached);

        destinationAddress = _destination;
        tokenAddress = IErc20Token(_token);
        saleOwnerAddress = _owner;
        buyFunctionName = keccak256("N/A");
        refundFunctionName = keccak256("claimRefund()");
        claimFunctionName = keccak256("claimToken()");
        publicEthPricePerToken = 0.05 ether;
        groupEthPricePerToken = 0.04 ether;
        subsidyRequired = true;
    }

    /**
     * @dev Sale address will be set by backend service once address is has been made available by ICO in their official page. Address is received by making service call to URL
     */
    function configurePool() public payable {
        require(poolStatus == Status.WaterMarkReached);
        //oraclize_query("URL", oraclizeQueryDestinationAddress);
        oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).destinationAddress");
    }

    /**
     * @dev Oraclize callback
     */
    function __callback(bytes32 _qId, string _result) public {
        require (msg.sender == oraclize_cbAddress());

        if (destinationAddress == 0x0) {
            destinationAddress = parseAddr(_result);
            //oraclize_query("URL", oraclizeQueryTokenAddress);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).tokenAddress");
        } else if (address(tokenAddress) == 0x0) {
            tokenAddress = IErc20Token(parseAddr(_result));
            //oraclize_query("URL", oraclizeQuerySaleOwnerAddress);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).saleOwnerAddress");
        } else if (saleOwnerAddress == 0x0) {
            saleOwnerAddress = parseAddr(_result);
            //oraclize_query("URL", oraclizeQueryBuyFunction);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).buyFunction");
        } else if (buyFunctionName == 0x0) {
            buyFunctionName = keccak256(_result);
            //oraclize_query("URL", oraclizeQueryRefundFunction);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).refundFunction");
        } else if (refundFunctionName == 0x0) {
            refundFunctionName = keccak256(_result);
            //oraclize_query("URL", oraclizeQueryClaimFunction);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).claimFunction");
        } else if (claimFunctionName == 0x0) {
            claimFunctionName = keccak256(_result);
            //oraclize_query("URL", oraclizeQueryPublicEthPricePerToken);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).publicETHPricePerToken");
        } else if (publicEthPricePerToken == 0) {
            publicEthPricePerToken = parseInt(_result);
            //oraclize_query("URL", oraclizeQueryGroupEthPricePerToken);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).groupETHPricePerToken");
        } else if (groupEthPricePerToken == 0) {
            groupEthPricePerToken = parseInt(_result);
            //oraclize_query("URL", oraclizeQuerySubsidyRequired);
            oraclize_query("URL", "json(http://api.test.foreground.io/pool/example?json=true).subsidyRequired");
        } else if (subsidyRequired == false) {
            //TODO: Convert value received from Oraclize to boolean - no built in method to do this
            //subsidyRequired = parseInt(_result);
            subsidyRequired = true;
        }
    }

    /**
     * @dev Complete the configuration
     */
    function completeConfiguration() public {
        require(msg.sender == saleOwnerAddress);
        require(
            destinationAddress != 0x0 &&
            address(tokenAddress) != 0x0 &&
            saleOwnerAddress != 0x0 &&
            buyFunctionName != 0x0 &&
            refundFunctionName != 0x0 &&
            claimFunctionName != 0x0 &&
            publicEthPricePerToken > 0 &&
            groupEthPricePerToken > 0
        );
        //Check that the groupTokenPrice is at least the correct percentage off => 0.005 - (0.005 * 15%)
        expectedGroupTokenPrice = publicEthPricePerToken.sub(publicEthPricePerToken.mul(expectedGroupDiscountPercent).div(100));
        require (expectedGroupTokenPrice >= groupEthPricePerToken);

        actualGroupDiscountPercent = (publicEthPricePerToken.sub(groupEthPricePerToken)).mul(100).div(publicEthPricePerToken);

        poolStatus = Status.DueDiligence;
        reviewPeriodStart = now;
        SaleDetailsConfigured(msg.sender, now);
    }

    /**
     * @notice Allows owners to remove investors who do not comply with KYC
     * @dev A small fee is charged to the person being ejected from the pool (only enough to cover gas costs of the transaction) but only if the invested amount is greater than the fee.
     * @param _userToKick Address of the person to eject from the pool.
     */
    function kickUser(address _userToKick)
    public
    timedTransition
        //TODO: Should this be limited to owner only? Or "Sale" contract owner? Currently anyone can kick a user so should restrict
    {
        require(poolStatus == Status.InReview);

        Investor storage _kickedUser = investors[_userToKick];
        uint256 _amountToRefund = _kickedUser.investmentAmount;
        uint256 _index = _kickedUser.arrayIndex;
        require(_amountToRefund > 0);
        _kickedUser.investmentAmount = 0;
        _kickedUser.arrayIndex = 0;
        _kickedUser.active= false;

        poolParticipants = poolParticipants.sub(1);
        removeInvestorFromList(_index);
        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);

        uint256 _fee = 0;
        if (_amountToRefund >= withdrawalFee) { //Don't take a fee if the investment amount is less than the fee
            _fee = withdrawalFee; //0.0015eth fee to cover gas costs for being kicked - taken from investor
            //TODO: who should get this fee? Currently goes to the caller of the function
            msg.sender.transfer(_fee);
        }

        InvestorEjected(_userToKick, _fee, _amountToRefund.sub(_fee), now);
        _userToKick.transfer(_amountToRefund.sub(_fee));
    }

    /**
     * @notice Once the watermark has been reached and the participants approved, the pool funds can be released to the Sale contract in exchange for tokens
     * @dev Subsidy amount is validated by checking to see if we will receive the correct number of tokens based on the configured parameters
     *      address.call is used to get around the fact that the minimum gas amount is sent with a .send or .transfer - this call needs more than the minimum
     */
    function releaseFundsToSale()
        public
        payable
    {
        require(poolStatus == Status.InReview);
        require(msg.sender == saleOwnerAddress);

        poolStatus = Status.Claim; //Takes care of re-entrancy

        //The fee must be paid by the caller of this function - which is saleOwnerAddress
        uint256 _feeAmount = totalPoolInvestments.mul(feePercentage).div(100);
        uint256 _amountToRelease = 0;
        uint256 _actualSubsidy = 0;

        if (subsidyRequired) { //If a subsidy is required, calculate the subsidy amount which should be sent to this function at time of calling
            uint256 _groupContributionPercent = uint256(100).sub(actualGroupDiscountPercent);
            _amountToRelease = totalPoolInvestments.mul(100).div(_groupContributionPercent);
            _actualSubsidy = _amountToRelease.sub(totalPoolInvestments);
            require(msg.value == _actualSubsidy.add(_feeAmount)); //Amount sent to the function should be the subsidy amount + the fee
        } else { //No subsidy, only fee has to be paid
            require(msg.value == _feeAmount);
            _amountToRelease = totalPoolInvestments;
        }

        //Transfer the fee to us
        poolPartyOwnerAddress.transfer(_feeAmount);

        //Release funds to sale contract
        if (buyFunctionName == keccak256("N/A")) { //Call fallback function
            require(destinationAddress.call.gas(300000).value(_amountToRelease)());
        } else { //Call function specified during creation
            require(destinationAddress.call.gas(300000).value(_amountToRelease)(bytes4(buyFunctionName)));
        }

        //If there is no claim function then assume tokens are minted at time they are bought (for example TokenMarketCrowdSale)
        if (claimFunctionName == keccak256("N/A")) {
            claimTokensFromIco();
        }

        FundsReleasedToIco(_amountToRelease, _actualSubsidy, _feeAmount, destinationAddress, now);
    }


    /*
     * INTEGRATION POINT WITH SALE CONTRACT
     * @notice If tokens are not minted by ICO at time of purchase, they need to be claimed once the sale is over. Tokens are released to this contract - called once by anyone
     * @dev Integration with Token Sale contract - claim tokens
     *      actualGroupTokenPrice is calculated when the configuration is completed by the ICO
     */
    function claimTokensFromIco() public {
        require(poolStatus == Status.Claim);
        require(totalTokensReceived == 0);

        if (claimFunctionName != keccak256("N/A")) {
            require(destinationAddress.call(bytes4(claimFunctionName)));
        }

        totalTokensReceived = tokenAddress.balanceOf(address(this));
        uint256 _expectedTokenBalance = totalPoolInvestments.div(groupEthPricePerToken);
        require(totalTokensReceived >= _expectedTokenBalance);
        ClaimedTokensFromIco(address(this), totalTokensReceived, now);
    }

    /**
     * @notice Allows participants to claim tokens once they have been received from the token sale
     * @dev Tokens are distributed proportionately to how much they contributed. Mut be called before users can claim refund
     */
    function claimTokens() public {
        Investor storage _investor = investors[msg.sender];

        require(poolStatus == Status.Claim);
        require(_investor.investmentAmount > 0);
        require(totalTokensReceived > 0);

        uint256 _totalContribution = _investor.investmentAmount;
        _investor.investmentAmount = 0;
        //TODO: Check this calculation...its not used yet though
        _investor.percentageContribution = _totalContribution.mul(100).mul(DECIMAL_PRECISION).div(totalPoolInvestments);

        uint256 _tokensDue = getInternalTokensDue(msg.sender, _totalContribution);

        TokensClaimed(msg.sender, _totalContribution, _tokensDue, now);
        tokenAddress.transfer(msg.sender, _tokensDue);
    }

    /**
     * @dev Add comment here
     */
    function claimRefund() public {
        require(poolStatus == Status.Claim);
        //TODO: Implement this
    }

    /**
     * @notice Returns all relevant pool details in 1 function
     */
    function getPoolDetails()
        public
        view
        returns (string,  uint256, uint256, uint256, uint256, uint256, address, address, Status)
    {
        return(icoUrl, waterMark, feePercentage, withdrawalFee, expectedGroupDiscountPercent, totalPoolInvestments, destinationAddress, tokenAddress, poolStatus);
    }

    /**
     * @notice Allows anyone to query the number of tokens due for a given address
     * @dev Returns 0 unless the tokens have been released by the sale contract (totalTokensReceived > 0)
     * @param _user The user address of the account to look up
     */
    function getTokensDue(address _user)
        public
        view
        returns (uint256)
    {
        return totalTokensReceived > 0 ? getInternalTokensDue(_user, investors[_user].investmentAmount) : 0;
    }

    function getInternalTokensDue(address _user, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        uint8 _tokenPrecision = tokenAddress.decimals();
        return _tokenPrecision == 0 ? _amount.div(groupEthPricePerToken) : _amount.mul(_tokenPrecision).div(groupEthPricePerToken);
    }

    function removeInvestorFromList(uint256 _index) internal {
        //Move the last element of the array to the index of the element being deleted
        investorList[_index] = investorList[investorList.length - 1];
        //Update the index of the item being moved
        investors[investorList[_index]].arrayIndex = _index;
        //Delete the last element of the array (because its now at position _index)
        delete investorList[investorList.length - 1];
        //Reduce the size of the array
        investorList.length--;
    }
}
