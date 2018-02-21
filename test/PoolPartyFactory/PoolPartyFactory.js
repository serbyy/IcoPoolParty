/*global artifacts*/
const icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
const icoPoolParty = artifacts.require('./IcoPoolParty');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};

contract('IcoPoolPartyFactory', (accounts) => {

    const [deployer, investor1, investor2] = accounts;

    beforeEach(async () => {
        icoPoolPartyFactoryContract = await icoPoolPartyFactory.new();
    });

    describe('Function: createNewPoolParty', () => {
        it('should add funds to pool in "Open" status', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor1});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));

            assert.equal(await icoPoolPartyContract.icoUrl(), "api.test.foreground.io", "Incorrect pool details");

        });
    });

    describe('Function: getContractAddressByName', () => {
        it('should get the address of the pool party contract by name', async () => {
            await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor1});
            icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));

            const poolAddress = await icoPoolPartyFactoryContract.getContractAddressByName("api.test.foreground.io");
            assert.equal(poolAddress, icoPoolPartyContract.address, "Incorrect address for pool party contract");
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

