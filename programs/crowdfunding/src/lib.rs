use anchor_lang::prelude::*;

declare_id!("7zT6hzi2QoHtZrhsBqoapB5nEX94SBvoX21awsELDdGx");

#[program]
pub mod crowdfunding {
    use anchor_lang::solana_program::entrypoint::ProgramResult;

    use super::*;

    pub fn create(ctx: Context<Create>, name: String, description: String) -> ProgramResult {
        let campaign = &mut ctx.accounts.campaign;
        campaign.admin = ctx.accounts.user.key();
        campaign.name = name;
        campaign.description = description;
        campaign.amount_donated = 0;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> ProgramResult {
        let campaign = &mut ctx.accounts.campaign;
        let user = &mut ctx.accounts.user;

        if (campaign.admin != *user.key) {
            return Err(ProgramError::IncorrectProgramId);
        }

        let rent_balance = Rent::get()?.minimum_balance(campaign.to_account_info().data_len());
        if **campaign.to_account_info().lamports.borrow() - rent_balance < amount {
            return Err(ProgramError::InsufficientFunds);
        }

        **campaign.to_account_info().try_borrow_mut_lamports()? -= amount;  
        **user.to_account_info().try_borrow_mut_lamports()? += amount;  
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"CAMPAIGN_DEMO", user.key().as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
}


#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub admin: Pubkey,

    #[max_len(64)]
    pub name: String,

    #[max_len(256)]
    pub description: String,

    pub amount_donated: i64,
}