import { db } from "../firebase";
import { doc, updateDoc, increment, setDoc, onSnapshot } from "firebase/firestore";

const STATS_DOC_REF = doc(db, "global_stats", "main");

export const incrementGlobalPops = async (amount: number) => {
    try {
        await updateDoc(STATS_DOC_REF, {
            total_pops: increment(amount)
        });
    } catch (e) {
        // If doc doesn't exist, create it (lazy init)
        try {
            await setDoc(STATS_DOC_REF, { total_pops: amount }, { merge: true });
        } catch (innerError) {
            console.error("Failed to update global pops", innerError);
        }
    }
};

export const subscribeToGlobalPops = (callback: (count: number) => void) => {
    return onSnapshot(STATS_DOC_REF, (doc) => {
        if (doc.exists()) {
            callback(doc.data().total_pops || 0);
        } else {
            callback(0);
        }
    });
};
