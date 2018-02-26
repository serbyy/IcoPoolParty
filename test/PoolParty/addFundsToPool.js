import expectThrow from './../helpers/expectThrow';

const poolPartyFactoryArtifact = artifacts.require('./IcoPoolPartyFactory');
const poolPartyArtifact = artifacts.require('./IcoPoolParty');
const genericTokenArtifact = artifacts.require('./test-contracts/GenericToken');

const MIN_CONT_AMOUNT = web3.toWei("0.01");

let icoPoolPartyFactory;
let icoPoolParty;
let genericToken;

const Status = {
    Open: 0,
    WaterMarkReached: 1,
    DueDiligence: 2,
    InReview: 3,
    Claim: 4,
    Refunding: 5
};

contract('IcoPoolParty', (accounts) => {
    const [_deployer, _investor1, _investor2, _saleAddress, _investor3, _nonInvestor, _saleOwner, _investor4] = accounts;

    beforeEach(async () => {
        icoPoolPartyFactory = await poolPartyFactoryArtifact.new(_deployer, {from: _deployer});
        await icoPoolPartyFactory.setWaterMark(web3.toWei("1"));
        await icoPoolPartyFactory.createNewPoolParty("api.test.foreground.io", {from: _investor1});
        icoPoolParty = poolPartyArtifact.at(await icoPoolPartyFactory.partyList(0));

    });

    describe('Function: addFundsToPool', () => {
        it('should add funds to pool when in "Open" status', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");

            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.5")});
            assert.equal((await icoPoolParty.investors(_investor1))[0], web3.toWei("0.5"), "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.5"), "Incorrect total investment balance");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.41234351")});
            assert.equal((await icoPoolParty.investors(_investor2))[0], web3.toWei("0.41234351"), "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.91234351"), "Incorrect total investment balance");
        });

        it('should attempt to add funds to pool with amount lower than the minimum', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await expectThrow(icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.009")}));
            assert.notEqual((await icoPoolParty.investors(_investor1))[0], web3.toWei("0.009"), "Incorrect investment amount balance");
            assert.notEqual(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.009"), "Incorrect total investment balance");
        });

        it('should add funds to pool with minimum amount', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await icoPoolParty.addFundsToPool({from: _investor1, value: MIN_CONT_AMOUNT});
            assert.equal((await icoPoolParty.investors(_investor1))[0], MIN_CONT_AMOUNT, "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.01"), "Incorrect total investment balance");
        });

        it('should add funds to pool when in "Watermark" status', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            assert.equal(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.25")});
            assert.equal((await icoPoolParty.investors(_investor2))[0], web3.toWei("0.25"), "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("1.25"), "Incorrect total investment balance");
        });

        it('should add funds to pool when in "Due Diligence" status', async () => {
            genericToken = await genericTokenArtifact.new();
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.setIcoOwnerTest(_saleOwner, {from: _investor1});
            await icoPoolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.2")});
            assert.equal((await icoPoolParty.investors(_investor2))[0], web3.toWei("0.2"), "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("1.2"), "Incorrect total investment balance");
        });

        it('should attempt to add funds to pool when in "In Review" status', async () => {
            genericToken = await genericTokenArtifact.new();
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.1")});
            await icoPoolParty.setIcoOwnerTest(_saleOwner, {from: _investor1});
            await icoPoolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
            await sleep(3000);
            await icoPoolParty.leavePool({from: _investor2}); //Just to advance state
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            await expectThrow(icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.3")}));
            assert.notEqual((await icoPoolParty.investors(_investor2))[0], web3.toWei("0.3"), "Incorrect investment amount balance");
            assert.notEqual(await icoPoolParty.totalPoolInvestments(), web3.toWei("1.3"), "Incorrect total investment balance");

            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
        });

        it('should calculate the correct number of pool participants', async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.05")});
            assert.equal(await icoPoolParty.poolParticipants(), 1, "Incorrect number of participants");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.02")});
            assert.equal(await icoPoolParty.poolParticipants(), 2, "Incorrect number of participants");

            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.03")});
            assert.equal(await icoPoolParty.poolParticipants(), 2, "Incorrect number of participants");

            await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.03")});
            assert.equal(await icoPoolParty.poolParticipants(), 3, "Incorrect number of participants");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.01")});
            await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.01")});
            assert.equal(await icoPoolParty.poolParticipants(), 3, "Incorrect number of participants");
        });

        it('should confirm correct values in investors struct', async () => {
            assert.equal((await icoPoolParty.investors(_nonInvestor))[0], 0, "Default values should be 0");
            assert.equal((await icoPoolParty.investors(_nonInvestor))[1], 0, "Default values should be 0");
            assert.equal((await icoPoolParty.investors(_nonInvestor))[2], 0, "Default values should be 0");
            assert.equal((await icoPoolParty.investors(_nonInvestor))[3], 0, "Default values should be 0");
            assert.equal((await icoPoolParty.investors(_nonInvestor))[4], false, "Default value should be false");
            assert.equal((await icoPoolParty.investors(_nonInvestor))[5], false, "Default value should be false");
            assert.equal((await icoPoolParty.investors(_nonInvestor))[6], 0, "Default values should be 0");

            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.02")});
            assert.equal(await icoPoolParty.poolParticipants(), 1, "Incorrect number of participants");
            assert.equal((await icoPoolParty.investors(_investor1))[0], web3.toWei("0.02"), "Incorrect investor balance");
            assert.equal((await icoPoolParty.investors(_investor1))[1], 0, "Should still be default value");
            assert.equal((await icoPoolParty.investors(_investor1))[2], 0, "Should still be default value");
            assert.equal((await icoPoolParty.investors(_investor1))[3], 0, "Index should be 0");
            assert.equal((await icoPoolParty.investors(_investor1))[4], true, "Investor should be able to claim refund");
            assert.equal((await icoPoolParty.investors(_investor1))[5], true, "Investor should be active");
            assert.equal((await icoPoolParty.investors(_investor1))[6], 0, "Should still be default value");

            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.025")});
            assert.equal(await icoPoolParty.poolParticipants(), 2, "Incorrect number of participants");
            assert.equal((await icoPoolParty.investors(_investor2))[0], web3.toWei("0.025"), "Incorrect investor balance");
            assert.equal((await icoPoolParty.investors(_investor2))[3], 1, "Index should be 1");
            assert.equal((await icoPoolParty.investors(_investor2))[4], true, "Investor should be able to claim refund");
            assert.equal((await icoPoolParty.investors(_investor2))[5], true, "Investor should be active");
        });
    });

    describe('Function: leavePool', () => {
        it('should leave pool in "Open" status', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.6")});
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");

            await icoPoolParty.leavePool({from: _investor1});
            assert.equal((await icoPoolParty.investors(_investor1))[0], 0, "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), 0, "Incorrect total investment balance");
        });

        it('should leave pool in "Watermark" status -> back to "Open" status', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            assert.equal(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await icoPoolParty.leavePool({from: _investor1});
            assert.equal((await icoPoolParty.investors(_investor1))[0], 0, "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), 0, "Incorrect total investment balance");
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
        });

        it('should leave pool in "Watermark" status -> stay in "Watermark" status', async () => {
            assert.equal(await icoPoolParty.poolStatus(), Status.Open, "Pool in incorrect status");
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.02")});
            assert.equal(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");

            await icoPoolParty.leavePool({from: _investor2});
            assert.equal((await icoPoolParty.investors(_investor2))[0], 0, "Incorrect investment amount balance");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await icoPoolParty.poolStatus(), Status.WaterMarkReached, "Pool in incorrect status");
        });

        it('should leave pool in "Due Diligence" status', async () => {
            genericToken = await genericTokenArtifact.new();
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.05")});
            await icoPoolParty.setIcoOwnerTest(_saleOwner, {from: _investor1});
            await icoPoolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");

            await icoPoolParty.leavePool({from: _investor2});
            assert.equal((await icoPoolParty.investors(_investor2))[0], 0, "Incorrect investment amount balance");
            assert.equal((await icoPoolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await icoPoolParty.poolStatus(), Status.DueDiligence, "Pool in incorrect status");
        });

        it('should leave pool in "In Review" status', async () => {
            genericToken = await genericTokenArtifact.new();
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("1")});
            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.09")});
            await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.011")});
            await icoPoolParty.setIcoOwnerTest(_saleOwner, {from: _investor1});
            await icoPoolParty.configurePool(_saleAddress, genericToken.address, "N/A", "claimToken()", "claimRefund()", web3.toWei("0.05"), web3.toWei("0.04"), true, {from: _saleOwner});
            await icoPoolParty.completeConfiguration({from: _saleOwner});
            await sleep(3000);
            await icoPoolParty.leavePool({from: _investor3}); //Just to advance state
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");

            await icoPoolParty.leavePool({from: _investor2});
            assert.equal((await icoPoolParty.investors(_investor2))[0], 0, "Incorrect investment amount balance");
            assert.equal((await icoPoolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("1"), "Incorrect total investment balance");
            assert.equal(await icoPoolParty.poolStatus(), Status.InReview, "Pool in incorrect status");
        });

        it('should leave pool and be removed from the list', async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.01")});
            assert.equal((await icoPoolParty.investors(_investor1))[3], 0, "Incorrect list index");
            await icoPoolParty.addFundsToPool({from: _investor2, value: web3.toWei("0.02")});
            assert.equal((await icoPoolParty.investors(_investor2))[3], 1, "Incorrect list index");
            await icoPoolParty.addFundsToPool({from: _investor3, value: web3.toWei("0.03")});
            assert.equal((await icoPoolParty.investors(_investor3))[3], 2, "Incorrect list index");
            await icoPoolParty.addFundsToPool({from: _investor4, value: web3.toWei("0.04")});
            assert.equal((await icoPoolParty.investors(_investor4))[3], 3, "Incorrect list index");
            assert.equal(await icoPoolParty.poolParticipants(), 4, "Incorrect number of participants");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.1"), "Incorrect total investment balance");

            await icoPoolParty.leavePool({from: _investor2});
            assert.equal((await icoPoolParty.investors(_investor2))[0], 0, "Investment balance should be 0");
            assert.equal((await icoPoolParty.investors(_investor2))[5], false, "Investor should not be active");
            assert.equal((await icoPoolParty.investors(_investor4))[3], 1, "Incorrect list index");
            assert.equal(await icoPoolParty.poolParticipants(), 3, "Incorrect number of participants");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.08"), "Incorrect total investment balance");

            await icoPoolParty.leavePool({from: _investor3});
            assert.equal((await icoPoolParty.investors(_investor3))[0], 0, "Investment balance should be 0");
            assert.equal((await icoPoolParty.investors(_investor3))[5], false, "Investor should not be active");
            assert.equal((await icoPoolParty.investors(_investor4))[3], 1, "Incorrect list index");
            assert.equal((await icoPoolParty.investors(_investor1))[3], 0, "Incorrect list index");
            assert.equal(await icoPoolParty.poolParticipants(), 2, "Incorrect number of participants");
            assert.equal(await icoPoolParty.totalPoolInvestments(), web3.toWei("0.05"), "Incorrect total investment balance");
        });

        it('should attempt to leave pool when balance is 0', async () => {
            await icoPoolParty.addFundsToPool({from: _investor1, value: web3.toWei("0.2")});
            assert.equal(await icoPoolParty.poolParticipants(), 1, "Incorrect number of participants");
            assert.equal((await icoPoolParty.investors(_investor2))[0], 0, "Investor should have a 0 balance");

            await expectThrow(icoPoolParty.leavePool({from: _investor2}));
            assert.equal((await icoPoolParty.investors(_investor2))[0], 0, "Investor 2 should still have 0 balance");
            assert.equal(await icoPoolParty.poolParticipants(), 1, "Incorrect number of participants");
        });
    });

    describe.skip('Function: configurePool', () => {
        it('should configure sale using oraclize', async () => {
        });

    });

    function sleep(_ms) {
        return new Promise(resolve => setTimeout(resolve, _ms));
    }
});

