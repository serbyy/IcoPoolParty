pragma solidity ^0.4.18;

import "./IcoPoolParty.sol";

contract IcoPoolPartyFactory is Ownable {

    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public groupDiscountPercent;
    uint256 public waterMark;

    address public poolPartyOwnerAddress;
    address public serviceAccountAddress;

    address[] public partyList;
    mapping(bytes32 => address) public contractAddressByName;

    event PoolPartyCreated(address indexed poolAddress, address indexed creator, bytes32 poolUrl, uint256 date);
    event FeePercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WithdrawalFeeUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event GroupDiscountPercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event ServiceAccountUpdate(address indexed updater, address oldValue, address newValue, uint256 date);
    event WaterMarkUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);

    /**
     * @dev Constructor for the Pool Party Factory
     * @param _poolPartyOwnerAddress Account that the fee for the pool party service goes to
     * @param _serviceAccountAddress Account used by the hosted (trusted) service to update the ICO details (sale address, owner function names etc)
     */
    function IcoPoolPartyFactory(address _poolPartyOwnerAddress, address _serviceAccountAddress) public {
        feePercentage = 5;
        withdrawalFee = 0.0015 ether;
        groupDiscountPercent = 15;
        waterMark = 100 ether;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
        serviceAccountAddress = _serviceAccount;
    }

    /**
     * @notice Creates a new pool with the ICO's official URL
     * @param _icoUrl The official URL for the ICO. Confirmation from the ICO about this pool will be posted at this URL
     */
    function createNewPoolParty(bytes32 _icoUrl) public {
        IcoPoolParty poolPartyContract = new IcoPoolParty(_icoUrl, waterMark, feePercentage, withdrawalFee, groupDiscountPercent, poolPartyOwnerAddress, serviceAccountAddress);
        poolPartyContract.transferOwnership(msg.sender);
        partyList.push(address(poolPartyContract));
        contractAddressByName[bytes32(_icoUrl)] = address(poolPartyContract);

        PoolPartyCreated(poolPartyContract, msg.sender, _icoUrl, now);
    }


    /**
     * @dev Set the percentage fee that we take for using this service
     * @param _feePercentage The new fee as a percentage
     */
    function setFeePercentage(uint256 _feePercentage) public onlyOwner {
        uint256 _oldValue = feePercentage;
        feePercentage = _feePercentage;

        FeePercentageUpdate(msg.sender, _oldValue, _feePercentage, now);
    }

    /**
     * @dev Set the withdrawal fee - used when a person gets kicked from the pool due to KYC
     * @param _withdrawalFee The new withdrawal fee
     */
    function setWithdrawalFee(uint256 _withdrawalFee) public onlyOwner {
        uint256 _oldValue = withdrawalFee;
        withdrawalFee = _withdrawalFee;

        WithdrawalFeeUpdate(msg.sender, _oldValue, _withdrawalFee, now);
    }

    /**
     * @dev Set the discount percentage for the pool - this is the percentage discount the group will get by participating in the pool
     * @param _discountPercent The new percentage discount
     */
    function setGroupPurchaseDiscountPercentage(uint256 _discountPercent) public onlyOwner {
        uint256 _oldValue = groupDiscountPercent;
        groupDiscountPercent = _discountPercent;

        GroupDiscountPercentageUpdate(msg.sender, _oldValue, _discountPercent, now);
    }

    /**
     * @dev Set the service account address that is used by our hosted service
     * @param _serviceAccount The new service account address
     */
    function setServiceAccount(address _serviceAccount) public onlyOwner {
        address _oldValue = serviceAccountAddress;
        serviceAccountAddress = _serviceAccount;

        ServiceAccountUpdate(msg.sender, _oldValue, _serviceAccount, now);
    }

    /**
     * @dev Sets the watermark the pool needs to reach in order to have the funds released to the ICO
     * @param _waterMark The new watermark
     */
    function setWaterMark(uint256 _waterMark) public onlyOwner {
        uint256 _oldValue = waterMark;
        waterMark = _waterMark;

        WaterMarkUpdate(msg.sender, _oldValue, _waterMark, now);
    }
}
