# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)


# 🗺️ Google Places Explorer

A modern React application that integrates Google Places Autocomplete with interactive maps, built with Redux Saga for advanced state management.

## ✨ Features

- 🔍 **Real-time Place Search** - Google Places Autocomplete with debounced search
- 🗺️ **Interactive Maps** - Google Maps integration with place markers
- 📚 **Search History** - Persistent search history with Redux state management
- 🎯 **Advanced State Management** - Redux Saga for complex async flows
- 📱 **Responsive Design** - Mobile-first design with Tailwind CSS
- ⌨️ **Keyboard Navigation** - Full accessibility support
- 🔄 **Error Handling** - Comprehensive error boundaries and user feedback

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern functional components with hooks
- **Redux Toolkit** - Simplified Redux state management
- **Redux Saga** - Advanced async flow control and side effects
- **Tailwind CSS** - Utility-first CSS framework
- **Google Maps JavaScript API** - Maps and Places integration

### Patterns & Practices
- **Functional Components** - Modern React with hooks
- **Custom Hooks** - Reusable logic with `usePlaces`, `useDebounce`, `useGoogleMaps`
- **ES6+ Features** - Arrow functions, destructuring, async/await
- **Error Boundaries** - Robust error handling
- **Performance Optimization** - Memoization and debouncing

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ and npm 6+
- Google Maps API key with Places API enabled

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/google-places-redux-saga.git
cd google-places-redux-saga

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Google Maps API key to .env

# Start development server
npm start