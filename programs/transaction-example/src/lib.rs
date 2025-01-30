use anchor_lang::prelude::*;

declare_id!("BhV84MZrRnEvtWLdWMRJGJr1GbusxfVMHAwc3pq92g4z");

#[program]
pub mod transaction_example {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        ctx.accounts.counter.count = 0;  // Initialize to 0 instead of incrementing
        Ok(())
    }

    pub fn increment(ctx: Context<Increment>) -> Result<()> {
        ctx.accounts.counter.count += 1;
        emit!(CounterEvent {
            counter: ctx.accounts.counter.count,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(init_if_needed, 
        payer = signer,
        space = 8 + 8,
        seeds = [b"counter"],
        bump,
    )]
    pub counter: Account<'info, Counter>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Increment<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"counter"], bump)]
    pub counter: Account<'info, Counter>,
}

#[account]
pub struct Counter {
    pub count: u64,
}

#[event]
pub struct CounterEvent {
    pub counter: u64,
    pub timestamp: i64,
}
