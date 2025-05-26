const fs = require('fs');
const path = require('path');
const chalk = require('chalk').default; // Add chalk for colored output

// Get the configuration name from the command-line arguments
const configName = process.argv[2] ? `${process.argv[2]}.json`:  null;

if (!configName) {
    console.error(chalk.red('Configuration name must be provided as a command-line argument.'));
    process.exit(1);
}

// Resolve the path to the configuration file
const configPath = path.resolve(__dirname, '../conf', configName);

if (!fs.existsSync(configPath)) {
    const sampleConfigPath = path.resolve(__dirname, 'config.sample.json');
    if (fs.existsSync(sampleConfigPath)) {
        const sampleConfig = JSON.parse(fs.readFileSync(sampleConfigPath, 'utf-8'));
        console.log(chalk.yellow('To create a configuration file, follow these steps:'));
        console.log(chalk.green('1.') + ' Navigate to the "conf" directory located at "../conf" relative to this script.');
        console.log(chalk.green('2.') + ' Create a new JSON file named "<config-name>.json".');
        console.log(chalk.green('3.') + ' Use the following sample structure as a reference:');
        console.log(chalk.blue(JSON.stringify(sampleConfig, null, 4)));
    }
    console.error(chalk.red(`Configuration file "${configName}" not found at ${configPath}`));
    process.exit(1);
}

// Load the configuration file
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Validate the configuration
if (!config.servers || typeof config.servers !== 'object' || Object.keys(config.servers).length === 0) {
    console.error(chalk.red('Invalid configuration: "servers" must be a non-empty object.'));
    process.exit(1);
}
if (!Object.values(config.servers).every(server => server.url && server.label)) {
    console.error(chalk.red('Invalid configuration: Each server must have a "url" and "label".'));
    process.exit(1);
}

// Display a summary of the servers to be used
console.log(chalk.green('Configuration loaded successfully!'));
console.log(chalk.blue('Servers to be used:'));
Object.values(config.servers).forEach(server => {
    console.log(`- ${chalk.bold(server.label)}: ${chalk.underline(server.url)} (${chalk.hex(server.color || '#000000')('color')})`);
});

module.exports = config;