import expectThrow from './../helpers/expectThrow';

const icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
const icoPoolParty = artifacts.require('./IcoPoolParty');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};
const FactoryDefaultConfig = {FeePercentage: 4, WithdrawlFee: web3.toWei("0.0015"), GroupDiscountPercent: 15, WaterMark: web3.toWei("15")};

contract('IcoPoolPartyFactory Contract', (accounts) => {
    const [deployer, investor1, investor2, investor3, investor4] = accounts;
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    beforeEach(async () => {
        icoPoolPartyFactoryContract = await icoPoolPartyFactory.new();
    });

    describe('Function: createNewPoolParty', () => {
        it('should create new pool', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor1});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));
            assert.equal(await icoPoolPartyContract.icoUrl(), "api.test.foreground.io", "Incorrect pool details");
        });

        it('should attempt to create new pool with empty domain name', async () => {
            await expectThrow(icoPoolPartyFactoryContract.createNewPoolParty("", {from:investor1}));
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 0, "Too many contracts in the list");
        });

        it('should create new pool with really long name', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("thisisareallylongdomainnameonpurposetotestthecontractthoroughlytoseeifithandleslengthcorrectlyandthisisaddedjusttomakeitevenlongerbecausewhynotright.com", {from:investor1});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 1, "Incorrect number of entries in the list");
        });

        it('should attempt to create pool with same name as already existing', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor1});
            await expectThrow(icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor2}));
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 1, "Too many contracts in the list");
        });

        it('should create multiple new pools', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("test1.com", {from:investor1});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));
            assert.equal(await icoPoolPartyContract.feePercentage(), FactoryDefaultConfig.FeePercentage, "Incorrect fee percentage");
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 1, "Incorrect number of entries in the list");

            await icoPoolPartyFactoryContract.createNewPoolParty("test2.com", {from:investor2});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(1));
            assert.equal(await icoPoolPartyContract.withdrawalFee(), FactoryDefaultConfig.WithdrawlFee, "Incorrect withdrawal fee");
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 2, "Incorrect number of entries in the list");

            await icoPoolPartyFactoryContract.createNewPoolParty("test3.com", {from:investor3});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(2));
            assert.equal(await icoPoolPartyContract.expectedGroupDiscountPercent(), FactoryDefaultConfig.GroupDiscountPercent, "Incorrect group discount percentage");
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 3, "Incorrect number of entries in the list");

            await icoPoolPartyFactoryContract.createNewPoolParty("test4.com", {from:investor4});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(3));
            assert.equal(await icoPoolPartyContract.waterMark(), FactoryDefaultConfig.WaterMark, "Incorrect watermark");
            assert.equal(await icoPoolPartyFactoryContract.getPartyListSize(), 4, "Incorrect number of entries in the list");
        });
    });

    describe('Function: getContractAddressByName', () => {
        it('should get the address of the pool party contract by name', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor1});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));

            const poolAddress = await icoPoolPartyFactoryContract.getContractAddressByName("api.test.foreground.io");
            assert.equal(poolAddress, icoPoolPartyContract.address, "Incorrect address for pool party contract");
        });

        it('should attempt to get the address of a contract that does not exist', async () => {
            const poolAddress = await icoPoolPartyFactoryContract.getContractAddressByName("notfound.com");
            assert.equal(poolAddress, ZERO_ADDRESS, "Pool address should be 0");
        });
    });

    describe.skip('Function: setFeePercentage', () => {
        it('should ...', async () => {
        });
    });

    describe.skip('Function: setWithdrawalFee', () => {
        it('should ...', async () => {
        });
    });

    describe.skip('Function: setGroupPurchaseDiscountPercentage', () => {
        it('should ...', async () => {
        });
    });

    describe.skip('Function: setWaterMark', () => {
        it('should ...', async () => {
        });
    });
});

