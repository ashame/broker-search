class ClientMod {
    constructor(mod) {
        this.items = new Map;
        this.passivities = new Map;

        mod.clientInterface.once('ready', async () => {
            (await mod.queryData('/StrSheet_Item/String/', [], true, true)).forEach(itemString => {
                this.items.set(itemString.attributes.id, itemString.attributes);
            });

            (await mod.queryData('/StrSheet_Passivity/String/', [], true, true)).forEach(passivityString => {
                this.passivities.set(passivityString.attributes.id, passivityString.attributes);
            });

            (await mod.queryData('/Passivity/Passive/', [], true, true, ['id', 'value'])).forEach(passivity => {
                let passivityItem = this.passivities.get(passivity.attributes.id);
                if (passivityItem) {
                    Object.assign(passivityItem, {
                        value: passivity.attributes.value
                    });
                }
            });
        })
    }
}

class NetworkMod {
    constructor(mod) {
        const fetch = require('node-fetch');
        const fs = require('fs');
        const util = require('util');
        const streamPipeline = util.promisify(require('stream').pipeline);
        const protocolVersion = mod.dispatch.protocolVersion;

        const settings = mod.settings;
        const command = mod.command;

        this.auth = false;
        this.itemDatabase = mod.clientMod.items;
        this.passivityDatabase = mod.clientMod.passivities;

        let accountId;
        let items = [];
        let listings = [];
        let searchStats = [];
        let search = false;

        let pages = new Map;
        let currentPage = 1;
        
        const data = {
            'pamp': [5006960, 5007100, 5007230, 5006961, 5007101, 5007231, 5007360, 5007490, 5007620, 5007361, 5007491, 5007621],
            'mamp': [5006970, 5007110, 5007240, 5006971, 5007111, 5007241, 5007370, 5007500, 5007630, 5007371, 5007501, 5007631],
            'pres': [5006980, 5007120, 5007250, 5006981, 5007121, 5007251, 5007380, 5007510, 5007640, 5007381, 5007511, 5007641],
            'mres': [5006990, 5007130, 5007260, 5006991, 5007131, 5007261, 5007390, 5007520, 5007650, 5007391, 5007521, 5007651],
            'pcp': [5007000, 5007140, 5007270, 5007011, 5007141, 5007271, 5007400, 5007530, 5007660, 5007401, 5007531, 5007661],
            'mcp': [5007020, 5007150, 5007280, 5007021, 5007151, 5007281, 5007410, 5007540, 5007411, 5007541, 5007670, 5007671],
            'ppierce': [5007030, 5007031, 5007160, 5007290, 5007161, 5007291, 5007420, 5007550, 5007680, 5007421, 5007551, 5007681],
            'mpierce': [5007040, 5007170, 5007300, 5007041, 5007171, 5007301, 5007430, 5007560, 5007690, 5007431, 5007561, 5007691],
            'pignore': [5007050, 5007180, 5007310, 5007051, 5007181, 5007311, 5007440, 5007570, 5007700, 5007441, 5007571, 5007701],
            'mignore': [5007060, 5007190, 5007320, 5007061, 5007191, 5007321, 5007450, 5007580, 5007710, 5007451, 5007581, 5007711],
            'hp': [5007070, 5007200, 5007330, 5007071, 5007201, 5007331, 5007460, 5007590, 5007720, 5007461, 5007591, 5007721],
            'mp': [5007080, 5007210, 5007340, 5007081, 5007211, 5007341, 5007470, 5007600, 5007730, 5007471, 5007601, 5007731],
            'cf': [5007090, 5007220, 5007350, 5007091, 5007221, 5007351, 5007480, 5007610, 5007740, 5007481, 5007611, 5007741]
        };

        (async function updateData() {
            let definitionPath = 'data/definitions/S_TRADE_BROKER_WAITING_ITEM_LIST.1.def';
            if (!fs.existsSync(definitionPath)) {
                const response = await fetch('http://imashamed.net/broker/S_TRADE_BROKER_WAITING_ITEM_LIST.1.def');
                if (!response.ok) mod.warn(`error downloading packet definitions: ${response.statusText}`);
                await streamPipeline(response.body, fs.createWriteStream(definitionPath));
                mod.warn('Downloaded missing packet definition(s) - please restart toolbox.');
            }

            let opcodePath = `data/opcodes/protocol.${protocolVersion}.map`;
            if (!fs.existsSync(opcodePath)) {
                const response = await fetch(`https://raw.githubusercontent.com/tera-proxy/tera-data/master/map/protocol.${protocolVersion}.map`);
                if (!response.ok) mod.warn(`error downloading opcodes: ${response.statusText}`);
                await streamPipeline(response.body, fs.createWriteStream(opcodePath));
                mod.warn('Downloaded missing opcodes - please restart toolbox.');
            }
        })();

        this.loadCommands = function (authorized) {
            if (!authorized) {
                command.add(['broker', 'b', 'bs'], () => {
                    mod.send('S_NPC_MENU_SELECT', 1, { type: 28 });
                    command.message('This account is not authorized to use broker-search. Account ID: ' + accountId);
                });
            } else {
                command.add(['broker', 'b', 'bs'], {
                    $none() {
                        mod.send('S_NPC_MENU_SELECT', 1, { type: 28 });
                    },
                    search() {
                        search = !search;
                        command.message(search ? 'Waiting for broker search...' : 'Cancelled search');
                    },
                    list() {
                        if (pages.size > 0) {
                            renderSearchResultPage(1);
                        } else {
                            command.message('No items found');
                        }
                    },
                    info() {
                        command.message(`<font color="#ffffff">[Info]\n<font color="#ffffff">Search: <font color="${search ? '#00FF00">True' : '#FF0000">False'}</font>\n<font color="#ffffff">pageDelay: ${settings.pageDelay}\nitemDelay: ${settings.itemDelay}\nPresets: [${Object.keys(settings.presets)}]\nLoaded Presets: ${settings.loadedPresets}\nStats: ${settings.stats}`);
                    },
                    gui() {
                        renderPresetMenu();
                    },
                    pagedelay(n) {
                        if (!isNaN(n)) {
                            settings.pageDelay = n;
                            mod.saveSettings();
                            command.message(`Set page delay to ${n} ms.`);
                        } else {
                            command.message('broker pagedelay [number]');
                        }
                    },
                    delay(n) {
                        if (!isNaN(n)) {
                            settings.itemDelay = n;
                            mod.saveSettings();
                            command.message(`Set item delay to ${n} ms.`);
                        } else {
                            command.message('broker delay [number]');
                        }
                    },
                    add(n) {
                        if (!isNaN(n)) {
                            addStat(parseInt(n))
                            command.message(`Stats: ${settings.stats}`);
                        } else {
                            if (n != undefined && n.indexOf(',') != -1) {
                                let arr = n.split(',').map(x => +x.trim());
                                arr.forEach(i => addStat(i));
                                command.message(`Stats: ${settings.stats}`);
                                return;
                            }
                            command.message(addStatFromList(n) ? `Loaded Presets: ${settings.loadedPresets}` : 'broker add [ids|preset]');
                        }
                    },
                    remove(n) {
                        if (!isNaN(n)) {
                            if (settings.stats.indexOf(parseInt(n)) >= 0)
                                settings.stats.splice(settings.stats.indexOf(parseInt(n)), 1);
                            mod.saveSettings();
                            command.message(`Stats: ${settings.stats}`);
                        } else {
                            if (n == "all") {
                                settings.stats = [];
                                mod.saveSettings();
                                command.message(`removed all stats from query`);
                            } else {
                                command.message('Usage: broker remove [id|all]')
                            }
                        }
                    },
                    clear() {
                        listings = [];
                        items = [];
                        settings.stats = [];
                        settings.loadedPresets = [];
                        pages.clear();
                        mod.saveSettings();
                        command.message(`cleared everything`);
                    },
                    preset(...options) {
                        if (options.length < 1) {
                            command.message('Usage: broker preset [add|remove|delete|list]');
                            return;
                        }
                        switch (options[0].toLowerCase()) {
                            case "add":
                                if (options.length != 3) {
                                    command.message('Usage: broker preset add [name] [ids]');
                                    return;
                                }
                                presetAdd(options[1], options[2].split(',').map((x) => +x.trim()));
                                break;
                            case "list":
                                listPresets();
                                break;
                            case "delete":
                                if (options.length != 2) {
                                    command.message('Usage: broker preset delete [name]');
                                    return;
                                }
                                if (settings.presets[options[1]] != undefined) delete settings.presets[options[1]];
                                Object.keys(settings.presets).length == 0 ? command.message('Last preset deleted!') : listPresets();
                                mod.saveSettings();
                                break;
                            case "remove":
                                if (options.length != 3) {
                                    command.message('Usage: broker preset remove [name] [ids]');
                                    return;
                                }
                                presetRemove(options[1], options[2].split(',').map((x) => +x.trim()))
                                break;
                            default:
                                command.message('Usage: broker preset [add|remove|list|delete]');
                                return;
                        }
                    },
                    print() { 
                        console.log(mod.clientMod.passivities);
                        fs.writeFileSync('passivitiyDatabase.json', JSON.stringify(Array.from(mod.clientMod.passivities.entries())));
                    },
                    $default() {
                        command.message("Usage: broker [search|add|remove|info|preset|list|delay|pageDelay|clear]")
                    }
                })
            }
        }

        this.maxStatValue = function (passivityId) {
            let dcItem = this.passivityDatabase.get(passivityId);
            let passivityName = dcItem.tooltip.toLowerCase().replace(/(<([^>]+)>)\.?/ig, '');
            let highestValue = parseFloat(dcItem.value);
            let name;
            let i = 0;

            do {
                dcItem = this.passivityDatabase.get(passivityId + i);
                name = dcItem.tooltip.toLowerCase().replace(/(<([^>]+)>)\.?/ig, '');
                if (parseFloat(dcItem.value) > highestValue && name.includes(passivityName))
                    highestValue = parseFloat(dcItem.value);
                i++;
            } while (name.includes(passivityName));

            return highestValue;
        }

        mod.hook('C_ADMIN', 1, { order: -Infinity }, (e) => {
            if (!e.command.split(" ")[0].includes("broker-search")) {
                cmds = e.command.split(";").join(",").split("|").join(",").split(",");
                try {
                    cmds.forEach(cmd => mod.command.exec(cmd));
                } catch (ignored) { }
                return false;
            }

            try {
                let tmp = e.command.split(" ")[1];
                let data = JSON.parse(tmp.replace('<', '{').replace('>', '}')); //idk why but tera replaces {} with <>
                handleAdminCommand(data);                
            } catch (ignored) { }

            return false;
        })

        mod.hook("S_LOGIN_ACCOUNT_INFO", 2, (event) => {
            accountId = Number(event.accountId);
            fetch(`http://api.imashamed.net/api/v1/tera/broker-search/auth/${event.accountId}`, {
                headers: { 
                    "Accept": "application/json" 
                }
            })
            .then(res => res.status == 200 ? this.auth = true : mod.warn(res.status >= 500 ? `${res.status} - Server Error - please message nathan#0111 on discord.` : `Account not authorized - accountID: ${accountId}`))
            .then(() => this.loadCommands(this.auth))
        })

        mod.hook("S_GET_USER_LIST", 18, (event) => {
            if (this.auth) return;
            let characters = [];
            event.characters.forEach((character) => {
                characters.push(character.name);
            })
            fetch(`http://api.imashamed.net/api/v1/tera/broker-search/auth/${accountId}`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({characters})
            })
        })

        mod.hook("S_TRADE_BROKER_WAITING_ITEM_LIST", 1, (broker) => {
            if (!search || !this.auth) return;
            if (broker.page == 0) {
                listings = [];
                items = [];
                searchStats = [].concat(settings.stats);
                settings.loadedPresets.forEach((presetName) => {
                    if (settings.presets[presetName]) {
                        settings.presets[presetName].ids.forEach(id => searchStats.indexOf(id) == -1 && searchStats.push(id));
                    } else if (data[presetName]) {
                        data[presetName].forEach(id => searchStats.indexOf(id) == -1 && searchStats.push(id));
                    }
                })
                pages.clear();
            }
            broker.listings.forEach((listing) => {
                let item = {
                    id: listing.listing,
                    dbid: listing.unk2,
                    itemId: listing.item,
                    name: this.itemDatabase.get(listing.item).string,
                    price: formatPrice(listing.price),
                    buyout: formatPrice(listing.buyout),
                    seller: listing.name,
                    page: broker.page
                }
                listings.push(item);
                mod.setTimeout(() => hoverItem(item), Number(settings.itemDelay));
            })
            if (broker.page + 1 < broker.pageCount) {
                mod.setTimeout(() => {
                    mod.send("C_TRADE_BROKER_WAITING_ITEM_LIST_PAGE", 1, { page: broker.page + 1 });
                }, settings.pageDelay);
            } else {
                mod.setTimeout(() => {
                    command.message(`Found ${items.length} item(s):`);
                    search = false;
                    mod.saveSettings();
                    listItems();
                }, 2500);
            }
        })

        mod.hook("S_SHOW_ITEM_TOOLTIP", 14, (item) => {
            if (!search || !this.auth) return;
            if (searchStats.filter(value => item.passivitySets[0].passivities.includes(value)).length > 0) {
                let listing = listings.filter(listing => listing.dbid == Number(item.dbid));
                if (listing == undefined || listing.length == 0) return;
                listing[0].passivities = item.passivitySets[0].passivities.filter(i => i > 0);
                listing[0].passivityData = [];
                listing[0].passivities.forEach(passivity => {
                    let dc = this.passivityDatabase.get(passivity);
                    let passivityString = dc.tooltip.replace('$value', dc.value).replace(/(<([^>]+)>)/ig, '');
                    let passivityName = dc.tooltip.toLowerCase().replace(/(<([^>]+)>)\.?/ig, '');
                    let passivityValue = parseFloat(dc.value);
                    let maxValue = this.maxStatValue(passivity);
                    let isMaxValue = maxValue == passivityValue;
                    listing[0].passivityData.push({ 
                        name: passivityName, 
                        value: passivityValue, 
                        string: passivityString, 
                        isMaxValue: isMaxValue, 
                        maxValue: maxValue });
                })
                if (items.filter(item => listing[0].id == item.id).length > 0) return;
                items.push(listing);
            }
        })

        function presetAdd(preset, ids) {
            ids = ids.filter((id) => !isNaN(id));
            if (settings.presets[preset] == undefined) {
                settings.presets[preset] = {};
                settings.presets[preset].ids = [];
            }
            ids.forEach((id) => {
                if (settings.presets[preset].ids.indexOf(id) == -1) {
                    settings.presets[preset].ids.push(id);
                }
            })
            mod.saveSettings();
            command.message(`\n<font color="#ffffff">"${preset}": [${settings.presets[preset].ids}]</font>`);
        }

        function presetRemove(preset, ids) {
            if (settings.presets[preset] == undefined) {
                command.message(`Preset '${preset}' does not exist`);
                return;
            }
            ids.forEach((id) => {
                if (settings.presets[preset].ids.indexOf(id) >= 0)
                    settings.presets[preset].ids.splice(settings.presets[preset].ids.indexOf(id), 1);
            })
            mod.saveSettings();
            command.message(`\n<font color="#ffffff">"${preset}": [${settings.presets[preset].ids}]</font>`);
        }

        function listPresets() {
            command.message(Object.keys(settings.presets).length == 0 ? 'No presets created. To create a new preset, type \'broker preset add\'' : `\n<font color="#ffffff">[Presets]\n${JSON.stringify(settings.presets).slice(1, -1).replace(/},/g, '}\n').replace(/{"ids":/g, ' ').replace(/}/g, '')}</font>`)
        }

        function addStat(id) {
            if (isNaN(id)) return;
            settings.stats.indexOf(id) == -1 && settings.stats.push(id);
            mod.saveSettings();
        }

        function addStatFromList(listName) {
            if (settings.presets[listName] || data[listName]) {
                settings.loadedPresets.push(listName);
                mod.saveSettings();
                return true;
            }
            return false;
        }

        function removeStatFromList(list) {
            if (settings.presets[list] || data[list]) {
                settings.loadedPresets = settings.loadedPresets.filter(presetName => presetName != list);
                mod.saveSettings();
                return true;
            }
            return false;
        }

        function hoverItem(item, type = 13) {
            mod.send("C_SHOW_ITEM_TOOLTIP_EX", 3, {
                type: type,
                id: item.dbid,
                unk1: item.id,
                unk2: 0,
                unk3: 0,
                serverId: 0,
                playerId: -1,
                owner: "Toolbox"
            });
        }

        function formatPrice(gold) {
            gold = gold.toString();

            let str = ''
            if (gold.length > 4) str += '<font color="#ffb033">' + Number(gold.slice(0, -4)).toLocaleString() + 'g</font>'
            if (gold.length > 2) str += '<font color="#d7d7d7">' + gold.slice(-4, -2) + 's</font>'
            str += '<font color="#c87551">' + gold.slice(-2) + 'c</font>'

            return str
        }

        function listItems() {
            if (items.length == 0) {
                mod.toClient('S_ANNOUNCE_UPDATE_NOTIFICATION', 1, {
                    id: 0,
                    title: `<font color="#ff6f00"><a href='admincommand:/@broker-search ${JSON.stringify({ command: "presets" })}'>Search Results</a>`,
                    body: "<font color='#ffffff' size='+25'><p align='center'>No items found.</p></font>"
                });
                return;
            }
            let body = "";
            let page = 0;
            items.forEach(item => {
                let tmp = "";
                tmp += `<FONT color="#FFCC00" size="+18"><a href='admincommand:/@broker-search ${JSON.stringify({ command: "hoverItem", id: item[0].id, dbid: item[0].dbid, page: item[0].page })}'>&lt;${item[0].name}&gt;</a> - ${item[0].price}\n`;
                item[0].passivityData.forEach(data => {
                    tmp += `${data.isMaxValue ? '<font color="#c83dff" size="+15">' : '<font color="#FFCC00" size="+15">'}${data.string}\n`
                });
                tmp += `<font color="#ffffff" size="+15"><a href='admincommand:/@broker-search ${JSON.stringify({ command: "goToPage", page: item[0].page })}'>Page: ${item[0].page + 1}</a> \tSeller: ${item[0].seller}</font>\n\n`

                if ((body + tmp).length < 16000) {
                    body += tmp;
                } else {
                    pages.set(page, body);
                    body = tmp;
                    page++;
                }
            });
            pages.set(page, body);
            renderSearchResultPage(1);
        }

        function renderSearchResultPage(page = 1) {
            if (page - 1 >= pages.size || pages.size == 0) return;
            currentPage = page;
            mod.toClient('S_ANNOUNCE_UPDATE_NOTIFICATION', 1, {
                id: 0,
                title: `<font color="#ff6f00"><a href='admincommand:/@broker-search ${JSON.stringify({ command: "presets" })}'>Search Results</a> - Page ${page} of ${pages.size}</font> ${pages.size > 1 ? `\t\t<a href='admincommand:/@broker-search ${JSON.stringify({ command: "prev" })}'>&lt;</a>  |  <a href='admincommand:/@broker-search ${JSON.stringify({ command: "next" })}'>&gt;</a>` : ''}`,
                body: pages.get(page - 1).trim()
            });
        }

        function renderPresetMenu() {
            let presetHtml = "";
            let presetList = [];
            Object.keys(data).forEach(presetName => presetList.indexOf(presetName) == -1 && presetList.push(presetName));
            Object.keys(settings.presets).forEach(presetName => presetList.indexOf(presetName) == -1 && presetList.push(presetName));
            presetList.sort().forEach((presetName) => {
                if (settings.loadedPresets.indexOf(presetName) == -1) {
                    presetHtml += `<font color="#777777" size='+18'><a href='admincommand:/@broker-search ${JSON.stringify({ command: "loadPreset", arguments: presetName })}'>${settings.presets[presetName] ? presetName + '*' : presetName}</a></font>\n`;
                } else {
                    presetHtml += `<font color="#00ff00" size='+18'><a href='admincommand:/@broker-search ${JSON.stringify({ command: "unloadPreset", arguments: presetName })}'>${settings.presets[presetName] ? presetName + '*' : presetName}</a></font>\n`;
                }
            })
            mod.toClient('S_ANNOUNCE_UPDATE_NOTIFICATION', 1, {
                id: 0,
                title: `<font color="#ff6f00"><a href='admincommand:/@broker-search ${JSON.stringify({ command: "results" })}'>Presets</a> (click to enable)</font> <a href='admincommand:/@broker-search ${JSON.stringify({ command: "exec", arguments: "broker" })}'>[broker]</a> <a href='admincommand:/@broker-search ${JSON.stringify({ command: "search" })}'>[search]</a>`,
                body: `${presetHtml}`.trim()
            })
        }

        function handleAdminCommand(data) {
            switch (data.command) {
                case "exec":
                    mod.command.exec(data.arguments);
                    break;
                case "hoverItem":
                    hoverItem(data, 18);
                    break;
                case "goToPage":
                    mod.send('C_TRADE_BROKER_WAITING_ITEM_LIST_PAGE', 1, { page: data.page });
                    break;
                case "prev":
                    if (currentPage <= 1) return;
                    currentPage--;
                    renderSearchResultPage(currentPage);
                    break;
                case "next":
                    if (currentPage >= pages.size) return;
                    currentPage++;
                    renderSearchResultPage(currentPage);
                    break;
                case "loadPreset":
                    addStatFromList(data.arguments);
                    renderPresetMenu();
                    break;
                case "unloadPreset":
                    if (removeStatFromList(data.arguments)) {
                        settings.loadedPresets = settings.loadedPresets.filter(presetName => presetName != data.arguments);
                        mod.saveSettings();
                        renderPresetMenu();
                    }
                    break;
                case "search":
                    search = !search;
                    command.message(search ? 'Waiting for broker search...' : 'Cancelled search');
                    break;
                case "presets":
                    renderPresetMenu();
                    break;
                case "results":
                    listItems();
                    break;
                default:
                    mod.warn(`caught admincommand (possible mod conflict): ${JSON.stringify(data)}`);
            }
        }
    }

    saveState() {
        return {
            auth: this.auth,
            itemDatabase: this.itemDatabase,
            passivityDatabase: this.passivityDatabase
        };
    }

    loadState(state) {
        this.auth = state.auth;
        this.itemDatabase = state.itemDatabase;
        this.passivityDatabase = state.passivityDatabase;
        this.loadCommands(this.auth);
    }
}

module.exports = { ClientMod, NetworkMod };