const config = {
    "credentials": {
        "sampleCredential": {
            "username": "<sample username>",
            "password": "<sample password>"
        }
    },
    "servers": {
        "ServerGroup": {
            "srv1": {
                "url": "https://<sample log server url>/path/",
                "label": "Server 1",
                "credentialId": "sampleCredential",
                "color": "#4299e1"
            },
            "srv2": {
                "url": "https://<sample log server url>/path/",
                "label": "Server 2",
                "credentialId": "sampleCredential",
                "color": "#48bb78"
            }
        }
    }
}

module.exports = { config };