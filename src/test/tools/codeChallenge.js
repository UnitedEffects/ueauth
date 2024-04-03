const crypto = require('crypto');

function base64URLEncode(str) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

function verifierAndChallenge () {
    const verifier = base64URLEncode(crypto.randomBytes(50));
    const challenge = base64URLEncode(sha256(verifier));
    console.info(`VERIFIER: ${verifier}`);
    console.info(`CHALLENGE: ${challenge}`);
}

verifierAndChallenge();