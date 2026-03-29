# HashCinema Video Prompt Generation Bank (Google Veo with Sound)

## Purpose

This file is the cinematic prompt bank for HashCinema.

It is designed to support full-video generation with Google Veo with sound.

It should be used by the prompt-building agent after wallet analytics are already computed.

This file does not decide facts.
It decides cinematic interpretation.

Facts come from:
- normalized trades (Pump.fun only, last 24/48/72h)
- wallet personality
- modifiers
- villain arc moment
- main character moment
- trench lore moment
- absolute cinema moment
- story beats
- token asset map from Pump.fun metadata images

This bank helps translate those facts into:
- visual metaphor
- scene structure
- camera language
- sound language
- pacing
- emotional coherence
- symbolic continuity

The result should feel like:

A short film trailer about someone's recent memecoin trading behavior in the trenches.

Not a dashboard.
Not a chart recap.
Cinema.

---

## Global Rules

### Hard Rules (never break)

1. Never invent wallet facts.
2. Never invent token names, timestamps, PnL, or trade counts.
3. Never make the film feel like analytics software.
4. Charts may appear only as environmental texture, not the main subject.
5. Always include a trader protagonist or symbolic trader presence.
6. Use Pump.fun token metadata images when they matter emotionally or narratively.
7. Use symbolism more than literal explanation.
8. Sound is mandatory in every scene.
9. Favor clarity over overstuffed prompt wording.
10. Every video must feel like one coherent short film.

### Soft Rules (preferred)

- ironic but not detached
- memecoin-native
- emotionally observant
- internet-literate
- dramatic
- slightly absurd
- screenshot-worthy
- trailer-like

### Forbidden Language (anti-dashboard)

Avoid phrases like:
- "wallet metrics indicate"
- "based on score"
- "volatility index"
- "behavior score"
- "win rate"
- "profit factor"
- "ROI"

If the upstream facts imply those realities, translate them into story physics:
- posture, breath, pacing, camera instability, environment pressure, sound density

---

## Core Generation Model (do not skip steps)

wallet facts
-> emotional signals
-> narrative archetype
-> character arc
-> three-act structure
-> scene entropy
-> visual metaphor
-> token image plan
-> continuous Veo scene prompt (WITH SOUND)

---

## Film Grammar (non-negotiable)

### Three Acts

Act 1 - Entry Into The Trenches
- curiosity, temptation, discovery, first vow

Act 2 - Conflict / Character Arc
- pressure, escalation, damage, absurdity, villain/jester turn, war

Act 3 - Resolution
- comeback or collapse, acceptance, exhaustion, hollow victory, eerie calm

### Scene Count

HashCinema micro-films should land in 6-10 scenes.

- 24h: 6 scenes (tight trailer cut)
- 48h: 8 scenes (full trailer structure)
- 72h: 10 scenes (denser act 2)

### Continuity

Every scene must keep continuity across:
- the protagonist presence (direct or symbolic)
- recurring visual motifs (palette, props, environment echoes)
- recurring sound motifs (a sonic "theme" that evolves)
- token image anchors (used sparingly, but recurring when relevant)

---

## Emotional Signal Model (exactly five)

These signals shape the film. They should influence pacing, symbolism, and sensation.

### confidence
How strongly the trader believes they are right.

High confidence visual language:
- upright posture
- forward movement
- elevated framing (low-angle, hero framing)
- strong green or gold light
- stable camera moves (dolly, crane, clean tracking)

Low confidence visual language:
- hesitation
- screen-glow in a darker room
- fragmented reflections
- downward gaze
- slower movement, pauses, micro-flinches

### chaos
How unstable and frantic the session feels.

High chaos visual language:
- storms, rain, wind
- flickering light
- rapid camera motion and whip pans
- glitch textures, strobe pressure
- crowded or unstable environments

Low chaos visual language:
- still air
- clean framing
- quiet room tone
- controlled camera
- minimal motion

### desperation
How emotionally urgent actions become.

High desperation visual language:
- rematch imagery (boxing ring, bell, "one more round")
- leaning in, close-up on hands
- frantic hand movement, clenched jaw
- late-night fatigue
- claustrophobic framing
- heartbeat bass

Low desperation visual language:
- detached observation
- distance and wide shots
- patience
- calmer sound design
- breathing room between beats

### discipline
How controlled and intentional the trader behaves.

High discipline visual language:
- measured movement
- clean compositions
- restrained motion
- cool lighting, crisp edges
- deliberate action (ritual, chess, metronome)

Low discipline visual language:
- messy space
- overactive camera
- flashing color
- impulsive gestures
- frantic pacing

### luck
How much the outcome feels improbably favorable or weird.

High luck visual language:
- lightning strike
- surreal coincidence
- impossible save
- divine timing
- sudden change in light
- "the market laughs and it somehow works"

Low luck visual language:
- delayed relief
- flat aftermath
- empty rooms
- fading screens
- hollow wins

---

## Narrative Archetypes (tone + pacing lenses)

Archetypes shape the world and the cinematic "language." They do not override facts.

For each archetype: treat the world like a genre.

### The Gambler
Core feel: risk, temptation, casino gravity, emotional overexposure
- Environments: casino-cathedral, roulette corridors, velvet shadows, neon pit
- Camera: snap-zooms on choices, ringside handheld, table-level push-ins
- Sound: chips, crowd murmur, heartbeat bass, slot chimes warping into static

### The Prophet
Core feel: eerie early conviction, seeing the move before everyone else
- Environments: radar room, watchtower, horizon screens, constellations of chart-light
- Camera: long lens restraint, slow zooms, measured tracking, omen inserts
- Sound: slow pulse, radar sweep, restrained synth, distant thunder

### The Survivor
Core feel: damage happened, but the trader remains
- Environments: dawn streets, storm aftermath, rubble-lit alleys, breathing fog
- Camera: steady forward motion, low-angle endurance shots, calm re-centering
- Sound: wind, boots on wet pavement, sirens far away, orchestral lift held back

### The Martyr
Core feel: holding through pain, refusing retreat, stoic suffering
- Environments: empty casino sunrise, battlefield sunset, shrine rooms
- Camera: lingering close-ups, long takes, slow creep, heavy silence
- Sound: room tone, low cello grief, distant hum, soft rain

### The Trickster
Core feel: strange reversals, absurd success, surreal chaos
- Environments: mirror corridors, glitch doors, funhouse markets
- Camera: dutch angles, surprise reveals, spinning moves, comedic whip pans
- Sound: reversed chimes, broken calliope, glitch percussion, laughter echo

### The Pilgrim
Core feel: searching, uncertain, moving through signs and temptations
- Environments: stations, long corridors, desert neon mirages, alley wayfinding
- Camera: wide lonely frames, slow pans, quiet forward tracking
- Sound: distant trains, wind, soft footsteps, morning ambience

### The Believer
Core feel: sincere conviction, attachment to story, emotional faith
- Environments: shrines made of posters, candle rooms, devotional neon icons
- Camera: ritual close-ups, icon framing, reverent pushes
- Sound: hush, subtle bells, hymn-like pads, tension under faith

### The Chaser
Core feel: the move is leaving and the trader is sprinting after it
- Environments: departing trains, closing gates, elevators, neon chase alleys
- Camera: running tracking, motion blur, whip pans, breath-in-mic immediacy
- Sound: train screech, urgent synth, siren-like market tension, fast hats

### The Alchemist
Core feel: making something from chaos, surprising recombination
- Environments: labs, vials, reaction chambers, spell-circles of screens
- Camera: macro inserts, controlled moves, then instability as reaction heats
- Sound: glass clinks, machine hum, rising charge, controlled orchestral swell

### The Ghost
Core feel: quiet, eerie, detached, absent but still watching
- Environments: empty trading floor, blue haze, dim monitors, reflections
- Camera: slow drift, locked wide shots, minimal movement, negative space
- Sound: AC hum, distant rain, soft buzz, silence that feels loud

---

## Character Arc Library (dominant drama)

Use one dominant arc per video. It dictates act emphasis and ending flavor.

### Hero Arc
The trader suffers, adapts, and earns a meaningful rise.
- Use when: comeback exists; discipline/timing improves; tension resolves cleanly
- Ending flavor: earned clarity, controlled triumph, sunrise relief

### Villain Arc
The trader's worst instincts take the wheel.
- Use when: revenge dominates; greed escalates; damage is self-authored; warning signs ignored
- Ending flavor: seductive downfall, collapse spectacle, quiet ruin after heat

### Jester Arc
Absurd, surreal, darkly funny chaos with danger under it.
- Use when: logic collapses; weird luck appears; trench lore dominates; irrationality is entertaining
- Ending flavor: punchline lands, then a quiet stare at sunrise

### Martyr Arc
Holding through unbearable pain.
- Use when: bagholding is core; exits resisted; pain tolerance is the story
- Ending flavor: devotion, denial, funeral glow, shrine aftermath

### Survivor Arc
Escape and stabilization after damage, without full triumph.
- Use when: it gets ugly; the win is survival; the ending breathes
- Ending flavor: weary persistence, storm clears, still standing

### Prophet Arc
Sees the narrative early and moves before the crowd.
- Use when: early entry dominates; confidence is justified; timing feels uncanny
- Ending flavor: omen resolves, eerie satisfaction or eerie cost

### Trickster Arc
Strange pivots and reversals; the story feels like a prank by fate.
- Use when: outcomes are bizarre; "had to be there" sequences; trench lore outweighs logic
- Ending flavor: doors that were traps become exits, or exits become traps

### Fallen Hero Arc
Starts strong, overconfident, deteriorates.
- Use when: early success leads to overextension; strong opening then villain turn/collapse
- Ending flavor: gold to rust, cheer to static

### Pilgrim Arc
Wanders through signs, temptations, uncertainty.
- Use when: mixed behavior; searching; re-entering; sincerity without stability
- Ending flavor: arrival without certainty, tired hope

### Ghost Arc
Quiet movement; presence implied; aftermath matters more than spectacle.
- Use when: low action but strong implication; detachment; quiet tension
- Ending flavor: blue hush, vanished exit

---

## Scene Entropy Rules (visual + sound pressure)

Entropy is the control knob for intensity.

### Low entropy
- Camera: slow push-ins, stable frame, gentle pans
- Space: clean, still air, minimal motion
- Sound: quiet room tone, sparse textures, restrained bass
- Best for: opening, quiet conviction, aftermath, ghost/prophet/pilgrim beats

### Medium entropy
- Camera: measured tracking, readable handheld glide
- Space: environmental movement, moderate flicker
- Sound: stronger pulse, tension bed, transitions that land
- Best for: discovery, momentum, turning points, hero/survivor/believer beats

### High entropy
- Camera: aggressive handheld, orbiting, snap-zooms, whip pans
- Space: storms, strobe, neon overload, collisions, unstable architecture
- Sound: dense pressure, thunder, sirens, impact hits, glitch
- Best for: villain turns, revenge spirals, jester chaos, absolute cinema payoff

---

## Camera Language Bank (use cinematic grammar)

### Shot types (pick 1 per scene as the anchor)
- wide establishing shot (world first)
- medium over-the-shoulder (protagonist + screen glow)
- close-up on eyes (emotion legibility)
- close-up on hands (ritual and compulsion)
- low-angle hero framing (confidence and myth)
- high-angle isolation framing (smallness, shame, doubt)
- long lens compression (pressure, inevitability)
- macro insert (talisman, poster fragment, coin spin)

### Camera movement (entropy-driven)

Low entropy moves:
- slow dolly push-in
- gentle pan across the room
- static frame with subtle drift
- crane rise used sparingly (act 3 clarity)

Medium entropy moves:
- tracking follow behind protagonist
- handheld glide (stable but alive)
- dolly zoom into tension
- orbit that stays readable

High entropy moves:
- aggressive handheld (still coherent)
- orbiting camera around protagonist
- whip pan between omens and consequences
- snap-zoom on the decision point

### Editing language (implied, not a command list)

Avoid explicit edit commands like "cut to" as the primary writing style.
Instead, imply trailer pacing through:
- short declarative sentences when intensity is high
- longer sentences when entropy is low
- repeated motifs as "callbacks"

---

## Sound Design Bank (mandatory per scene)

Every scene must include sound cues. Treat sound as character psychology.

### Core sound categories (mix 3-6 per scene)
- rain on glass
- keyboard clicks
- heartbeat bass
- distant thunder
- casino crowd murmur
- glitch synth tension
- orchestral rise
- hollow room tone
- electric hum
- siren-like market tension
- morning ambience
- ventilation/AC hum
- train rumble / platform PA
- slot machine chimes (warped)
- metallic stress / bridge groan
- muffled laughter / echo reverb

### Act sound shapes

Act 1:
- quieter, curiosity, room tone + rain + clicks

Act 2:
- pressure builds, bass thickens, glitch and impact enter

Act 3:
- release or hollowing; morning ambience, distant city, quiet verdict tones

### Sound continuity trick

Pick 1 recurring micro-motif and mutate it:
- a metronome tick becomes a train clack becomes a heartbeat bass
- rain becomes static becomes ash settling
- keyboard clicks become chip clacks become impact hits

---

## Pump Token Metadata Image Integration Bank (in-world, not UI)

### Core rule
Token images are cinematic anchors. They must appear in-world:
- posters
- billboards
- holograms
- shrine icons
- reflections
- mascots on signage
- wanted posters
- fractured screens

Never present them as a UI "gallery" unless explicitly stylized as part of the world.

### When to feature token images
Feature token images when the token is:
- tied to the villain arc moment
- tied to the main character moment
- tied to trench lore
- tied to absolute cinema
- emotionally dominant in the window

### Frequency
- Prefer 2-4 featured mints total.
- Do not overload every scene.
- Recurrence beats variety: repeat the primary anchor across the film if it matters.

### Cinematic treatments (pick one per usage)
- "flickering billboard above the alley"
- "hologram reflection in rain on glass"
- "sticker shrine on the trading desk"
- "wanted poster under red strobe"
- "arcade marquee mascot sign"
- "skyline-wide projection for the climax"

### Token image line format (recommended)
"Token image integration: {SYMBOL} appears as {PLACEMENT} (image={URL})."

This keeps the prompt deterministic and avoids inventing descriptions for the image itself.

---

## Visual Metaphor Library (expanded building blocks)

Use one dominant metaphor per scene. Metaphors are not facts; they are the world's language.

Each entry below is a compact prompt kit:
- Behavior tags
- Environment
- Objects
- Lighting / palette
- Motion style
- Sound style
- Prompt hint phrases

### revenge_trading_boxing_ring
- Tags: revenge, rematch, villain_turn, impact
- Environment: boxing ring under harsh light inside a neon casino
- Objects: gloves, ropes like chart lines, bell like a fill, red sparks
- Lighting: white overhead + deep red accents
- Motion: ringside handheld, snap-zooms, impact cuts
- Sound: crowd murmur, impact thuds, heartbeat bass
- Hints: "one more round", "the bell demands it"

### diamond_hands_warrior
- Tags: holding, martyr, hero, pressure
- Environment: battlefield at sunset
- Objects: shield etched with a memecoin sigil, embers, banners of torn posters
- Lighting: gold rim light, dust shafts
- Motion: steady dolly, low-angle hero push-in
- Sound: wind, distant war drums, restrained orchestral lift
- Hints: "holding is a stance"

### fomo_train_departure
- Tags: fomo, chase, momentum
- Environment: rain station, departure board flickering with token symbols
- Objects: closing doors, stamped ticket, wet footsteps
- Lighting: neon reflections on wet concrete
- Motion: running tracking, whip pans
- Sound: train horn, sprint breaths, siren tension
- Hints: "doors almost close"

### bagholding_empty_casino
- Tags: bagholding, martyr, aftermath, denial
- Environment: abandoned casino at sunrise
- Objects: dead roulette wheel, peeling posters, silent slots
- Lighting: cold sunrise + dying neon corners
- Motion: slow creeping steadicam, long takes
- Sound: hollow room tone, ventilation hum, faint chimes glitching out
- Hints: "the house is quiet now"

### breakout_rocket_launch
- Tags: comeback, climax, hero
- Environment: rocket launch pad on a cyberpunk skyline
- Objects: countdown tower of screens, rocket branded like a poster
- Lighting: ignition flare, green-blue rim, smoke illumination
- Motion: crane rise, tracking reveal, slow-motion ignition moment
- Sound: engine roar, orchestral hit, pressure release
- Hints: "the skyline lights up"

### late_night_neon_city
- Tags: goblin_hour, neon, trench
- Environment: 3AM cyberpunk city, rain and reflections
- Objects: billboards, wet street glass, flickering monitors
- Lighting: cyan/magenta with chart-green pulses
- Motion: slow tracking, occasional whip to signage
- Sound: rain, distant traffic, synth tension bed
- Hints: "the city watches"

### collapse_storm_bridge
- Tags: collapse, failure, damage
- Environment: bridge failing under lightning storm
- Objects: snapping signage, falling panels, red lightning
- Lighting: storm blue + violent red flashes
- Motion: aggressive handheld, falling perspective
- Sound: thunder, metal stress, wind
- Hints: "the path breaks"

### comeback_sunrise_battlefield
- Tags: survivor, hero, recovery
- Environment: battlefield at dawn
- Objects: dust settling, lone figure, horizon glow
- Lighting: warm sunrise breaking cold blue
- Motion: steady forward walk, calm re-centering
- Sound: wind, breath, soft orchestral lift
- Hints: "still standing"

### jester_funhouse_market
- Tags: jester, absurd, surreal
- Environment: neon funhouse market, distorted architecture
- Objects: warped slot machines, mirror candlesticks, prize wheels
- Lighting: acid neon, rotating reflections
- Motion: spinning reveals, comedic whip pans
- Sound: warped carnival, glitch percussion, laugh echoes
- Hints: "the market is a prank"

### ghost_empty_trading_floor
- Tags: ghost, quiet, aftermath
- Environment: empty trading floor, blue haze, dim monitors
- Objects: rolling chair, fogged glass, dead screens
- Lighting: cold blue, pale white
- Motion: slow drift, locked wide frames
- Sound: AC hum, distant buzz, room tone
- Hints: "presence without confession"

### prophet_radar_room
- Tags: prophet, omen, early
- Environment: radar room / watchtower of screens
- Objects: sweeping signal rings, glowing map lines
- Lighting: cool blue with signal green
- Motion: slow zoom, restrained tracking
- Sound: radar sweep, low pulse
- Hints: "the signal appears first"

### believer_shrine_of_memes
- Tags: believer, conviction, shrine
- Environment: shrine built from posters and monitors
- Objects: candles, offerings, iconography
- Lighting: warm candle glow + screen green
- Motion: reverent push-in, icon framing
- Sound: hush, subtle bells, tension pad
- Hints: "faith becomes a room"

### trickster_mirror_corridor
- Tags: trickster, reversal, pivot
- Environment: mirror corridor, shifting hallways
- Objects: fractured reflections, token posters on glass
- Lighting: split green/red, surreal flicker
- Motion: dutch angle drift, sudden perspective flips
- Sound: reversed chimes, unstable ambience
- Hints: "every door lies"

### fallen_hero_trophy_melts
- Tags: fallen_hero, decay, collapse
- Environment: hero stage where success rots
- Objects: trophy softening, confetti turning to ash
- Lighting: gold turning to red
- Motion: slow push then snap into chaos
- Sound: crowd cheer fading into static
- Hints: "gold to static"

### pilgrim_neon_alley_search
- Tags: pilgrim, search, uncertain
- Environment: wet neon alley with hidden doors
- Objects: faint symbols, posters, path markers
- Lighting: dim blue/purple with selective green highlights
- Motion: wide lonely tracking, slow pans
- Sound: rain drip, distant city hum
- Hints: "the sign keeps moving"

### alchemist_lab_of_charts
- Tags: alchemist, experiment, transformation
- Environment: futuristic lab, screens like spell circles
- Objects: vials, reaction chamber, green ignition
- Lighting: cold white with emerald bursts
- Motion: macro inserts, controlled movement, then shake
- Sound: glass clink, machine hum, rising charge
- Hints: "the reaction goes unstable"

### Additional metaphor kits (grab bag)

Use these when you want variety without losing trench continuity:

- "throne_of_broken_screens": villain triumph made of shattered monitors, crown of static, impact bass.
- "altar_of_hopium": martyr/believer shrine, candle smoke, posters as saints, low choir pad.
- "subway_tunnel_reentry": revenge re-entry, tunnel strobe, relentless forward motion, train rumble bass.
- "liquidity_desert_mirage": pilgrim uncertainty, mirage billboards, wind, distant hum.
- "arcade_token_marquee": jester/trickster lore, arcade street, neon mascots, glitch calliope.
- "stormglass_control_room": survivor stabilization, storm windows, radio headset, quiet sirens.
- "elevator_freefall_candle": sudden dump, falling elevator, red strobe, metal groan.
- "coin_spin_oracle": luck, coin spinning forever, reflected token icon, whispering synth.
- "rooftop_siren_chase": chaser energy, rooftops, rain, siren tension, breath in mic.
- "library_of_receipts": trench lore, walls of posters, receipts as prophecy scrolls, paper rustle + hum.

---

## Scene Recipe Cards (arc-first structures)

These are templates. Pick one and adapt to the real StoryState.

### Hero Arc (8 scenes)
1. opening - trench entry, first temptation
2. discovery - omen appears
3. damage - first wound
4. escalation - pressure rises
5. comeback - breath and pivot
6. main_character - mythic presence
7. absolute_cinema - set-piece payoff
8. aftermath - sunrise clarity

### Villain Arc (8 scenes)
1. opening - trench entry, house glow
2. temptation - chase framed as salvation
3. first_conviction - vow becomes obsession seed
4. escalation - world strobes
5. villain_turn - rematch bell rings
6. collapse - bridge breaks / screens shatter
7. absolute_cinema - spectacle of consequence
8. aftermath - quiet ruin

### Jester Arc (8 scenes)
1. opening - odd entry
2. discovery - weird sign
3. momentum - absurd acceleration
4. damage - slapstick pain with teeth
5. jester_turn - punchline becomes danger
6. escalation - funhouse pressure
7. trench_lore - posters and mascots keep receipts
8. aftermath - sunrise: a stare that says "what just happened"

### Martyr Arc (8 scenes)
1. opening - quiet vow
2. first_conviction - shrine moment
3. discovery - sign interpreted as destiny
4. damage - pain arrives
5. trench_lore - the city watches
6. main_character - stoic under spotlight
7. absolute_cinema - symbolic funeral glow
8. aftermath - empty casino dawn

### Fallen Hero Arc (8 scenes)
1. opening - gold entrance
2. discovery - early signal
3. momentum - confident run
4. escalation - overreach begins
5. damage - first crack
6. villain_turn - ego takes wheel
7. collapse - static takes the stage
8. aftermath - dawn with no applause

---

## Scene Writing Template (Veo-ready)

Use this structure per scene. Keep it readable.

Scene X:
- shot framing
- camera movement
- environment
- trader protagonist action
- dominant visual metaphor
- token image integration (if relevant)
- lighting
- color palette
- atmospheric effects
- sound design cues

Example (style, not facts):
Wide establishing shot of a rain-soaked neon alley. Slow dolly push-in toward a desk in the window. The trader sits in silhouette, face lit by screen glow. Token image integration: {SYMBOL} appears as a flickering billboard above the alley (image={URL}). Lighting: cold blue with chart-green pulses. Atmosphere: rain on glass, thin fog, subtle glitch flicker. Sound design: rain on glass, keyboard clicks, low synth tension.

---

## Quality Checklist (final pass)

- One coherent film, not scenes pasted together.
- No invented tokens, no invented trades, no invented numbers.
- No analytics narration language.
- Every scene includes sound cues.
- Token images are in-world, used sparingly, with continuity.
- Entropy escalates and resolves with the arc.
- Metaphors are varied, but not random.
- The protagonist is always present or strongly implied.

---

## Lighting and Color Bank (pick a canon and evolve it)

### Palette canons (global)

Pick 1-2 and keep them consistent:
- "neon teal + chart green + ink black" (default trench)
- "casino gold + warning red + velvet black" (gambler/villain)
- "signal green + cold blue + white glare" (prophet/alchemist)
- "washed gold + pale morning blue + dust gray" (martyr/aftermath)
- "electric blue + carnival pink + acid green" (jester/trickster)

### Lighting recipes (scene-level)

Low entropy:
- screen glow + soft edge light
- candle + monitor mix (believer/martyr)
- dawn window light + dying neon

Medium entropy:
- hard rim light + wet reflections
- moving signage light (billboards "breathing")
- controlled strobe (rare, readable)

High entropy:
- red/green strobe + smoke shafts
- lightning flashes + neon overload
- harsh top light + rapid flicker

### Color progression (act-level)

Act 1:
- cooler tones, curiosity, teal/blue, clean highlights

Act 2:
- saturation increases, red/green tension, harder contrast

Act 3:
- desaturate toward sunrise, washed gold, pale blue, quiet verdict

---

## Environment Bank (memecoin-native worlds)

Act 1 environments:
- dim apartment overlooking neon city rain
- radar room / watchtower of screens
- quiet alley with poster walls and distant hum
- station platform with departure boards (but calm, not sprint yet)

Act 2 environments:
- casino-cathedral floor, velvet smoke, crowd murmur
- boxing ring inside neon casino
- storm bridge / collapsing walkway
- funhouse market with warped architecture
- underground tunnel with strobing lights and relentless forward pull

Act 3 environments:
- empty casino at sunrise (neon dying)
- rooftop dawn haze, quiet city after storm
- battlefield sunrise, dust settling, lone figure
- empty trading floor with blue hush and fading screen glow

---

## Occasion Inspiration Bank (gift / celebration briefs)

### awareness_avenue_bestselling_gifts
Source: https://www.awareness-avenue.com/collections/shop_bestselling_gifts
Use this as an occasions reference for birthdays, anniversaries, holidays, thank-you gifts, milestone moments, and other celebratory briefs.
Tone: warm, giftable, occasion-first, and easy to personalize.
Visuals: wrapped presents, handwritten tags, confetti, keepsake moments, glowing shelves, and celebration-card imagery.

---

## Sound Phrase Bank (ready-to-use cues)

Use these as literal sound cue tokens. Mix 3-6 per scene.

Room / ambience:
- "hollow room tone"
- "ventilation hum"
- "electric hum"
- "distant city ambience"
- "morning ambience"

Weather / pressure:
- "rain on glass"
- "distant thunder"
- "wind through concrete"
- "metal stress groan"

Trading / ritual:
- "keyboard clicks"
- "mouse scroll ticks"
- "notification ping drowned in reverb" (use sparingly)

Casino / crowd:
- "casino crowd murmur"
- "chip clacks"
- "slot machine chimes warping into static"

Music beds:
- "glitch synth tension"
- "heartbeat bass"
- "orchestral rise"
- "low cello grief"
- "choir pad haze"

Transitions (sound bridges between scenes):
- "rain becomes static"
- "metronome becomes train clack"
- "chip clacks become impact hits"
- "cheer fades into static"

---

## Token Image Integration Patterns (expanded)

### Continuity patterns

Pick one and repeat it:
- "Primary token is the city's billboard logo"
- "Primary token is a desk talisman close-up that returns at the climax"
- "Primary token appears as a wanted poster under red strobe during the villain turn"
- "Primary token becomes a skyline projection only at absolute cinema"

### Placement patterns by scene type (quick bank)

opening:
- sticker shrine on desk
- hologram reflection in rain on glass

discovery:
- billboard flicker triggers the omen
- token icon hidden in a reflection

temptation:
- casino marquee mascot sign
- departure board icon replacing the clock

villain_turn:
- torn boxing banner with token crest
- wanted poster in red light

jester_turn:
- funhouse prize wheel with token face
- warped mirror mascot reflection

damage/collapse:
- poster shredding in wind
- billboard shorting out into static

comeback:
- poster re-lit at dawn
- rocket decal ignites with the skyline

trench_lore:
- wall of posters and graffiti stencils
- hologram ad in alley fog

absolute_cinema:
- skyline-wide projection
- colossal hologram hovering over the set piece

aftermath:
- peeling poster in an empty room
- faint reflection on a dead monitor

### Image safety rule

If you do not have a URL, do not describe specific image content.
Use "token iconography" language and keep it abstract.

---

## Expanded Metaphor Kits (more variety)

Use these to avoid repetition across wallets while staying memecoin-native.

### throne_of_broken_screens
- Tags: villain, ego, climax, collapse
- Environment: a throne room built from shattered monitors and cables
- Objects: crown of static, cracked phone screens, broken tickers as stained glass
- Lighting: red strobe + sickly green underlight
- Motion: orbiting camera, snap-zooms on the crown
- Sound: impact hits, glitch bass, distant crowd dissolving
- Hints: "the throne hums", "static applause"

### altar_of_hopium
- Tags: martyr, believer, first_conviction, aftermath
- Environment: altar of posters, candles, and sticky-note prophecies
- Objects: token poster fragments, wax drips on keyboard, coin talisman
- Lighting: candle gold + monitor green
- Motion: reverent push-in, macro inserts on wax and paper
- Sound: hush, soft bells, low choir pad
- Hints: "a vow room", "faith under fluorescent ruin"

### elevator_freefall_candle
- Tags: damage, collapse, panic
- Environment: a glass elevator dropping through a neon shaft
- Objects: red warning signs, flickering floor numbers, reflection of the protagonist
- Lighting: harsh white flashes + red strobes
- Motion: falling POV, shaky handheld
- Sound: metal groan, siren tension, bass drop
- Hints: "the floor disappears"

### coin_spin_oracle
- Tags: luck, prophet, omen
- Environment: a coin spinning on a desk that feels like an altar
- Objects: spinning coin, reflection of token icon, dust in screen light
- Lighting: tight spotlight + cold screen glow
- Motion: macro insert, slow orbit, time dilates
- Sound: high ping, low hum, restrained pulse
- Hints: "the coin refuses to fall"

### library_of_receipts
- Tags: trench_lore, memory, witnesses
- Environment: an alley library where walls are covered in posters and receipts
- Objects: paper scraps, sticker maps, graffiti arrows
- Lighting: warm tungsten pockets + neon bleed
- Motion: slow pan across the wall, then find the protagonist in silhouette
- Sound: paper rustle, distant city, low tension bed
- Hints: "the city keeps receipts"

### siren_rooftop_sprint
- Tags: chaser, momentum, temptation
- Environment: rooftop chase over wet neon signs
- Objects: red exit sign, billboard reflections
- Lighting: rain reflections, saturated signage, rim light
- Motion: high-speed tracking, slow-motion leap, whip pans
- Sound: rain on metal, fast hats, siren-like market tension
- Hints: "doors closing"

### aquarium_of_liquidity
- Tags: ghost, pilgrim, uncertainty
- Environment: a glass corridor like an aquarium; symbols drift like fish
- Objects: floating token icons, bubbles, a lone silhouette
- Lighting: cold blue, soft refractions
- Motion: slow drift, locked wide shots
- Sound: underwater hush, distant hum
- Hints: "watching without touching"

### forge_of_conviction
- Tags: hero, discipline, resolve
- Environment: a neon forge where chart lines become metal
- Objects: hammer, glowing blade, sparks
- Lighting: hot orange sparks + green underglow
- Motion: steady dolly, deliberate framing
- Sound: metal ring, restrained drums
- Hints: "craft over panic"

---

## Continuous Veo Prompt Skeleton (copy/paste pattern)

Use this as the outer wrapper for Veo. Keep one prompt for the whole film.

Title: {SHORT_TITLE}
Tagline: {ONE_LINE_TAGLINE}

Guardrails:
- Generate one continuous short film for Google Veo WITH SOUND.
- Cinema, not analytics. No numbers, no PnL captions, no dashboard UI as the subject.
- Facts-first: do not invent trades, tokens, or events.
- Token images must appear in-world (posters, billboards, holograms, shrines, reflections).

Scene 1: (opening, Act 1, {DURATION}s, entropy={low/medium/high})
{SHOT}. Camera movement: {MOVE}.
Environment: {WORLD}.
Trader protagonist: {PROTAGONIST}. Action: {ACTION}.
Visual metaphor: {METAPHOR_ID}.
Token image integration: {SYMBOL} appears as {PLACEMENT} (image={URL}).
Lighting: {LIGHTING}.
Color palette: {PALETTE}.
Atmosphere: {ATMOSPHERE}.
Sound design: {SOUND_CUES}.

Scene 2:
(repeat...)

Scene N:
(repeat...)
