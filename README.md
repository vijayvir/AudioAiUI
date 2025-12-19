# 🗣️ AI Speech-to-Text & Sentiment Analyzer

A modern, full-stack application for real-time live transcription, file processing, and AI-driven sentiment analysis. This project features a React frontend that streams audio data to a FastAPI backend for instant insights.

---

## ✨ Features

* **🎙️ Live Transcription:** Stream audio from your microphone via **WebSockets** with instant text feedback.
* **📁 Batch File Processing:** Upload audio or video files for high-accuracy transcription with a simulated progress tracker.
* **🧠 Sentiment Analysis:** Real-time emotional tone detection (Positive, Neutral, Negative) with distribution mapping.
* **📝 AI Summarization:** Generate concise summaries of long conversations at the click of a button.
* **💾 Multi-Format Export:** Download your results in `.txt`, `.docx`, `.pdf`, or `.srt` formats bundled in a `.zip` file.
* **🌓 Adaptive UI:** Sleek Dark and Light mode support with local storage persistence.
* **📈 Visual Waveform:** Real-time audio level visualization during recording sessions.

---

## 🚀 How it Works

The application performs sophisticated audio signal processing directly in the browser:

1.  **Audio Capture:** The app requests microphone access via the `getUserMedia` API at a sample rate of **16,000Hz**.
2.  **Signal Processing:** Captures raw audio via a `ScriptProcessorNode` in 4096-sample chunks.
3.  **Data Conversion:** Converts **Float32** samples into **16-bit Signed PCM** bytes to ensure backend compatibility and optimized bandwidth.
4.  **Auto-Scrolling:** The transcript panel uses React `useRef` and `useEffect` hooks to automatically track the conversation flow.

---

## 🛠️ Technical Stack

* **Frontend:** React.js (Functional Components, Hooks, and Refs)
* **Audio Engine:** Web Audio API (AnalyserNode, AudioContext)
* **Communication:** WebSockets (Real-time Streaming) & REST (Multipart File Uploads)
* **Styling:** CSS3 Custom Properties (CSS Variables) for dynamic theming.

---

## ⚙️ Setup & Installation

### 1. Environment Configuration
Create a `.env` file in the root directory and update the URLs to match your local or deployed backend:

```env
REACT_APP_API_URL=[http://127.0.0.1:8000](http://127.0.0.1:8000)
REACT_APP_WEBSOCKET_URL=ws://127.0.0.1:8000/ws


# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes. You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.

See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.

It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes. Your app is ready to be deployed!

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
