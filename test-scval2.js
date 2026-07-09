import { scValToNative, nativeToScVal, Address, Keypair } from '@stellar/stellar-sdk';
const addr = Keypair.random().publicKey();
const scv = nativeToScVal(Address.fromString(addr), { type: 'address' });
const native = scValToNative(scv);
console.log(typeof native, typeof native === 'string', native instanceof Address);
