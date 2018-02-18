pragma solidity ^0.4.18;

contract IErc20Token {
    uint8 public decimals;

    function transfer(address _to, uint256 _value) public returns (bool);

    function balanceOf(address _owner) public constant returns (uint256 balance);
}
