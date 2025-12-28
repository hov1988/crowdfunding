import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Crowdfunding } from "../target/types/crowdfunding";
import { expect } from "chai";
import { BN } from "bn.js";

describe("crowdfunding", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Crowdfunding as Program<Crowdfunding>;
  const user = provider.wallet;

  const campaignName = "Help for Cats";
  const campaignDescription = "Buying food for local shelter";
  const targetAmount = new BN(2 * anchor.web3.LAMPORTS_PER_SOL);
  const duration = new BN(5);

  const [campaignPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("campaign"),
      user.publicKey.toBuffer(),
      Buffer.from(campaignName),
    ],
    program.programId
  );

  const [contributorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("contribution"),
      campaignPDA.toBuffer(),
      user.publicKey.toBuffer(),
    ],
    program.programId
  );

  it("Creates a campaign successfully", async () => {
    await program.methods
      .create(campaignName, campaignDescription, targetAmount, duration)
      .accounts({
        campaign: campaignPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.campaign.fetch(campaignPDA);
    expect(account.targetAmount.toString()).to.equal(targetAmount.toString());
    expect(account.amountDonated.toNumber()).to.equal(0);
  });

  it("Allows a user to donate and creates a record", async () => {
    const donationAmount = new BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 1 SOL

    await program.methods
      .donate(donationAmount)
      .accounts({
        campaign: campaignPDA,
        contributorRecord: contributorPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const campaignAcc = await program.account.campaign.fetch(campaignPDA);
    const contributionAcc = await program.account.contribution.fetch(contributorPDA);

    expect(campaignAcc.amountDonated.toString()).to.equal(donationAmount.toString());
    expect(contributionAcc.amount.toString()).to.equal(donationAmount.toString());
  });

  it("Fails to withdraw before target is reached", async () => {
    try {
      await program.methods
        .withdraw(new BN(0.1 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          campaign: campaignPDA,
          admin: user.publicKey,
        })
        .rpc();
      expect.fail("Should have failed because target not reached");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("TargetNotReached");
    }
  });

  it("Reaches target and allows withdrawal", async () => {
    const secondDonation = new BN(1 * anchor.web3.LAMPORTS_PER_SOL);
    
    await program.methods
      .donate(secondDonation)
      .accounts({
        campaign: campaignPDA,
        contributorRecord: contributorPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const withdrawAmount = new BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);
    await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        campaign: campaignPDA,
        admin: user.publicKey,
      })
      .rpc();

    const campaignAcc = await program.account.campaign.fetch(campaignPDA);
    expect(campaignAcc.amountDonated.toNumber()).to.be.greaterThan(0);
  });

  it("Testing Refund logic (requires new campaign)", async () => {
    const shortName = "Short Campaign";
    const [shortPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("campaign"), user.publicKey.toBuffer(), Buffer.from(shortName)],
      program.programId
    );
    const [shortContributorPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("contribution"), shortPDA.toBuffer(), user.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .create(shortName, "Refund test", new BN(10e9), new BN(1))
      .accounts({ campaign: shortPDA, user: user.publicKey, systemProgram: anchor.web3.SystemProgram.programId })
      .rpc();

    await program.methods
      .donate(new BN(1e9))
      .accounts({ 
        campaign: shortPDA, 
        contributorRecord: shortContributorPDA, 
        user: user.publicKey, 
        systemProgram: anchor.web3.SystemProgram.programId 
      })
      .rpc();

    await new Promise(resolve => setTimeout(resolve, 2000));

    await program.methods
      .refund()
      .accounts({
        campaign: shortPDA,
        contributorRecord: shortContributorPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .rpc();

    try {
      await program.account.contribution.fetch(shortContributorPDA);
      expect.fail("Contribution account should be closed");
    } catch (e) {
    }
  });
});