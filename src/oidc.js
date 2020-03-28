const { Provider } = require('oidc-provider');
const configuration = {
    // ... see available options /docs
    clients: [{
        client_id: 'foo',
        client_secret: 'bar',
        redirect_uris: ['http://lvh.me:8080/cb'],
        // + other client properties
    }],
};

export default new Provider('http://localhost:3000', configuration);