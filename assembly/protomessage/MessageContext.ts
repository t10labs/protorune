import { Block, OutPoint, Transaction } from "metashrew-as/assembly/blockdata";
import { IncomingRune } from "./IncomingRune";
import { AtomicTransaction } from "metashrew-as/assembly/indexer/atomic";
import { protorune } from "../proto/protorune";
import { RuneId } from "../indexer/RuneId";
import { BalanceSheet } from "../indexer/BalanceSheet";

export class MessageContext {
  runtime: AtomicTransaction = new AtomicTransaction();
  public runes: Array<IncomingRune> = new Array<IncomingRune>();
  public predicates: Array<IncomingRune> = new Array<IncomingRune>();
  transaction: Transaction = changetype<Transaction>(0);
  block: Block = changetype<Block>(0);
  height: u64 = 0;
  outpoint: OutPoint = changetype<OutPoint>(0);
  pointer: OutPoint = changetype<OutPoint>(0);
  refund_pointer: OutPoint = changetype<OutPoint>(0);
  calldata: ArrayBuffer = new ArrayBuffer(0);
  sheets: Map<u32, BalanceSheet>;

  constructor(
    message: protorune.ProtoMessage,
    transaction: Transaction,
    block: Block,
    height: u64,
    index: u32,
    sheets: Map<u32, BalanceSheet>,
  ) {
    if (sheets.has(index)) {
      for (let i = 0; i < sheets.get(index).runes.length; i++) {
        const sheet = sheets.get(index);
        const runeId = RuneId.fromBytesU128(sheet.runes[i]);
        const rune = new IncomingRune(
          runeId,
          sheet.balances[i].lo,
          sheet.balances[i].hi,
        );
        this.runes.push(rune);
      }
    }
    this.sheets = sheets;
    for (let i = 0; i < message.predicate.clauses.length; i++) {
      const clause = message.predicate.clauses[i];
      const runeId = new RuneId(<u64>clause.rune.height, clause.rune.txindex);
      const rune = new IncomingRune(runeId, clause.amount.lo, clause.amount.hi);
      this.predicates.push(rune);
    }
    this.transaction = transaction;
    this.block = block;
    this.height = height;
    const txid = this.transaction.txid();
    this.outpoint = OutPoint.from(txid, index);
    this.pointer = OutPoint.from(txid, message.pointer);
    this.refund_pointer = OutPoint.from(txid, message.refund_pointer);
    this.calldata = changetype<Uint8Array>(message.calldata).buffer;
  }

  run(): void {
    this.runtime.checkpoint();
    const result = this.handle();
    if (!result) {
      this.runtime.rollback();
    }

    this.runtime.commit();
  }

  handle(): bool {
    return false;
  }
}
