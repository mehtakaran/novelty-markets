# Novelty Markets AI Assistant

This is a small demo app for a sports betting company's trading desk. It helps a trader
spot fun, offbeat betting markets (things like "Will this movie win an award?" or "Will
this politician survive a confidence vote?") before anyone else does.

Right now, a trader does this by hand: reading the news, checking social media, and using
their own judgment. That takes a long time and depends a lot on one person's gut feeling.
This app speeds that up. It reads through some news and social posts, picks out the ones
worth turning into a betting market, checks each one against the company's rules, suggests
a starting price, and then hands everything to a human trader for a final yes or no.
Nothing ever goes live without a person approving it.

Everything you'll see here uses made-up, fictional data: fake news stories, fake social
posts, fake prices. It's a prototype, not a real product.

## What it actually does

Here's the whole journey, in order:

1. **Find stories.** The app looks through three made-up feeds (news, social media, and
   trending betting markets) and picks up anything interesting.
2. **Shortlist with AI.** An AI model (Claude) reads through everything and picks out the
   handful of stories that could actually become a good betting market. These are stories
   with broad interest and a clear date when we'd know the answer.
3. **Check the rules.** Every shortlisted story is checked against the company's policies.
   Some checks are simple and automatic and need no AI at all. For example, anything about
   war, tragedy, or religion is always blocked. Anything trickier is sent to the AI for a
   second opinion, but the AI can only *recommend*. It never gets the final say.
4. **Suggest a price.** If a similar market already exists, the app just copies its price.
   If not, the AI makes a rough guess based on how much buzz the story is getting, and that
   guess is always clearly labeled as a guess.
5. **Ask a human.** Every single story shows up in a review list for a trader to look at,
   even the ones that got blocked or flagged. The trader can approve it, reject it, or
   approve it anyway with a reason if it was flagged. Nothing goes live without this step.
6. **Watch the competition.** Once a market is live, the app checks it once an hour against
   a made-up competitor price, and flags it if the two prices drift more than 10% apart.

Every single thing the app does gets written down in an audit log: every check, every AI
answer, every trader decision. Nothing happens quietly in the background.

There's also a diagram of this whole flow at [`docs/workflow-diagram.drawio`](docs/workflow-diagram.drawio). Open it at [draw.io](https://app.diagrams.net) if you want a picture instead of words.

## The guardrails around the AI

The AI is genuinely useful here, but it's never trusted blindly. A few rules keep it in
check:

- **Hard rules always run first, and the AI can't overrule them.** War, tragedy, religion,
  excluded jurisdictions, and missing a verifiable resolution date are checked by plain code,
  not the AI, before the AI ever sees the story. If one of those rules blocks something,
  that's final.
- **The AI's compliance opinion can only add caution, never remove it.** If a deterministic
  check already flagged a story as suspicious (see the next point), the AI's own judgment
  gets added to that flag. It can never quietly downgrade it back to a pass.
- **A prompt injection check runs before anything reaches the AI at all.** News and social
  posts come from the open internet, not from the trader, so they're treated as data to
  read, never as instructions to follow. A plain pattern match scans for phrases like
  "ignore previous instructions" before that text is ever sent to the model, and every
  prompt tells the model the same thing directly.
- **Every AI answer is checked against a strict shape before anything trusts it.** A missing
  field, a price out of range, or a broken response is treated as a failure and logged as
  one, not quietly patched up to look fine.
- **An AI failure is never treated as a quiet pass.** If the compliance check fails to run,
  the story gets flagged for a human to look at, not waved through. If the price estimate
  fails, it falls back to a clearly labeled placeholder, not a confident-looking number.
- **AI-estimated prices always look different from sourced ones.** A different badge color
  and an explicit "this is a guess" label, so a trader can never mistake a soft guess for a
  real market price.
- **The AI's compliance judgment is a recommendation, full stop.** It never publishes
  anything by itself. A trader's explicit decision is required no matter what any AI call
  concluded.

## Why this app uses Temporal

Step 5 above (asking a human) is the tricky part. A trader might approve a market in ten
seconds, or they might not look at it for two days. The app has to sit there and wait,
however long that takes, and pick up exactly where it left off the moment a decision comes
in. If you only used a normal database for this, and the app happened to restart while it
was waiting (a deploy, a crash, anything), it would have no memory of what it was in the
middle of doing.

[Temporal](https://temporal.io) is a tool built to solve exactly that problem. Each
candidate market becomes its own small, trackable process. Temporal remembers exactly where
that process is (running its checks, or paused waiting on a trader) even if the app itself
restarts, so nothing gets lost or half-finished. It also runs the two schedules mentioned
above (the twice-daily search and the hourly price check) as real, recurring jobs, not just
buttons that only work while someone remembers to click them.

The tradeoff is that it adds a moving part: Temporal needs its own small database (which is
why Docker is in the requirements below). For a one-person demo, that's more machinery than
strictly necessary. It's here because it's a genuinely good fit for "wait an unknown amount
of time for a human, then resume exactly where you left off," and because it makes that
waiting state fully visible instead of hidden inside application memory.

## Before you start

You'll need three things installed on your computer:

- **Node.js**, version 22 or newer
- **Docker Desktop**, and it needs to be running
- **An Anthropic API key** for the Claude AI calls. Get one at [console.anthropic.com](https://console.anthropic.com)

## Setting it up

Open a terminal in this folder and run:

```bash
npm install
cp .env.local.example .env.local
```

Then open the new `.env.local` file and paste in your Anthropic API key:

```
ANTHROPIC_API_KEY=your-key-here
```

That's it. Setup is done.

## Starting the app

One command starts everything:

```bash
npm run dev
```

This single command quietly starts a few things at once: a small database system called
Temporal (it runs in Docker and keeps track of each market as it moves through the review
process), a background worker that does the actual AI and rule-checking work, and the
website itself. Give it about 10 to 20 seconds the first time, since Docker needs a moment
to warm up.

Once it's ready, open your browser to **[http://localhost:3000](http://localhost:3000)**.
That's the app itself.

You'll land on the **Review Queue**, which is empty at first. Click the **Run Discovery
Sweep** button to kick things off. It'll go find some stories, check them, price them, and
drop them into the list for you to review.

There's also a second, separate page at **[http://localhost:8233](http://localhost:8233)**:
the Temporal Web UI. This is where you can see every candidate's process directly, including
the ones sitting paused and waiting on a trader right now. Click into any one of them to see
its full history: every step it ran, and the exact moment it started waiting.

### Stopping the app

Press `Ctrl+C` in the terminal where it's running.

### Starting fresh

If you want to wipe everything and start from a completely clean slate (no candidates, no
history, nothing):

```bash
npm run reset
npm run dev
```

## Taking a look around

- **Review Queue** (`/`): every story the app has found, with its reasoning, its suggested
  price, and buttons to approve, reject, or override it.
- **Live Markets** (`/monitoring`): every market that's gone live, who approved it, and how
  it compares to a made-up competitor price. Click **Simulate hourly check** to run a
  comparison right now instead of waiting for the hourly schedule. If a market drifts past
  the alert band, an **Accept new price** button shows up so the trader can adopt the new
  price directly.
- **Audit Log** (`/audit`): a running list of everything the app has done, searchable.

If you want to see exactly what's asked of the AI, every prompt lives in one file, written
out in plain text: [`lib/ai/prompts.ts`](lib/ai/prompts.ts).

## Running the checks

There are two ways to check things still work.

**Unit tests.** These check the plain rule-based logic (the compliance rules, the price
lookup, the injection screen, and so on). They run in under two seconds, don't need an API
key, and don't call the AI at all.

```bash
npm test
```

**Evals.** This is a second, separate script that also exercises the real AI calls, so it
needs your API key and costs a little money to run. It checks that the rule-based logic
still passes (same checks as above), and then sends real prompts to Claude to see whether
its answers still look reasonable. Since the AI's answers are judgment calls and not fixed
right-or-wrong facts, a surprising answer here is a soft warning, not a hard failure. This
one's really meant to be run and talked through live, not just used as a pass/fail gate.

```bash
npm run eval
```

## What's real and what's made up

Everything here is fake, on purpose. That includes the news stories, the social posts, the
prices, and the company rules. Nothing is connected to a real news source, a real exchange,
or any real company system. There's also no login system and no support for multiple people
using it at once. It's built to be looked at and clicked through by one person at a time.

## A quick map of the code

```
app/            The website: pages and API routes. No business logic lives here.
lib/
  deterministic/  Plain rules and lookups. No AI involved. *.test.ts files sit next to
                  the code they test.
  ai/             Every place the app talks to Claude. prompts.ts has every prompt.
  db.ts           The database, where everything gets saved.
temporal/       Keeps track of each market's journey and pauses it until a trader decides.
data/fixtures/  All the made-up sample data.
evals/          The AI-judgment test script mentioned above.
```
