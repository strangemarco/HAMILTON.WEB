// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

// TODO: Replace the following with your app's Firebase project configuration
// 1. Go to console.firebase.google.com
// 2. Create a new project or select an existing one
// 3. Add a web app to the project to get this config object
const firebaseConfig = {
  apiKey: "AIzaSyC1EZ6oghs_2K3zoUSRc2v325yaOSoDfIs",
  authDomain: "respuestohamilton.firebaseapp.com",
  projectId: "respuestohamilton",
  storageBucket: "respuestohamilton.firebasestorage.app",
  messagingSenderId: "372457853032",
  appId: "1:372457853032:web:56420317f53e3ff4da2bdd",
  measurementId: "G-VSYQV7HEZK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
