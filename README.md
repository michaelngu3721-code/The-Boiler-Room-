# NASA Combustion Research Dashboard

The developer created the primary framework as well as the bridges
between the modules. The rest of the script was primarily written
by SI. 

Imagery in the "Environment Comparison" module was produced by SI.
The candle light images were created by SI, but that is inherent to
be able to modify the flame accordingly. Our knight mascot image was
produced by Johnny Trinh.

The dashboard combines an illustrative gravity visualizer, an environment
comparison, and a browser for NASA Physical Sciences Informatics (PSI)
combustion investigations. The investigation explorer loads records directly
from NASA PSI; no data file or account is needed.

## Requirements

- Python 3.12 or newer and [`uv`](https://docs.astral.sh/uv/)
- [Node.js](https://nodejs.org/) with npm
- An OpenAI API key only if you want optional investigation, factor, or
  environment explanations, or the research-gap analysis

## Run locally

Open the project in VS Code and start the API and website in separate
terminals.

**Terminal 1 — API**, from the project folder:

```powershell
uv sync
uv run uvicorn agent.api:app --reload
```

**Terminal 2 — website:**

```powershell
cd web
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Keep both
terminals running while using the site. The API retrieves the combustion
investigation list and selected record from NASA PSI.

## Deploy on Render

The repository includes a Render Blueprint and a Dockerfile for deploying the
website and API as one service. Push the project to a Git provider, then in
Render choose **New → Blueprint** and connect that repository. Render reads
`render.yaml`, builds the frontend, and serves it alongside the API. The
Blueprint uses Render's free service plan and the default `onrender.com` URL.
Free services spin down after 15 minutes without traffic and can take about a
minute to wake up again.

The site can be deployed without an OpenAI key. To enable the optional AI
explanations and research-gap analysis, add `OPENAI_API_KEY` under the service's
environment variables in Render. Do not put the key in the repository.

The dashboard opens in dark mode. Use the theme button in the header to switch
to light mode. All six modules are on one vertically scrolling page; use the
sidebar links to jump to a module or scroll through them in sequence. The
learning path moves from a visual introduction to PSI evidence, recurring
factors, environment comparison, scenario exploration, and research gaps.
The introduction, transition bubbles, and closing section guide the reader
through this learning sequence.

## Explore investigations

Open **PSI investigations**, search or browse the list, and select a record.
Every record uses the same sections for its goal, method, hypothesis,
background, and research impact. If NASA PSI does not provide a field, the
explorer marks it as not provided. Use the record link or the **Sources &
citations** dropdown to open the original source.

**Ask the agent** is optional and only runs when clicked. It restates the
selected record in everyday language; it does not treat a hypothesis as a
proven result or invent missing details. Add an `OPENAI_API_KEY` to a private
`.env` file in the project folder to enable it. Keep the key private: the
explanation uses the OpenAI API and may incur usage charges. Browsing PSI
records does not require an OpenAI key.

## Mission Control

Mission Control is an educational what-if explorer for gravity, oxygen,
temperature, pressure, airflow and direction, material, fuel shape and amount,
ignition, and observed smoke. NASA's BASS-II investigation supports several of
these as experimental variables. The page shows qualitative flame-shape cues,
scenario factors, smoke context, and general safety reminders; it does not
calculate a numerical flame-spread rate, flammability probability, or smoke
amount. It is not for real fire-safety decisions.

The Gravity Lab flame control is a visual illustration, not a validated
combustion simulation.

## Environment comparison

Choose Earth, an ISS-like pressurized cabin, the Moon, or Mars. Selecting an
environment expands its card and asks the agent for a NASA-source-backed
summary of fire-safety implications, with citations and labels distinguishing
direct source statements from cautious habitat extrapolations. The ISS option
means the inhabited cabin; lunar and Martian surface conditions are not the
same as conditions inside a future habitat. This educational comparison is not
emergency or operational fire-response guidance. Selecting an environment

## Research gaps

Open **Research gaps** and choose **Analyze PSI records** to ask the agent for
three possible research directions based on goals, methods, conditions, and
limitations described in the NASA PSI combustion-search sample. The page shows
the number of records reviewed and links the PSI records cited for each
suggestion. The analyzed sample is capped at 40 records if the search returns
more.

These are sample-based hypotheses, not proof that a topic is missing from the
wider scientific literature. A result is labeled as an explicitly stated
limitation only when a PSI record says so; otherwise it is labeled as a sample
coverage observation. Analysis runs only when requested, requires an
`OPENAI_API_KEY`, and may incur usage charges. It is not a substitute for
expert literature review. Selecting an environment
requires an `OPENAI_API_KEY` and may incur API charges.

## Factor chart

The chart counts how often a fixed set of research factors appears in the PSI
keywords and summary fields of records returned by the combustion search. Each
study is counted once per factor. Selecting a bar opens the PSI records behind
its count. Choose **Ask the agent** to get three distinct study-backed points
about the selected factor, including combustion relevance, fire-safety
connections, and what the sources say about suppression tactics. The agent
states when a source does not cover a topic rather than inventing a finding or
recommendation. Explanations run only when requested, require an OpenAI API key,
and may incur usage charges. This is a sample, not a full-text count of every
investigation in the NASA database.

## If `uv sync` cannot create its environment

Some protected or synced folders, including certain OneDrive setups, may block
uv from creating a `.venv` folder. If that happens, set a writable environment
before running `uv sync` or `uv run`. Do this in each PowerShell terminal where
you run a Python command:

```powershell
$env:UV_PROJECT_ENVIRONMENT = Join-Path $env:LOCALAPPDATA 'uv\agent-parameter-env'
uv sync
```
