const servers = [
    "customers-is",
    "demat",
    "services",
    "filers"
];
const environments = [
    "p",
    "pp"
];
const regions = {
    "sbg5-01": {
        "label": "SBG5",
        "color": "#4299e1"
    },
    "gra5-01": {
        "label": "GRA5",
        "color": "#48bb78"
    }
};

const config = {
    "credentials": {
        "bimedia": {
            "username": process.env.ORISHA_LDAP_USERNAME || null,
            "password": process.env.ORISHA_LDAP_PASSWORD || null
        }
    },
    // Build the servers configuration synchronously
    "servers": (() => {
        const serverConfigs = {};
        servers.forEach(server => {
            environments.forEach(env => {
                const key = `${server}-${env}`;
                serverConfigs[key] = (() => {
                    const regionConfigs = {};
                    Object.keys(regions).forEach(region => {
                        const regionConfig = regions[region];
                        regionConfigs[region] = {
                            "url": `https://${server}-hor-${env}-${region}.bimedia-it.com/logs/`,
                            "label": regionConfig.label,
                            "credentialId": "bimedia",
                            "color": regionConfig.color
                        };
                    });
                    return regionConfigs;
                })()
            });
        });
        return serverConfigs;
    })()
};
module.exports = { config };