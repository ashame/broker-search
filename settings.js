"use strict";

const DefaultSettings = {
    pageDelay: 100,
    itemDelay: 40,
    stats: [],
    presets: {},
    loadedPresets: []
};

module.exports = function MigrateSettings(from_ver, to_ver, settings) {
    if (from_ver === undefined) {
        // Migrate legacy config file
        return Object.assign(Object.assign({}, DefaultSettings), settings);
    } else if (from_ver === null) {
        // No config file exists, use default settings
        return DefaultSettings;
    } else {
        if (to_ver - from_ver > 1) {
            settings = MigrateSettings(from_ver, from_ver + 1, settings);
            return MigrateSettings(from_ver + 1, to_ver, settings);
        }

        switch (to_ver) {
            case 2: 
                return Object.assign(settings, {loadedPresets: []});
            default:
                throw new Error('Error updating settings, please delete config.json / make a backup and restart toolbox');
        }
    }
};