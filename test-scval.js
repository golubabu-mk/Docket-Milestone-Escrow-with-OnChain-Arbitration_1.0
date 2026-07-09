import { scValToNative, nativeToScVal, Address } from '@stellar/stellar-sdk';
const addr = 'GB7FP5GMFW6U4H3B5T4YFOW6Y2ZY6V2T62LZN5X2P2QVQ3B3OY2LOALB';
const scv = nativeToScVal(Address.fromString(addr), { type: 'address' });
const native = scValToNative(scv);
console.log(typeof native, native);
console.log("Is instance of Address?", native instanceof Address);
console.log("toString() ->", native.toString());
