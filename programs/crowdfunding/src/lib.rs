use anchor_lang::prelude::*;

declare_id!("7zT6hzi2QoHtZrhsBqoapB5nEX94SBvoX21awsELDdGx");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn create(
        _ctx: Context<Create>,
        _name: String,
        _description: String,
    ) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
