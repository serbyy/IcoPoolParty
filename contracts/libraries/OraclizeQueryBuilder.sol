pragma solidity ^0.4.18;

import "./strings.sol";

library OraclizeQueryBuilder {
    using strings for *;
    struct OraclizeQueries {
        string oraclizeQueryAuthorizedConfigAddress;
    }

    function buildQueries(OraclizeQueries storage self, string _icoUrl, bool _useWww) internal {
        self.oraclizeQueryAuthorizedConfigAddress = _useWww ?
        ("json(https://www.".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/ppconfig).saleOwnerAddress".toSlice()) :
        ("json(https://".toSlice().concat(_icoUrl.toSlice())).toSlice().concat("/ppconfig).saleOwnerAddress".toSlice());
    }
}
