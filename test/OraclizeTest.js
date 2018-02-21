/* global artifacts */
import expectThrow from "./helpers/expectThrow";

let oraclize = artifacts.require('./OracalizeTest');
let oraclizeContract;

contract('Oraclize Test', function (accounts) {

    describe.skip('Contribute to new pool', function () {
        this.slow(5000);

        before(async () => {
            //oraclizeContract = await oraclize.new({from: accounts[2]});
            oraclizeContract = await oraclize.deployed();
            smartLog("Contract Address [" + await oraclizeContract.address + "]");
        });

        it("should get pool config from Oraclize", async () => {
            smartLog("Start balance for Account0 [" + web3.fromWei(web3.eth.getBalance(accounts[3])) + "]", true);
            await oraclizeContract.update({from:accounts[3], value:web3.toWei("0.5", "ether")});

            var loopCounter = 0;
            while (loopCounter < 120) {
                loopCounter++;
                smartLog("Timer [" + loopCounter + "]", true);
                await sleep(1000);
            }
            var destinationAddress = await oraclizeContract.destinationAddress();
            smartLog("Destination Address is [" + destinationAddress + "]", true);
            //assert.equal(saleAddressVar, "0xe83dC1d9f5aA8223Acb090Be5c14877DF8C3F71b");

            var tokenAddress = await oraclizeContract.tokenAddress();
            smartLog("Token Address is [" + tokenAddress + "]", true);
            //assert.equal(tokenAddress, "0xD67B30581733214F3e82F2b556be662BD977D812");


            var saleOwnerAddress = await oraclizeContract.saleOwnerAddress();
            smartLog("Sale Owner address is [" + saleOwnerAddress+ "]", true);
            /*assert.equal(saleOwnerAddress, "0x2E05A304d3040f1399c8C20D2a9F659AE7521058");
            await sleep(20000);*/

            var buyFunction = await oraclizeContract.buyFunctionName();
            smartLog("Buy Fn is [" + buyFunction + "]", true);
            /*assert.equal(buyFunction, web3.sha3("puchaseTokens()"));
            await sleep(20000);*/

            var refundFunction = await oraclizeContract.refundFunctionName();
            smartLog("Refund fn is [" + refundFunction + "]", true);
            /*assert.equal(refundFunction, web3.sha3("refundEther()"));
            await sleep(20000);*/

            var claimFunction = await oraclizeContract.claimFunctionName();
            smartLog("Claim fn is [" + claimFunction + "]", true);
            /*assert.equal(claimFunction, web3.sha3("claimTokens()"));
            await sleep(20000);*/

            var publicEthPrice = await oraclizeContract.publicEthPricePerToken();
            smartLog("Public ETH price [" + publicEthPrice + "]", true);

            var groupEthPrice = await oraclizeContract.groupEthPricePerToken();
            smartLog("Group ETH price [" + groupEthPrice + "]", true);

            var subsidyRequired = await oraclizeContract.subsidyRequired();
            smartLog("Subsidy required [" + subsidyRequired + "]", true);

            smartLog("Start balance for Account0 [" + web3.fromWei(web3.eth.getBalance(accounts[3])) + "]", true);
            /*smartLog("Price is [" + price + "]", true);
            smartLog("Id is [" + id + "]", true);*/
        });

    });

    function smartLog(message, override) {
        let verbose = false;
        if (verbose || override)
            console.log(message);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
