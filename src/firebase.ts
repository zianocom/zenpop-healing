import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyA6PvrCiRztQrrimM7XC3uFmUT5i5fzTZs",
    authDomain: "zenpop-healing-service.firebaseapp.com",
    projectId: "zenpop-healing-service",
    storageBucket: "zenpop-healing-service.firebasestorage.app",
    messagingSenderId: "552085670300",
    appId: "1:552085670300:web:8e06c224fa01009d376059"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
