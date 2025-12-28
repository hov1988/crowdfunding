use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("53VNkdZZAGPEHRVmx9Hpvm4XcDMiqzGfZquaUQqhwv66");

#[program]
pub mod crowdfunding {
    use super::*;

    pub fn create(ctx: Context<Create>, name: String, description: String, target_amount: u64, duration: i64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        campaign.admin = ctx.accounts.user.key();
        campaign.name = name;
        campaign.description = description;
        campaign.target_amount = target_amount;
        campaign.amount_donated = 0;
        campaign.deadline = Clock::get()?.unix_timestamp + duration;
        campaign.bump = ctx.bumps.campaign;
        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let contributor_record = &mut ctx.accounts.contributor_record;

        require!(Clock::get()?.unix_timestamp <= campaign.deadline, ErrorCode::CampaignEnded);

        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: campaign.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        campaign.amount_donated += amount;

        contributor_record.amount += amount;
        contributor_record.user = ctx.accounts.user.key();

        emit!(DonationEvent {
            campaign: campaign.key(),
            user: ctx.accounts.user.key(),
            amount,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        
        require!(campaign.amount_donated >= campaign.target_amount, ErrorCode::TargetNotReached);

        let rent_balance = Rent::get()?.minimum_balance(campaign.to_account_info().data_len());
        let available_balance = **campaign.to_account_info().lamports.borrow() - rent_balance;
        
        require!(available_balance >= amount, ErrorCode::InsufficientFunds);

        **campaign.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += amount;
        
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let contributor_record = &mut ctx.accounts.contributor_record;

        require!(Clock::get()?.unix_timestamp > campaign.deadline, ErrorCode::CampaignStillActive);
        require!(campaign.amount_donated < campaign.target_amount, ErrorCode::TargetReachedNoRefund);
        require!(contributor_record.amount > 0, ErrorCode::NoContributionFound);

        let amount_to_refund = contributor_record.amount;

        **ctx.accounts.campaign.to_account_info().try_borrow_mut_lamports()? -= amount_to_refund;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount_to_refund;

        contributor_record.amount = 0;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct Create<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [b"campaign", user.key().as_ref(), name.as_bytes()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Donate<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Contribution::INIT_SPACE,
        seeds = [b"contribution", campaign.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub contributor_record: Account<'info, Contribution>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        mut,
        seeds = [b"contribution", campaign.key().as_ref(), user.key().as_ref()],
        bump,
        close = user
    )]
    pub contributor_record: Account<'info, Contribution>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = admin)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub admin: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(100)]
    pub description: String,
    pub amount_donated: u64,
    pub target_amount: u64,
    pub deadline: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Contribution {
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DonationEvent {
    pub campaign: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Campaign ended.")] CampaignEnded,
    #[msg("Campaign still active.")] CampaignStillActive,
    #[msg("Target reached, refunds disabled.")] TargetReachedNoRefund,
    #[msg("No contribution found.")] NoContributionFound,
    #[msg("Target not reached.")] TargetNotReached,
    #[msg("Insufficient funds.")] InsufficientFunds,
    #[msg("Invalid admin.")] InvalidAdmin,
}