# Options dialogs

## Scope

Where a user-facing option goes: the Map View dialog or the Settings dialog, both opened from the navigation rail. Covers the rule that sorts an option into one of them. Excludes options that belong to a single tool or window, such as the scanner's layer choice or the Inspector's chart controls, which are in that tool.

## Structure

```
 navigation rail
   |
   +-- Map View  (icon: tune)        options changed while exploring the map
   |
   +-- Settings  (icon: settings)    preferences set once for the application
```

## Sorting rule

One question sorts every option: would someone change it several times in a session, while looking at the map?

- Yes: Map View. These options act on what the map shows or how it moves, and are one click away.
- No: Settings. These are preferences for the whole application, set once.

Two dialogs keep each one short, with the options used while exploring apart from the preferences set once. The rule sorts by how often an option changes. The rotation lock at the poles, a camera setting, is toggled while navigating near a pole, so it is in Map View.

The rail labels match the dialog titles, so a user finds the same name in both places.

## Components

**`SectionNavigation`** declares the rail entries, each with its icon, its rail label, its dialog title and its content. The Map View entry has the id `viewer-option-dialog`.

**`ViewerOptionsSection`** renders the Map View dialog's content: one section per group of options, each option a `CheckboxWithInfo` with an explanation in its info popover.

**Settings** has no content component; its entry in `SectionNavigation` holds placeholder text.

## Configuration reference

| Concern | File |
|---|---|
| Rail entries, labels, dialog titles | `src/components/navigation/SectionNavigation/SectionNavigation.tsx` |
| Map View options | `src/components/navigation/ViewerOptionsSection/ViewerOptionsSection.tsx` |
