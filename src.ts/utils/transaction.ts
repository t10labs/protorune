import * as bitcoin from "bitcoinjs-lib";
import { DEFAULT as DEFAULT_KEYPAIR, tweakPubkey } from "./wallet";
import { rpcCall } from "./sandshrew";
import { inspect } from "util";
const DEFAULT_AMOUNT = 2_000;

export async function getFeeEstimates(): Promise<any> {
  return await rpcCall("esplora_fee-estimates", []);
}

export async function getVSize(tx: string): Promise<number> {
  return (await rpcCall("btc_decoderawtransaction", [tx])).vsize;
}

type UTXO = { txid: string; vout: number; value: number };
//@TODO: should fetch a list of spendable outpoints for the specified address
export async function getInputsFor(address: string, amount: number) {
  const utxos: UTXO[] = await rpcCall("esplora_address::utxo", [address]);
  const inputs = utxos.reduce(
    (a, d) => {
      if (a.total < amount) {
        return {
          result: [...a.result, d],
          total: (a.total += d.value),
        };
      }
      return a;
    },
    { result: [], total: 0 } as { result: UTXO[]; total: number },
  ).result;
  return { inputs, utxos };
}

export async function buildRunesTransaction(
  outputs: any[],
  address: string,
  output: any,
) {
  const { inputs, utxos } = await getInputsFor(address, DEFAULT_AMOUNT);
  let tx = new bitcoin.Psbt();
  outputs.map((o) => (o.script ? (tx = tx.addOutput(o)) : null));
  let currentIndex = inputs.length;
  const nodeXOnlyPubkey = tweakPubkey(DEFAULT_KEYPAIR.publicKey);
  const pair = DEFAULT_KEYPAIR.tweak(
    bitcoin.crypto.taggedHash("TapTweak", nodeXOnlyPubkey),
  );
  tx.locktime = 6;
  let currentTotal = inputs.reduce((a, d, i) => {
    tx = tx.addInput({
      hash: Buffer.from(d.txid, "hex"),
      index: d.vout,
      witnessUtxo: {
        value: d.value,
        script: output,
      },
      tapInternalKey: nodeXOnlyPubkey,
    });
    return a + d.value;
  }, 0);
  let baseTx = tx.clone();
  tx.signAllInputs(pair);
  tx.finalizeAllInputs();
  //locktime - 6 blocks

  let vsize = await getVSize(tx.extractTransaction().toHex());
  const feeRate = (await getFeeEstimates())["1"];

  let fee = vsize * feeRate;
  while (fee > currentTotal) {
    if (currentIndex > utxos.length)
      throw new Error("wallet does not have enough spendable btc");
    const v = utxos[currentIndex];
    tx = baseTx.clone();
    tx = tx.addInput({
      hash: Buffer.from(v.txid, "hex"),
      index: v.vout,

      witnessUtxo: {
        value: v.value,
        script: output,
      },
      tapInternalKey: nodeXOnlyPubkey,
    });
    baseTx = tx.clone();
    tx = tx.signAllInputs(pair);
    tx.finalizeAllInputs();
    currentIndex++;
    currentTotal += v.value;
    vsize = await getVSize(tx.extractTransaction().toHex());
    fee = vsize * feeRate;
  }
  tx = baseTx.clone();
  tx = tx.addOutput({
    script:
      bitcoin.payments.p2tr({
        address,
        network: bitcoin.networks.bitcoin,
      }).output || Buffer.from(""),
    value: currentTotal - Math.ceil(fee),
  });
  console.log("total inputs: ", currentTotal, ", fee: ", fee);
  tx.signAllInputs(pair);
  tx.finalizeAllInputs();

  return tx;
}