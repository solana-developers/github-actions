import * as multisig from "@sqds/multisig";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import * as yargs from "yargs";

async function createTransferTransaction({
  connection,
  member,
  multisigPda,
  recipient,
  amount,
  name = "Test Transfer",
}: {
  connection: Connection;
  member: PublicKey;
  multisigPda: PublicKey;
  recipient: PublicKey;
  amount: number;
  name?: string;
}) {
  // Get multisig account info
  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  // Get the vault PDA
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });

  // Create transfer instruction
  const transferIx = SystemProgram.transfer({
    fromPubkey: vaultPda,
    toPubkey: recipient,
    lamports: amount * LAMPORTS_PER_SOL,
  });

  // Build transaction message
  const message = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [transferIx],
  });

  // Get next transaction index
  const transactionIndex = BigInt(Number(multisigInfo.transactionIndex) + 1);

  // Create vault transaction
  const createTxIx = await multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex,
    creator: member,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: message,
    memo: name,
  });

  return createTxIx;
}

// CLI entry point
async function main() {
  const argv = await yargs
    .option("rpc", {
      type: "string",
      description: "RPC URL",
      required: true,
    })
    .option("multisig", {
      type: "string",
      description: "Multisig address",
      required: true,
    })
    .option("member", {
      type: "string",
      description: "Member public key",
      required: true,
    })
    .option("recipient", {
      type: "string",
      description: "Recipient address",
      required: true,
    })
    .option("amount", {
      type: "number",
      description: "Amount in SOL",
      default: 0.1,
    })
    .option("keypair", {
      type: "string",
      description: "Path to keypair file",
      required: true,
    }).argv;

  const connection = new Connection(argv.rpc);
  const keypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(require("fs").readFileSync(argv.keypair, "utf-8")))
  );
  const multisigPda = new PublicKey(argv.multisig);
  const recipient = new PublicKey(argv.recipient);

  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });

  console.log("\n=== Setup Info ===");
  console.log("Multisig:", multisigPda.toString());
  console.log("Vault:", vaultPda.toString());
  console.log("Member:", keypair.publicKey.toString());
  console.log("Recipient:", recipient.toString());
  console.log("Amount:", argv.amount, "SOL");

  // Get next transaction index
  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  console.log("\n=== Multisig Info ===");
  console.log("Transaction Index:", multisigInfo.transactionIndex.toString());
  console.log("Threshold:", multisigInfo.threshold.toString());
  console.log("Config Index:", multisigInfo.members.toString());
  console.log("Bump:", multisigInfo.bump.toString());
  console.log("Raw Data:", multisigInfo);

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const newTransactionIndex = BigInt(currentTransactionIndex + 1);
  console.log("New Transaction Index:", newTransactionIndex.toString());

  const instruction = SystemProgram.transfer({
    fromPubkey: vaultPda,
    toPubkey: recipient,
    lamports: argv.amount * LAMPORTS_PER_SOL,
  });

  console.log("\n=== Creating Transaction ===");
  console.log("Transfer Amount:", argv.amount * LAMPORTS_PER_SOL, "lamports");

  const transferMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [instruction],
  });

  try {
    console.log("\n=== Sending Transaction ===");
    const signature1 = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: keypair,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: keypair.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: transferMessage,
      memo: `Transfer ${argv.amount} SOL`,
    });

    await connection.confirmTransaction(signature1);
    console.log("Transaction Created - Signature:", signature1);

    console.log("\n=== Creating Proposal ===");
    const signature2 = await multisig.rpc.proposalCreate({
      connection,
      feePayer: keypair,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: keypair,
    });

    await connection.confirmTransaction(signature2);
    console.log("Proposal Created - Signature:", signature2);
    console.log("\nPlease approve in Squads UI: https://v4.squads.so/");
  } catch (error) {
    console.error("\n=== Error ===");
    console.error("Error details:", error);
    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}
