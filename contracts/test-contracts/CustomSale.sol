pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./GenericToken.sol";

contract CustomSale is Ownable {
    GenericToken public token;
    uint256 tokenPrice;
    uint256 amountSentToSale;

    function () payable {}

    function CustomSale(uint256 _tokenPrice, address _token) public {
        tokenPrice = _tokenPrice;
        token = GenericToken(_token);
    }

    function buy() public payable {
        uint256 tokensToSend = msg.value*10**18/tokenPrice; //Precision is important here
        mintTokens(msg.sender, tokensToSend);
    }

    function buyWithIntentToRefund() public payable {
        //Does not mint tokens -- mimics a sale that eventually doesn't reach its goal
        amountSentToSale = msg.value;
    }

    function refund() public {
        msg.sender.transfer(amountSentToSale);
    }

    function mintTokens(address _recipient, uint256 _amount) public {
        token.mint(_recipient, _amount);
    }
}
