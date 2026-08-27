import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFgyr_UHVcDP2sK1YUNottcwMh1D41zqc",
  authDomain: "catalogo-stock-e9c38.firebaseapp.com",
  projectId: "catalogo-stock-e9c38",
  storageBucket: "catalogo-stock-e9c38.firebasestorage.app",
  messagingSenderId: "874931789450",
  appId: "1:874931789450:web:9aefee74d5b397341d1773"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
