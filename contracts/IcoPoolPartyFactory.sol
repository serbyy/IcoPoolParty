pragma solidity ^0.4.18;

import "./IcoPoolParty.sol";

contract IcoPoolPartyFactory is Ownable {

    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public groupDiscountPercent;
    uint256 public waterMark;

    address public poolPartyOwnerAddress;
    address public serviceAccount;

    address[] public partyList;
    mapping(bytes32 => address) public contractAddressByName;

    event PoolPartyCreated(address indexed poolAddress, address indexed creator, bytes32 poolUrl, uint256 date);
    event FeePercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WithdrawalFeeUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event GroupDiscountPercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event ServiceAccountUpdate(address indexed updater, address oldValue, address newValue, uint256 date);
    event WaterMarkUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);

    function IcoPoolPartyFactory(address _poolPartyOwnerAddress, address _serviceAccount) public {
        feePercentage = 5;
        withdrawalFee = 0.0015 ether;
        groupDiscountPercent = 15;
        waterMark = 100 ether;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        serviceAccount = _serviceAccount;
    }

    function createNewPoolParty(bytes32 _icoUrl) public {
        IcoPoolParty poolPartyContract = new IcoPoolParty(_icoUrl, waterMark, feePercentage, withdrawalFee, groupDiscountPercent, poolPartyOwnerAddress, serviceAccount);
        poolPartyContract.transferOwnership(msg.sender);
        partyList.push(address(poolPartyContract));
        contractAddressByName[bytes32(_icoUrl)] = address(poolPartyContract);

        PoolPartyCreated(poolPartyContract, msg.sender, _icoUrl, now);
    }

    function setFeePercentage(uint256 _feePercentage) public onlyOwner {
        uint256 _oldValue = feePercentage;
        feePercentage = _feePercentage;

        FeePercentageUpdate(msg.sender, _oldValue, _feePercentage, now);
    }

    function setWithdrawalFee(uint256 _withdrawalFee) public onlyOwner {
        uint256 _oldValue = withdrawalFee;
        withdrawalFee = _withdrawalFee;

        WithdrawalFeeUpdate(msg.sender, _oldValue, _withdrawalFee, now);
    }

    function setGroupPurchaseDiscountPercentage(uint256 _discountPercent) public onlyOwner {
        uint256 _oldValue = groupDiscountPercent;
        groupDiscountPercent = _discountPercent;

        GroupDiscountPercentageUpdate(msg.sender, _oldValue, _discountPercent, now);
    }

    function setServiceAccount(address _serviceAccount) public onlyOwner {
        address _oldValue = serviceAccount;
        serviceAccount = _serviceAccount;

        ServiceAccountUpdate(msg.sender, _oldValue, _serviceAccount, now);
    }

    function setWaterMark(uint256 _waterMark) public onlyOwner {
        uint256 _oldValue = waterMark;
        waterMark = _waterMark;

        WaterMarkUpdate(msg.sender, _oldValue, _waterMark, now);
    }
}
