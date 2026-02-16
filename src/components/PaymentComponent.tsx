import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

interface PaymentComponentProps {
    onSuccess: () => void;
}

export const PaymentComponent = ({ onSuccess }: PaymentComponentProps) => {
    // Replace with actual Client ID from user later
    const initialOptions = {
        clientId: "ATczEUH_l-1UBXARVkUhdE7xHNZgNPicnMLwyDwnxlWW06CTJYnuIoAF_hUXijrgdbUHiW6jTdYGPspn",
        currency: "USD",
        intent: "capture",
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-gray-800">Unlock Premium Sounds</h3>
            <PayPalScriptProvider options={initialOptions}>
                <PayPalButtons
                    style={{ layout: "horizontal" }}
                    createOrder={(_data, actions) => {
                        return actions.order.create({
                            intent: "CAPTURE",
                            purchase_units: [
                                {
                                    amount: {
                                        currency_code: "USD",
                                        value: "1.99",
                                    },
                                    description: "Zen-Pop Premium Sound Pack",
                                },
                            ],
                        });
                    }}
                    onApprove={async (_data, actions) => {
                        if (actions.order) {
                            const details = await actions.order.capture();
                            const payerName = details.payer?.name?.given_name || "Guest";
                            console.log("Transaction completed by " + payerName);
                            onSuccess();
                        }
                    }}
                />
            </PayPalScriptProvider>
        </div>
    );
};
