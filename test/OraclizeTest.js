/* global artifacts */

const oraclize = artifacts.require('./OracalizeTest');
let oraclizeContract;

contract('Oraclize Test', function (accounts) {

    describe('Contribute to new pool', function () {
        this.slow(5000);

        before(async () => {
            oraclizeContract = await oraclize.deployed();
            smartLog("Contract Address [" + await oraclizeContract.address + "]");
        });

        it("should get pool config from Oraclize", async () => {
            smartLog("Start balance for Account0 [" + web3.fromWei(web3.eth.getBalance(accounts[3])) + "]", true);
            await oraclizeContract.update({from:accounts[3], value:web3.toWei("0.5", "ether")});

            let loopCounter = 0;
            while (loopCounter < 100) {
                loopCounter++;
                smartLog("Timer [" + loopCounter + "]", true);
                await sleep(1000);
            }

            const destinationAddress = await oraclizeContract.destinationAddress();
            smartLog("Destination address is [" + destinationAddress + "]", true);
            smartLog("Destination address proof is [" + await oraclizeContract.parameterProof(web3.sha3("destinationAddress")) + "]", true);

            const tokenAddress = await oraclizeContract.tokenAddress();
            smartLog("Token address is [" + tokenAddress + "]", true);
            smartLog("Token address proof is [" + await oraclizeContract.parameterProof(web3.sha3("tokenAddress")) + "]", true);

            const saleOwnerAddress = await oraclizeContract.saleOwnerAddress();
            smartLog("Sale Owner address is [" + saleOwnerAddress+ "]", true);
            smartLog("Sale Owner address proof is [" + await oraclizeContract.parameterProof(web3.sha3("saleOwnerAddress")) + "]", true);

            const buyFunction = await oraclizeContract.buyFunctionName();
            smartLog("Buy Fn is [" + buyFunction + "]", true);
            smartLog("Buy Fn proof is [" + await oraclizeContract.parameterProof(web3.sha3("buyFunction")) + "]", true);

            const refundFunction = await oraclizeContract.refundFunctionName();
            smartLog("Refund fn is [" + refundFunction + "]", true);
            smartLog("Refund fn proof is [" + await oraclizeContract.parameterProof(web3.sha3("refundFunction")) + "]", true);

            const claimFunction = await oraclizeContract.claimFunctionName();
            smartLog("Claim fn is [" + claimFunction + "]", true);
            smartLog("Claim fn proof is [" + await oraclizeContract.parameterProof(web3.sha3("claimFunction")) + "]", true);

            const publicEthPrice = await oraclizeContract.publicEthPricePerToken();
            smartLog("Public ETH price [" + publicEthPrice + "]", true);
            smartLog("Public ETH price proof is [" + await oraclizeContract.parameterProof(web3.sha3("publicETHPricePerToken")) + "]", true);

            const groupEthPrice = await oraclizeContract.groupEthPricePerToken();
            smartLog("Group ETH price [" + groupEthPrice + "]", true);
            smartLog("Group ETH price proof is [" + await oraclizeContract.parameterProof(web3.sha3("groupETHPricePerToken")) + "]", true);

            const subsidyRequired = await oraclizeContract.subsidyRequired();
            smartLog("Subsidy required is [" + subsidyRequired + "]", true);
            smartLog("Subsidy required proof is [" + await oraclizeContract.parameterProof(web3.sha3("subsidyRequired")) + "]", true);

            smartLog("Start balance for Account0 [" + web3.fromWei(web3.eth.getBalance(accounts[3])) + "]", true);
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
