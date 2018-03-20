pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./interfaces/IErc20Token.sol";
import "./usingOraclize.sol";
import "./libraries/OraclizeQueryBuilder.sol";

/**
 * @title IcoPoolParty
 * @dev Individual pools that are linked to a particular ICO
 * @author - Shane van Coller
 */
contract IcoPoolParty is Ownable, usingOraclize {
    using SafeMath for uint256;
    using OraclizeQueryBuilder for OraclizeQueryBuilder.OraclizeQueries;

    /* Constants */
    uint256 constant VERSION = 1;
    uint256 constant DECIMAL_PRECISION = 10**18;

    string public icoUrl;
    string public buyFunctionName;
    string public refundFunctionName;
    string public claimFunctionName;

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
    uint256 public tokenPrecision;
    uint256 public minPurchaseAmount;
    uint256 public minOraclizeFee;
    uint256 public dueDiligenceDuration;
    uint256 public poolSubsidyAmount;

    address public poolPartyOwnerAddress;
    address public destinationAddress;
    address public authorizedConfigurationAddress;

    bool public subsidyRequired;
    bool public configUrlRequiresWww;

    bytes32 hashedBuyFunctionName;
    bytes32 hashedRefundFunctionName;
    bytes32 hashedClaimFunctionName;
    bytes32 oraclizeQueryId;

    bytes public oraclizeProof;

    OraclizeQueryBuilder.OraclizeQueries oQueries;
    IErc20Token public tokenAddress;

    Status public poolStatus;
    address[] public investorList;

    mapping(address => Investor) public investors;
    mapping(bytes32 => bytes32) queryMapping;

    struct Investor {
        uint256 investmentAmount;
        uint256 tokensDue;
        uint256 percentageContribution;
        uint256 arrayIndex;
        bool hasClaimedRefund;
        bool isActive;
        uint256 refundAmount;
        bool hasClaimedTokens;
    }

    enum Status {Open, WaterMarkReached, DueDiligence, InReview, Claim}

    event PoolCreated(string poolName, uint256 date);
    event SaleDetailsConfigured(address configurer, uint256 date);
    event FundsAdded(address indexed investor, uint256 amount, uint256 date);
    event FundsWithdrawn(address indexed investor, uint256 amount, uint256 date);
    event FundsReleasedToIco(uint256 totalInvestmentAmount, uint256 subsidyAmount, uint256 feeAmount,  address tokenSaleAddress, uint256 date);
    event TokensClaimed(address indexed investor, uint256 investmentAmount, uint256 tokensTransferred, uint256 date);
    event InvestorKicked(address indexed investor, uint256 fee, uint256 amount, string reason, uint256 date);
    event RefundClaimed(address indexed investor, uint256 amount, uint256 date);
    event AuthorizedAddressConfigured(address initiator, uint256 date);
    event PoolConfigured(address initiator, address destination, address tokenAddress, string buyFnName, string claimFnName, string refundFnName, uint256 publicTokenPrice, uint256 groupTokenPrice, bool subsidy, uint256 date);

    event ClaimedTokensFromIco(address indexed owner, uint256 tokenBalance, uint256 date);
    event ClaimedRefundFromIco(address indexed owner, address initiator, uint256 refundedAmount, uint256 date);
    event NoRefundFromIco(address indexed owner, address initiator, uint256 date);

    /**
     * @dev Check the state of the watermark only if the current state is OPEN or WATERMARKREACHED
     */
    modifier assessWaterMark {
        _;

        if (poolStatus == Status.Open || poolStatus == Status.WaterMarkReached) { //Only worry about the watermark before the ICO has configured the "sale"
            if (totalPoolInvestments < waterMark) { //If the pool total drops below watermark, change status to OPEN
                poolStatus = Status.Open;
            } else if (totalPoolInvestments >= waterMark) { //If the pool total equals watermark or more, change status to WATERMARKREACHED
                poolStatus = Status.WaterMarkReached;
            }
        }
    }

    /**
     * @dev Start the timer to once the sale is configured - this gives time for investors to review where their funds will go before they are released to the configured address
     */
    modifier timedTransition {
        if (
            poolStatus == Status.DueDiligence &&
            reviewPeriodStart != 0 &&
            now >= reviewPeriodStart + dueDiligenceDuration
        ) {
            poolStatus = Status.InReview;
        }
        _;
    }

    /**
     * @dev Only allow sale owner to execute function
     */
    modifier onlyAuthorizedAddress {
        require (authorizedConfigurationAddress != 0x0 && msg.sender == authorizedConfigurationAddress);
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
     * @param _dueDiligenceDuration Duration in seconds of the due diligence state
     * @param _minPurchaseAmount Duration in seconds of the due diligence state
     * @param _minOraclizeFee Duration in seconds of the due diligence state
     */
    function IcoPoolParty(
        string _icoUrl,
        uint256 _waterMark,
        uint256 _feePercentage,
        uint256 _withdrawalFee,
        uint256 _groupDiscountPercent,
        address _poolPartyOwnerAddress,
        uint256 _dueDiligenceDuration,
        uint256 _minPurchaseAmount,
        uint256 _minOraclizeFee
    )
        public
    {
        icoUrl = _icoUrl;
        waterMark = _waterMark;
        feePercentage = _feePercentage;
        withdrawalFee = _withdrawalFee;
        expectedGroupDiscountPercent = _groupDiscountPercent;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        dueDiligenceDuration = _dueDiligenceDuration;
        minPurchaseAmount = _minPurchaseAmount;
        minOraclizeFee = _minOraclizeFee;
        poolParticipants = 0;
        reviewPeriodStart = 0;

        OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475); //TODO: ONLY USED FOR LOCAL TESTING
        PoolCreated(icoUrl, now);
    }

    /**
     * @dev Default fallback function
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
        require(msg.value >= minPurchaseAmount);

        Investor storage _investor = investors[msg.sender];

        if(_investor.isActive == false) {
            poolParticipants = poolParticipants.add(1);
            investorList.push(msg.sender);
            _investor.isActive = true;
            _investor.hasClaimedRefund = false;
            _investor.hasClaimedTokens = false;
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
        require(_investor.isActive);
        require(_investor.investmentAmount > 0);

        uint256 _amountToRefund = _investor.investmentAmount;
        uint256 _index = _investor.arrayIndex;
        delete investors[msg.sender];

        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);
        removeUserFromList(_index);
        poolParticipants = poolParticipants.sub(1);
        FundsWithdrawn(msg.sender, _amountToRefund, now);

        msg.sender.transfer(_amountToRefund);
    }

    /* TODO: REMOVE THIS FUNCTION WHEN DEPLOYING - ONLY USED TO SKIP ORACLIZE CALL */
    function setAuthorizedConfigurationAddressTest(address _authorizedAddress, bool _useWww)
        public
        payable
    {
        require(poolStatus == Status.WaterMarkReached);
        require(msg.value >= minOraclizeFee);
        configUrlRequiresWww = _useWww;
        authorizedConfigurationAddress = _authorizedAddress;
        AuthorizedAddressConfigured(msg.sender, now);
    }

    /**
     * @dev Oraclize call to get ICO owner from config page hosted on their domain
     * @param _useWww Whether or not to use www subdomain for the call to Oraclize
     */
    function setAuthorizedConfigurationAddress(bool _useWww)
        public
        payable
    {
        require(poolStatus == Status.WaterMarkReached);
        require(msg.value >= minOraclizeFee);

        configUrlRequiresWww = _useWww;
        oQueries.buildQueries(icoUrl, configUrlRequiresWww);
        oraclize_setProof(proofType_TLSNotary | proofStorage_IPFS);
        oraclizeQueryId = oraclize_query("URL", oQueries.oraclizeQueryAuthorizedConfigAddress);
    }

    /**
     * @dev Oraclize callback
     * @param _qId ID used to tie result back to the original query
     * @param _result Result of the oracle query
     */
    function __callback(bytes32 _qId, string _result, bytes _proof) public {
        require (msg.sender == oraclize_cbAddress());
        oraclizeProof = _proof;

        if(oraclizeQueryId == _qId) {
            authorizedConfigurationAddress = parseAddr(_result);
            oraclizeQueryId = 0x0;

            AuthorizedAddressConfigured(msg.sender, now);
        }
    }

    /**
     * @dev Configure sale parameters - only the authorized address can do this
     * @param _destination Address where the pool funds will be sent once released to the ICO
     * @param _tokenAddress Address of the token being bought (must be an ERC20 token)
     * @param _buyFnName Name of the buy function in the "sale" contract
     * @param _claimFnName Name of the claim tokens function in the "sale" contract
     * @param _refundFnName Name of the claim refund function in the "sale" contract
     * @param _publicTokenPrice Price of the token if bought directly from the ICO
     * @param _groupTokenPrice Discounted price of the token for participants in the pool
     * @param _subsidy Whether a subsidy amount is due by the ICO holder when releasing the funds
     */
    function configurePool(
        address _destination,
        address _tokenAddress,
        string _buyFnName,
        string _claimFnName,
        string _refundFnName,
        uint256 _publicTokenPrice,
        uint256 _groupTokenPrice,
        bool _subsidy
    )
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.WaterMarkReached);
        require(
            _destination != 0x0 &&
            _tokenAddress != 0x0 &&
            bytes(_buyFnName).length > 0 &&
            bytes(_refundFnName).length > 0 &&
            bytes(_claimFnName).length > 0 &&
            _publicTokenPrice > 0 &&
            _groupTokenPrice > 0
        );

        destinationAddress = _destination;
        tokenAddress = IErc20Token(_tokenAddress);
        buyFunctionName = _buyFnName;
        hashedBuyFunctionName = keccak256(buyFunctionName);
        refundFunctionName = _refundFnName;
        hashedRefundFunctionName = keccak256(refundFunctionName);
        claimFunctionName = _claimFnName;
        hashedClaimFunctionName = keccak256(claimFunctionName);
        publicEthPricePerToken = _publicTokenPrice;
        groupEthPricePerToken = _groupTokenPrice;
        subsidyRequired = _subsidy;

        PoolConfigured(msg.sender, _destination, _tokenAddress, _buyFnName, _claimFnName, _refundFnName, _publicTokenPrice, _groupTokenPrice, _subsidy, now);
    }


    /**
     * @dev Complete the configuration and start the 7 day timer for participants to review the configured parameters - only the authorized address can do this
     */
    function completeConfiguration()
        public
        onlyAuthorizedAddress
    {
        require(
            destinationAddress != 0x0 &&
            address(tokenAddress) != 0x0 &&
            hashedBuyFunctionName != 0x0 &&
            hashedRefundFunctionName != 0x0 &&
            hashedClaimFunctionName != 0x0 &&
            publicEthPricePerToken > 0 &&
            groupEthPricePerToken > 0
        );
        //Check that the groupTokenPrice is at least the correct percentage off => 0.005 - (0.005 * 15%)
        expectedGroupTokenPrice = publicEthPricePerToken.sub(publicEthPricePerToken.mul(expectedGroupDiscountPercent).div(100));
        require (expectedGroupTokenPrice >= groupEthPricePerToken);

        uint8 decimals = tokenAddress.decimals();
        tokenPrecision = power(10, decimals);

        actualGroupDiscountPercent = (publicEthPricePerToken.sub(groupEthPricePerToken)).mul(100).div(publicEthPricePerToken);

        poolStatus = Status.DueDiligence;
        reviewPeriodStart = now;
        SaleDetailsConfigured(msg.sender, now);
    }

    /**
     * @dev Allows owners to remove investors who do not comply with KYC. A small fee is charged to the person being kicked from the pool (only enough to cover gas costs of the transaction)
     * @param _userToKick Address of the person to kick from the pool.
     */
    function kickUser(address _userToKick, string _reason)
        public
        timedTransition
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.InReview);

        Investor storage _kickedUser = investors[_userToKick];
        uint256 _amountToRefund = _kickedUser.investmentAmount;
        uint256 _index = _kickedUser.arrayIndex;
        require(_amountToRefund > 0);
        delete investors[_userToKick];

        poolParticipants = poolParticipants.sub(1);
        removeUserFromList(_index);
        totalPoolInvestments = totalPoolInvestments.sub(_amountToRefund);

        //fee to cover gas costs for being kicked - taken from investor
        uint256 _fee = _amountToRefund < withdrawalFee ? _amountToRefund : withdrawalFee;
        InvestorKicked(_userToKick, _fee, _amountToRefund.sub(_fee), _reason, now);

        msg.sender.transfer(_fee);
        _userToKick.transfer(_amountToRefund.sub(_fee));
    }

    /**
     * @dev Once due diligence duration has passed since the configuration was completed, the pool funds can be released to the Sale contract in exchange for tokens - only the authorized address can do this
     *      address.call is used to get around the fact that the minimum gas amount is sent with a .send or .transfer - this call needs more than the minimum
     */
    function releaseFundsToSale()
        public
        timedTransition
        onlyAuthorizedAddress
        payable
    {
        require(poolStatus == Status.InReview);

        //The fee must be paid by the caller of this function - which is authorizedConfigurationAddress
        uint256 _feeAmount = totalPoolInvestments.mul(feePercentage).div(100);
        uint256 _amountToRelease = 0;
        uint256 _actualSubsidy = 0;

        if (subsidyRequired) { //If a subsidy is required, calculate the subsidy amount which should be sent to this function at time of calling
            uint256 _groupContributionPercent = uint256(100).sub(actualGroupDiscountPercent);
            _amountToRelease = totalPoolInvestments.mul(100).div(_groupContributionPercent);
            _actualSubsidy = _amountToRelease.sub(totalPoolInvestments);
            require(msg.value >= _actualSubsidy.add(_feeAmount)); //Amount sent to the function should be the subsidy amount + the fee
        } else { //No subsidy, only fee has to be paid
            require(msg.value >= _feeAmount);
            _amountToRelease = totalPoolInvestments;
        }

        poolSubsidyAmount = _actualSubsidy;

        //Transfer the fee to pool party owners
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
     * @dev If tokens are not minted by ICO at time of purchase, they need to be claimed once the sale is over - only the authorized address can do this.
     */
    function claimTokensFromIco()
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.InReview);
        require(totalTokensReceived == 0);

        if (hashedClaimFunctionName != keccak256("N/A")) {
            require(destinationAddress.call(bytes4(hashedClaimFunctionName)));
        }

        totalTokensReceived = tokenAddress.balanceOf(address(this));
        if (totalTokensReceived > 0) {
            poolStatus = Status.Claim;
            ClaimedTokensFromIco(address(this), totalTokensReceived, now);
        }
    }

    /*
	 * INTEGRATION POINT WITH SALE CONTRACT
	 * @dev In the case that the token sale is unsuccessful, withdraw funds from Sale Contract back to this contract in order for investors to claim their refund - only the authorized address can do this
     */
    function claimRefundFromIco()
        public
        onlyAuthorizedAddress
    {
        require(poolStatus == Status.InReview);
        require(totalTokensReceived == 0);

        require(destinationAddress.call(bytes4(hashedRefundFunctionName)));

        if (this.balance >= totalPoolInvestments) {
            poolStatus = Status.Claim;
            balanceRemainingSnapshot = this.balance.sub(poolSubsidyAmount);
            msg.sender.transfer(poolSubsidyAmount);
            ClaimedRefundFromIco(address(this), msg.sender, balanceRemainingSnapshot, now);
        } else {
            NoRefundFromIco(address(this), msg.sender, now);
        }
    }

    /**
     * @dev Call by each pool participant. Tokens are distributed proportionately to how much the caller contributed.
     */
    function claimTokens() public {
        Investor storage _investor = investors[msg.sender];
        require(poolStatus == Status.Claim);
        require(totalTokensReceived > 0);
        require(_investor.isActive);
        require(_investor.investmentAmount > 0);
        require(!_investor.hasClaimedTokens);

        _investor.hasClaimedTokens = true;
        calculateAndStoreDerivedValues(msg.sender);

        TokensClaimed(msg.sender, _investor.investmentAmount, _investor.tokensDue, now);
        tokenAddress.transfer(msg.sender, _investor.tokensDue);
    }

    /**
     * @dev Call by each pool participant. If there are any funds left in the contract after the sale completes, participants are entitled to claim their share proportionality to how much they contributed
     *      Once refund is claimed, this function cannot be called again
     */
    function claimRefund() public {
        Investor storage _investor = investors[msg.sender];
        require(poolStatus == Status.Claim);
        require(_investor.isActive);
        require(_investor.investmentAmount > 0);
        require(!_investor.hasClaimedRefund);

        _investor.hasClaimedRefund = true;
        calculateAndStoreDerivedValues(msg.sender);

        RefundClaimed(msg.sender, _investor.refundAmount, now);
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
        return (destinationAddress, tokenAddress, authorizedConfigurationAddress, publicEthPricePerToken, groupEthPricePerToken, subsidyRequired, buyFunctionName, refundFunctionName, claimFunctionName);
    }

    /**
     * @dev Returns all relevant pool details in 1 function
     */
    function getPoolDetails()
        public
        view
        returns (Status, uint256, uint256, uint256, uint256, uint256)
    {
        return (poolStatus, totalPoolInvestments, poolParticipants, withdrawalFee, waterMark, reviewPeriodStart);
    }

    /**
     * @dev Allows anyone to query the percentage contribution, refund amount and tokens due for a given address. If no tokens have been received by the sale contract, returns 0
     * @param _user The user address of the account to look up
     */
    function getContributionsDue(address _user)
        public
        view
        returns (uint256, uint256, uint256, bool, bool)
    {
        if (poolStatus != Status.Claim) {return (0, 0, 0, false, false);}

        Investor storage _investor = investors[_user];
        var (_percentageContribution, _refundAmount, _tokensDue) = calculateDerivedValues(_investor.investmentAmount);
        return (_percentageContribution, _refundAmount, _tokensDue, _investor.hasClaimedRefund, _investor.hasClaimedTokens);
    }

    /**********************/
    /* INTERNAL FUNCTIONS */
    /**********************/

    /**
     * @dev Internal function to store the calculated percentage contribution, refund amount and tokens due of a participant - values stored in the investor struct
     * @param _user The user to calculate the values for
     */
    function calculateAndStoreDerivedValues(address _user) internal {
        Investor storage _investor = investors[_user];

        if (_investor.percentageContribution == 0) {
            var (_percentageContribution, _refundAmount, _tokensDue) = calculateDerivedValues(_investor.investmentAmount);
            _investor.percentageContribution = _percentageContribution;
            _investor.refundAmount = _refundAmount;
            _investor.tokensDue = _tokensDue;
        }
    }

    /**
     * @dev Internal function that calculates a participants contribution percentage, refund amount and tokens due based on the amount originally contributed and total pool size
     * @param _investmentAmount Amount used to do the calculation
     */
    function calculateDerivedValues(uint256 _investmentAmount)
        internal
        returns (uint256, uint256, uint256)
    {
        uint256 _percentageContribution = _investmentAmount.mul(100).mul(DECIMAL_PRECISION).div(totalPoolInvestments);
        uint256 _refundAmount = balanceRemainingSnapshot.mul(_percentageContribution).div(100).div(DECIMAL_PRECISION);
        uint256 _tokensDue = totalTokensReceived.mul(_percentageContribution).div(100).div(DECIMAL_PRECISION);

        return (_percentageContribution, _refundAmount, _tokensDue);
    }

    /**
     * @dev Move the last element of the array to the index of the element being deleted, update the index of the item being moved, delete the last element of the
     *      array (because its now at position _index), reduce the size of the array
     */
    function removeUserFromList(uint256 _index) internal {
        investorList[_index] = investorList[investorList.length - 1];
        investors[investorList[_index]].arrayIndex = _index;
        delete investorList[investorList.length - 1];
        investorList.length--;
    }

    /**
     * @dev Set precision based on decimal places in the token
     */
    function power(uint256 _a, uint256 _b) internal returns (uint256) {
        return _a ** _b;
    }
}