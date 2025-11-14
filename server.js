// A simple Express server to handle cryptographic signing
const express = require('express');
const { Wallet, utils } = require('ethers');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// --- CRITICAL SECURITY STEP ---
// The private key MUST be loaded from an environment variable (e.g., in Vercel or AWS Lambda)


const VERIFIER_PRIVATE_KEY = process.env.VERIFIER_PRIVATE_KEY;




if (!VERIFIER_PRIVATE_KEY) {
    console.error("FATAL: VERIFIER_PRIVATE_KEY environment variable is not set.");
    // Exiting prevents the service from running without the key
    process.exit(1);5000000000000000000
}

// Initialize the wallet once at startup
const wallet = new Wallet(VERIFIER_PRIVATE_KEY);

// Endpoint called by the n8n HTTP Request node
// It receives pre-verified data and returns the signature.
app.post('/api/sign-claim', async (req, res) => {
    try {
        // Data received from the n8n workflow (already verified in n8n)
        const { userId, recipient, amount, rawClaimId } = req.body;

        if (!userId || !recipient || !amount || !rawClaimId) {
            return res.status(400).send({ error: "Missing required parameters (userId, recipient, amount, or rawClaimId)." });
        }


        //  Hash the raw string into the required bytes32 format
        // This is the equivalent of keccak256(rawClaimId)
        const claimIdBytes32 = utils.id(rawClaimId);

        // 1. Encode the Message to match the Solidity contract's expected packed data
        // Order: ['string', 'address', 'uint256', 'bytes32']
        // This must be identical to the packing logic in the _getMessageHash function.
        const encodedMessage = utils.solidityPack(
            ['string', 'address', 'uint256', 'bytes32'],
            [userId, recipient, amount, claimIdBytes32]
        );

        const messageHash = utils.keccak256(encodedMessage);

        // 2. Sign the message hash using the verifier's private key
        const signature = await wallet.signMessage(utils.arrayify(messageHash));

        // 3. Return the signature to n8n
        console.log(`Generated signature for userId: ${userId}, recipient: ${recipient}, amount: ${amount}, claimId: ${rawClaimId}`);
        console.log(`Signature: ${signature}`);
        res.status(200).send({ signature });

    } catch (error) {
        console.error("Signing Error:", error);
        res.status(500).send({ error: "Internal signing service failure." });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Signing Service running on port ${PORT}`);
});
