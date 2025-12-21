use anchor_lang::prelude::*;

declare_id!("7zT6hzi2QoHtZrhsBqoapB5nEX94SBvoX21awsELDdGx");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
