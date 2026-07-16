/**
 * Solana / Anchor helpers for DepositGuard.
 *
 * Provides typed wrappers around the on-chain escrow program so every page
 * can call a single function and get back a confirmed transaction signature.
 */

import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";

// ── Constants ────────────────────────────────────────────────────────────────

export const SOLANA_NETWORK = "devnet";
export const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");

/**
 * Program ID — replace with your deployed program address.
 * For devnet testing before deployment, we use a deterministic placeholder.
 */
/**
 * Program ID — set NEXT_PUBLIC_PROGRAM_ID in .env.local after deploying.
 * Default is a deterministic devnet placeholder (derived from "depositguard").
 */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "11111111111111111111111111111112"
);

// ── Helpers ──────────────────────────────────────────────────────────────────

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function shortKey(pubkey: string, chars = 4): string {
  return `${pubkey.slice(0, chars)}…${pubkey.slice(-chars)}`;
}

/** Derive the escrow PDA for a tenancy using [b"escrow", tenancy_id] */
export function getEscrowPDA(tenancyId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), Buffer.from(tenancyId)],
    PROGRAM_ID
  );
}

export async function getBalance(address: string): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(address));
  return lamportsToSol(lamports);
}

// ── Anchor-style instruction builders ────────────────────────────────────────
// We build instructions manually to avoid heavy Anchor client-side dependency
// issues with Next.js bundling. The IDL is used for reference only.

/** Anchor discriminator: first 8 bytes of SHA-256("global:<instruction_name>") */
async function instructionDiscriminator(name: string): Promise<Buffer> {
  const encoded = new TextEncoder().encode(`global:${name}`);
  const buf = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Buffer.from(new Uint8Array(hash).slice(0, 8));
}

function encodeBorshString(s: string): Buffer {
  const strBytes = Buffer.from(s, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(strBytes.length, 0);
  return Buffer.concat([len, strBytes]);
}

function encodeU64(n: BN): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n.toString()), 0);
  return buf;
}

// ── On-chain transaction functions ───────────────────────────────────────────

/**
 * Create tenancy escrow on-chain.
 * Called by the landlord after creating the Supabase record.
 */
export async function createTenancyOnChain(
  wallet: WalletContextState,
  tenancyId: string,
  depositSol: number,
  moveInHash: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const [escrowPDA] = getEscrowPDA(tenancyId);
  const depositLamports = new BN(solToLamports(depositSol));

  const disc = await instructionDiscriminator("create_tenancy");
  const data = Buffer.concat([
    disc,
    encodeBorshString(tenancyId),
    encodeU64(depositLamports),
    encodeBorshString(moveInHash),
  ]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return await sendTransaction(wallet, [ix]);
}

/**
 * Tenant deposits SOL into the escrow PDA.
 */
export async function depositToEscrow(
  wallet: WalletContextState,
  tenancyId: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const [escrowPDA] = getEscrowPDA(tenancyId);

  const disc = await instructionDiscriminator("deposit");
  const data = Buffer.from(disc);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return await sendTransaction(wallet, [ix]);
}

/**
 * Landlord proposes a deposit split at move-out.
 */
export async function proposeReleaseOnChain(
  wallet: WalletContextState,
  tenancyId: string,
  landlordSol: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const [escrowPDA] = getEscrowPDA(tenancyId);
  const landlordLamports = new BN(solToLamports(landlordSol));

  const disc = await instructionDiscriminator("propose_release");
  const data = Buffer.concat([disc, encodeU64(landlordLamports)]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data,
  });

  return await sendTransaction(wallet, [ix]);
}

/**
 * Tenant approves the proposed split — escrow releases automatically.
 */
export async function approveReleaseOnChain(
  wallet: WalletContextState,
  tenancyId: string,
  landlordPubkey: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const [escrowPDA] = getEscrowPDA(tenancyId);

  const disc = await instructionDiscriminator("approve_release");
  const data = Buffer.from(disc);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(landlordPubkey), isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data,
  });

  return await sendTransaction(wallet, [ix]);
}

/**
 * Tenant disputes the proposed split.
 */
export async function disputeOnChain(
  wallet: WalletContextState,
  tenancyId: string
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const [escrowPDA] = getEscrowPDA(tenancyId);

  const disc = await instructionDiscriminator("dispute");
  const data = Buffer.from(disc);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    ],
    data,
  });

  return await sendTransaction(wallet, [ix]);
}

/**
 * Arbitrator reviews evidence and releases the escrow with their decided split.
 */
export async function arbitrateOnChain(
  wallet: WalletContextState,
  tenancyId: string,
  landlordPubkey: string,
  tenantPubkey: string,
  landlordSol: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const [escrowPDA] = getEscrowPDA(tenancyId);
  const landlordLamports = new BN(solToLamports(landlordSol));

  const disc = await instructionDiscriminator("arbitrate");
  const data = Buffer.concat([disc, encodeU64(landlordLamports)]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: escrowPDA, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(landlordPubkey), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(tenantPubkey), isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
    ],
    data,
  });

  return await sendTransaction(wallet, [ix]);
}

// ── Shared send helper ───────────────────────────────────────────────────────

async function sendTransaction(
  wallet: WalletContextState,
  instructions: TransactionInstruction[]
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  const tx = new Transaction();
  instructions.forEach((ix) => tx.add(ix));

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return sig;
}
