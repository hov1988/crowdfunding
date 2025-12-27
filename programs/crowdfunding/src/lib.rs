use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("53VNkdZZAGPEHRVmx9Hpvm4XcDMiqzGfZquaUQqhwv66");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn create(ctx: Context<Create>, name: String, description: String) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        campaign.admin = ctx.accounts.user.key();
        campaign.name = name;
        campaign.description = description;
        campaign.amount_donated = 0;
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let user = &mut ctx.accounts.user;

        let rent_balance = Rent::get()?.minimum_balance(campaign.to_account_info().data_len());
        if **campaign.to_account_info().lamports.borrow() - rent_balance < amount {
            return err!(ErrorCode::InsufficientFunds);
        }

        **campaign.to_account_info().try_borrow_mut_lamports()? -= amount;
        **user.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.campaign.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        ctx.accounts.campaign.amount_donated += amount;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String)]
pub struct Create<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + (4 + name.len()) + (4 + description.len()) + 8,
        seeds = [b"campaign", user.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        has_one = admin @ ErrorCode::InvalidAdmin
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Campaign {
    pub admin: Pubkey,
    pub name: String,
    pub description: String,
    pub amount_donated: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Only the admin can withdraw funds.")]
    InvalidAdmin,
    #[msg("Insufficient funds in campaign (must respect rent exemption).")]
    InsufficientFunds,
}