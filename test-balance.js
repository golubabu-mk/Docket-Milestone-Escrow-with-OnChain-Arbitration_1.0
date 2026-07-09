import { rpc, Contract, nativeToScVal, Address, scValToNative, TransactionBuilder, BASE_FEE, Account } from '@stellar/stellar-sdk';

const server = new rpc.Server('https://soroban-testnet.stellar.org', { allowHttp: false });

async function test() {
  try {
    const account = new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
    const contract = new Contract('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'); // Token ID from user
    const address = 'GB7FP5GMFW6U4H3B5T4YFOW6Y2ZY6V2T62LZN5X2P2QVQ3B3OY2LOALB'; // Some address from earlier screenshot

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(contract.call('balance', nativeToScVal(Address.fromString(address), { type: 'address' })))
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationError(simulated)) {
      console.log("Balance:", scValToNative(simulated.result.retval).toString());
    } else {
      console.log("Simulation error:", simulated.error);
    }
  } catch (e) {
    console.error(e);
  }
}

test();
