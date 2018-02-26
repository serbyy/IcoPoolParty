pragma solidity ^0.4.18;

import "./strings.sol";

library OraclizeQueryBuilder {
    using strings for *;
    struct OraclizeQueries {
        string oraclizeQuerySaleOwnerAddress;
    }

    function buildQueries(OraclizeQueries storage self, string _icoUrl) internal {
        self.oraclizeQuerySaleOwnerAddress = ("json(http://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/pool/example?json=true).saleOwnerAddress".toSlice());
    }
}
