import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
// import { getAuth } from "firebase/auth"; // If auth is needed later
// import { getAnalytics } from "firebase/analytics"; // If analytics is needed

const firebaseConfig = {
  apiKey: "AIzaSyB0lQyu2t7iVIBAC-xFJc60bTq6HMDhS38",
  authDomain: "sample-ae266.firebaseapp.com",
  databaseURL: "https://sample-ae266-default-rtdb.firebaseio.com",
  projectId: "sample-ae266",
  storageBucket: "sample-ae266.appspot.com",
  messagingSenderId: "387363513257",
  appId: "1:387363513257:web:7b1e260391fddd41145ab8",
  measurementId: "G-BQ7Y89EH7C"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const database = getDatabase(app);
// const auth = getAuth(app); // If auth is needed
// const analytics = typeof window !== 'undefined' ? getAnalytics(app) : undefined; // If analytics is needed

export { app, database };
