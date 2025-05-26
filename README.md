# Server Log Aggregator

The Server Log Aggregator is a tool designed to aggregate, analyze, and compare logs from multiple servers. It provides a web-based interface to navigate through logs, detect sensitive data, and visualize differences across servers.

## Features

- **Log Aggregation**: Fetch logs from multiple servers and display them in a unified view.
- **Sensitive Data Detection**: Automatically scan logs for sensitive information like passwords, API keys, and emails.
- **Breadcrumb Navigation**: Easily navigate through directories and files with a breadcrumb interface.
- **Search and Highlight**: Perform regex-based searches and highlight matching log entries.
- **File Size Warnings**: Warn users about large files before loading them.
- **Authentication**: Secure access to servers using credentials.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/server-log-aggregator.git
   ```

2. Navigate to the project directory:
   ```bash
   cd server-log-aggregator
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a configuration file:
   - Copy the sample configuration:
     ```bash
     cp src/config.sample.json conf/<your-config-name>.json
     ```
   - Edit the configuration file to include your server details and credentials.

5. Start the application:
   ```bash
   npm start <your-config-name>
   ```

## Usage

1. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

2. Log in using the required credentials.

3. Use the `/path` route to browse directories and compare logs.

4. Use the `/view` route to view and analyze individual log files.

5. Use the `/api` routes for programmatic access to log data.

## API Endpoints

- `GET /api/path/*`: Retrieve aggregated logs for a directory.
- `GET /api/view/*`: Retrieve the content of a specific log file.
- `GET /api/scan/*`: Scan a log file for sensitive data.

## Development

To start the application in development mode with live reloading:
```bash
npm run dev <your-config-name>
```

## Configuration

The configuration file should include:
- **Credentials**: Usernames and passwords for server access.
- **Servers**: Server URLs, labels, and optional colors for UI representation.

Refer to `src/config.sample.json` for an example.

### Placement and Naming

- Place your configuration file in the `conf` directory at the root of the project.
- Name the file with a descriptive identifier, such as `production.json` or `development.json`.
- Ensure the file name matches the argument passed to the `npm start` or `npm run dev` commands.

For example:
```bash
npm start production
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Description of changes"
   ```
4. Push to your branch:
   ```bash
   git push origin feature-name
   ```
5. Open a pull request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## Contact

For questions or feedback, please contact [your-email@example.com].
