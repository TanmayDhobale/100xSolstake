import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HundredXStaking } from "../target/types/hundred_x_staking";

describe("hundred_x_staking", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.HundredXStaking as Program<HundredXStaking>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
