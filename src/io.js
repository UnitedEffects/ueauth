export default {
    async respond (res, output) {
        const status = output.statusCode;
        delete output.statusCode;
        return res.status(status || 200).json(output);
    },
    pOK(data='OK', type='object') {
        return {
            statusCode: 200,
            type,
            data
        }
    },
    pCreated(data='Created', type='object') {
        return {
            statusCode: 201,
            type,
            data
        }
    },
    pNoContent(data='No Content', type='object') {
        return {
            statusCode: 204,
            type,
            data
        }
    },
    pAccepted(data='Accepted', type='object') {
        return {
            statusCode: 202,
            type,
            data
        }
    },
    pPartial(data='Partial Content', type='object') {
        return {
            statusCode: 206,
            type,
            data
        }
    },
    prepare(statusCode, data, type, error, message) {
        return {
            statusCode,
            type,
            data,
            error,
            message
        };
    }
}