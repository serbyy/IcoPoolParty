pragma solidity ^0.4.18;

import "./IcoPoolParty.sol";

/**
 * @title IcoPoolPartyFactory
 * @dev Factory to create individual Pool Party contracts. Controls default value that pools are created with
 * @author - Shane van Coller
 */
contract IcoPoolPartyFactory is Ownable {

    uint256 public feePercentage;
    uint256 public withdrawalFee;
    uint256 public groupDiscountPercent;
    uint256 public waterMark;

    address public poolPartyOwnerAddress;

    address[] public partyList;
    mapping(bytes32 => address) hashedPoolAddress;

    event PoolPartyCreated(address indexed poolAddress, address indexed creator, string poolUrl, uint256 date);
    event FeePercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WithdrawalFeeUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event GroupDiscountPercentageUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);
    event WaterMarkUpdate(address indexed updater, uint256 oldValue, uint256 newValue, uint256 date);

    /**
     * @dev Constructor for the Pool Party Factory
     * @param _poolPartyOwnerAddress Account that the fee for the pool party service goes to
     */
    function IcoPoolPartyFactory(address _poolPartyOwnerAddress) public {
        require(_poolPartyOwnerAddress != 0x0);
        feePercentage = 4;
        withdrawalFee = 0.0015 ether;
        groupDiscountPercent = 15;
        waterMark = 15 ether;
        poolPartyOwnerAddress = _poolPartyOwnerAddress;
    }

    /**
     * @notice Creates a new pool with the ICO's official URL.
     * @param _icoUrl The official URL for the ICO. Must be unique. Confirmation from the ICO about this pool will be posted at this URL
     */
    function createNewPoolParty(string _icoUrl) public {
        require(bytes(_icoUrl).length != 0); //Check if url is empty

        bytes32 _hashedIcoUrl = keccak256(_icoUrl);
        require(hashedPoolAddress[_hashedIcoUrl] == 0x0); //Check if name already exists

        IcoPoolParty poolPartyContract = new IcoPoolParty(_icoUrl, waterMark, feePercentage, withdrawalFee, groupDiscountPercent, poolPartyOwnerAddress);
        poolPartyContract.transferOwnership(msg.sender);
        partyList.push(address(poolPartyContract));
        hashedPoolAddress[_hashedIcoUrl] = address(poolPartyContract);

        PoolPartyCreated(poolPartyContract, msg.sender, _icoUrl, now);
    }

    /**
     * @notice Gets the address of the contract created for a given URL
     * @dev Name is hashed so that it can be used as the key for the mapping - hashing it allows for that name to be an arbitrary length but always stored as bytes32
     * @param _icoUrl URL of to lookup
     */
    function getContractAddressByName(string _icoUrl)
        public
        view
        returns(address)
    {
        return hashedPoolAddress[keccak256(_icoUrl)];
    }

    /**
     * @dev Gets the size of the partyList array
     * @return Size of array
     */
    function getPartyListSize()
        public
        view
        returns(uint256)
    {
        return partyList.length;
    }

    /**
     * @dev Set the percentage fee that we take for using this service
     * @param _feePercentage The new fee as a percentage
     */
    function setFeePercentage(uint256 _feePercentage) public onlyOwner {
        require(_feePercentage <= 50);
        uint256 _oldValue = feePercentage;
        feePercentage = _feePercentage;

        FeePercentageUpdate(msg.sender, _oldValue, _feePercentage, now);
    }

    /**
     * @dev Set the withdrawal fee - used when a person gets kicked from the pool due to KYC
     * @param _withdrawalFee The new withdrawal fee in wei
     */
    function setWithdrawalFeeAmount(uint256 _withdrawalFee) public onlyOwner {
        uint256 _oldValue = withdrawalFee;
        withdrawalFee = _withdrawalFee;

        WithdrawalFeeUpdate(msg.sender, _oldValue, _withdrawalFee, now);
    }

    /**
     * @dev Set the discount percentage for the pool - this is the percentage discount the group will get by participating in the pool
     * @param _discountPercent The new percentage discount
     */
    function setGroupPurchaseDiscountPercentage(uint256 _discountPercent) public onlyOwner {
        require(_discountPercent <= 100);
        uint256 _oldValue = groupDiscountPercent;
        groupDiscountPercent = _discountPercent;

        GroupDiscountPercentageUpdate(msg.sender, _oldValue, _discountPercent, now);
    }

    /**
     * @dev Sets the watermark the pool needs to reach in order to have the funds released to the ICO
     * @param _waterMark The new watermark in wei
     */
    function setWaterMark(uint256 _waterMark) public onlyOwner {
        uint256 _oldValue = waterMark;
        waterMark = _waterMark;

        WaterMarkUpdate(msg.sender, _oldValue, _waterMark, now);
    }

    /**
     * @dev Sets the Pool Party owner address. This is the address that the Pool Party fees go to. This is different from the owner of the contract
     * @param _newOwner Address of the new owner
     */
    function setPoolPartyOwnerAddress(address _newOwner) public onlyOwner {
        require(_newOwner != 0x0);
        poolPartyOwnerAddress = _newOwner;
    }
}
