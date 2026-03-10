# personalities
## The Chaos Gambler
- description: Spins the wheel first, asks questions during the liquidation candle.
- humorStyle: degen sports commentator with meme subtitles.
- themes: chaos,frequency,casino,memetic,viral

## The Revenge Trader
- description: Treats every red candle like direct disrespect.
- humorStyle: boxing promo narrator from the trenches.
- themes: revenge,chaos,momentum,late

## The Diamond Hands Martyr
- description: Holds through pain with religious conviction and zero stop-loss energy.
- humorStyle: dramatic priest of unrealized PnL.
- themes: diamond,baghold,conviction,cinema

## The Exit Liquidity Philanthropist
- description: Generously donates favorable exits to strangers.
- humorStyle: charity gala host for bad entries.
- themes: late,fomo,liquidity,pain

## The Conviction Maximalist
- description: Chooses one thesis and defends it like a courtroom drama.
- humorStyle: serious documentary narrator with sarcastic cutaways.
- themes: conviction,focus,patience,meta

## The Chart Monk
- description: Surprisingly calm execution in a market built from noise.
- humorStyle: stoic monk whispering in all caps.
- themes: consistency,discipline,early,calm

# modifiers
## Maximum Hopium
- description: Keeps optimism fully charged during structural drawdowns.
- toneEffect: inspirational-but-concerning
- triggerHints: hold_losers,drawdown,conviction

## Catastrophic Timing
- description: Arrives exactly when the move is already old news.
- toneEffect: tragic-comedy
- triggerHints: late,fomo,momentum

## Suspicious Luck
- description: Execution looked cursed but somehow the scoreboard looked blessed.
- toneEffect: backhanded-miracle
- triggerHints: luck,chaos,frequency

## Full Casino Mode
- description: Every click feels like an all-in side quest.
- toneEffect: all-gas-no-brakes
- triggerHints: frequency,chaos,volatility

## Quiet Discipline
- description: Less emotional whiplash, more deliberate entries.
- toneEffect: cold-and-clinical
- triggerHints: consistency,patience,early

# interpretation-lines
- id: interp-chaos-01
- tags: chaos,universal,memetic
- tone: roast
- suitabilityRules: behavior.chaosScore>=0.6|1.2;activity.tradesPerHour>=0.25|0.8
- text: Wallet traded like it heard a drum solo every 30 seconds.

- id: interp-chaos-02
- tags: chaos,high-frequency,viral
- tone: trench-caster
- suitabilityRules: activity.tradesPerHour>=0.35|1.3;behavior.chaosScore>=0.55|1
- text: Order flow looked less like strategy and more like speedrunning emotional damage.

- id: interp-late-01
- tags: late,fomo,momentum
- tone: playful-drag
- suitabilityRules: timing.lateEntryBias>=0.55|1.4;attention.chaseScore>=0.5|1
- text: Entries kept arriving right after the timeline already posted we are so back.

- id: interp-late-02
- tags: late,exit-liquidity-philanthropist
- tone: ironic
- suitabilityRules: timing.lateEntryBias>=0.62|1.4
- text: You consistently bought premium candles and donated exits to earlier believers.

- id: interp-early-01
- tags: early,terminally-early-visionary,conviction
- tone: mythic
- suitabilityRules: timing.earlyEntryBias>=0.58|1.2;behavior.convictionScore>=0.5|0.8
- text: Some entries landed early enough to look like leaked script pages.

- id: interp-baghold-01
- tags: baghold,diamond,maximum-hopium
- tone: tragic-comedy
- suitabilityRules: holding.bagholdBias>=0.5|1.3;risk.drawdownTolerance>=0.5|0.8
- text: Positions were held with heroic faith and very limited concern for market weather.

- id: interp-baghold-02
- tags: baghold,legendary-bag-holder
- tone: mockumentary
- suitabilityRules: holding.bagholdBias>=0.58|1.5
- text: That bag was not a trade anymore, it was a long-term relationship.

- id: interp-paperhands-01
- tags: paper-hands,low-patience
- tone: roast
- suitabilityRules: holding.shortHoldBias>=0.58|1.4;timing.lateEntryBias>=0.3|0.3
- text: Profits were taken so early they were still in tutorial mode.

- id: interp-revenge-01
- tags: revenge,emotional-trading
- tone: combative
- suitabilityRules: behavior.revengeBias>=0.52|1.3;timing.rapidReentryScore>=0.45|1
- text: Losses triggered immediate rematches like the chart owed you money personally.

- id: interp-revenge-02
- tags: revenge,chaos
- tone: unhinged
- suitabilityRules: behavior.revengeBias>=0.6|1.5
- text: This was less portfolio management and more sanctioned vengeance.

- id: interp-conviction-01
- tags: conviction,high-conviction
- tone: respectful-roast
- suitabilityRules: behavior.convictionScore>=0.6|1.3;sizing.concentrationScore>=0.5|0.8
- text: When conviction appeared, you pressed it like a launch button.

- id: interp-conviction-02
- tags: conviction,silent-accumulator
- tone: calm
- suitabilityRules: behavior.convictionScore>=0.55|1.1;behavior.patienceScore>=0.55|1
- text: You ignored noise and treated entries like deliberate inventory, not panic clicks.

- id: interp-night-01
- tags: night,goblin,overcooked
- tone: trench-lore
- suitabilityRules: timing.nightActivityScore>=0.38|1.2;activity.tradesPerHour>=0.2|0.6
- text: Goblin-hour execution stayed active while normal sleep schedules were offline.

- id: interp-luck-01
- tags: lucky-idiot,suspicious-luck,viral
- tone: backhanded-praise
- suitabilityRules: pnl.estimatedPnlSol>=0.1|0.8;behavior.chaosScore>=0.45|0.8;virality.memeabilityScore>=0.45|0.8
- text: The process looked cursed, but outcomes occasionally arrived wearing plot armor.

- id: interp-cinema-01
- tags: cinema,viral,universal
- tone: cinematic
- suitabilityRules: virality.cinemaScore>=0.55|1.2
- text: The timeline reads like an edit timeline, not a calm accounting ledger.

- id: interp-cinema-02
- tags: cinema,absolute-cinema,memetic
- tone: over-the-top
- suitabilityRules: virality.cinemaScore>=0.62|1.4;behavior.chaosScore>=0.45|0.6
- text: This session delivered frame-by-frame content for the village historians.

- id: interp-meta-01
- tags: meta,meta-awareness
- tone: analyst
- suitabilityRules: attention.momentumAlignment>=0.56|1.2;timing.earlyEntryBias>=0.45|0.6
- text: Rotation awareness was visible, with entries often aligned to active narrative flow.

- id: interp-risk-01
- tags: degenerate-risk-tolerance,casino
- tone: dark-comedy
- suitabilityRules: risk.drawdownTolerance>=0.58|1.2;sizing.sizeVariance>=0.5|0.7
- text: Risk sizing suggests your comfort zone starts where disclaimers usually end.

- id: interp-risk-02
- tags: panic-selling,paper-hands
- tone: cautionary
- suitabilityRules: risk.panicExitBias>=0.5|1.3;holding.shortHoldBias>=0.5|0.7
- text: Exit behavior often prioritized immediate safety over full move completion.

- id: interp-universal-01
- tags: universal,memetic,cinema
- tone: trench-poetry
- suitabilityRules: activity.tradeCount>=12|0.8
- text: Facts were objective. Decision-making was occasionally spiritual.

- id: interp-attention-01
- tags: attention,universal,consistency
- tone: tactical
- suitabilityRules: attention.attentionSensitivity>=0.5|1.2;attention.momentumAlignment>=0.52|1
- text: Price was the result. Attention was the driver.

- id: interp-attention-02
- tags: attention,late,fomo
- tone: cautionary
- suitabilityRules: attention.attentionSensitivity>=0.45|0.8;timing.lateEntryBias>=0.55|1.2
- text: Setup looked bullish on chart, but social attention was already crowded.

- id: interp-no-trade-01
- tags: no-trade,discipline,consistency
- tone: pro-mindset
- suitabilityRules: activity.tradesPerHour<=0.08|1.3;behavior.patienceScore>=0.55|1
- text: Best trade in this phase was selective inactivity, not forced participation.

- id: interp-no-trade-02
- tags: no-trade,culture
- tone: calm
- suitabilityRules: activity.tradesPerHour<=0.1|1;attention.attentionSensitivity<=0.35|0.8
- text: Doing nothing preserved capital while the timeline searched for a new story.

- id: interp-newpairs-01
- tags: new-pairs,risk,late
- tone: warning
- suitabilityRules: timing.lateEntryBias>=0.58|1.2;behavior.chaosScore>=0.55|1
- text: This behavior profile matched new-pair danger: fast chaos, thin edge, expensive mistakes.

- id: interp-newpairs-02
- tags: new-pairs,discipline
- tone: strategic
- suitabilityRules: behavior.patienceScore>=0.55|0.8;timing.earlyEntryBias>=0.45|0.6
- text: Edge improved when waiting for structure instead of competing in launch-speed roulette.

- id: interp-wallet-context-01
- tags: culture,meta,attention
- tone: professional
- suitabilityRules: attention.momentumAlignment>=0.5|1;behavior.convictionScore>=0.45|0.6
- text: Wallet signals worked best as confidence checks, not copy-trade commands.

- id: interp-wallet-context-02
- tags: culture,discipline
- tone: observer
- suitabilityRules: behavior.patienceScore>=0.5|1;activity.tradesPerHour<=0.2|0.5
- text: Interpreted who was participating and who stayed silent before sizing.

- id: interp-process-01
- tags: consistency,discipline,universal
- tone: coaching
- suitabilityRules: behavior.patienceScore>=0.55|1;behavior.chaosScore<=0.45|0.8
- text: Process quality stayed higher than outcome obsession, which kept execution cleaner.

- id: interp-process-02
- tags: overtrading,discipline
- tone: corrective
- suitabilityRules: activity.tradesPerHour>=0.35|1.1;behavior.chaosScore>=0.5|0.7
- text: Trade count outran judgment at times; fewer cleaner entries would have improved expectancy.

- id: interp-sizing-01
- tags: risk,overtrading
- tone: blunt
- suitabilityRules: sizing.sizeVariance>=0.55|1.2;risk.panicExitBias>=0.45|0.8
- text: Position sizing occasionally looked too large for calm decision-making under drawdown.

- id: interp-cutloss-01
- tags: discipline,risk
- tone: practical
- suitabilityRules: risk.panicExitBias>=0.48|1;behavior.revengeBias>=0.45|0.8
- text: Loss control worked best when cuts were mechanical and immediate, not negotiated mid-trade.

# trench-copypasta
- id: copy-general-01
- trigger: general
- tags: village,cinema,memetic
- text: Brother this wallet did not trade, it produced a trilogy.

- id: copy-chaos-01
- trigger: chaos
- tags: chaos,viral
- text: This chart needed supervision and you brought fireworks.

- id: copy-revenge-01
- trigger: revenge
- tags: revenge,combat
- text: The market threw a jab and you answered with a full combo.

- id: copy-baghold-01
- trigger: baghold
- tags: baghold,maximum-hopium
- text: Position aged from trade to lore artifact.

- id: copy-cinema-01
- trigger: cinema
- tags: cinema,absolute-cinema,viral
- text: Oscar for Best On-Chain Emotional Performance goes to this wallet.

- id: copy-fomo-01
- trigger: fomo
- tags: fomo,late
- text: Entry timing said breaking news, move already happened.

- id: copy-conviction-01
- trigger: conviction
- tags: conviction,diamond
- text: Conviction levels were high enough to ignore weather, gravity, and comments.

- id: copy-attention-01
- trigger: attention
- tags: attention,culture
- text: You were not trading candles, you were trading crowd focus latency.

- id: copy-nopressure-01
- trigger: no-trade
- tags: no-trade,discipline
- text: The market offered noise; you invoiced it with silence.

- id: copy-steady-lads
- trigger: risk
- tags: memetic,risk,chaos
- text: Steady lads, deploying more caution.

- id: copy-investigation
- trigger: general
- tags: memetic,universal
- text: In case of an investigation, this entry was definitely based on risk rules and not vibes.

- id: copy-lock-in
- trigger: discipline
- tags: discipline,consistency
- text: The cost of not locking in is spending tomorrow clocking in.

- id: copy-think-pro
- trigger: culture
- tags: culture,consistency
- text: Pros ask is this worth trading at all before asking where to click buy.

# moments
## absolute-cinema
- title-template: Absolute Cinema Moment
- humor-template: Brother this was cinema. {momentDescription}

## main-character
- title-template: Main Character Candle
- humor-template: Camera zoomed in and {walletShort} briefly remembered the assignment.

## trench-lore
- title-template: Trench Lore Archive Entry
- humor-template: This one cannot be explained to civilians. {momentHumor}

## paper-hands
- title-template: Paper Hands Intermission
- humor-template: Took the quick bag, missed the sequel, still rolled credits early.

## diamond-hands
- title-template: Diamond Hands Cutscene
- humor-template: Held through turbulence like volatility was a personality quiz.

## comeback
- title-template: Plot Armor Comeback
- humor-template: Got clipped, respawned, and returned with better dialogue.

## fumble
- title-template: Historic Fumble
- humor-template: Bag slipped, floor disappeared, lore expanded.

## goblin-hour
- title-template: Goblin Hour Dispatch
- humor-template: Strategy was asleep, instincts had admin access.

## conviction
- title-template: Conviction Arc
- humor-template: This thesis got repeated buys and a full emotional sponsorship.

## had-to-be-there
- title-template: Had-To-Be-There Sequence
- humor-template: Anyone not live in the trenches chat will never fully understand.

## escape
- title-template: Narrow Escape Scene
- humor-template: You left just before the roof filed for collapse.

## overcooked
- title-template: Overcooked Sequence
- humor-template: Too many clicks, not enough oxygen.

# cinematic-summaries
- id: summary-chaos-cinema
- tone: memetic-cinema
- tags: chaos,cinema,viral
- text: {walletShort} ran a {tradeCount}-trade speedrun where strategy and adrenaline split custody.

- id: summary-conviction-cut
- tone: dramatic
- tags: conviction,diamond,cinema
- text: {walletShort} played {personality} with {modifierOne} energy and held narrative pressure through turbulence.

- id: summary-fomo-arc
- tone: satirical
- tags: late,fomo,momentum
- text: In a {rangeHours}h window, {walletShort} chased heat with {modifierTone} pacing and converted it into modern trench folklore.

- id: summary-meta-arc
- tone: analyst-meme
- tags: meta,early,cinema
- text: {walletShort} moved with {personalityDescription}, mixing timeline awareness with selective chaos for a highly watchable tape.

- id: summary-attention-first
- tone: tactical
- tags: attention,consistency,culture
- text: {walletShort} traded attention cycles first and candles second, using {modifierTone} discipline to avoid crowded exits.

- id: summary-discipline-arc
- tone: pro
- tags: discipline,no-trade,consistency
- text: Best edge came from selectivity: fewer forced clicks, clearer invalidations, and cleaner follow-through.

# x-lines
- id: x-cinema-01
- tags: viral,cinema,memetic
- text: This wallet did not trade, it released episodes.

- id: x-cinema-02
- tags: viral,absolute-cinema
- text: Brother this was cinema, financed by pure conviction and questionable timing.

- id: x-chaos-01
- tags: chaos,viral
- text: Order flow looked like a keyboard durability test.

- id: x-fomo-01
- tags: late,fomo,viral
- text: Entered right after the move and still made it look intentional.

- id: x-baghold-01
- tags: baghold,diamond
- text: Held that token long enough to qualify for emotional ownership.

- id: x-revenge-01
- tags: revenge,chaos
- text: Red candle posted disrespect. Wallet replied instantly.

- id: x-meta-01
- tags: meta,timeline
- text: Traded like a full-time timeline anthropologist.

- id: x-hopium-01
- tags: maximum-hopium,viral
- text: Hope was up only.

- id: x-conviction-01
- tags: conviction,cinema
- text: Conviction level: no stop-loss, only plot.

- id: x-goblin-01
- tags: night,goblin
- text: Goblin hour had admin rights again.

- id: x-attention-01
- tags: attention,viral
- text: Charts showed what happened. Attention showed what was next.

- id: x-discipline-01
- tags: discipline,consistency
- text: Fewer trades, better judgment, less emotional tax.

- id: x-newpairs-01
- tags: new-pairs,risk
- text: New pairs are where excitement is high and edge is usually low.

- id: x-notrade-01
- tags: no-trade,discipline
- text: Doing nothing was the alpha trade in that phase.

- id: x-wallet-context-01
- tags: culture,meta
- text: Wallets were context, not commandments.
