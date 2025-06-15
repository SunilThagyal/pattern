
import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth"; // Ensure getAuth is imported
// import { getAnalytics } from "firebase/analytics"; // If analytics is needed

// const firebaseConfig = {
//   apiKey: "AIzaSyB0lQyu2t7iVIBAC-xFJc60bTq6HMDhS38",
//   authDomain: "sample-ae266.firebaseapp.com",
//   databaseURL: "https://sample-ae266-default-rtdb.firebaseio.com",
//   projectId: "sample-ae266",
//   storageBucket: "sample-ae266.appspot.com",
//   messagingSenderId: "387363513257",
//   appId: "1:387363513257:web:7b1e260391fddd41145ab8",
//   measurementId: "G-BQ7Y89EH7C"
// };

const firebaseConfig = {
  apiKey: "AIzaSyCnXi_6intu7w9oWwYBnc9KiRYGj-ZccdQ",
  authDomain: "suvi-play.firebaseapp.com",
  databaseURL: "https://suvi-play-default-rtdb.firebaseio.com",
  projectId: "suvi-play",
  storageBucket: "suvi-play.firebasestorage.app",
  messagingSenderId: "406628436936",
  appId: "1:406628436936:web:ea6dc7e2c56d4173ac8efd",
  measurementId: "G-5EVPDLPXLX"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const database = getDatabase(app);
const auth = getAuth(app); // Initialize auth
// const analytics = typeof window !== 'undefined' ? getAnalytics(app) : undefined; // If analytics is needed

export { app, database, auth }; // Export auth

