import jose from 'jose';

const DEFAULT = [
	{
		kty: 'RSA',
		bitlength: 2048,
		parameters: { use: 'sig'}
	},
	{
		kty: 'RSA',
		bitlength: 2048,
		parameters: { use: 'enc' }
	},
	{
		kty: 'EC',
		crv: 'P-256',
		parameters: { use: 'sig' }
	},
	{
		kty: 'EC',
		crv: 'P-256',
		parameters: { use: 'enc' }
	},
	{
		kty: 'OKP',
		crv: 'Ed25519',
		parameters: { use: 'sig' }
	}
];

export default {
    async write (codes = DEFAULT) {
        try {
            const keystore = new jose.JWKS.KeyStore();
            for(let i = 0; i < codes.length; i++) {
                await keystore.generate(codes[i].kty, codes[i].bitlength || codes[i].crv, codes[i].parameters);
            }
            const output = JSON.parse(JSON.stringify(keystore.toJWKS(true))).keys;
            return output;
        } catch (error) {
            throw error;
        }
    }
}