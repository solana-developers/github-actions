import * as multisig from "@sqds/multisig";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  Keypair,
  TransactionInstruction,
} from "@solana/web3.js";
import * as yargs from "yargs";

const BPF_UPGRADE_LOADER_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

async function createCloseBufferAuthorityInstruction(
  bufferAddress: PublicKey,
  bufferAuthority: PublicKey
): Promise<TransactionInstruction> {
  return new TransactionInstruction({
    keys: [
      { pubkey: bufferAddress, isWritable: true, isSigner: false },
      { pubkey: bufferAuthority, isWritable: true, isSigner: true },
      { pubkey: bufferAuthority, isWritable: true, isSigner: true },
    ],
    programId: BPF_UPGRADE_LOADER_ID,
    data: Buffer.from([5, 0, 0, 0]), // SetBufferAuthority instruction
  });
}

async function main() {
  const argv = await yargs
    .option("rpc", {
      type: "string",
      description: "RPC URL",
      required: true,
    })
    .option("program", {
      type: "string",
      description: "Program ID",
      required: true,
    })
    .option("buffer", {
      type: "string",
      description: "Program buffer address",
      required: true,
    })
    .option("multisig", {
      type: "string",
      description: "Multisig address",
      required: true,
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
  const programId = new PublicKey(argv.program);
  const programBuffer = new PublicKey(argv.buffer);

  // Get vault PDA (authority)
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });

  console.log("\n=== Setup Info ===");
  console.log("Multisig:", multisigPda.toString());
  console.log("Vault:", vaultPda.toString());
  console.log("Program:", programId.toString());
  console.log("Program Buffer:", programBuffer.toString());

  // Create authority transfer instructions
  const programBufferAuthorityIx = await createCloseBufferAuthorityInstruction(
    programBuffer,
    vaultPda
  );

  // Build transaction message with all instructions
  // NOTE: You first need to upgrade the IDL if you do it after it sais the program is not deployed ...
  const message = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [programBufferAuthorityIx],
  });

  // Get next transaction index
  const multisigInfo = await multisig.accounts.Multisig.fromAccountAddress(
    connection,
    multisigPda
  );

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);

  const newTransactionIndex = BigInt(currentTransactionIndex + 1);

  try {
    console.log("\n=== Creating Upgrade Transaction ===");
    const createVaultSignature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: keypair,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: keypair.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: message,
      memo: "Program and IDL upgrade",
    });

    console.log("Confirming transaction:", createVaultSignature);
    await connection.confirmTransaction(createVaultSignature);
    console.log("Transaction Created - Signature:", createVaultSignature);

    console.log("\n=== Creating Proposal ===");
    const proposalCreateSignature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: keypair,
      multisigPda,
      transactionIndex: newTransactionIndex,
      creator: keypair,
    });

    console.log("Confirming proposal:", proposalCreateSignature);
    await connection.confirmTransaction(createVaultSignature);
    console.log("Proposal Created - Signature:", proposalCreateSignature);
    console.log("\nPlease approve in Squads UI: https://v4.squads.so/");
  } catch (error) {
    console.error("\n=== Error ===");
    console.error("Error details:", error);
    process.exit(1); // Exit with error code to prevent double logging
  }
}

if (require.main === module) {
  main().catch(console.error);
}
