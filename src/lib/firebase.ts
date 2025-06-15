
import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics"; // Updated import

const firebaseConfig = {
  apiKey: "AIzaSyCnXi_6intu7w9oWwYBnc9KiRYGj-ZccdQ",
  authDomain: "suvi-play.firebaseapp.com",
  databaseURL: "https://suvi-play-default-rtdb.firebaseio.com",
  projectId: "suvi-play",
  storageBucket: "suvi-play.appspot.com", // Corrected storageBucket
  messagingSenderId: "406628436936",
  appId: "1:406628436936:web:ea6dc7e2c56d4173ac8efd",
  measurementId: "G-5EVPDLPXLX"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const database = getDatabase(app);
const auth = getAuth(app);
let analytics;

if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, database, auth, analytics };
