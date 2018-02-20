pragma solidity ^0.4.18;

import "./strings.sol";

library OraclizeQueryBuilder {
    using strings for *;
    struct OraclizeQueries {
        string oraclizeQueryDestinationAddress;
        string oraclizeQueryTokenAddress;
        string oraclizeQuerySaleOwnerAddress;
        string oraclizeQueryBuyFunction;
        string oraclizeQueryRefundFunction;
        string oraclizeQueryClaimFunction;
        string oraclizeQueryPublicEthPricePerToken;
        string oraclizeQueryGroupEthPricePerToken;
        string oraclizeQuerySubsidyRequired;
    }

    function buildQueries(OraclizeQueries storage self, string _icoUrl) {
        self.oraclizeQueryDestinationAddress = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).destinationAddress".toSlice());
        self.oraclizeQueryTokenAddress = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).tokenAddress".toSlice());
        self.oraclizeQuerySaleOwnerAddress = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).saleOwnerAddress".toSlice());
        self.oraclizeQueryBuyFunction = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).buyFunction".toSlice());
        self.oraclizeQueryRefundFunction = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).refundFunction".toSlice());
        self.oraclizeQueryClaimFunction = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).claimFunction".toSlice());
        self.oraclizeQueryPublicEthPricePerToken = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).publicETHPricePerToken".toSlice());
        self.oraclizeQueryGroupEthPricePerToken = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).groupETHPricePerToken".toSlice());
        self.oraclizeQuerySubsidyRequired = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).subsidyRequired".toSlice());
    }
}
