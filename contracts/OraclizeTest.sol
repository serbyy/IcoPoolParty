pragma solidity ^0.4.18;

import "./usingOraclize.sol";
import "./libraries/OraclizeQueryBuilder.sol";

contract OracalizeTest is usingOraclize {
    using OraclizeQueryBuilder for OraclizeQueryBuilder.OraclizeQueries;

    address public authorizedConfigurationAddress;
    string icoUrl = "api.test.foreground.io";
    bytes32 oraclizeQueryId;
    bytes public oraclizeProof;

    OraclizeQueryBuilder.OraclizeQueries oQueries;

    function OracalizeTest() public {
        OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
        oQueries.buildQueries(icoUrl, false);
    }

    function __callback(bytes32 _qId, string _result, bytes _proof) public {
        require (msg.sender == oraclize_cbAddress());
        oraclizeProof = _proof;

        if (oraclizeQueryId == _qId) {
            authorizedConfigurationAddress = parseAddr(_result);
            oraclizeQueryId = 0x0;
        }
    }

    function update() public payable {
        //URL must be HTTPS in order to get a proof back
        oraclize_setProof(proofType_TLSNotary | proofStorage_IPFS);
        oraclizeQueryId = oraclize_query("URL", oQueries.oraclizeQueryAuthorizedConfigAddress);
    }
}
