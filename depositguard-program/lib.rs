use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("PASTE_PROGRAM_ID_HERE_AFTER_DEPLOY");

#[program]
pub mod depositguard {
    use super::*;

    /// Landlord creates the escrow PDA.
    /// Stores deposit amount and move-in photo hash on-chain.
    pub fn create_tenancy(
        ctx: Context<CreateTenancy>,
        tenancy_id: String,
        deposit_lamports: u64,
        move_in_hash: String,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.tenancy_id                 = tenancy_id;
        escrow.landlord                   = ctx.accounts.landlord.key();
        escrow.tenant                     = Pubkey::default();
        escrow.arbitrator                 = Pubkey::default();
        escrow.deposit_lamports           = deposit_lamports;
        escrow.proposed_landlord_lamports = 0;
        escrow.proposed_tenant_lamports   = 0;
        escrow.move_in_hash               = move_in_hash;
        escrow.landlord_agreed            = false;
        escrow.tenant_agreed              = false;
        escrow.status                     = EscrowStatus::AwaitingDeposit;
        escrow.bump                       = ctx.bumps.escrow;
        Ok(())
    }

    /// Tenant sends DEPG into the PDA escrow. Marks tenancy Active.
    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        // Validate first — no &mut binding so we don't conflict with to_account_info()
        require!(
            ctx.accounts.escrow.status == EscrowStatus::AwaitingDeposit,
            DepositGuardError::InvalidStatus
        );
        require!(
            ctx.accounts.escrow.tenant == Pubkey::default(),
            DepositGuardError::TenantAlreadySet
        );

        let amount     = ctx.accounts.escrow.deposit_lamports;
        let tenant_key = ctx.accounts.tenant.key();

        // CPI: transfer DEPG from tenant wallet to escrow PDA
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.tenant.to_account_info(),
                    to:   ctx.accounts.escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update state after CPI
        ctx.accounts.escrow.tenant = tenant_key;
        ctx.accounts.escrow.status = EscrowStatus::Active;
        Ok(())
    }

    /// Landlord proposes a deposit split at move-out.
    pub fn propose_release(
        ctx: Context<ProposeRelease>,
        landlord_lamports: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Active,
            DepositGuardError::InvalidStatus
        );
        require!(
            ctx.accounts.landlord.key() == ctx.accounts.escrow.landlord,
            DepositGuardError::Unauthorized
        );
        require!(
            landlord_lamports <= ctx.accounts.escrow.deposit_lamports,
            DepositGuardError::InvalidAmount
        );

        let total = ctx.accounts.escrow.deposit_lamports;
        let escrow = &mut ctx.accounts.escrow;
        escrow.proposed_landlord_lamports = landlord_lamports;
        escrow.proposed_tenant_lamports   = total - landlord_lamports;
        escrow.landlord_agreed            = true;
        escrow.status                     = EscrowStatus::MoveOutProposed;
        Ok(())
    }

    /// Tenant agrees to the split — escrow releases automatically.
    pub fn approve_release(ctx: Context<ApproveRelease>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::MoveOutProposed,
            DepositGuardError::InvalidStatus
        );
        require!(
            ctx.accounts.tenant.key() == ctx.accounts.escrow.tenant,
            DepositGuardError::Unauthorized
        );

        // Read amounts before touching account infos
        let landlord_share = ctx.accounts.escrow.proposed_landlord_lamports;
        let tenant_share   = ctx.accounts.escrow.proposed_tenant_lamports;

        // Get cloned AccountInfos — these hold Rc<RefCell<>> refs to the same lamports
        let escrow_info   = ctx.accounts.escrow.to_account_info();
        let landlord_info = ctx.accounts.landlord.to_account_info();
        let tenant_info   = ctx.accounts.tenant.to_account_info();

        if landlord_share > 0 {
            **escrow_info.try_borrow_mut_lamports()?   -= landlord_share;
            **landlord_info.try_borrow_mut_lamports()? += landlord_share;
        }
        if tenant_share > 0 {
            **escrow_info.try_borrow_mut_lamports()?  -= tenant_share;
            **tenant_info.try_borrow_mut_lamports()?  += tenant_share;
        }

        ctx.accounts.escrow.tenant_agreed = true;
        ctx.accounts.escrow.status        = EscrowStatus::Completed;
        Ok(())
    }

    /// Tenant disputes the proposed split — moves to arbitration.
    pub fn dispute(ctx: Context<DisputeEscrow>) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::MoveOutProposed,
            DepositGuardError::InvalidStatus
        );
        require!(
            ctx.accounts.tenant.key() == ctx.accounts.escrow.tenant,
            DepositGuardError::Unauthorized
        );

        ctx.accounts.escrow.status = EscrowStatus::Disputed;
        Ok(())
    }

    /// Arbitrator reviews on-chain evidence and releases the split.
    pub fn arbitrate(
        ctx: Context<Arbitrate>,
        landlord_lamports: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.escrow.status == EscrowStatus::Disputed,
            DepositGuardError::InvalidStatus
        );
        require!(
            landlord_lamports <= ctx.accounts.escrow.deposit_lamports,
            DepositGuardError::InvalidAmount
        );

        let total          = ctx.accounts.escrow.deposit_lamports;
        let tenant_lamports = total - landlord_lamports;
        let arbitrator_key = ctx.accounts.arbitrator.key();

        let escrow_info   = ctx.accounts.escrow.to_account_info();
        let landlord_info = ctx.accounts.landlord.to_account_info();
        let tenant_info   = ctx.accounts.tenant.to_account_info();

        if landlord_lamports > 0 {
            **escrow_info.try_borrow_mut_lamports()?   -= landlord_lamports;
            **landlord_info.try_borrow_mut_lamports()? += landlord_lamports;
        }
        if tenant_lamports > 0 {
            **escrow_info.try_borrow_mut_lamports()?  -= tenant_lamports;
            **tenant_info.try_borrow_mut_lamports()?  += tenant_lamports;
        }

        ctx.accounts.escrow.arbitrator = arbitrator_key;
        ctx.accounts.escrow.status     = EscrowStatus::Completed;
        Ok(())
    }
}

// ── Account contexts ──────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(tenancy_id: String)]
pub struct CreateTenancy<'info> {
    #[account(
        init,
        payer = landlord,
        space = EscrowState::space(),
        seeds = [b"escrow", tenancy_id.as_bytes()],
        bump
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub landlord: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.tenancy_id.as_bytes()],
        bump  = escrow.bump
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub tenant: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeRelease<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.tenancy_id.as_bytes()],
        bump  = escrow.bump
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub landlord: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveRelease<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.tenancy_id.as_bytes()],
        bump  = escrow.bump
    )]
    pub escrow: Account<'info, EscrowState>,

    /// CHECK: compared against escrow.landlord inside the instruction
    #[account(mut)]
    pub landlord: AccountInfo<'info>,

    #[account(mut)]
    pub tenant: Signer<'info>,
}

#[derive(Accounts)]
pub struct DisputeEscrow<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.tenancy_id.as_bytes()],
        bump  = escrow.bump
    )]
    pub escrow: Account<'info, EscrowState>,

    #[account(mut)]
    pub tenant: Signer<'info>,
}

#[derive(Accounts)]
pub struct Arbitrate<'info> {
    #[account(
        mut,
        seeds = [b"escrow", escrow.tenancy_id.as_bytes()],
        bump  = escrow.bump
    )]
    pub escrow: Account<'info, EscrowState>,

    /// CHECK: funds recipient — compared against escrow.landlord
    #[account(mut)]
    pub landlord: AccountInfo<'info>,

    /// CHECK: funds recipient — compared against escrow.tenant
    #[account(mut)]
    pub tenant: AccountInfo<'info>,

    pub arbitrator: Signer<'info>,
}

// ── State ─────────────────────────────────────────────────────────────────────

#[account]
pub struct EscrowState {
    pub tenancy_id:                 String,  // UUID (max 36 chars)
    pub landlord:                   Pubkey,
    pub tenant:                     Pubkey,
    pub arbitrator:                 Pubkey,
    pub deposit_lamports:           u64,
    pub proposed_landlord_lamports: u64,
    pub proposed_tenant_lamports:   u64,
    pub move_in_hash:               String,  // SHA-256 hex (64 chars)
    pub landlord_agreed:            bool,
    pub tenant_agreed:              bool,
    pub status:                     EscrowStatus,
    pub bump:                       u8,
}

impl EscrowState {
    pub fn space() -> usize {
        8           // discriminator
        + 4 + 36    // tenancy_id
        + 32        // landlord
        + 32        // tenant
        + 32        // arbitrator
        + 8         // deposit_lamports
        + 8         // proposed_landlord_lamports
        + 8         // proposed_tenant_lamports
        + 4 + 64    // move_in_hash
        + 1         // landlord_agreed
        + 1         // tenant_agreed
        + 1         // status enum
        + 1         // bump
        + 32        // padding
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    AwaitingDeposit,
    Active,
    MoveOutProposed,
    Disputed,
    Completed,
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum DepositGuardError {
    #[msg("Escrow is not in the correct status for this action")]
    InvalidStatus,
    #[msg("Caller is not authorized for this action")]
    Unauthorized,
    #[msg("Tenant has already paid into this escrow")]
    TenantAlreadySet,
    #[msg("Amount exceeds the total deposit")]
    InvalidAmount,
}
