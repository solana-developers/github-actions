// Comment out until new helpers package release

import { Program } from "@coral-xyz/anchor";
import { getKeypairFromFile, prepareTransactionWithCompute } from "@solana-developers/helpers";
import { TransactionExample } from "../target/types/transaction_example";
import {
  getIdlParsedAccountData,
  parseAnchorTransactionEvents,
  decodeAnchorTransaction,
  sendTransaction,
  //} from "@solana-developers/helpers";
} from "/Users/jonasmac2/Documents/GitHub/helpers/src/lib/transaction";
import { Connection, PublicKey } from "@solana/web3.js";
import { strict as assert } from "assert";
const anchor = require("@coral-xyz/anchor");

describe("transaction-example", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace
    .TransactionExample as Program<TransactionExample>;

  it("Initialize counter!", async () => {
    const keyPair = await getKeypairFromFile();
    const connection = new Connection(
      anchor.getProvider().connection.rpcEndpoint,
      "confirmed"
    );

    // Initialize transaction
    const tx = await program.methods.initialize().transaction();

    await prepareTransactionWithCompute(connection, tx, keyPair.publicKey, 10000);

    // This could be really nice if RPC providers would all have the same API...
    // Please fall back to the fee api of your favourite RPC provider to get a good value.
    const priorityFee = 10000;

    var signature = await sendTransaction(connection, tx, [keyPair], priorityFee);
    console.log("Initialize signature:", signature);

    // This is how to subscribe to events in anchor
    const subscriptionId = await program.addEventListener(
      "counterEvent",
      (event) => {
        console.log("CounterEvent", event);
      }
    );

    const incrementTx = await program.methods.increment().transaction();

    var signature = await sendTransaction(connection, incrementTx, [keyPair]);
    console.log("Your transaction signature", signature);

    const transaction = await connection.getTransaction(signature, {
      commitment: "confirmed",
    });
    console.log("Transaction", transaction);

    // --- Decode Transaction ---
    const decodedTx = await decodeAnchorTransaction(
      "./target/idl/transaction_example.json",
      signature,
      connection
    );

    console.log(decodedTx.toString());

    // --- Parse Events ---
    const events = await parseAnchorTransactionEvents(
      "./target/idl/transaction_example.json",
      signature,
      connection
    );
    console.log("Events:", events);

    // --- Parse Account Data ---

    const counterPdaPubkey = PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      program.programId
    )[0];

    const counterData = await getIdlParsedAccountData(
      "./target/idl/transaction_example.json",
      "counter",
      counterPdaPubkey,
      connection
    );

    assert(
      counterData.count == 1,
      `Expected count to be 1 but got ${counterData.count}`
    );

    await program.removeEventListener(subscriptionId);
  });

  it("Increment counter!", async () => {
    const keyPair = await getKeypairFromFile();
    const connection = new Connection(
      anchor.getProvider().connection.rpcEndpoint,
      "confirmed"
    );

    // Subscribe to events
    const subscriptionId = await program.addEventListener(
      "counterEvent",
      (event) => {
        console.log("CounterEvent", event);
      }
    );

    // Increment transaction
    const tx = await program.methods.increment().transaction();
    const signature = await sendTransaction(connection, tx, [keyPair]);
    console.log("Increment signature:", signature);

    // Verify counter was incremented
    const counterPdaPubkey = PublicKey.findProgramAddressSync(
      [Buffer.from("counter")],
      program.programId
    )[0];

    const counterData = await getIdlParsedAccountData(
      "./target/idl/transaction_example.json",
      "counter",
      counterPdaPubkey,
      connection
    );

    assert(
      counterData.count == 2,
      `Expected count to be 2 but got ${counterData.count}`
    );

    // Parse events and transaction data
    const events = await parseAnchorTransactionEvents(
      "./target/idl/transaction_example.json",
      signature,
      connection
    );
    console.log("Events:", events);

    const decodedTx = await decodeAnchorTransaction(
      "./target/idl/transaction_example.json",
      signature,
      connection
    );
    console.log(decodedTx.toString());

    await program.removeEventListener(subscriptionId);
  });

  it("Increment counter with priority fees!", async () => {
    const keyPair = await getKeypairFromFile();
    const connection = new Connection(
      anchor.getProvider().connection.rpcEndpoint,
      "confirmed"
    );

    const initTransaction = await program.methods.initialize().transaction();

    await sendTransaction(
      connection,
      initTransaction,
      [keyPair],
      10000 // priority fee
    );

    // Increment counter 10 times
    for (let i = 0; i < 10; i++) {
      const tx = await program.methods.increment().transaction();
      await sendTransaction(
        connection,
        tx,
        [keyPair],
        10000 // priority fee
      );
    }
  });
});
