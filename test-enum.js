import { rpc, Contract, nativeToScVal, Address, scValToNative, TransactionBuilder, BASE_FEE, Account, Keypair } from '@stellar/stellar-sdk';

const server = new rpc.Server('https://soroban-testnet.stellar.org', { allowHttp: false });

async function test() {
  try {
    const account = new Account(Keypair.random().publicKey(), '0');
    const contract = new Contract('CBW37JY67AHTWQTE6PHHCOLVZOIOH7HBNIK63PLH53PMVKKBWUZGRBIN'); // Escrow Contract ID

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: 'Test SDF Network ; September 2015',
    })
      .addOperation(contract.call('get_job', nativeToScVal(BigInt(2), { type: 'u64' }))) // Docket No 0002
      .setTimeout(30)
      .build();

    const simulated = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationError(simulated)) {
      const raw = scValToNative(simulated.result.retval);
      console.log("Raw Job:", JSON.stringify(raw, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
    }
  } catch (e) {
    console.error(e);
  }
}

test();
