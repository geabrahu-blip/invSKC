import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAt6sKXrnU8d3tzClUIFBLlzETYM-lFYc4",
  authDomain: "bodega-skc.firebaseapp.com",
  projectId: "bodega-skc",
  storageBucket: "bodega-skc.firebasestorage.app",
  messagingSenderId: "522402556850",
  appId: "1:522402556850:web:2b30a40e23f0482211d2ab"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
