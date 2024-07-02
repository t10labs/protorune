import { _flush, input, get, set } from "metashrew-as/assembly/indexer/index";
import { Index } from "./indexer";
import { Block } from "metashrew-as/assembly/blockdata/block";
import { Transaction } from "metashrew-as/assembly/blockdata/transaction";
import { Box } from "metashrew-as/assembly/utils/box";
import { decodeHex } from "metashrew-as/assembly";
import { GENESIS, TWENTY_SIX, RUNE_ID_TO_ETCHING } from "./indexer/constants";
import { fieldToName, fromArrayBuffer, nameToArrayBuffer } from "./utils";
import { parsePrimitive } from "metashrew-as/assembly/utils/utils";
import { u128 } from "as-bignum/assembly";
import { console } from "metashrew-as/assembly/utils/logging";
import { RunesBlock } from "./indexer/RunesBlock";
import { RuneId } from "./indexer/RuneId";

export function testCommitment(): void {
  const data = input();
  const box = Box.from(data);
  const height = parsePrimitive<u32>(box);
  const block = new Block(box);
  Index.inspectTransaction(
    nameToArrayBuffer("QUORUMGENESISPROTORUNE"),
    height,
    block,
    298,
  );
}

export function testOverwrite(): void {
  const data = input();
  const box = Box.from(data);
  const height = parsePrimitive<u32>(box);
  const block = changetype<RunesBlock>(new Block(box));
  const tx1 = block.getTransaction(142);
  const tx2 = block.getTransaction(158);
  Index.processRunesTransaction(block, tx1, tx1.txid(), height, 142);
  const testBytes = new RuneId(840000, 158).toBytes();
  RUNE_ID_TO_ETCHING.select(testBytes).setValue<u32>(10);
  // Index.processRunesTransaction(tx2, tx2.txid(), height, 158);
  _flush();
}

export function testFieldToName(): void {
  const name = fieldToName(u128.from("99246114928149462"));
  console.log(name);
  const num = fromArrayBuffer(nameToArrayBuffer(name));
  console.log(num.toString());
  const next = fieldToName(u128.from("99246114928149461") / TWENTY_SIX);
  console.log(next);
}

function testTransaction(hex: string): void {
  const block = new Block(
    Box.from(
      decodeHex(
        "0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c0101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff4d04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73ffffffff0100f2052a01000000434104678afdb0fe5548271967f1a67130b7105cd6a828e03909a67962e0ea1f61deb649f6bc3f4cef38c4f35504e51ec112de5c384df7ba0b8d578a4c702b6bf11d5fac00000000",
      ),
    ),
  );
  block.transactions = new Array<Transaction>(1);
  block.transactions[0] = new Transaction(Box.from(decodeHex(hex)));
  Index.indexBlock(GENESIS, block);
  _flush();
}

export function test_indexEtching(): void {
  testTransaction(
    "0200000000010281763d607e7599dde732fa2c3e7b53ff4c3d097ce89287fc276d8dfe9e886492020000000005000000df9c57a83f900c09faae93686bdf662d9ccb5eab22c9b3184a071664eb18e8650000000000050000000578030000000000002251201a020509bff496a0eef4b9444f804e24c9394a043e8e71965baa200abbc4d09578030000000000002251208f442570a0db90e5b3455573212c8edf9425cb05bd6194e70766aa17c49b3c0c1027000000000000225120e3a2c44155e80bbb791f0121893392b02f804aa07360a22b18861b9b8dd135e100000000000000001f6a5d1c020104c4a1a8e18bbd8af58c830103880805c8530680a4ca9d4e1602204e00000000000022512000b9665e3d564a99f0f20d7829f58f2a43e0a60cc40921d8b32d1985c0b7b4e70140436f259ca43dcb558885856e9fe3bedee5bdec75b714a79c5445ed3bb56dc414baf209ad40ee43a80115c4c763911597b34e9c1a49bfc9d52eb344bd8b1764c50340251d46d96914b732154ca9c1278529e3ca14714770e6a07a2c6d5f5b9d51f9b6e63101a2c875d42a8446fa2f66aac279e25fad797447d670eb7cc111c9e06b0d8120ed247313597e5eadc95a09e6c34643fd4f6edd4dad046cc155d5609c05a81611ac0063036f726401032181763d607e7599dde732fa2c3e7b53ff4c3d097ce89287fc276d8dfe9e88649201010b2064ec82c41727c6dba0d9d61559436a657ae62cdb94462056c297331e868004d40102027803010d09c4102abce829ea8c416821c0ed247313597e5eadc95a09e6c34643fd4f6edd4dad046cc155d5609c05a816113fd10c00",
  );
}

export function test_genesisTransaction(): void {
  testTransaction(
    "020000000001017fb9cc941aa0ca3aaf339783564d2d29ec3254a9128f5d49ad3eeb002aeb40ec0000000000000000000242342a6b000000002251203b8b3ab1453eb47e2d4903b963776680e30863df3625d3e74292338ae7928da10000000000000000246a5d21020704b5e1d8e1c8eeb788a30705a02d039f3e01020680dc9afd2808c7e8430a640340924b2624416402a52ed7cf4eba6b2c535d2def8e649a74ed97aaca5ec54881ef3b34da68bb13d76d6b420e60297a9247cb081d1e59cb2c260b1509cff25d4b3158204c04e894d5357840e324b24c959ca6a5082035f6ffae12f331202bc84bf4612eac0063036f7264010b2047f22ed15d3082f5e9a005864528e4f991ade841a9c5846e2c118425878b6be1010d09b530368c74df10a3036821c04c04e894d5357840e324b24c959ca6a5082035f6ffae12f331202bc84bf4612e00000000",
  );
}

export function test_secondTransaction(): void {
  testTransaction(
    "020000000001018e50641896e8da6a06b096f786bf9c6229ff765518826d6cf7af4d35ba6415280000000000fdffffff032602000000000000225120b5d8055f4a796325e5df348da2681bc5e43379eeff85cd1257dd05865037b5f92602000000000000225120b5d8055f4a796325e5df348da2681bc5e43379eeff85cd1257dd05865037b5f900000000000000001d6a5d1a020504f5bba1a9d3ffbbc705010205a14d068090848e8f3d16010340f89aa2e43e20e358ccc7e72e58085c109a13aaabf35929259b988a7f9e987c0ffdaa6bc68c1287d16c4a70d5d7a04f114e661a6ccd671c662532fdfd660f85b05c205bb63e7141d4aed9be467c4b415dc79339e9e170f66f7db82f8e6bcda7531945ac0063036f7264010b20988e7e6ab89f58c6c28759e9bfe772fe99c32aa5bddd94e7bcf5241f9c8f8b1401020100010d08f55d2835fdef8e05006821c05bb63e7141d4aed9be467c4b415dc79339e9e170f66f7db82f8e6bcda753194500000000",
  );
}

export function test_oneFortyEight(): void {
  testTransaction(
    "010000000001019337eda3b74a0cb2c13df69ae1839584ecf4e02bbaced178587deb1b19f1a4320100000000ffffffff0424f01e00000000002251205c444f03854dfdb7e686b4d5d2f289512715a01eba0639816c5dba83760bcc27d1ba0400000000002251201d5a7d213f1a680691e6e62de1c4342e8a694c52e1a804388d1d154e33b46bac0000000000000000056a5d0216033da5380000000000225120428a80ac40e2416988bd95d597f430e869d0db2d6445ea2d70ee0ecf6c096bf801407f96013bffd621af1c1dc70a100b21d651ad20f575d4ef8e7adc18b776049e55c12d0940fa34576a34ecfc0b624038e11e44442f0f0751b376994d087e31111a00000000",
  );
}

export function test_fifteen(): void {
  testTransaction(
    "020000000001015f21185c7ac9d64aac3e8068c81439ec707f71ba20fa3637858a119571227b110200000000fdffffff020000000000000000096a5d0614c0a23314012202000000000000225120644e2e837226f025142ba9ba21b9d875b72d7627d9978a08d00ec63bf93d0a0e0140271d0d7b282a585b8611c564c8647e7ed4e876821395b4b944531a3a0a042e93d06fccc0ae90c36f6e96cfdfdf6c9f83ea4fa10bdce79c6c15580c91078e619d00000000",
  );
}
