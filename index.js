const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS ও Body Parser মিডলওয়্যার
app.use(cors());
app.use(express.json());

// Render Environment Variables (Secrets) থেকে ভ্যালু নেওয়া হবে
const TON_API_KEY = process.env.TON_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

// রুট হেলথ-চেক রাউট
app.get('/', (req, res) => {
    res.send('TON Payment Verification Server is Live!');
});

// পেমেন্ট ভেরিফিকেশন রাউট
app.get('/verify-payment', async (req, res) => {
    const { txHash, expectedAmount } = req.query;

    if (!txHash || !expectedAmount) {
        return res.status(400).json({ 
            success: false, 
            message: 'TxHash এবং expectedAmount উভয় তথ্যই প্রদান করতে হবে।' 
        });
    }

    if (!TON_API_KEY || !WALLET_ADDRESS) {
        return res.status(500).json({ 
            success: false, 
            message: 'সার্ভারে TON_API_KEY বা WALLET_ADDRESS কনফিগার করা নেই।' 
        });
    }

    try {
        // TON API তে ট্রানজেকশন হ্যাশ দিয়ে রিকোয়েস্ট
        const response = await axios.get(`https://tonapi.io/v2/blockchain/transactions/${txHash}`, {
            headers: {
                'Authorization': `Bearer ${TON_API_KEY}`
            }
        });

        const data = response.data;

        if (data && data.success) {
            let receivedAmount = 0;
            let recipientMatched = false;

            // ইনকামিং মেসেজ ডাটা ফিল্টারিং
            if (data.in_msg) {
                const destination = data.in_msg.destination ? data.in_msg.destination.address : '';
                
                // আপনার ওয়ালেটে টাকা এসেছে কিনা তা নিশ্চিত করা
                if (destination.toLowerCase() === WALLET_ADDRESS.toLowerCase()) {
                    recipientMatched = true;
                    // Nanoton/Units থেকে TON বা USDT পরিমাণে রূপান্তর (1 TON/USDT = 1,000,000,000 Nano Units)
                    receivedAmount = data.in_msg.value / 1000000000; 
                }
            }

            // ভ্যালিডেশন চেক
            if (recipientMatched && receivedAmount >= parseFloat(expectedAmount)) {
                return res.json({ 
                    success: true, 
                    message: 'পেমেন্ট সফলভাবে ভেরিফাই করা হয়েছে!', 
                    receivedAmount: receivedAmount 
                });
            } else if (!recipientMatched) {
                return res.json({ 
                    success: false, 
                    message: 'এই ট্রানজেকশনটি আপনার নির্ধারিত ওয়ালেটে আসেনি।' 
                });
            } else {
                return res.json({ 
                    success: false, 
                    message: `টাকার পরিমাণ অপূর্ণ। প্রয়োজন: ${expectedAmount}, পাওয়া গেছে: ${receivedAmount}` 
                });
            }
        } else {
            return res.json({ 
                success: false, 
                message: 'ইনভ্যালিড অথবা অসফল ট্রানজেকশন।' 
            });
        }

    } catch (error) {
        console.error('Blockchain Verification Error:', error.response ? error.response.data : error.message);
        
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ 
                success: false, 
                message: 'ব্লকচেইনে এই ট্রানজেকশন আইডির কোনো ডাটা পাওয়া যায়নি।' 
            });
        }

        return res.status(500).json({ 
            success: false, 
            message: 'সার্ভার ভেরিফিকেশন সমস্যা। অনুগ্রহ করে আবার চেষ্টা করুন।' 
        });
    }
});

// Render Dynamic Port Bind
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server environment loaded. Running on port ${PORT}`);
});
