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
  
  const [campaignPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("campaign"),
      user.publicKey.toBuffer(),
      Buffer.from(campaignName),
    ],
    program.programId
  );

  it("Creates a campaign successfully", async () => {
    await program.methods
      .create(campaignName, campaignDescription)
      .accounts({
        campaign: campaignPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.campaign.fetch(campaignPDA);
    expect(account.name).to.equal(campaignName);
    expect(account.description).to.equal(campaignDescription);
    expect(account.admin.toString()).to.equal(user.publicKey.toString());
    expect(account.amountDonated.toNumber()).to.equal(0);
  });

  it("Allows a user to donate", async () => {
    const donationAmount = new BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 1 SOL

    await program.methods
      .donate(donationAmount)
      .accounts({
        campaign: campaignPDA,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.campaign.fetch(campaignPDA);
    expect(account.amountDonated.toString()).to.equal(donationAmount.toString());

    const balance = await provider.connection.getBalance(campaignPDA);
    expect(balance).to.be.greaterThan(donationAmount.toNumber());
  });

  it("Allows admin to withdraw funds", async () => {
    const withdrawAmount = new BN(0.5 * anchor.web3.LAMPORTS_PER_SOL); // 0.5 SOL
    
    const beforeBalance = await provider.connection.getBalance(user.publicKey);

    await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        campaign: campaignPDA,
        admin: user.publicKey,
      })
      .rpc();

    const afterBalance = await provider.connection.getBalance(user.publicKey);
    
    expect(afterBalance).to.be.greaterThan(beforeBalance);
  });

  it("Fails when a non-admin tries to withdraw", async () => {
    const maliciousUser = anchor.web3.Keypair.generate();
    
    const signature = await provider.connection.requestAirdrop(maliciousUser.publicKey, 1e9);
    await provider.connection.confirmTransaction(signature);

    try {
      await program.methods
        .withdraw(new BN(0.1 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          campaign: campaignPDA,
          admin: maliciousUser.publicKey,
        })
        .signers([maliciousUser])
        .rpc();
        
      expect.fail("The transaction should have failed");
    } catch (err: any) {
      expect(err.error.errorCode.code).to.equal("InvalidAdmin");
    }
  });
});