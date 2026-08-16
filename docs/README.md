# Documentation

Organisation of the folders under `docs/` and the structure expected of the
documents in each.

| folder | holds |
|---|---|
| `architecture/` | how a part of the running system works |
| `measurements/` | dated results, with the scripts that produced them |

## Choosing a document type

An architecture document answers "how does this work now". It describes the
current system and is revised in place as the system changes.

A measurement document answers "what was observed, and under what conditions".
It accumulates dated results, and existing entries remain unchanged as new
results are added.

A change that alters behaviour and was justified by measurement produces both:
the measurement document records the evidence, and the architecture document
describes the resulting design.

## Architecture documents

One file per path or subsystem, named for the area it covers, for example
`tile-and-point-serving.md`. Keep the scope of each file narrow. A file covering
the whole application accumulates unrelated detail and becomes outdated faster
than it is maintained.

Each document covers the following, in order. Headings name the specific
subject, not these labels.

1. **Scope.** What the document covers, and what it excludes.
2. **Structure.** A diagram of the path, in plain text so that it renders in any
   viewer.
3. **Design rationale.** The constraint that drove the design, in one or two
   paragraphs. Reference the relevant measurement folder for evidence. Do not
   quote figures.
4. **Components.** A short section for each part involved.
5. **Configuration reference.** A table mapping each concern to the file that
   defines it.

Describe structure and intent. Do not restate values held in configuration
files, such as cache sizes, timeouts or port numbers. A copied value drifts from
its source, and a reader has no way to tell which is authoritative. State that a
cache is size-capped and omit the cap itself. The configuration table leads the
reader to the current value.

Design decisions that would be lost without explanation are worth recording,
even where they resemble tuning. A worker count chosen for a measured reason
belongs in the document; a timeout does not.

## Measurement documents

One subfolder per investigation, named for its subject, for example
`scanner-latency/`. Each subfolder holds `README.md` together with the scripts
that produced the results, so that any reader can re-run them. Scripts kept
outside the folder are eventually copied into it and then diverge from the
original.

Each document covers the following, in order:

1. **Scope and date.** What was measured, and when.
2. **Environment.** Hardware, service configuration, and anything else that
   makes the results specific to this setup. Without it, results mislead when
   applied to different hardware.
3. **Reproducing.** The exact commands.
4. **Results.** One section per configuration measured.
5. **Findings.** The current interpretation, numbered.
6. **Harness limitations.** What the method does not capture.

Label each result section with the configuration that produced it, for example
"no tile caching" or "with workload isolation", so that a later reader can
attribute every figure to a known state. When a change is measured, retain the
earlier results and place the new ones alongside them, since comparison across
configurations is the document's main purpose.

Findings are rewritten when new results change the interpretation. Results are
not.

Record negative results. A change that was measured and produced no improvement
is the finding most likely to be attempted a second time, and recording it is
what prevents that. State both the outcome and the reason it did not help.

Report what the runs produced, including variance and outliers. Where a metric
is noisy, give the number of runs and the observed spread, not a single
representative figure.
