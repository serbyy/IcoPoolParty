import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FactoryDefaultConfig = {
    FeePercentage: 4,
    WithdrawlFee: web3.toWei("0.0015"),
    GroupDiscountPercent: 15,
    WaterMark: web3.toWei("15")
};

let icoPoolPartyFactory;
let icoPoolParty;

contract('IcoPoolPartyFactory Contract', (accounts) => {
    const [_deployer, _creator1, _creator2, _creator3, _newOwner] = accounts;

    beforeEach(async () => {
        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
    });

    describe('Function: createNewPoolParty', () => {
        it('should create new pool', async () => {
            await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _creator1});
            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
            assert.equal(await icoPoolParty.icoUrl(), "api.test.foreground.io", "Incorrect pool details");
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 1, "Incorrect number of entries in the list");
        });

        it('should attempt to create new pool with empty domain name', async () => {
            await expectThrow(icoPoolPartyFactory.createNewPoolParty("", {from: _creator1}));
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 0, "Too many contracts in the list");
        });

        it('should create new pool with really long name', async () => {
            await icoPoolPartyFactory.createNewPoolParty("thisisareallylongdomainnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisi" +
                "saddedjusttomakeitevenlongerbecausewhynotrightthisisareallylongdomainnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisisad" +
                "dedjusttomakeitevenlongerbecausewhynotrightandmaybejustalittlelongertobeabsolutelysureitworksok.com", {from: _creator1});
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 1, "Incorrect number of entries in the list");
        });

        it('should attempt to create pool with same name as already existing', async () => {
            await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _creator1});
            await expectThrow(icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _creator2}));
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 1, "Too many contracts in the list");
        });

        it('should create multiple new pools', async () => {
            await icoPoolPartyFactory.createNewPoolParty("test1.com", {from: _creator1});
            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));
            assert.equal(await icoPoolParty.feePercentage(), FactoryDefaultConfig.FeePercentage, "Incorrect fee percentage");
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 1, "Incorrect number of entries in the list");

            await icoPoolPartyFactory.createNewPoolParty("test2.com", {from: _creator2});
            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(1));
            assert.equal(await icoPoolParty.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Incorrect withdrawal fee");
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 2, "Incorrect number of entries in the list");

            await icoPoolPartyFactory.createNewPoolParty("test3.com", {from: _creator3});
            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(2));
            assert.equal(await icoPoolParty.expectedGroupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Incorrect group discount percentage");
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 3, "Incorrect number of entries in the list");

            await icoPoolPartyFactory.createNewPoolParty("test4.com", {from: _creator2});
            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(3));
            assert.equal(await icoPoolParty.waterMark(), FactoryDefaultConfig.WaterMark, "Incorrect watermark");
            assert.equal(await icoPoolPartyFactory.getPartyListSize(), 4, "Incorrect number of entries in the list");
        });
    });

    describe('Function: getContractAddressByName', () => {
        it('should get the address of the pool party contract by name', async () => {
            await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _creator1});
            icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));

            const poolAddress = await icoPoolPartyFactory.getContractAddressByName("api.test.foreground.io");
            assert.equal(poolAddress, icoPoolParty.address, "Incorrect address for pool party contract");
        });

        it('should attempt to get the address of a contract that does not exist', async () => {
            const poolAddress = await icoPoolPartyFactory.getContractAddressByName("notfound.com");
            assert.equal(poolAddress, ZERO_ADDRESS, "Pool address should be 0");
        });
    });

    describe('Function: setFeePercentage', () => {
        it('should set a new fee percentage', async () => {
            await icoPoolPartyFactory.setFeePercentage(5, {from: _deployer});
            assert.equal(await icoPoolPartyFactory.feePercentage(), 5, "Incorrect fee percentage");
            assert.notEqual(await icoPoolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage did not change");

            await icoPoolPartyFactory.setFeePercentage(50, {from: _deployer});
            assert.equal(await icoPoolPartyFactory.feePercentage(), 50, "Incorrect fee percentage");
            assert.notEqual(await icoPoolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage did not change");
        });

        it('should attempt to set a new fee percentage with non owner account', async () => {
            await expectThrow(icoPoolPartyFactory.setFeePercentage(10, {from: _creator1}));
            assert.notEqual(await icoPoolPartyFactory.feePercentage(), 10, "Fee percentage changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage changed when it shouldn't have");
        });

        it('should attempt to set a new fee percentage above 50%', async () => {
            await expectThrow(icoPoolPartyFactory.setFeePercentage(51, {from: _deployer}));
            assert.notEqual(await icoPoolPartyFactory.feePercentage(), 51, "Fee percentage changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage changed when it shouldn't have");

            await expectThrow(icoPoolPartyFactory.setFeePercentage(138, {from: _deployer}));
            assert.notEqual(await icoPoolPartyFactory.feePercentage(), 138, "Fee percentage changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.feePercentage(), FactoryDefaultConfig.FeePercentage, "Fee percentage changed when it shouldn't have");
        });
    });

    describe('Function: setWithdrawalFeeAmount', () => {
        it('should set a new withdrawal fee', async () => {
            await icoPoolPartyFactory.setWithdrawalFeeAmount(web3.toWei("0.01"), {from: _deployer});
            assert.equal(await icoPoolPartyFactory.withdrawalFee(), web3.toWei("0.01"), "Incorrect withdrawal fee");
            assert.notEqual(await icoPoolPartyFactory.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Withdrawal fee did not change");
        });

        it('should attempt to set a new withdrawal fee with non owner account', async () => {
            await expectThrow(icoPoolPartyFactory.setWithdrawalFeeAmount(web3.toWei("0.95"), {from: _creator1}));
            assert.notEqual(await icoPoolPartyFactory.withdrawalFee(), web3.toWei("0.95"), "Withdrawal fee changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Withdrawal fee changed when it shouldn't have");
        });
    });

    describe('Function: setGroupPurchaseDiscountPercentage', () => {
        it('should set a new group discount percentage', async () => {
            await icoPoolPartyFactory.setGroupPurchaseDiscountPercentage(35, {from: _deployer});
            assert.equal(await icoPoolPartyFactory.groupDiscountPercent(), 35, "Incorrect group discount percentage");
            assert.notEqual(await icoPoolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage did not change");

            await icoPoolPartyFactory.setGroupPurchaseDiscountPercentage(100, {from: _deployer});
            assert.equal(await icoPoolPartyFactory.groupDiscountPercent(), 100, "Group discount percentage did not change when it shouldn't have");
            assert.notEqual(await icoPoolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage did not change");
        });

        it('should attempt to set a new group discount percentage with non owner account', async () => {
            await expectThrow(icoPoolPartyFactory.setGroupPurchaseDiscountPercentage(7, {from: _creator1}));
            assert.notEqual(await icoPoolPartyFactory.groupDiscountPercent(), 7, "Group discount percentage changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage changed when it shouldn't have");
        });

        it('should attempt to set a new group discount percentage greater than 100%', async () => {
            await expectThrow(icoPoolPartyFactory.setGroupPurchaseDiscountPercentage(101, {from: _deployer}));
            assert.notEqual(await icoPoolPartyFactory.groupDiscountPercent(), 101, "Group discount percentage changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage changed when it shouldn't have");

            await expectThrow(icoPoolPartyFactory.setGroupPurchaseDiscountPercentage(150, {from: _deployer}));
            assert.notEqual(await icoPoolPartyFactory.groupDiscountPercent(), 150, "Group discount percentage changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.groupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Group discount percentage changed when it shouldn't have");
        });
    });

    describe('Function: setWaterMark', () => {
        it('should set a new watermark', async () => {
            await icoPoolPartyFactory.setWaterMark(web3.toWei("200"), {from: _deployer});
            assert.equal(await icoPoolPartyFactory.waterMark(), web3.toWei("200"), "Incorrect watermark");
            assert.notEqual(await icoPoolPartyFactory.waterMark(), FactoryDefaultConfig.WaterMark, "Watermark did not change");
        });

        it('should attempt to set a new withdrawal fee with non owner account', async () => {
            await expectThrow(icoPoolPartyFactory.setWaterMark(web3.toWei("20"), {from: _creator1}));
            assert.notEqual(await icoPoolPartyFactory.waterMark(), web3.toWei("20"), "Watermark changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.waterMark(), FactoryDefaultConfig.WaterMark, "Watermark changed when it shouldn't have");
        });
    });

    describe('Function: setPoolPartyOwnerAddress', () => {
        it('should set a new Pool Party owner address', async () => {
            await icoPoolPartyFactory.setPoolPartyOwnerAddress(_newOwner, {from: _deployer});
            assert.equal(await icoPoolPartyFactory.poolPartyOwnerAddress(), _newOwner, "Incorrect PP owner");
            assert.notEqual(await icoPoolPartyFactory.waterMark(), _deployer, "PP owner did not change");
        });

        it('should attempt to set a new pool Party owner with non owner account', async () => {
            await expectThrow(icoPoolPartyFactory.setPoolPartyOwnerAddress(_newOwner, {from: _creator1}));
            assert.notEqual(await icoPoolPartyFactory.poolPartyOwnerAddress(), _newOwner, "PP owner changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.poolPartyOwnerAddress(), _deployer, "PP owner changed when it shouldn't have");
        });

        it('should attempt to set a new pool Party owner to blank address', async () => {
            await expectThrow(icoPoolPartyFactory.setPoolPartyOwnerAddress(ZERO_ADDRESS, {from: _deployer}));
            assert.notEqual(await icoPoolPartyFactory.poolPartyOwnerAddress(), ZERO_ADDRESS, "PP owner changed when it shouldn't have");
            assert.equal(await icoPoolPartyFactory.poolPartyOwnerAddress(), _deployer, "PP owner changed when it shouldn't have");
        });
    });
});

