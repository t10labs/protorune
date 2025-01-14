import { RunesBlock } from "metashrew-runes/assembly/indexer/RunesBlock";
import { RunestoneMessage } from "metashrew-runes/assembly/indexer/RunestoneMessage";
import { RunesTransaction } from "metashrew-runes/assembly/indexer/RunesTransaction";
import { Block } from "metashrew-as/assembly/blockdata/block";
import { Field } from "metashrew-runes/assembly/indexer/Field";
import { ProtoruneField } from "./fields/ProtoruneField";
import { OutPoint } from "metashrew-as/assembly/blockdata/transaction";
import { fieldTo, min } from "metashrew-runes/assembly/utils";
import { Edict } from "metashrew-runes/assembly/indexer/Edict";
import { ProtoMessage, MessageContext } from "./protomessage";
import { ProtoruneBalanceSheet } from "./ProtoruneBalanceSheet";
import { BalanceSheet } from "metashrew-runes/assembly/indexer/BalanceSheet";
import { Protostone } from "./Protostone";
import { u128 } from "as-bignum/assembly";
import { console } from "metashrew-as/assembly/utils/logging";
import { RunesIndex } from "metashrew-runes/assembly/indexer";

import { Protoburn } from "./Protoburn";

class BurnCycle {
  public max: i32;
  public cycles: Map<string, i32>;
  constructor(max: i32) {
    this.max = max;
    this.cycles = new Map<string, i32>();
  }
  next(rune: ArrayBuffer): i32 {
    if (!this.cycles.has(changetype<string>(rune))) {
      this.cycles.set(changetype<string>(rune), 0);
    }
    const cycle = this.cycles.get(changetype<string>(rune));
    this.cycles.set(changetype<string>(rune), (cycle + 1) % this.max);
    return cycle;
  }
  peek(rune: ArrayBuffer): i32 {
    if (!this.cycles.has(changetype<string>(rune))) {
      this.cycles.set(changetype<string>(rune), 0);
    }
    return this.cycles.get(changetype<string>(rune));
  }
}

export class Protorune<T extends MessageContext> extends RunesIndex {
  processRunestone(
    block: RunesBlock,
    tx: RunesTransaction,
    txid: ArrayBuffer,
    height: u32,
    i: u32,
  ): RunestoneMessage {
    const baseRunestone = tx.runestone();
    const runestone = Protostone.from(baseRunestone);
    const unallocatedTo = runestone.fields.has(Field.POINTER)
      ? fieldTo<u32>(runestone.fields.get(Field.POINTER))
      : <u32>tx.defaultOutput();
    if (changetype<usize>(runestone) === 0)
      return changetype<RunestoneMessage>(0);
    const balancesByOutput = changetype<Map<u32, ProtoruneBalanceSheet>>(
      baseRunestone.process(tx, txid, height, i),
    );
    const protostones = runestone.protostones(tx.outs.length + 1);
    const burns = protostones.burns();

    const runestoneOutputIndex = tx.runestoneOutputIndex();
    const edicts = Edict.fromDeltaSeries(runestone.edicts);
    if (burns.length > 0) {
      this.processProtoburns(
        unallocatedTo,
        balancesByOutput,
        txid,
        runestoneOutputIndex,
        runestone,
        edicts,
        burns,
      );
    }
    this.processProtostones(protostones.flat(), block, height, tx, txid, i);
    return changetype<RunestoneMessage>(runestone);
  }
  processProtoburns(
    unallocatedTo: u32,
    balancesByOutput: Map<u32, ProtoruneBalanceSheet>,
    txid: ArrayBuffer,
    runestoneOutputIndex: i32,
    runestone: Protostone,
    edicts: Array<Edict>,
    protoburns: Array<Protoburn>,
  ): void {
    const runestoneBalanceSheet = new ProtoruneBalanceSheet();
    (balancesByOutput.has(runestoneOutputIndex)
      ? balancesByOutput.get(runestoneOutputIndex)
      : new ProtoruneBalanceSheet()
    ).pipe(changetype<BalanceSheet>(runestoneBalanceSheet));
    const burns: Array<Edict> = new Array<Edict>(protoburns.length);
    const burnSheets = new Array<ProtoruneBalanceSheet>(protoburns.length);
    const cycles = new BurnCycle(protoburns.length);
    for (let i = 0; i < protoburns.length; i++) {
      burnSheets[i] = new ProtoruneBalanceSheet();
    }
    for (let i = 0; i < edicts.length; i++) {
      if (edicts[i].output === u128.from(runestoneOutputIndex)) {
        const rune = edicts[i].runeId().toBytes();
        const cycle = cycles.peek(rune);
        const remaining = runestoneBalanceSheet.get(rune);
        const toApply = min(remaining, edicts[i].amount);
        if (toApply.isZero()) continue;
        cycles.next(rune);
        runestoneBalanceSheet.decrease(rune, toApply);
        burnSheets[cycle].increase(rune, toApply);
      }
    }
    if (runestoneOutputIndex === unallocatedTo) {
      for (let i = 0; i < runestoneBalanceSheet.runes.length; i++) {
        const rune = runestoneBalanceSheet.runes[i];
        const cycle = cycles.peek(rune);
        const toApply = runestoneBalanceSheet.get(rune);
        if (toApply.isZero()) continue;
        cycles.next(rune);
        runestoneBalanceSheet.decrease(rune, toApply);
        burnSheets[cycle].increase(rune, toApply);
      }
    }
    for (let i = 0; i < protoburns.length; i++) {
      protoburns[i].process(
        burnSheets[i],
        OutPoint.from(txid, protoburns[i].pointer).toArrayBuffer(),
      );
    }
  }
  processProtostones(
    protostones: Array<Protostone>,
    block: RunesBlock,
    height: u64,
    tx: RunesTransaction,
    txid: ArrayBuffer,
    txindex: u32,
  ): void {
    for (let i = 0; i < protostones.length; i++) {
      const protostone = protostones[i];
      if (protostone.isMessage()) {
        protostone
          .toMessage(tx.outs.length + 1 + i)
          .handle<T>(tx, block, height, txindex);
      } else if (protostone.edicts.length) {
        protostone.process(tx, txid, <u32>height, txindex);
      }
    }
  }
  initializeSubprotocols(): void {
    changetype<T>(0).initializeProtocol();
  }
  indexBlock(height: u32, block: Block): void {
    this.initializeSubprotocols();
    super.indexBlock(height, block);
  }
}

export class DefaultProtorune extends Protorune<MessageContext> {}
