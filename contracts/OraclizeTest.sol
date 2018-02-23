pragma solidity ^0.4.18;

import "./usingOraclize.sol";
import "./libraries/OraclizeQueryBuilder.sol";

contract OracalizeTest is usingOraclize {
    using OraclizeQueryBuilder for OraclizeQueryBuilder.OraclizeQueries;

    string public buyFunctionName;
    string public refundFunctionName;
    string public claimFunctionName;

    bool public subsidyRequired;

    address public destinationAddress;
    address public tokenAddress;
    address public saleOwnerAddress;
    uint256 public publicEthPricePerToken;
    uint256 public groupEthPricePerToken;


    bytes32 hashedBuyFunctionName;
    bytes32 hashedRefundFunctionName;
    bytes32 hashedClaimFunctionName;

    string icoUrl = "api.test.foreground.io";

    mapping(bytes32 => bytes32) queryMapping;
    mapping(bytes32 => bytes) public parameterProof;

    OraclizeQueryBuilder.OraclizeQueries oQueries;

    function OracalizeTest() public {
        OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
        oQueries.buildQueries(icoUrl);
    }

    function __callback(bytes32 _qId, string _result, bytes _proof) public {
        require (msg.sender == oraclize_cbAddress());

        bytes32 paramToSet = queryMapping[_qId];
        delete queryMapping[_qId];

        parameterProof[paramToSet] = _proof;

        if(paramToSet == keccak256("destinationAddress")) {
            destinationAddress = parseAddr(_result);
            bytes32 _tokenAddressId = oraclize_query("URL", oQueries.oraclizeQueryTokenAddress);
            queryMapping[_tokenAddressId] = keccak256("tokenAddress");
        } else if (paramToSet == keccak256("tokenAddress")) {
            tokenAddress = parseAddr(_result);
            bytes32 _saleOwnerAddressId = oraclize_query("URL", oQueries.oraclizeQuerySaleOwnerAddress);
            queryMapping[_saleOwnerAddressId] = keccak256("saleOwnerAddress");
        } else if (paramToSet == keccak256("saleOwnerAddress")) {
            saleOwnerAddress = parseAddr(_result);
            bytes32 _buyFunctionId = oraclize_query("URL", oQueries.oraclizeQueryBuyFunction);
            queryMapping[_buyFunctionId] = keccak256("buyFunction");
        } else if (paramToSet == keccak256("buyFunction")) {
            buyFunctionName = _result;
            hashedBuyFunctionName = keccak256(buyFunctionName);
            bytes32 _refundFunctionId = oraclize_query("URL", oQueries.oraclizeQueryRefundFunction);
            queryMapping[_refundFunctionId] = keccak256("refundFunction");
        } else if (paramToSet == keccak256("refundFunction")) {
            refundFunctionName = _result;
            hashedRefundFunctionName = keccak256(refundFunctionName);
            bytes32 _claimFunctionId = oraclize_query("URL", oQueries.oraclizeQueryClaimFunction);
            queryMapping[_claimFunctionId] = keccak256("claimFunction");
        } else if (paramToSet == keccak256("claimFunction")) {
            claimFunctionName = _result;
            hashedClaimFunctionName = keccak256(claimFunctionName);
            bytes32 _publicEthId = oraclize_query("URL", oQueries.oraclizeQueryPublicEthPricePerToken);
            queryMapping[_publicEthId] = keccak256("publicETHPricePerToken");
        } else if (paramToSet == keccak256("publicETHPricePerToken")) {
            publicEthPricePerToken = parseInt(_result);
            bytes32 _groupEthId = oraclize_query("URL", oQueries.oraclizeQueryGroupEthPricePerToken);
            queryMapping[_groupEthId] = keccak256("groupETHPricePerToken");
        } else if (paramToSet == keccak256("groupETHPricePerToken")) {
            groupEthPricePerToken = parseInt(_result);
            bytes32 _subsidyId = oraclize_query("URL", oQueries.oraclizeQuerySubsidyRequired);
            queryMapping[_subsidyId] = keccak256("subsidyRequired");
        } else if (paramToSet == keccak256("subsidyRequired")) {
            subsidyRequired = keccak256(_result) == keccak256("false") ? false : true;
        }
    }

    function update() public payable {
        //URL must be HTTPS in order to get a proof back
        oraclize_setProof(proofType_TLSNotary | proofStorage_IPFS);
        bytes32 _qId = oraclize_query("URL", oQueries.oraclizeQueryDestinationAddress);
        queryMapping[_qId] = keccak256("destinationAddress");
    }
}
