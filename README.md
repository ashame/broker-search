# broker-search [![discord](https://img.shields.io/badge/discord-msg-333333.svg?colorA=253B80&colorB=333333)](https://discordapp.com/users/89571774471086080)

TERA Toolbox module for finding your gear rolls on broker

## Installation

- Create a folder called `broker-search` in `TeraToolbox/mods` and download [`module.json`](https://git.imashamed.net/nathan/broker-search/raw/master/module.json) into the folder (right click -> save link as)
  
## Example Usage

- __`broker remove all`__
  - Clear list prior to populating new query

- __`broker add pcp`__
  - Adds physical crit power rolls to query

- __`broker add pamp`__
  - Adds physical amplification rolls to query

- __`broker search`__
  - Prepares script for broker search
  - **You still need to manually search for your item at this point**

## Presets

[`Warlord Accessory / Infusion IDs`](http://imashamed.net/stats.html)
[`Exodor Gear IDs`](http://imashamed.net/stats2.html)

Presets can be used to customize 'loadouts' for quick loading / switching between ID sets.

Presets are created using `broker preset add [name] [ids]` command, where `[name]` is a custom name of your choice, and `[ids]` can be either a single or list of IDs to add to the preset. ID lists for this module will always be in the format (#######,#######,#######) for input purposes.

You can load presets via `broker add [preset]` - note that preset names which overlap with existing builtins (e.x. pcp, cf, pamp) will **override** the builtin lists.

Removing IDs from existing presets can be done with the `broker preset remove [name] [ids]` command. This will remove one or multiple IDs from `[name]` preset, and **the process is irreversible.**

Similarly, you can delete an entire preset with `broker preset delete [name]`. This action completely deletes the preset from your configuration, and **is an irreversible process.**

At any given time, you can view all custom-made presets and their contents with the `broker preset list` command.

### Preset Example #1

- __`broker preset add weapon-pamp 5005650,5005651,5005652,5005653,5005654`__
  - Creates new preset named `weapon-pamp` with ids `5005650,5005651,5005652,5005653,5005654`

- __`broker add weapon-pamp`__
  - Adds ids from `weapon-pamp` to query

- __`broker search`__
  - Prepares script for broker search
  - **You still need to manually search for your item at this point**

### Preset Example #2

- __`broker preset add pcp 5007011,5007141,5007271`__
  - Creates new preset named `pcp` with ids `5007011,5007141,5007271`
  - Note that because this overlaps with a builtin preset, this will **override** said builtin

- __`broker add pcp`__
  - Because we just created a custom preset `pcp` which overrides the builtin, this will load IDs from our custom preset `pcp`

- __`broker search`__
  - Prepares script for broker search
  - **You still need to manually search for your item at this point**

## Commands

- __`broker`__
- __`b`__
- __`bs`__

### Arguments

- __`open`__
  - opens trade broker window
- __`search`__
  - toggles search on next broker query
- __`list`__
  - lists results from previous search
- __`info`__
  - displays verbose information about the script
- __`pagedelay`__
  - `[ms]` : adjusts delay between flipping through broker pages
- __`delay`__
  - `[ms]` : adjusts delay between querying item stats
- __`add`__
  - `[id]` : adds ID to list of stats to search for [`Full list here`](http://imashamed.net/stats.html)
    - this can also be an array of IDs in the format (#######,#######,#######)
  - `[preset]` : adds IDs from custom preset to search query - **custom presets with the same name override builtin presets**
  - `pamp` : adds best two Physical Amplification rolls to search query
  - `mamp` : adds best two Magic Amplification rolls to search query
  - `pcp` : adds best two Physical Crit Power rolls to search query
  - `mcp` : adds best two Magic Crit Power rolls to search query
  - `cf` : adds best two Crit Factor rolls to search query
  - `ppierce` : adds best two Physical Piercing rolls to search query
  - `mpierce` : adds best two Magic Piercing rolls to search query
  - `pres` : adds best two Physical Resistance rolls to search query
  - `mres` : adds best two Magic Resistance rolls to search query
  - `pignore` : adds best two Ignore Physical Resistance rolls to search query
  - `mignore` : adds best two Ignore Magic Resistance rolls to search query
  - `hp` : adds best two HP rolls to search query
  - `mp` : adds best two MP rolls to search query
- __`remove`__
  - `[id]` : removes ID from list of stats to search for
  - `all` : clears list of stats to search for
- __`preset`__ _**NEW**_
  - `list` : Lists all custom presets
  - `add [name] [ids]` : adds `[ids]` to `[name]` preset, or creates a new one if previous doesn't exist
  - `remove [name] [ids]` : removes `[ids]` from `[name]` preset, where ids is a list in format (######,######,######)
  - `delete [name]` : *deletes* preset with `[name]`
- __`clear`__
  - Clears previous search results

## Changelog

```diff
v1.0.1
+ Unauthorized users will now receieve a message in-game indicating them of their status
+ Unauthorized users will be able to use the base command to open a broker anywhere
+ Added example config file for creating presets outside of game

v1.0.0
+ Initial release
```
