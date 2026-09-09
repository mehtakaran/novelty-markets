# Novelty Markets AI Assistant

This is a small demo app for a sports betting company's trading desk. It helps a trader
spot fun, offbeat betting markets — things like "Will this movie win an award?" or "Will
this politician survive a confidence vote?" — before anyone else does.

Right now, a trader does this by hand: reading the news, checking social media, and using
their own judgment. That takes a long time and depends a lot on one person's gut feeling.
This app speeds that up. It reads through some news and social posts, picks out the ones
worth turning into a betting market, checks each one against the company's rules, suggests
a starting price, and then hands everything to a human trader for a final yes or no.
Nothing ever goes live without a person approving it.

Everything you'll see here uses made-up, fictional data — fake news stories, fake social
posts, fake prices. It's a prototype, not a real product.

## What it actually does

Here's the whole journey, in order:

1. **Find stories.** The app looks through three made-up feeds — news, social media, and
   trending betting markets — and picks up anything interesting.
2. **Shortlist with AI.** An AI model (Claude) reads through everything and picks out the
   handful of stories that could actually become a good betting market — something with
   broad interest and a clear date when we'd know the answer.
3. **Check the rules.** Every shortlisted story is checked against the company's policies.
   Some checks are simple and automatic (no AI needed) — for example, anything about war,
   tragedy, or religion is always blocked. Anything trickier is sent to the AI for a second
   opinion, but the AI can only *recommend* — it never gets the final say.
4. **Suggest a price.** If a similar market already exists, the app just copies its price.
   If not, the AI makes a rough guess based on how much buzz the story is getting, and that
   guess is always clearly labeled as a guess.
5. **Ask a human.** Every single story shows up in a review list for a trader to look at —
   even the ones that got blocked or flagged. The trader can approve it, reject it, or
   approve it anyway with a reason if it was flagged. Nothing goes live without this step.
6. **Watch the competition.** Once a market is live, the app checks it once an hour against
   a made-up competitor price, and flags it if the two prices drift more than 10% apart.

Every single thing the app does — every check, every AI answer, every trader decision — gets
written down in an audit log, so nothing happens quietly in the background.

There's also a diagram of this whole flow at [`docs/workflow-diagram.drawio`](docs/workflow-diagram.drawio) — open it at [draw.io](https://app.diagrams.net) if you want a picture instead of words.

## Before you start

You'll need three things installed on your computer:

- **Node.js**, version 22 or newer
- **Docker Desktop**, and it needs to be running
- **An Anthropic API key** (for the Claude AI calls) — get one at [console.anthropic.com](https://console.anthropic.com)

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

That's it — setup is done.

## Starting the app

One command starts everything:

```bash
npm run dev
```

This single command quietly starts a few things at once: a small database system called
Temporal (it runs in Docker and keeps track of each market as it moves through the review
process), a background worker that does the actual AI and rule-checking work, and the
website itself. Give it about 10–20 seconds the first time — Docker needs a moment to warm up.

Once it's ready, open your browser to:

- **[http://localhost:3000](http://localhost:3000)** — the app itself

You'll land on the **Review Queue**, which is empty at first. Click the **Run Discovery
Sweep** button to kick things off — it'll go find some stories, check them, price them, and
drop them into the list for you to review.

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

- **Review Queue** (`/`) — every story the app has found, with its reasoning, its suggested
  price, and buttons to approve, reject, or override it.
- **Price Monitoring** (`/monitoring`) — shows every market that's gone live, next to a
  made-up competitor price. Click **Simulate hourly check** to run a comparison right now
  instead of waiting for the hourly schedule.
- **Audit Log** (`/audit`) — a running list of everything the app has done, searchable.

If you want to see exactly what's asked of the AI, every prompt lives in one file, written
out in plain text: [`lib/ai/prompts.ts`](lib/ai/prompts.ts).

## Running the checks

There's a small test script that checks the important rules still work correctly:

```bash
npm run eval
```

## What's real and what's made up

Everything here is fake, on purpose — the news stories, the social posts, the prices, the
company rules. Nothing is connected to a real news source, a real exchange, or any real
company system. There's also no login system and no support for multiple people using it
at once — it's built to be looked at and clicked through by one person at a time.

## A quick map of the code

```
app/            The website — pages and API routes. No business logic lives here.
lib/
  deterministic/  Plain rules and lookups. No AI involved.
  ai/             Every place the app talks to Claude. prompts.ts has every prompt.
  db.ts           The database — where everything gets saved.
temporal/       Keeps track of each market's journey and pauses it until a trader decides.
data/fixtures/  All the made-up sample data.
evals/          The test script mentioned above.
```
