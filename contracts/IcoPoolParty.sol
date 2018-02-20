pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./interfaces/IErc20Token.sol";
import "./usingOraclize.sol";
import "./strings.sol";

contract IcoPoolParty is Ownable, usingOraclize {
    using SafeMath for uint256;
    using strings for *;

    /* Constants */
    uint256 constant VERSION = 1;
    uint256 constant DECIMAL_PRECISION = 10**18;

    string public icoUrl;
    string public buyFunctionName;
    string public refundFunctionName;
    string public claimFunctionName;
    string oraclizeQueryDestinationAddress;
    string oraclizeQueryTokenAddress;
    string oraclizeQuerySaleOwnerAddress;
    string oraclizeQueryBuyFunction;
    string oraclizeQueryRefundFunction;
    string oraclizeQueryClaimFunction;
    string oraclizeQueryPublicEthPricePerToken;
    string oraclizeQueryGroupEthPricePerToken;
    string oraclizeQuerySubsidyRequired;

    uint256 public waterMark;
    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public expectedGroupDiscountPercent;
    uint256 public publicEthPricePerToken;
    uint256 public groupEthPricePerToken;
    uint256 public expectedGroupTokenPrice;
    uint256 public actualGroupDiscountPercent;
    uint256 public totalPoolInvestments;
    uint256 public totalTokensReceived;
    uint256 public poolParticipants;
    uint256 public reviewPeriodStart;
    uint256 public balanceRemainingSnapshot;

    address public poolPartyOwnerAddress;
    address public destinationAddress;
    address public saleOwnerAddress;

    bool public subsidyRequired;

    bytes32 hashedBuyFunctionName;
    bytes32 hashedRefundFunctionName;
    bytes32 hashedClaimFunctionName;

    IErc20Token public tokenAddress;

    Status public poolStatus;
    address[] public investorList;

    mapping(address => Investor) public investors;
    mapping(bytes32 => bytes32) queryMapping;

    struct Investor {
        uint256 investmentAmount;
        uint256 snapshotInvestmentAmount;
        uint256 percentageContribution;
        uint256 arrayIndex;
        bool canClaimRefund;
        bool active;
        uint256 refundAmount;
    }

    enum Status {Open, WaterMarkReached, DueDiligence, InReview, Claim}

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
     * @dev Check the state of the watermark only if the current state is OPEN or WATERMARKREACHED
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
     * @dev Start the 7 day timer to once the sale is configured - this gives time for investors to review where their funds will go before they are released to the configured address
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
     * @dev Only allow sale owner to execute function
     */
    modifier onlySaleOwner {
        require (msg.sender == saleOwnerAddress);
        _;
    }

    /**
     * @dev Constructor initializing parameters
     * @param _icoUrl Domain name of the sale
     * @param _waterMark Minimum amount the pool has to reach in order for funds to be released to sale contract
     * @param _feePercentage Fee percentage for using Pool Party
     * @param _withdrawalFee Fee charged for kicking a participant
     * @param _groupDiscountPercent Expected percentage discount that the pool will receive
     * @param _poolPartyOwnerAddress Address to pay the Pool Party fee to
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
        oraclizeQueryDestinationAddress = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).destinationAddress".toSlice());
        oraclizeQueryTokenAddress = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).tokenAddress".toSlice());
        oraclizeQuerySaleOwnerAddress = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).saleOwnerAddress".toSlice());
        oraclizeQueryBuyFunction = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).buyFunction".toSlice());
        oraclizeQueryRefundFunction = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).refundFunction".toSlice());
        oraclizeQueryClaimFunction = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).claimFunction".toSlice());
        oraclizeQueryPublicEthPricePerToken = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).publicETHPricePerToken".toSlice());
        oraclizeQueryGroupEthPricePerToken = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).groupETHPricePerToken".toSlice());
        oraclizeQuerySubsidyRequired = ("json(http://".toSlice().concat(icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).subsidyRequired".toSlice());

        PoolCreated(icoUrl, now);
    }

    /**
     * @dev Default fallback function, only the sale address is allowed to send funds directly to this contract
     */
    function () public payable {
    }

    /**
	 * @dev Add funds to the group purchases pool. Contract status needs to be 'Open', 'WatermarkReached' or 'DueDiligence' in order to contribute additional funds
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
        require(msg.value >= 0.01 ether);

        Investor storage _investor = investors[msg.sender];

        if(_investor.active == false) {
            poolParticipants = poolParticipants.add(1);
            investorList.push(msg.sender);
            _investor.active = true;
            _investor.canClaimRefund = true;
            _investor.arrayIndex = investorList.length-1;
        }

        uint256 _amountInvested = msg.value;
        _investor.investmentAmount = investors[msg.sender].investmentAmount.add(_amountInvested);
        totalPoolInvestments = totalPoolInvestments.add(_amountInvested);

        FundsAdded(msg.sender, msg.value, now);
    }

    /**
     * @dev Can withdraw funds from the group purchase pool at any time. There is no penalty for user withdrawing their contribution - only pay the gas fee for the transaction
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
        delete investors[msg.sender];

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
        buyFunctionName = "N/A";
        hashedBuyFunctionName = keccak256(buyFunctionName);
        refundFunctionName = "claimRefund()";
        hashedRefundFunctionName = keccak256(refundFunctionName);
        claimFunctionName = "claimToken()";
        hashedClaimFunctionName = keccak256(claimFunctionName);
        publicEthPricePerToken = 0.05 ether;
        groupEthPricePerToken = 0.04 ether;
        subsidyRequired = true;
    }

    /**
     * @dev Configure sale by calling Oracle service to get config values
     */
    function configurePool()
        public
        payable
    {
        require(poolStatus == Status.WaterMarkReached);
        bytes32 _qId = oraclize_query("URL", oraclizeQueryDestinationAddress);
        queryMapping[_qId] = keccak256("destinationAddress");
    }

    /**
     * @dev Oraclize callback
     * @param _qId ID used to tie result back to the original query
     * @param _result Result of the oracle query
     */
    function __callback(bytes32 _qId, string _result) public {
        require (msg.sender == oraclize_cbAddress());

        bytes32 paramToSet = queryMapping[_qId];
        delete queryMapping[_qId];

        if(paramToSet == keccak256("destinationAddress")) {
            destinationAddress = parseAddr(_result);
            bytes32 _tokenAddressId = oraclize_query("URL", oraclizeQueryTokenAddress);
            queryMapping[_tokenAddressId] = keccak256("tokenAddress");
        } else if (paramToSet == keccak256("tokenAddress")) {
            tokenAddress = IErc20Token(parseAddr(_result));
            bytes32 _saleOwnerAddressId = oraclize_query("URL", oraclizeQuerySaleOwnerAddress);
            queryMapping[_saleOwnerAddressId] = keccak256("saleOwnerAddress");
        } else if (paramToSet == keccak256("saleOwnerAddress")) {
            saleOwnerAddress = parseAddr(_result);
            bytes32 _buyFunctionId = oraclize_query("URL", oraclizeQueryBuyFunction);
            queryMapping[_buyFunctionId] = keccak256("buyFunction");
        } else if (paramToSet == keccak256("buyFunction")) {
            buyFunctionName = _result;
            hashedBuyFunctionName = keccak256(buyFunctionName);
            bytes32 _refundFunctionId = oraclize_query("URL", oraclizeQueryRefundFunction);
            queryMapping[_refundFunctionId] = keccak256("refundFunction");
        } else if (paramToSet == keccak256("refundFunction")) {
            refundFunctionName = _result;
            hashedRefundFunctionName = keccak256(refundFunctionName);
            bytes32 _claimFunctionId = oraclize_query("URL", oraclizeQueryClaimFunction);
            queryMapping[_claimFunctionId] = keccak256("claimFunction");
        } else if (paramToSet == keccak256("claimFunction")) {
            claimFunctionName = _result;
            hashedClaimFunctionName = keccak256(claimFunctionName);
            bytes32 _publicEthId = oraclize_query("URL", oraclizeQueryPublicEthPricePerToken);
            queryMapping[_publicEthId] = keccak256("publicETHPricePerToken");
        } else if (paramToSet == keccak256("publicETHPricePerToken")) {
            publicEthPricePerToken = parseInt(_result);
            bytes32 _groupEthId = oraclize_query("URL", oraclizeQueryGroupEthPricePerToken);
            queryMapping[_groupEthId] = keccak256("groupETHPricePerToken");
        } else if (paramToSet == keccak256("groupETHPricePerToken")) {
            groupEthPricePerToken = parseInt(_result);
            bytes32 _subsidyId = oraclize_query("URL", oraclizeQuerySubsidyRequired);
            queryMapping[_subsidyId] = keccak256("subsidyRequired");
        } else if (paramToSet == keccak256("subsidyRequired")) {
            subsidyRequired = keccak256(_result) == keccak256("false") ? false : true;
        }
    }

    /**
     * @dev Complete the configuration and start the 7 day timer for participants to review the configured parameters
     */
    function completeConfiguration() public {
        require(msg.sender == saleOwnerAddress);
        require(
            destinationAddress != 0x0 &&
            address(tokenAddress) != 0x0 &&
            saleOwnerAddress != 0x0 &&
            hashedBuyFunctionName != 0x0 &&
            hashedRefundFunctionName != 0x0 &&
            hashedClaimFunctionName != 0x0 &&
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
     * @dev Allows owners to remove investors who do not comply with KYC. A small fee is charged to the person being kicked from the pool (only enough to cover gas costs of the transaction)
     * @param _userToKick Address of the person to kick from the pool.
     */
    function kickUser(address _userToKick)
        public
        timedTransition
        onlySaleOwner
    {
        require(poolStatus == Status.InReview);

        Investor storage _kickedUser = investors[_userToKick];
        uint256 _amountToRefund = _kickedUser.investmentAmount;
        uint256 _index = _kickedUser.arrayIndex;
        require(_amountToRefund > 0);
        delete investors[_userToKick];

        poolParticipants = poolParticipants.sub(1);
        removeInvestorFromList(_index);
        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);

        //fee to cover gas costs for being kicked - taken from investor
        uint256 _fee = _amountToRefund < withdrawalFee ? _amountToRefund : withdrawalFee;
        InvestorEjected(_userToKick, _fee, _amountToRefund.sub(_fee), now);

        msg.sender.transfer(_fee);
        _userToKick.transfer(_amountToRefund.sub(_fee));
    }

    /**
     * @dev Once 7 days has passed since the configuration was completed, the pool funds can be released to the Sale contract in exchange for tokens.
     *      address.call is used to get around the fact that the minimum gas amount is sent with a .send or .transfer - this call needs more than the minimum
     */
    function releaseFundsToSale()
        public
        payable
    {
        require(poolStatus == Status.InReview);
        require(msg.sender == saleOwnerAddress);

        poolStatus = Status.Claim;

        //The fee must be paid by the caller of this function - which is saleOwnerAddress
        uint256 _feeAmount = totalPoolInvestments.mul(feePercentage).div(100);
        uint256 _amountToRelease = 0;
        uint256 _actualSubsidy = 0;

        if (subsidyRequired) { //If a subsidy is required, calculate the subsidy amount which should be sent to this function at time of calling
            uint256 _groupContributionPercent = uint256(100).sub(actualGroupDiscountPercent);
            _amountToRelease = totalPoolInvestments.mul(100).div(_groupContributionPercent);
            _actualSubsidy = _amountToRelease.sub(totalPoolInvestments);
            require(msg.value >= _actualSubsidy.add(_feeAmount)); //Amount sent to the function should be the subsidy amount + the fee
        } else { //No subsidy, only fee has to be paid
            require(msg.value == _feeAmount);
            _amountToRelease = totalPoolInvestments;
        }

        //Transfer the fee to us
        poolPartyOwnerAddress.transfer(_feeAmount);

        //Release funds to sale contract
        if (hashedBuyFunctionName == keccak256("N/A")) { //Call fallback function
            require(destinationAddress.call.gas(300000).value(_amountToRelease)());
        } else { //Call function specified during creation
            require(destinationAddress.call.gas(300000).value(_amountToRelease)(bytes4(hashedBuyFunctionName)));
        }

        balanceRemainingSnapshot = this.balance;

        //If there is no claim function then assume tokens are minted at time they are bought (for example TokenMarketCrowdSale)
        if (hashedClaimFunctionName == keccak256("N/A")) {
            claimTokensFromIco();
        }

        FundsReleasedToIco(_amountToRelease, _actualSubsidy, _feeAmount, destinationAddress, now);
    }


    /*
     * INTEGRATION POINT WITH SALE CONTRACT
     * @dev If tokens are not minted by ICO at time of purchase, they need to be claimed once the sale is over. Tokens are released to this contract. actualGroupTokenPrice is calculated when the
     *      configuration is completed by the ICO
     */
    function claimTokensFromIco() public {
        require(poolStatus == Status.Claim);
        require(totalTokensReceived == 0);

        if (hashedClaimFunctionName != keccak256("N/A")) {
            require(destinationAddress.call(bytes4(hashedClaimFunctionName)));
        }

        totalTokensReceived = tokenAddress.balanceOf(address(this));
        uint256 _expectedTokenBalance = totalPoolInvestments.div(groupEthPricePerToken);
        require(totalTokensReceived >= _expectedTokenBalance);
        ClaimedTokensFromIco(address(this), totalTokensReceived, now);
    }

    /*
	 * INTEGRATION POINT WITH SALE CONTRACT
	 * @dev In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for investors to claim their refund
     */
    function claimRefundFromIco() public {
        require(poolStatus == Status.Claim);
        require(totalTokensReceived == 0);
        //TODO: Must prevent this from being called if claimTokensFromIco should be called instead
        //TODO: Need a way to stop this function from being called again

        require(destinationAddress.call(bytes4(hashedRefundFunctionName)));
        balanceRemainingSnapshot = this.balance;

        ClaimedRefundFromIco(address(this), msg.sender, now);
    }

    /**
     * @dev Tokens are distributed proportionately to how much they contributed.
     */
    function claimTokens() public {
        Investor storage _investor = investors[msg.sender];

        require(poolStatus == Status.Claim);
        require(_investor.investmentAmount > 0);
        require(totalTokensReceived > 0);

        uint256 _totalContribution = _investor.investmentAmount;
        _investor.investmentAmount = 0;
        if (_investor.percentageContribution == 0) {
            setContributionPercentage(msg.sender, _totalContribution);
        }

        uint256 _tokensDue = calculateTokensDue(msg.sender, _totalContribution);

        TokensClaimed(msg.sender, _totalContribution, _tokensDue, now);
        tokenAddress.transfer(msg.sender, _tokensDue);
    }

    /**
     * @dev If there are any funds left in the contract after once the sale completes, participants are entitled to claim their share proportionality to how much they contributed
     */
    function claimRefund() public {
        Investor storage _investor = investors[msg.sender];
        require(poolStatus == Status.Claim);
        require(_investor.canClaimRefund);

        _investor.canClaimRefund = false;
        if (_investor.investmentAmount != 0) { //If investmentAmount == 0, then refundAmount has already been set
            setContributionPercentage(msg.sender, _investor.investmentAmount);
        }

        msg.sender.transfer(_investor.refundAmount);
    }

    /**
     * @dev Returns all relevant pool configurations in 1 function
     */
    function getConfigDetails()
        public
        view
        returns (address, address, address, uint256, uint256, bool, string, string, string)
    {
        return (destinationAddress, tokenAddress, saleOwnerAddress, publicEthPricePerToken, groupEthPricePerToken, subsidyRequired, buyFunctionName, refundFunctionName, claimFunctionName);
    }

    /**
     * @dev Returns all relevant pool details in 1 function
     */
    function getPoolDetails()
        public
        view
        returns (Status, uint256, uint256, uint256, uint256)
    {
        return (poolStatus, totalPoolInvestments, poolParticipants, withdrawalFee, waterMark);
    }

    /**
     * @dev Allows anyone to query the number of tokens due for a given address. Returns 0 unless the tokens have been released by the sale contract (totalTokensReceived > 0)
     * @param _user The user address of the account to look up
     */
    function getTokensDue(address _user)
        public
        view
        returns (uint256)
    {
        return totalTokensReceived > 0 ? calculateTokensDue(_user, investors[_user].investmentAmount) : 0;
    }

    /**********************/
    /* INTERNAL FUNCTIONS */
    /**********************/
    /**
     * @dev Internal function that sets a participants contribution percentage and refund amount based on the amount originally contributed
     * @param _user Participant to calculate for
     * @param _investmentAmount Investment amount used in the calculation
     */
    function setContributionPercentage(address _user, uint _investmentAmount) internal {
        Investor storage _investor = investors[_user];
        _investor.percentageContribution = _investmentAmount.mul(100).mul(DECIMAL_PRECISION).div(totalPoolInvestments);
        _investor.refundAmount = balanceRemainingSnapshot.mul(_investor.percentageContribution).div(100).div(DECIMAL_PRECISION);
    }

    /**
     * @dev Get the amount of tokens a participant has due to them
     * @param _user Participant to calculate for
     * @param _amount Participants investment amount
     */
    function calculateTokensDue(address _user, uint256 _amount)
        internal
        view
        returns (uint256)
    {
        uint8 _tokenPrecision = tokenAddress.decimals();
        return _tokenPrecision == 0 ? _amount.div(groupEthPricePerToken) : _amount.mul(_tokenPrecision).div(groupEthPricePerToken);
    }

    /**
     * @dev Move the last element of the array to the index of the element being deleted, update the index of the item being moved, delete the last element of the
     *      array (because its now at position _index), reduce the size of the array
     */
    function removeInvestorFromList(uint256 _index) internal {
        investorList[_index] = investorList[investorList.length - 1];
        investors[investorList[_index]].arrayIndex = _index;
        delete investorList[investorList.length - 1];
        investorList.length--;
    }
}