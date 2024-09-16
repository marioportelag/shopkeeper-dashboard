# ShopKeeper Dashboard

A dashboard application built with **Express** and **Node.js** to analyze data from different businesses.

## Requirements

- **Node.js** v14+ (v16+ recommended)
- **NPM** (comes with Node.js installation)

## Installation

Follow these steps to install and run the application locally:

1. Clone this repository to your local machine:

   ```bash
   git clonehttps://github.com/marioportelag/shopkeeper-dashboard.git
   cd repo
   ```

2. Install the required dependencies by running the following command:

   ```bash
   npm install
   ```

   This will install all the necessary packages listed in the `package.json` file, including **Express**, **Handlebars**, **PostgreSQL**, and others.

## Environment Variables

You need to create a `.env` file in the root directory of the project to configure the environment variables required for the app. Ensure the following variables are included:

```bash
# Port for the app to run on
PORT=3000

# PostgreSQL database configuration
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=shopkeeper_db
DB_PORT=5432
```

- **PORT**: The port on which the application will run.
- **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**, **DB_PORT**: PostgreSQL database credentials and connection details.

## Running the Application

Once you've installed the dependencies and configured the environment variables, you can start the application using the following command:

```bash
npm run start
```

This will start the server on the port defined in the `.env` file. If you don't specify a port in the `.env` file, the app will default to port 3000.

## Accessing the Application

After the server is up and running, you can access the application in your browser using the following URL:

```
http://localhost:3000
```

## Available Scripts

- `npm run start`: Starts the server in production mode.

## Contributing

If you would like to contribute to this project, please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature (`git checkout -b new-feature`).
3. Make your changes and commit them (`git commit -am 'Add new feature'`).
4. Push to the branch (`git push origin new-feature`).
5. Open a Pull Request.

---

Thank you for using **ShopKeeper Dashboard**! If you have any questions or need assistance, feel free to reach out to the email marioportelag@gmail.com