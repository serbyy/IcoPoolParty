pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract GenericToken is MintableToken {
    string public constant name = "Generic Token";
    string public constant symbol = "GENX";
    uint8 public constant decimals = 18;

    /**
     * @dev - Empty constructor
     */
    function GenericToken() public {

    }
}
