let icoPoolPartyFactory = artifacts.require('./IcoPoolPartyFactory');
let icoPoolParty = artifacts.require('./IcoPoolParty');

let icoPoolPartyFactoryContract;
let icoPoolPartyContract;

const Status = {Open: 0, WaterMarkReached: 1, DueDiligence: 2, InReview: 3, Claim: 4, Refunding: 5};

contract('IcoPoolParty', (accounts) => {
    const [deployer, investor1, investor2] = accounts;

    beforeEach(async () => {
        icoPoolPartyFactoryContract = await icoPoolPartyFactory.new();
        await icoPoolPartyFactoryContract.createNewPoolParty("api.test.foreground.io", {from:investor1});
        icoPoolPartyContract = icoPoolParty.at(await icoPoolPartyFactoryContract.partyList(0));
    });

    describe('Function: addFundsToPool', () => {
        it('should add funds to pool in "Open" status', async () => {
            assert.equal(await icoPoolPartyContract.poolStatus(), Status.Open, "Pool in incorrect status");

            await icoPoolPartyContract.addFundsToPool({from: investor1, value: web3.toWei("6", "ether")});
            assert.equal((await icoPoolPartyContract.investors(investor1))[0], web3.toWei("6", "ether"), "Incorrect investment amount balance");
            assert.equal(await icoPoolPartyContract.totalPoolInvestments(), web3.toWei("6", "ether"), "Incorrect total investment balance");

            await icoPoolPartyContract.addFundsToPool({from: investor2, value: web3.toWei("20.1234351", "ether")});
            assert.equal((await icoPoolPartyContract.investors(investor2))[0], web3.toWei("20.1234351", "ether"), "Incorrect investment amount balance");
            assert.equal(await icoPoolPartyContract.totalPoolInvestments(), web3.toWei("26.1234351", "ether"), "Incorrect total investment balance");
        });

        it('should add funds to pool in "Watermark" status', async () => {
            assert.equal(await icoPoolPartyContract.poolStatus(), Status.Open, "Pool in incorrect status");

            await icoPoolPartyContract.addFundsToPool({from: investor1, value: web3.toWei("10", "ether")});
            await icoPoolPartyContract.addFundsToPool({from: investor2, value: web3.toWei("5", "ether")});
            assert.equal(await icoPoolPartyContract.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await icoPoolPartyContract.addFundsToPool({from: investor2, value: web3.toWei("5", "ether")});
            assert.equal((await icoPoolPartyContract.investors(investor2))[0], web3.toWei("10", "ether"), "Incorrect investment amount balance");
            assert.equal(await icoPoolPartyContract.totalPoolInvestments(), web3.toWei("20", "ether"), "Incorrect total investment balance");
        });
    });
});

