import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-Z-iOLagPr_lQMq87eQ_doqOLIfssxGs",
  authDomain: "inventario-perfumes.firebaseapp.com",
  projectId: "inventario-perfumes",
  storageBucket: "inventario-perfumes.firebasestorage.app",
  messagingSenderId: "712235668233",
  appId: "1:712235668233:web:a616ad967df32199ff79d8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
