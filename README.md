Truffle commands to read contract info from command line:

    IcoPoolPartyFactory.deployed().then(function(instance){return instance.getPartyListSize.call();}).then(function(value){return value.toNumber()});
    IcoPoolPartyFactory.deployed().then(function(instance){return instance.feePercentage.call();}).then(function(value){return value.toNumber()});
    IcoPoolPartyFactory.deployed().then(function(instance){return instance.poolPartyOwnerAddress.call();}).then(function(value){return value});
    IcoPoolPartyFactory.deployed().then(function(instance){return instance.address;}).then(function(value){return value});
